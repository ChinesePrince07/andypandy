import { LOD_LEVELS } from './constants'
import type { WebGLImageViewerProps } from './interface'
import {
  createShader,
  FRAGMENT_SHADER_SOURCE,
  VERTEX_SHADER_SOURCE,
} from './shaders'

// WebGL Image Viewer implementation class
export class WebGLImageViewerEngine {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private program!: WebGLProgram
  private texture: WebGLTexture | null = null
  private imageLoaded = false
  private originalImageSrc = ''

  // Transform state
  private scale = 1
  private translateX = 0
  private translateY = 0
  private imageWidth = 0
  private imageHeight = 0
  private canvasWidth = 0
  private canvasHeight = 0

  // Interaction state
  private isDragging = false
  private lastMouseX = 0
  private lastMouseY = 0
  private lastTouchDistance = 0
  private lastDoubleClickTime = 0
  private isOriginalSize = false

  // Touch double-tap detection
  private lastTouchTime = 0
  private lastTouchX = 0
  private lastTouchY = 0
  private touchTapTimeout: ReturnType<typeof setTimeout> | null = null

  // Animation state
  private isAnimating = false
  private animationStartTime = 0
  private animationDuration = 300 // ms
  private startScale = 1
  private targetScale = 1
  private startTranslateX = 0
  private startTranslateY = 0
  private targetTranslateX = 0
  private targetTranslateY = 0
  private lodUpdateSuspended = false // 是否暂停 LOD 更新

  // Throttle state for render
  private renderThrottleId: number | null = null
  private lastRenderTime = 0
  private renderThrottleDelay = 16 // ~60fps

  // LOD (Level of Detail) texture management
  private originalImage: HTMLImageElement | null = null
  private lodTextures = new Map<number, WebGLTexture>() // LOD level -> texture
  private currentLOD = 0
  private lodUpdateDebounceId: ReturnType<typeof setTimeout> | null = null
  private lodUpdateDelay = 200 // ms
  private maxTextureSize = 0 // WebGL maximum texture size

  // Web Worker for LOD processing
  private lodWorker: Worker | null = null
  private pendingLODRequests = new Map<
    string,
    {
      lodLevel: number
      resolve: (texture: WebGLTexture | null) => void
      reject: (error: Error) => void
    }
  >()
  private originalImageBitmap: ImageBitmap | null = null

  // Configuration
  private config: Required<WebGLImageViewerProps>
  private onZoomChange?: (originalScale: number, relativeScale: number) => void
  private onImageCopied?: () => void
  private onLoadingStateChange?: (
    isLoading: boolean,
    message?: string,
    quality?: 'high' | 'medium' | 'low' | 'unknown',
  ) => void
  private onDebugUpdate?: React.RefObject<(debugInfo: any) => void>

  // Bound event handlers for proper cleanup
  private boundHandleMouseDown: (e: MouseEvent) => void
  private boundHandleMouseMove: (e: MouseEvent) => void
  private boundHandleMouseUp: () => void
  private boundHandleWheel: (e: WheelEvent) => void
  private boundHandleDoubleClick: (e: MouseEvent) => void
  private boundHandleTouchStart: (e: TouchEvent) => void
  private boundHandleTouchMove: (e: TouchEvent) => void
  private boundHandleTouchEnd: (e: TouchEvent) => void
  private boundResizeCanvas: () => void

  // 双缓冲纹理管理
  private frontTexture: WebGLTexture | null = null
  private backTexture: WebGLTexture | null = null
  private isPreparingTexture = false
  private pendingTextureSwitch: {
    texture: WebGLTexture
    lodLevel: number
  } | null = null

  // 批量错误检查
  private errorCheckScheduled = false

  // 当前质量和loading状态
  private currentQuality: 'high' | 'medium' | 'low' | 'unknown' = 'unknown'
  private isLoadingTexture = true

  constructor(
    canvas: HTMLCanvasElement,
    config: Required<WebGLImageViewerProps>,
    onDebugUpdate?: React.RefObject<(debugInfo: any) => void>,
  ) {
    this.canvas = canvas
    this.config = config
    this.onZoomChange = config.onZoomChange
    this.onImageCopied = config.onImageCopied
    this.onLoadingStateChange = config.onLoadingStateChange
    this.onDebugUpdate = onDebugUpdate

    // 设置初始loading状态
    this.isLoadingTexture = true
    this.notifyLoadingStateChange(true, 'WebGL 初始化中...')

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false, // 允许软件渲染作为后备
    })
    if (!gl) {
      throw new Error('WebGL not supported')
    }
    this.gl = gl

    // 获取 WebGL 最大纹理尺寸
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)

    // 在移动设备上记录一些有用的调试信息
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      console.info('WebGL Image Viewer - Mobile device detected')
      console.info('Max texture size:', this.maxTextureSize)
      console.info('Device pixel ratio:', window.devicePixelRatio || 1)
      console.info(
        'Screen size:',
        window.screen.width,
        'x',
        window.screen.height,
      )
      console.info('WebGL renderer:', gl.getParameter(gl.RENDERER))
      console.info('WebGL vendor:', gl.getParameter(gl.VENDOR))
    }

    // 初始缩放将在图片加载时正确设置，这里先保持默认值
    // this.scale = config.initialScale

    // Bind event handlers for proper cleanup
    this.boundHandleMouseDown = (e: MouseEvent) => this.handleMouseDown(e)
    this.boundHandleMouseMove = (e: MouseEvent) => this.handleMouseMove(e)
    this.boundHandleMouseUp = () => this.handleMouseUp()
    this.boundHandleWheel = (e: WheelEvent) => this.handleWheel(e)
    this.boundHandleDoubleClick = (e: MouseEvent) => this.handleDoubleClick(e)
    this.boundHandleTouchStart = (e: TouchEvent) => this.handleTouchStart(e)
    this.boundHandleTouchMove = (e: TouchEvent) => this.handleTouchMove(e)
    this.boundHandleTouchEnd = (e: TouchEvent) => this.handleTouchEnd(e)
    this.boundResizeCanvas = () => this.resizeCanvas()

    this.setupCanvas()
    this.initWebGL()
    this.initLODWorker()
    this.setupEventListeners()

    // 初始化完成，清除loading状态
    this.isLoadingTexture = false
    this.notifyLoadingStateChange(false)
  }

  private setupCanvas() {
    this.resizeCanvas()
    window.addEventListener('resize', this.boundResizeCanvas)
  }

  private initLODWorker() {
    try {
      // 创建 LOD Worker
      this.lodWorker = new Worker(new URL('lodWorker.ts', import.meta.url), {
        type: 'module',
      })

      // 监听 Worker 消息
      this.lodWorker.onmessage = (event) => {
        const { type, payload } = event.data

        if (type === 'LOD_CREATED') {
          const { id, imageBitmap, width, height } = payload
          const request = this.pendingLODRequests.get(id)

          if (request) {
            // 在主线程中创建 WebGL 纹理
            const texture = this.createWebGLTextureFromImageBitmap(
              imageBitmap,
              width,
              height,
              request.lodLevel,
            )
            this.pendingLODRequests.delete(id)
            request.resolve(texture)

            // 清理 ImageBitmap
            imageBitmap.close()
          }
        } else if (type === 'LOD_ERROR') {
          const { id, error } = payload
          const request = this.pendingLODRequests.get(id)

          if (request) {
            this.pendingLODRequests.delete(id)
            request.reject(new Error(error))
          }
        }
      }

      this.lodWorker.onerror = (error) => {
        console.error('LOD Worker error:', error)
        // 清理所有待处理的请求
        for (const [_id, request] of this.pendingLODRequests) {
          request.reject(new Error('Worker error'))
        }
        this.pendingLODRequests.clear()
      }
    } catch (error) {
      console.warn(
        'Failed to initialize LOD Worker, falling back to main thread processing:',
        error,
      )
      this.lodWorker = null
    }
  }

  private resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect()
    const devicePixelRatio = window.devicePixelRatio || 1

    // 使用设备像素比来提高清晰度，特别是在高 DPI 屏幕上
    this.canvasWidth = rect.width
    this.canvasHeight = rect.height

    // 设置实际的 canvas 像素尺寸，考虑设备像素比
    const actualWidth = Math.round(rect.width * devicePixelRatio)
    const actualHeight = Math.round(rect.height * devicePixelRatio)

    this.canvas.width = actualWidth
    this.canvas.height = actualHeight
    this.gl.viewport(0, 0, actualWidth, actualHeight)

    if (this.imageLoaded) {
      // 窗口大小改变时，需要重新约束缩放倍数和位置
      this.constrainScaleAndPosition()
      this.render()
      // canvas 尺寸变化时也需要检查 LOD 更新，但在动画期间不更新
      if (!this.lodUpdateSuspended) {
        this.debouncedLODUpdate()
      }
      // 通知缩放变化
      this.notifyZoomChange()
    }
  }

  private initWebGL() {
    const { gl } = this

    // Create shaders
    const vertexShader = createShader(
      gl,
      gl.VERTEX_SHADER,
      VERTEX_SHADER_SOURCE,
    )
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      FRAGMENT_SHADER_SOURCE,
    )

    // Create program
    this.program = gl.createProgram()!
    gl.attachShader(this.program, vertexShader)
    gl.attachShader(this.program, fragmentShader)
    gl.linkProgram(this.program)

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(
        `Program linking failed: ${gl.getProgramInfoLog(this.program)}`,
      )
    }

    gl.useProgram(this.program)

    // Enable blending for transparency
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    // Create geometry (quad that will be transformed to image size)
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ])

    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0])

    // Position buffer
    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    // Texture coordinate buffer
    const texCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)

    const texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord')
    gl.enableVertexAttribArray(texCoordLocation)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)
  }

  async loadImage(url: string) {
    this.originalImageSrc = url
    this.isLoadingTexture = true // 开始加载图片
    this.notifyLoadingStateChange(true, '图片加载中...')
    const image = new Image()
    image.crossOrigin = 'anonymous'

    return new Promise<void>((resolve, reject) => {
      image.onload = async () => {
        try {
          this.imageWidth = image.width
          this.imageHeight = image.height

          // 先设置正确的缩放值，再创建纹理
          if (this.config.centerOnInit) {
            this.fitImageToScreen()
          } else {
            // 即使不居中，也需要将相对缩放转换为绝对缩放
            const fitToScreenScale = this.getFitToScreenScale()
            this.scale = fitToScreenScale * this.config.initialScale
          }

          this.notifyLoadingStateChange(true, '创建纹理中...')
          await this.createTexture(image)
          this.imageLoaded = true
          this.isLoadingTexture = false // 图片加载完成
          this.notifyLoadingStateChange(false)
          this.render()
          this.notifyZoomChange() // 通知初始缩放值
          resolve()
        } catch (error) {
          this.isLoadingTexture = false // 加载失败也要清除状态
          this.notifyLoadingStateChange(false)
          reject(error)
        }
      }

      image.onerror = () => {
        this.isLoadingTexture = false // 加载失败清除状态
        this.notifyLoadingStateChange(false)
        reject(new Error('Failed to load image'))
      }
      image.src = url
    })
  }

  private async createTexture(image: HTMLImageElement) {
    this.originalImage = image
    await this.createOriginalImageBitmap()
    this.initializeLODTextures()
  }

  private async createOriginalImageBitmap() {
    if (!this.originalImage) return

    try {
      // 使用 createImageBitmap 避免阻塞主线程的 getImageData 操作
      this.originalImageBitmap = await createImageBitmap(this.originalImage)
    } catch (error) {
      console.error('Failed to create ImageBitmap:', error)
      this.originalImageBitmap = null
    }
  }

  // 批量错误检查，避免频繁调用 getError
  private scheduleErrorCheck() {
    if (!this.config.debug || this.errorCheckScheduled) return

    this.errorCheckScheduled = true
    requestAnimationFrame(() => {
      this.errorCheckScheduled = false
      const error = this.gl.getError()
      if (error !== this.gl.NO_ERROR) {
        console.error('WebGL error detected:', error)
      }
    })
  }

  // 高性能纹理创建（无错误检查）
  private createTextureOptimized(
    imageBitmap: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas,
    lodLevel: number,
  ): WebGLTexture | null {
    const { gl } = this
    const lodConfig = LOD_LEVELS[lodLevel]

    const texture = gl.createTexture()
    if (!texture) return null

    gl.bindTexture(gl.TEXTURE_2D, texture)

    // 设置纹理参数
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // 根据 LOD 级别选择过滤方式
    if (lodConfig.scale >= 4) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    } else if (lodConfig.scale >= 1) {
      const isPixelArt =
        this.originalImage &&
        (this.originalImage.width < 512 || this.originalImage.height < 512)
      if (isPixelArt) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      }
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }

    // 直接上传纹理数据（无错误检查）
    if (imageBitmap instanceof ImageData) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageBitmap,
      )
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageBitmap as any,
      )
    }

    return texture
  }

  private createWebGLTextureFromImageBitmap(
    imageBitmap: ImageBitmap,
    width: number,
    height: number,
    lodLevel: number,
  ): WebGLTexture | null {
    const lodConfig = LOD_LEVELS[lodLevel]

    try {
      // 使用优化版本的纹理创建（生产模式下跳过错误检查）
      const texture = this.config.debug
        ? this.createTextureWithDebug(imageBitmap, lodLevel)
        : this.createTextureOptimized(imageBitmap, lodLevel)

      if (!texture) {
        console.error(`Failed to create LOD ${lodLevel} texture`)
        return null
      }

      console.info(
        `Created LOD ${lodLevel} texture: ${width}×${height} (scale: ${lodConfig.scale}) from ImageBitmap`,
      )
      return texture
    } catch (error) {
      console.error(`Error creating LOD ${lodLevel} texture:`, error)
      return null
    } finally {
      // 清除loading状态
      this.isLoadingTexture = false
      this.notifyLoadingStateChange(false)
    }
  }

  private createTextureWithDebug(
    imageBitmap: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas,
    lodLevel: number,
  ): WebGLTexture | null {
    const { gl } = this
    const lodConfig = LOD_LEVELS[lodLevel]

    const texture = gl.createTexture()
    if (!texture) return null

    gl.bindTexture(gl.TEXTURE_2D, texture)

    // 设置纹理参数
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // 根据 LOD 级别选择过滤方式
    if (lodConfig.scale >= 4) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    } else if (lodConfig.scale >= 1) {
      const isPixelArt =
        this.originalImage &&
        (this.originalImage.width < 512 || this.originalImage.height < 512)
      if (isPixelArt) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      }
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }

    // 直接上传纹理数据
    if (imageBitmap instanceof ImageData) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageBitmap,
      )
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageBitmap as any,
      )
    }

    // 调度批量错误检查（避免阻塞主线程）
    this.scheduleErrorCheck()

    return texture
  }

  private async initializeLODTextures() {
    if (!this.originalImage) return

    // 清理现有的 LOD 纹理
    this.cleanupLODTextures()

    try {
      // 渐进式加载策略：先加载低质量纹理以快速显示，然后异步升级到高质量

      // 1. 立即创建最低质量纹理 (LOD 0: 最低分辨率)
      const lowQualityTexture = await this.createLODTexture(0)
      if (lowQualityTexture) {
        this.lodTextures.set(0, lowQualityTexture)
        this.currentLOD = 0
        this.texture = lowQualityTexture
        this.render()
        console.info('Initial low-quality texture loaded')
      }

      // 2. 异步创建中等质量纹理 (LOD 2: 中等分辨率)
      setTimeout(async () => {
        if (this.lodUpdateSuspended) return

        try {
          const mediumTexture = await this.createLODTexture(2)
          if (mediumTexture && !this.lodUpdateSuspended) {
            this.lodTextures.set(2, mediumTexture)
            // 如果当前 LOD 还是 0，升级到 2
            if (this.currentLOD <= 2) {
              this.currentLOD = 2
              this.texture = mediumTexture
              this.render()
              console.info('Upgraded to medium-quality texture')
            }
          }
        } catch (error) {
          console.error('Failed to create medium quality texture:', error)
        }
      }, 50)

      // 3. 异步创建高质量纹理 (LOD 3: 原始分辨率)
      setTimeout(async () => {
        if (this.lodUpdateSuspended) return

        try {
          const baseTexture = await this.createLODTexture(3)
          if (baseTexture && !this.lodUpdateSuspended) {
            this.lodTextures.set(3, baseTexture)
            // 根据当前缩放选择合适的 LOD
            const optimalLOD = this.selectOptimalLOD()
            if (optimalLOD >= 3) {
              this.currentLOD = 3
              this.texture = baseTexture
              this.render()
              console.info('Upgraded to high-quality texture')
            }
          }
        } catch (error) {
          console.error('Failed to create high quality texture:', error)
        }
      }, 100)
    } catch (error) {
      console.error('Failed to initialize LOD textures:', error)
    }
  }

  private async createLODTexture(
    lodLevel: number,
  ): Promise<WebGLTexture | null> {
    if (
      !this.originalImage ||
      !this.originalImageBitmap ||
      lodLevel < 0 ||
      lodLevel >= LOD_LEVELS.length
    ) {
      return null
    }

    // 设置loading状态
    this.isLoadingTexture = true
    this.notifyLoadingStateChange(true, `创建 LOD ${lodLevel} 纹理中...`)

    const lodConfig = LOD_LEVELS[lodLevel]

    // 计算 LOD 纹理尺寸
    const lodWidth = Math.max(
      1,
      Math.round(this.originalImage.width * lodConfig.scale),
    )
    const lodHeight = Math.max(
      1,
      Math.round(this.originalImage.height * lodConfig.scale),
    )

    // 计算最大纹理尺寸限制
    let { maxTextureSize } = this
    if (lodConfig.scale >= 4) {
      maxTextureSize = Math.min(this.maxTextureSize, 16384)
    } else if (lodConfig.scale >= 2) {
      maxTextureSize = Math.min(this.maxTextureSize, 8192)
    } else if (lodConfig.scale >= 1) {
      maxTextureSize = Math.min(this.maxTextureSize, 8192)
    } else {
      maxTextureSize = Math.min(this.maxTextureSize, 4096)
    }

    // 确保纹理尺寸不超过限制
    let finalWidth = lodWidth
    let finalHeight = lodHeight

    if (lodWidth > maxTextureSize || lodHeight > maxTextureSize) {
      const aspectRatio = lodWidth / lodHeight
      if (aspectRatio > 1) {
        finalWidth = maxTextureSize
        finalHeight = Math.round(maxTextureSize / aspectRatio)
      } else {
        finalHeight = maxTextureSize
        finalWidth = Math.round(maxTextureSize * aspectRatio)
      }
    }

    // 确定渲染质量
    let quality: 'high' | 'medium' | 'low'
    if (lodConfig.scale >= 2) {
      quality = 'high'
    } else if (lodConfig.scale >= 1) {
      quality = 'high'
    } else {
      quality = 'medium'
    }

    // 更新当前质量
    this.currentQuality = quality

    let result: WebGLTexture | null = null

    try {
      // 如果有 Worker，使用 Worker 处理
      if (this.lodWorker) {
        try {
          const id = `lod-${lodLevel}-${Date.now()}-${Math.random()}`

          result = await new Promise<WebGLTexture | null>((resolve, reject) => {
            this.pendingLODRequests.set(id, { lodLevel, resolve, reject })

            // 为每次请求创建新的 ImageBitmap，避免转移后无法重用
            createImageBitmap(this.originalImageBitmap!)
              .then((imageBitmapCopy) => {
                // 发送处理请求到 Worker，传递 ImageBitmap
                this.lodWorker!.postMessage(
                  {
                    type: 'CREATE_LOD',
                    payload: {
                      id,
                      imageBitmap: imageBitmapCopy,
                      targetWidth: finalWidth,
                      targetHeight: finalHeight,
                      quality,
                    },
                  },
                  [imageBitmapCopy],
                )
              })
              .catch((error) => {
                this.pendingLODRequests.delete(id)
                reject(error)
              })
          })
        } catch (error) {
          console.error('Failed to send LOD request to worker:', error)
          // 降级到主线程处理
        }
      }

      // 降级到主线程处理
      if (!result) {
        result = this.createLODTextureOnMainThread(
          lodLevel,
          finalWidth,
          finalHeight,
          quality,
        )
      }
    } finally {
      // 清除loading状态
      this.isLoadingTexture = false
      this.notifyLoadingStateChange(false)
    }

    return result
  }

  private createLODTextureOnMainThread(
    lodLevel: number,
    finalWidth: number,
    finalHeight: number,
    quality: 'high' | 'medium' | 'low',
  ): WebGLTexture | null {
    if (!this.originalImage) return null

    const lodConfig = LOD_LEVELS[lodLevel]

    try {
      // 创建离屏 canvas
      const offscreenCanvas = document.createElement('canvas')
      const offscreenCtx = offscreenCanvas.getContext('2d')!

      offscreenCanvas.width = finalWidth
      offscreenCanvas.height = finalHeight

      // 设置渲染质量
      if (quality === 'high') {
        offscreenCtx.imageSmoothingEnabled = true
        offscreenCtx.imageSmoothingQuality = 'high'
      } else if (quality === 'medium') {
        offscreenCtx.imageSmoothingEnabled = true
        offscreenCtx.imageSmoothingQuality = 'medium'
      } else {
        offscreenCtx.imageSmoothingEnabled = true
        offscreenCtx.imageSmoothingQuality = 'low'
      }

      // 绘制图像到目标尺寸
      offscreenCtx.drawImage(
        this.originalImage,
        0,
        0,
        this.originalImage.width,
        this.originalImage.height,
        0,
        0,
        finalWidth,
        finalHeight,
      )

      // 使用优化版本的纹理创建（生产模式下跳过错误检查）
      const texture = this.config.debug
        ? this.createTextureWithDebug(offscreenCanvas, lodLevel)
        : this.createTextureOptimized(offscreenCanvas, lodLevel)

      if (!texture) {
        console.error(`Failed to create LOD ${lodLevel} texture`)
        return null
      }

      console.info(
        `Created LOD ${lodLevel} texture: ${finalWidth}×${finalHeight} (scale: ${lodConfig.scale}) on main thread`,
      )
      return texture
    } catch (error) {
      console.error(`Error creating LOD ${lodLevel} texture:`, error)
      return null
    }
  }

  private cleanupLODTextures() {
    const { gl } = this

    // 删除所有现有的 LOD 纹理
    for (const [_level, texture] of this.lodTextures) {
      gl.deleteTexture(texture)
    }
    this.lodTextures.clear()

    // 清理主纹理引用
    this.texture = null
  }

  private selectOptimalLOD(): number {
    if (!this.originalImage) return 3 // 默认使用原始分辨率

    const fitToScreenScale = this.getFitToScreenScale()
    const relativeScale = this.scale / fitToScreenScale

    // 对于超高分辨率图片，当显示原始尺寸或更大时，需要更高的LOD
    if (this.scale >= 1) {
      // 原始尺寸或更大，根据实际显示需求选择 LOD
      if (this.scale >= 8) {
        return 7 // 16x LOD for extreme zoom
      } else if (this.scale >= 4) {
        return 6 // 8x LOD for very high zoom
      } else if (this.scale >= 2) {
        return 5 // 4x LOD for high zoom
      } else if (this.scale >= 1) {
        return 4 // 2x LOD for original size and above
      }
    }

    // 对于小于原始尺寸的情况，使用原有逻辑
    for (const [i, LOD_LEVEL] of LOD_LEVELS.entries()) {
      if (relativeScale <= LOD_LEVEL.maxViewportScale) {
        return i
      }
    }

    // 如果超出所有级别，返回最高级别
    return LOD_LEVELS.length - 1
  }

  private async updateLOD() {
    // 如果 LOD 更新被暂停，直接返回
    if (this.lodUpdateSuspended) {
      return
    }

    const optimalLOD = this.selectOptimalLOD()

    if (optimalLOD === this.currentLOD) {
      return // 无需更新
    }

    // 检查目标 LOD 纹理是否已存在
    let targetTexture = this.lodTextures.get(optimalLOD)

    if (!targetTexture) {
      try {
        // 异步创建新的 LOD 纹理
        const newTexture = await this.createLODTexture(optimalLOD)
        if (newTexture && !this.lodUpdateSuspended) {
          targetTexture = newTexture
          this.lodTextures.set(optimalLOD, newTexture)
        }
      } catch (error) {
        console.error(`Failed to create LOD ${optimalLOD}:`, error)
        return
      }
    }

    if (targetTexture && !this.lodUpdateSuspended) {
      this.currentLOD = optimalLOD
      this.texture = targetTexture
      console.info(`Switched to LOD ${optimalLOD}`)
      this.render()

      // 预加载相邻的LOD级别以提供更流畅的体验
      this.preloadAdjacentLODs(optimalLOD)
    }
  }

  private preloadAdjacentLODs(currentLOD: number) {
    // 异步预加载相邻的LOD级别
    setTimeout(async () => {
      // 如果 LOD 更新被暂停，不进行预加载
      if (this.lodUpdateSuspended) {
        return
      }

      try {
        // 预加载下一个更高质量的 LOD
        if (currentLOD < LOD_LEVELS.length - 1) {
          const nextLOD = currentLOD + 1
          if (!this.lodTextures.has(nextLOD)) {
            const texture = await this.createLODTexture(nextLOD)
            if (texture && !this.lodUpdateSuspended) {
              this.lodTextures.set(nextLOD, texture)
            }
          }
        }

        // 预加载下一个更低质量的LOD（用于快速缩小）
        if (currentLOD > 0) {
          const prevLOD = currentLOD - 1
          if (!this.lodTextures.has(prevLOD)) {
            const texture = await this.createLODTexture(prevLOD)
            if (texture && !this.lodUpdateSuspended) {
              this.lodTextures.set(prevLOD, texture)
            }
          }
        }
      } catch (error) {
        console.error('Error preloading adjacent LODs:', error)
      }
    }, 100) // 延迟 100ms 以避免阻塞主要渲染
  }

  private debouncedLODUpdate() {
    // 如果 LOD 更新被暂停，则直接返回
    if (this.lodUpdateSuspended) {
      return
    }

    // 清除之前的防抖调用
    if (this.lodUpdateDebounceId !== null) {
      clearTimeout(this.lodUpdateDebounceId)
    }

    // 设置新的防抖调用
    this.lodUpdateDebounceId = setTimeout(() => {
      this.lodUpdateDebounceId = null
      // 再次检查是否被暂停
      if (!this.lodUpdateSuspended) {
        this.updateLOD()
        this.render()
      }
    }, this.lodUpdateDelay)
  }

  private fitImageToScreen() {
    const scaleX = this.canvasWidth / this.imageWidth
    const scaleY = this.canvasHeight / this.imageHeight
    const fitToScreenScale = Math.min(scaleX, scaleY)

    // initialScale 是相对于适应页面大小的比例
    this.scale = fitToScreenScale * this.config.initialScale

    // Center the image
    this.translateX = 0
    this.translateY = 0

    this.isOriginalSize = false
  }

  // Easing function for smooth animation - more realistic physics-based easing
  private easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4)
  }

  private startAnimation(
    targetScale: number,
    targetTranslateX: number,
    targetTranslateY: number,
    animationTime?: number,
  ) {
    this.isAnimating = true
    this.lodUpdateSuspended = true // 暂停 LOD 更新
    this.animationStartTime = performance.now()
    this.animationDuration =
      animationTime ||
      (this.config.smooth
        ? 300 // Updated to 300ms for more realistic timing
        : 0)
    this.startScale = this.scale
    this.targetScale = targetScale
    this.startTranslateX = this.translateX
    this.startTranslateY = this.translateY

    // Apply constraints to target position before starting animation
    const tempScale = this.scale
    const tempTranslateX = this.translateX
    const tempTranslateY = this.translateY

    this.scale = targetScale
    this.translateX = targetTranslateX
    this.translateY = targetTranslateY
    this.constrainImagePosition()

    this.targetTranslateX = this.translateX
    this.targetTranslateY = this.translateY

    // Restore current state
    this.scale = tempScale
    this.translateX = tempTranslateX
    this.translateY = tempTranslateY

    this.animate()
  }

  private animate() {
    if (!this.isAnimating) return

    const now = performance.now()
    const elapsed = now - this.animationStartTime
    const progress = Math.min(elapsed / this.animationDuration, 1)
    const easedProgress = this.config.smooth
      ? this.easeOutQuart(progress)
      : progress

    // Interpolate scale and translation
    this.scale =
      this.startScale + (this.targetScale - this.startScale) * easedProgress
    this.translateX =
      this.startTranslateX +
      (this.targetTranslateX - this.startTranslateX) * easedProgress
    this.translateY =
      this.startTranslateY +
      (this.targetTranslateY - this.startTranslateY) * easedProgress

    this.render()
    this.notifyZoomChange()

    if (progress < 1) {
      requestAnimationFrame(() => this.animate())
    } else {
      this.isAnimating = false
      this.lodUpdateSuspended = false // 恢复 LOD 更新
      // Ensure final values are exactly the target values
      this.scale = this.targetScale
      this.translateX = this.targetTranslateX
      this.translateY = this.targetTranslateY
      this.render()
      this.notifyZoomChange()
      // 动画完成后触发 LOD 更新
      this.debouncedLODUpdate()
    }
  }

  private createMatrix(): Float32Array {
    // Create transformation matrix
    // 保持所有计算基于 CSS 尺寸，设备像素比的影响已经在 canvas 尺寸设置中处理
    const scaleX = (this.imageWidth * this.scale) / this.canvasWidth
    const scaleY = (this.imageHeight * this.scale) / this.canvasHeight

    const translateX = (this.translateX * 2) / this.canvasWidth
    const translateY = -(this.translateY * 2) / this.canvasHeight

    return new Float32Array([
      scaleX,
      0,
      0,
      0,
      scaleY,
      0,
      translateX,
      translateY,
      1,
    ])
  }

  private getFitToScreenScale(): number {
    const scaleX = this.canvasWidth / this.imageWidth
    const scaleY = this.canvasHeight / this.imageHeight
    return Math.min(scaleX, scaleY)
  }

  private constrainImagePosition() {
    if (!this.config.limitToBounds) return

    const fitScale = this.getFitToScreenScale()

    // If current scale is less than or equal to fit-to-screen scale, center the image
    if (this.scale <= fitScale) {
      this.translateX = 0
      this.translateY = 0
      return
    }

    // Otherwise, constrain the image within reasonable bounds
    const scaledWidth = this.imageWidth * this.scale
    const scaledHeight = this.imageHeight * this.scale

    // Calculate the maximum allowed translation to keep image edges within viewport
    const maxTranslateX = Math.max(0, (scaledWidth - this.canvasWidth) / 2)
    const maxTranslateY = Math.max(0, (scaledHeight - this.canvasHeight) / 2)

    // Constrain translation
    this.translateX = Math.max(
      -maxTranslateX,
      Math.min(maxTranslateX, this.translateX),
    )
    this.translateY = Math.max(
      -maxTranslateY,
      Math.min(maxTranslateY, this.translateY),
    )
  }

  private constrainScaleAndPosition() {
    // 首先约束缩放倍数
    const fitToScreenScale = this.getFitToScreenScale()
    const absoluteMinScale = fitToScreenScale * this.config.minScale

    // 计算原图1x尺寸对应的绝对缩放值
    const originalSizeScale = 1 // 原图1x尺寸

    // 确保maxScale不会阻止用户查看原图1x尺寸
    const userMaxScale = fitToScreenScale * this.config.maxScale
    const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

    // 如果当前缩放超出范围，调整到合理范围内
    if (this.scale < absoluteMinScale) {
      this.scale = absoluteMinScale
    } else if (this.scale > effectiveMaxScale) {
      this.scale = effectiveMaxScale
    }

    // 然后约束位置
    this.constrainImagePosition()
  }

  private render() {
    const now = performance.now()

    // 如果距离上次渲染时间不足，则使用节流
    if (now - this.lastRenderTime < this.renderThrottleDelay) {
      // 清除之前的节流调用
      if (this.renderThrottleId !== null) {
        cancelAnimationFrame(this.renderThrottleId)
      }

      // 安排下次渲染
      this.renderThrottleId = requestAnimationFrame(() => {
        this.renderThrottleId = null
        this.renderInternal()
      })
      return
    }

    this.renderInternal()
  }

  private renderInternal() {
    this.lastRenderTime = performance.now()

    const { gl } = this

    // 确保视口设置正确，使用实际的 canvas 像素尺寸
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)

    // 清除为完全透明
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.texture) return

    gl.useProgram(this.program)

    // Set transformation matrix
    const matrixLocation = gl.getUniformLocation(this.program, 'u_matrix')
    gl.uniformMatrix3fv(matrixLocation, false, this.createMatrix())

    const imageLocation = gl.getUniformLocation(this.program, 'u_image')
    gl.uniform1i(imageLocation, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    gl.drawArrays(gl.TRIANGLES, 0, 6)

    // Update debug info if enabled
    if (this.config.debug && this.onDebugUpdate) {
      this.updateDebugInfo()
    }
  }

  private updateDebugInfo() {
    if (!this.onDebugUpdate) return

    const fitToScreenScale = this.getFitToScreenScale()
    const relativeScale = this.scale / fitToScreenScale

    // 计算有效的最大缩放值
    const originalSizeScale = 1
    const userMaxScale = fitToScreenScale * this.config.maxScale
    const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

    this.onDebugUpdate.current({
      scale: this.scale,
      relativeScale,
      translateX: this.translateX,
      translateY: this.translateY,
      currentLOD: this.currentLOD,
      lodLevels: LOD_LEVELS.length,
      canvasSize: { width: this.canvasWidth, height: this.canvasHeight },
      imageSize: { width: this.imageWidth, height: this.imageHeight },
      fitToScreenScale,
      userMaxScale,
      effectiveMaxScale,
      originalSizeScale,
      renderCount: performance.now(),
      maxTextureSize: this.maxTextureSize,
      quality: this.currentQuality,
      isLoading: this.isLoadingTexture,
    })
  }

  private notifyZoomChange() {
    if (this.onZoomChange) {
      // 原图缩放比例（相对于图片原始大小）
      const originalScale = this.scale

      // 相对于页面适应大小的缩放比例
      const fitToScreenScale = this.getFitToScreenScale()
      const relativeScale = this.scale / fitToScreenScale

      this.onZoomChange(originalScale, relativeScale)
    }
  }

  private setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.boundHandleMouseDown)
    this.canvas.addEventListener('mousemove', this.boundHandleMouseMove)
    this.canvas.addEventListener('mouseup', this.boundHandleMouseUp)
    this.canvas.addEventListener('wheel', this.boundHandleWheel)
    this.canvas.addEventListener('dblclick', this.boundHandleDoubleClick)

    // Touch events
    this.canvas.addEventListener('touchstart', this.boundHandleTouchStart)
    this.canvas.addEventListener('touchmove', this.boundHandleTouchMove)
    this.canvas.addEventListener('touchend', this.boundHandleTouchEnd)
  }

  private removeEventListeners() {
    this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown)
    this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove)
    this.canvas.removeEventListener('mouseup', this.boundHandleMouseUp)
    this.canvas.removeEventListener('wheel', this.boundHandleWheel)
    this.canvas.removeEventListener('dblclick', this.boundHandleDoubleClick)
    this.canvas.removeEventListener('touchstart', this.boundHandleTouchStart)
    this.canvas.removeEventListener('touchmove', this.boundHandleTouchMove)
    this.canvas.removeEventListener('touchend', this.boundHandleTouchEnd)
  }

  private handleMouseDown(e: MouseEvent) {
    if (this.isAnimating || this.config.panning.disabled) return

    // Stop any ongoing animation when user starts interacting
    this.isAnimating = false
    this.lodUpdateSuspended = false // 恢复 LOD 更新

    this.isDragging = true
    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isDragging || this.config.panning.disabled) return

    const deltaX = e.clientX - this.lastMouseX
    const deltaY = e.clientY - this.lastMouseY

    this.translateX += deltaX
    this.translateY += deltaY

    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY

    this.constrainImagePosition()
    this.render()
  }

  private handleMouseUp() {
    this.isDragging = false
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault()

    if (this.config.wheel.wheelDisabled) return

    // 如果有正在进行的动画，停止并恢复 LOD 更新
    if (this.isAnimating) {
      this.isAnimating = false
      this.lodUpdateSuspended = false
    }

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const scaleFactor =
      e.deltaY > 0 ? 1 - this.config.wheel.step : 1 + this.config.wheel.step
    this.zoomAt(mouseX, mouseY, scaleFactor)
  }

  private handleDoubleClick(e: MouseEvent) {
    e.preventDefault()

    if (this.config.doubleClick.disabled) return

    const now = Date.now()
    if (now - this.lastDoubleClickTime < 300) return
    this.lastDoubleClickTime = now

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    this.performDoubleClickAction(mouseX, mouseY)
  }

  private handleTouchDoubleTap(clientX: number, clientY: number) {
    if (this.config.doubleClick.disabled) return

    const rect = this.canvas.getBoundingClientRect()
    const touchX = clientX - rect.left
    const touchY = clientY - rect.top

    this.performDoubleClickAction(touchX, touchY)
  }

  private performDoubleClickAction(x: number, y: number) {
    // Stop any ongoing animation
    this.isAnimating = false
    this.lodUpdateSuspended = false // 确保 LOD 更新状态正确

    if (this.config.doubleClick.mode === 'toggle') {
      const fitToScreenScale = this.getFitToScreenScale()
      const absoluteMinScale = fitToScreenScale * this.config.minScale

      // 计算原图1x尺寸对应的绝对缩放值
      const originalSizeScale = 1 // 原图1x尺寸

      // 确保maxScale不会阻止用户查看原图1x尺寸
      const userMaxScale = fitToScreenScale * this.config.maxScale
      const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

      if (this.isOriginalSize) {
        // Animate to fit-to-screen 1x (适应页面大小) with click position as center
        const targetScale = Math.max(
          absoluteMinScale,
          Math.min(effectiveMaxScale, fitToScreenScale),
        )

        // Calculate zoom point relative to current transform
        const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
        const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale

        // Calculate target translation after zoom
        const targetTranslateX = x - this.canvasWidth / 2 - zoomX * targetScale
        const targetTranslateY = y - this.canvasHeight / 2 - zoomY * targetScale

        this.startAnimation(
          targetScale,
          targetTranslateX,
          targetTranslateY,
          this.config.doubleClick.animationTime,
        )
        this.isOriginalSize = false
      } else {
        // Animate to original size 1x (原图原始大小) with click position as center
        // 确保能够缩放到原图1x尺寸，即使超出用户设置的maxScale
        const targetScale = Math.max(
          absoluteMinScale,
          Math.min(effectiveMaxScale, originalSizeScale),
        ) // 1x = 原图原始大小

        // Calculate zoom point relative to current transform
        const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
        const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale

        // Calculate target translation after zoom
        const targetTranslateX = x - this.canvasWidth / 2 - zoomX * targetScale
        const targetTranslateY = y - this.canvasHeight / 2 - zoomY * targetScale

        this.startAnimation(
          targetScale,
          targetTranslateX,
          targetTranslateY,
          this.config.doubleClick.animationTime,
        )
        this.isOriginalSize = true
      }
    } else {
      // Zoom mode - 使用动画版本以确保LOD暂停机制生效
      this.zoomAt(x, y, this.config.doubleClick.step, true)
    }
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault()

    // 如果有正在进行的动画，停止并恢复 LOD 更新
    if (this.isAnimating) {
      this.isAnimating = false
      this.lodUpdateSuspended = false
      return
    }

    if (e.touches.length === 1 && !this.config.panning.disabled) {
      const touch = e.touches[0]
      const now = Date.now()

      // Check for double-tap
      if (
        !this.config.doubleClick.disabled &&
        now - this.lastTouchTime < 300 &&
        Math.abs(touch.clientX - this.lastTouchX) < 50 &&
        Math.abs(touch.clientY - this.lastTouchY) < 50
      ) {
        // Double-tap detected
        this.handleTouchDoubleTap(touch.clientX, touch.clientY)
        this.lastTouchTime = 0 // Reset to prevent triple-tap
        return
      }

      // Single touch - prepare for potential drag or single tap
      this.isDragging = true
      this.lastMouseX = touch.clientX
      this.lastMouseY = touch.clientY
      this.lastTouchTime = now
      this.lastTouchX = touch.clientX
      this.lastTouchY = touch.clientY
    } else if (e.touches.length === 2 && !this.config.pinch.disabled) {
      this.isDragging = false
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      this.lastTouchDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2),
      )
    }
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault()

    if (
      e.touches.length === 1 &&
      this.isDragging &&
      !this.config.panning.disabled
    ) {
      const deltaX = e.touches[0].clientX - this.lastMouseX
      const deltaY = e.touches[0].clientY - this.lastMouseY

      this.translateX += deltaX
      this.translateY += deltaY

      this.lastMouseX = e.touches[0].clientX
      this.lastMouseY = e.touches[0].clientY

      this.constrainImagePosition()
      this.render()
    } else if (e.touches.length === 2 && !this.config.pinch.disabled) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2),
      )

      if (this.lastTouchDistance > 0) {
        const scaleFactor = distance / this.lastTouchDistance
        const centerX = (touch1.clientX + touch2.clientX) / 2
        const centerY = (touch1.clientY + touch2.clientY) / 2

        const rect = this.canvas.getBoundingClientRect()
        this.zoomAt(centerX - rect.left, centerY - rect.top, scaleFactor)
      }

      this.lastTouchDistance = distance
    }
  }

  private handleTouchEnd(_e: TouchEvent) {
    this.isDragging = false
    this.lastTouchDistance = 0

    // Clear any pending touch tap timeout
    if (this.touchTapTimeout) {
      clearTimeout(this.touchTapTimeout)
      this.touchTapTimeout = null
    }
  }

  private zoomAt(x: number, y: number, scaleFactor: number, animated = false) {
    const newScale = this.scale * scaleFactor
    const fitToScreenScale = this.getFitToScreenScale()

    // 将相对缩放比例转换为绝对缩放比例进行限制
    const absoluteMinScale = fitToScreenScale * this.config.minScale

    // 计算原图 1x 尺寸对应的绝对缩放值
    const originalSizeScale = 1 // 原图 1x 尺寸

    // 确保 maxScale 不会阻止用户查看原图 1x 尺寸
    const userMaxScale = fitToScreenScale * this.config.maxScale
    const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

    // Limit zoom
    if (newScale < absoluteMinScale || newScale > effectiveMaxScale) return

    if (animated && this.config.smooth) {
      // Calculate zoom point relative to current transform
      const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
      const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale

      // Calculate target translation after zoom
      const targetTranslateX = x - this.canvasWidth / 2 - zoomX * newScale
      const targetTranslateY = y - this.canvasHeight / 2 - zoomY * newScale

      this.startAnimation(newScale, targetTranslateX, targetTranslateY)
    } else {
      // Calculate zoom point relative to current transform
      const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
      const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale

      this.scale = newScale

      // Adjust translation to keep zoom point fixed
      this.translateX = x - this.canvasWidth / 2 - zoomX * this.scale
      this.translateY = y - this.canvasHeight / 2 - zoomY * this.scale

      this.constrainImagePosition()
      this.render()
      this.notifyZoomChange()
      // 只有在不是暂停状态时才触发LOD更新
      if (!this.lodUpdateSuspended) {
        this.debouncedLODUpdate()
      }
    }
  }

  async copyOriginalImageToClipboard() {
    try {
      // 获取原始图片
      const response = await fetch(this.originalImageSrc)
      const blob = await response.blob()

      // 检查浏览器是否支持剪贴板 API
      if (!navigator.clipboard || !navigator.clipboard.write) {
        console.warn('Clipboard API not supported')
        return
      }

      // 创建 ClipboardItem 并写入剪贴板
      const clipboardItem = new ClipboardItem({
        [blob.type]: blob,
      })

      await navigator.clipboard.write([clipboardItem])
      console.info('Original image copied to clipboard')
      if (this.onImageCopied) {
        this.onImageCopied()
      }
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error)
    }
  }

  // Public methods
  public zoomIn(animated = false) {
    const centerX = this.canvasWidth / 2
    const centerY = this.canvasHeight / 2
    this.zoomAt(centerX, centerY, 1 + this.config.wheel.step, animated)
  }

  public zoomOut(animated = false) {
    const centerX = this.canvasWidth / 2
    const centerY = this.canvasHeight / 2
    this.zoomAt(centerX, centerY, 1 - this.config.wheel.step, animated)
  }

  public resetView() {
    const fitToScreenScale = this.getFitToScreenScale()
    const targetScale = fitToScreenScale * this.config.initialScale
    this.startAnimation(targetScale, 0, 0)
  }

  public getScale(): number {
    return this.scale
  }

  public destroy() {
    this.removeEventListeners()
    window.removeEventListener('resize', this.boundResizeCanvas)

    // 停止动画并恢复 LOD 更新状态
    this.isAnimating = false
    this.lodUpdateSuspended = false

    // 清理节流相关的资源
    if (this.renderThrottleId !== null) {
      cancelAnimationFrame(this.renderThrottleId)
      this.renderThrottleId = null
    }

    // 清理 LOD 更新防抖相关的资源
    if (this.lodUpdateDebounceId !== null) {
      clearTimeout(this.lodUpdateDebounceId)
      this.lodUpdateDebounceId = null
    }

    // 清理触摸双击相关的资源
    if (this.touchTapTimeout !== null) {
      clearTimeout(this.touchTapTimeout)
      this.touchTapTimeout = null
    }

    // 清理双缓冲纹理
    if (this.frontTexture) {
      this.gl.deleteTexture(this.frontTexture)
      this.frontTexture = null
    }
    if (this.backTexture) {
      this.gl.deleteTexture(this.backTexture)
      this.backTexture = null
    }
    this.pendingTextureSwitch = null

    // 清理 Web Worker
    if (this.lodWorker) {
      this.lodWorker.terminate()
      this.lodWorker = null
    }

    // 清理待处理的请求
    for (const [_id, request] of this.pendingLODRequests) {
      request.reject(new Error('WebGL viewer destroyed'))
    }
    this.pendingLODRequests.clear()

    // 清理 ImageBitmap
    if (this.originalImageBitmap) {
      this.originalImageBitmap.close()
      this.originalImageBitmap = null
    }

    // 清理 WebGL 资源
    this.cleanupLODTextures()
  }

  private notifyLoadingStateChange(isLoading: boolean, message?: string) {
    if (this.onLoadingStateChange) {
      this.onLoadingStateChange(isLoading, message, this.currentQuality)
    }
  }
}
