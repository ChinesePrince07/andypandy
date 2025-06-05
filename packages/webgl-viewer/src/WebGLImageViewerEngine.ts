import { LOD_LEVELS } from './constants'
import type { DebugInfo, WebGLImageViewerProps } from './interface'
import {
  createShader,
  FRAGMENT_SHADER_SOURCE,
  VERTEX_SHADER_SOURCE,
} from './shaders'

// 瓦片信息类型
interface TileInfo {
  x: number // 瓦片在网格中的 x 坐标
  y: number // 瓦片在网格中的 y 坐标
  level: number // LOD 级别
  priority: number // 优先级 (距离视口中心越近优先级越高)
  lastAccessed: number // 最后访问时间 (用于LRU缓存)
  isLoading: boolean // 是否正在加载
  width: number // 瓦片实际宽度
  height: number // 瓦片实际高度
}

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

  // Tiled texture management for large images
  private originalImage: HTMLImageElement | null = null
  private lodTextures = new Map<number, WebGLTexture>() // LOD level -> texture (for small images)
  private currentLOD = 0
  private lodUpdateDebounceId: ReturnType<typeof setTimeout> | null = null
  private lodUpdateDelay = 200 // ms
  private maxTextureSize = 0 // WebGL maximum texture size

  // Tiling system for large images
  private useTiledRendering = false
  private tileSize = 512 // 瓦片大小 (像素)
  private maxTilesInMemory = 16 // 最大同时存在的瓦片数
  private tiles = new Map<string, TileInfo>() // tileKey -> TileInfo
  private tileCache = new Map<string, WebGLTexture>() // tileKey -> texture
  private activeTiles = new Set<string>() // 当前活跃的瓦片
  private tilesToLoad = new Set<string>() // 待加载的瓦片
  private tileLoadPromises = new Map<string, Promise<WebGLTexture | null>>() // 加载中的瓦片

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

  // 内存管理
  private memoryUsage = {
    textures: 0, // 纹理占用的内存 (bytes)
    estimated: 0, // 估算的总内存占用 (bytes)
  }
  private maxMemoryBudget = 512 * 1024 * 1024 // 512MB 内存预算
  private memoryPressureThreshold = 0.8 // 80% 内存使用率触发清理
  private maxConcurrentLODs = 3 // 最大同时存在的 LOD 级别数

  constructor(
    canvas: HTMLCanvasElement,
    config: Required<WebGLImageViewerProps>,
    onDebugUpdate?: React.RefObject<(debugInfo: DebugInfo) => void>,
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

    // 在移动设备上记录一些有用的调试信息并调整内存预算
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile) {
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

      // 移动设备使用更保守的内存预算
      this.maxMemoryBudget = 128 * 1024 * 1024 // 128MB (更保守)
      this.maxConcurrentLODs = 2 // 更少的 LOD 级别
      this.memoryPressureThreshold = 0.6 // 更低的压力阈值
      // 移动设备瓦片配置
      this.tileSize = 256 // 更小的瓦片尺寸
      this.maxTilesInMemory = 8 // 更少的瓦片数量
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

          // 估算内存需求并决定渲染策略
          const imagePixels = image.width * image.height
          const baseMemoryMB = (imagePixels * 4) / (1024 * 1024) // RGBA 基础内存
          const estimatedMaxMemoryMB = baseMemoryMB * 3 // 估算最多需要的内存（多个LOD级别）

          console.info(`Image loaded: ${image.width}×${image.height}`)
          console.info(`Base memory requirement: ${baseMemoryMB.toFixed(1)} MB`)
          console.info(
            `Estimated max memory: ${estimatedMaxMemoryMB.toFixed(1)} MB`,
          )
          console.info(
            `Memory budget: ${(this.maxMemoryBudget / 1024 / 1024).toFixed(1)} MB`,
          )

          // 决定是否使用瓦片渲染
          const maxDimension = Math.max(image.width, image.height)
          const shouldUseTiling =
            estimatedMaxMemoryMB > this.maxMemoryBudget / (1024 * 1024) ||
            imagePixels > 50 * 1024 * 1024 || // 50M 像素
            maxDimension > 8192 // 任一边超过 8K

          if (shouldUseTiling) {
            this.useTiledRendering = true
            console.info(`🧩 Using tiled rendering for large image`)
            console.info(`Tile size: ${this.tileSize}×${this.tileSize}`)
            console.info(`Max tiles in memory: ${this.maxTilesInMemory}`)
          } else {
            console.info(`📄 Using standard LOD rendering`)
          }

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

    if (this.useTiledRendering) {
      await this.initializeTiledSystem()
    } else {
      this.initializeLODTextures()
    }
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

  // 内存管理相关方法
  private updateTextureMemoryUsage(
    texture: WebGLTexture,
    imageBitmap: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas,
    lodLevel: number,
    tileKey?: string,
  ) {
    let width: number, height: number

    if (imageBitmap instanceof ImageData) {
      width = imageBitmap.width
      height = imageBitmap.height
    } else if (imageBitmap instanceof ImageBitmap) {
      width = imageBitmap.width
      height = imageBitmap.height
    } else if (
      imageBitmap instanceof HTMLCanvasElement ||
      imageBitmap instanceof OffscreenCanvas
    ) {
      width = imageBitmap.width
      height = imageBitmap.height
    } else {
      return
    }

    // RGBA 纹理，每个像素 4 字节
    const textureMemory = width * height * 4
    this.memoryUsage.textures += textureMemory

    const memoryType = tileKey ? `Tile ${tileKey}` : `LOD ${lodLevel}`
    console.info(
      `${memoryType} texture memory: ${(textureMemory / 1024 / 1024).toFixed(2)} MiB, Total: ${(this.memoryUsage.textures / 1024 / 1024).toFixed(2)} MiB`,
    )

    // 检查内存压力（只在瓦片模式下自动清理）
    if (this.useTiledRendering) {
      this.checkMemoryPressure()
    }
  }

  private checkMemoryPressure() {
    const memoryPressureRatio = this.memoryUsage.textures / this.maxMemoryBudget

    if (memoryPressureRatio > this.memoryPressureThreshold) {
      console.warn(
        `Memory pressure detected: ${(memoryPressureRatio * 100).toFixed(1)}% of budget used`,
      )
      this.cleanupOldLODTextures()
    }
  }

  private cleanupOldLODTextures() {
    const lodLevels = Array.from(this.lodTextures.keys()).sort((a, b) => b - a)

    // 保留当前 LOD 和相邻的几个级别
    const keepLevels = new Set([
      this.currentLOD,
      Math.max(0, this.currentLOD - 1),
      Math.min(LOD_LEVELS.length - 1, this.currentLOD + 1),
    ])

    let removed = 0
    for (const level of lodLevels) {
      if (removed >= this.maxConcurrentLODs || this.lodTextures.size <= 2) {
        break
      }

      if (!keepLevels.has(level)) {
        const texture = this.lodTextures.get(level)
        if (texture) {
          this.gl.deleteTexture(texture)
          this.lodTextures.delete(level)

          // 估算释放的内存（基于LOD级别）
          const lodConfig = LOD_LEVELS[level]
          if (this.originalImage) {
            const lodWidth = Math.max(
              1,
              Math.round(this.originalImage.width * lodConfig.scale),
            )
            const lodHeight = Math.max(
              1,
              Math.round(this.originalImage.height * lodConfig.scale),
            )
            const freedMemory = lodWidth * lodHeight * 4
            this.memoryUsage.textures = Math.max(
              0,
              this.memoryUsage.textures - freedMemory,
            )

            console.info(
              `Cleaned up LOD ${level}, freed ${(freedMemory / 1024 / 1024).toFixed(2)} MiB`,
            )
          }

          removed++
        }
      }
    }

    if (removed > 0) {
      console.info(
        `Memory cleanup completed. Current usage: ${(this.memoryUsage.textures / 1024 / 1024).toFixed(2)} MiB`,
      )

      // 在移动设备上，如果内存压力仍然很高，建议浏览器进行垃圾回收
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      if (
        isMobile &&
        this.memoryUsage.textures / this.maxMemoryBudget > 0.7 && // 手动触发垃圾回收（如果支持）
        'gc' in window &&
        typeof (window as any).gc === 'function'
      ) {
        ;(window as any).gc()
        console.info('Manual garbage collection triggered')
      }
    }
  }

  private getEstimatedTotalMemoryUsage(): number {
    let total = this.memoryUsage.textures

    // 估算原始图片和 ImageBitmap 的内存占用
    if (this.originalImage) {
      total += this.originalImage.width * this.originalImage.height * 4
    }
    if (this.originalImageBitmap) {
      total +=
        this.originalImageBitmap.width * this.originalImageBitmap.height * 4
    }

    this.memoryUsage.estimated = total
    return total
  }

  private getRuntimeMemoryUsage(): number {
    // 尝试获取实际内存使用情况
    if ('memory' in performance && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  // 瓦片系统核心方法
  private cleanupTiledSystem() {
    // 清理所有瓦片纹理
    for (const texture of this.tileCache.values()) {
      this.gl.deleteTexture(texture)
    }
    this.tileCache.clear()
    this.tiles.clear()
    this.activeTiles.clear()
    this.tilesToLoad.clear()
    this.tileLoadPromises.clear()

    console.info('Tiled system cleaned up')
  }

  private updateVisibleTiles() {
    if (!this.originalImage || !this.useTiledRendering) return

    // 计算当前视口在图片坐标系中的位置
    const viewport = this.calculateViewport()

    // 计算需要的瓦片范围
    const tileRange = this.calculateTileRange(viewport)

    // 更新活跃瓦片集合
    this.updateActiveTiles(tileRange)

    // 异步加载需要的瓦片
    this.loadRequiredTiles()
  }

  private calculateViewport() {
    // 计算当前视口在图片坐标系中的范围
    const viewportWidth = this.canvasWidth / this.scale
    const viewportHeight = this.canvasHeight / this.scale

    // 视口中心在图片坐标系中的位置
    const centerX = this.imageWidth / 2 - this.translateX / this.scale
    const centerY = this.imageHeight / 2 - this.translateY / this.scale

    const left = Math.max(0, centerX - viewportWidth / 2)
    const top = Math.max(0, centerY - viewportHeight / 2)
    const right = Math.min(this.imageWidth, centerX + viewportWidth / 2)
    const bottom = Math.min(this.imageHeight, centerY + viewportHeight / 2)

    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    }
  }

  private calculateTileRange(viewport: {
    left: number
    top: number
    right: number
    bottom: number
  }) {
    // 计算需要的瓦片范围，包括一些缓冲区（移动设备使用更小的缓冲区）
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const buffer = this.tileSize * (isMobile ? 0.25 : 0.5) // 移动设备25%缓冲区

    const startX = Math.max(
      0,
      Math.floor((viewport.left - buffer) / this.tileSize),
    )
    const endX = Math.min(
      Math.ceil(this.imageWidth / this.tileSize) - 1,
      Math.floor((viewport.right + buffer) / this.tileSize),
    )

    const startY = Math.max(
      0,
      Math.floor((viewport.top - buffer) / this.tileSize),
    )
    const endY = Math.min(
      Math.ceil(this.imageHeight / this.tileSize) - 1,
      Math.floor((viewport.bottom + buffer) / this.tileSize),
    )

    return { startX, endX, startY, endY }
  }

  private updateActiveTiles(tileRange: {
    startX: number
    endX: number
    startY: number
    endY: number
  }) {
    const newActiveTiles = new Set<string>()
    const currentTime = performance.now()

    // 确定当前缩放级别对应的 LOD
    const lodLevel = this.selectOptimalLOD()

    // 检查LOD是否改变，如果改变需要清理旧的瓦片
    if (lodLevel !== this.currentLOD) {
      console.info(
        `LOD changed from ${this.currentLOD} to ${lodLevel}, cleaning old tiles`,
      )
      this.cleanupTilesWithDifferentLOD(lodLevel)
      this.currentLOD = lodLevel
    }

    // 生成需要的瓦片
    for (let y = tileRange.startY; y <= tileRange.endY; y++) {
      for (let x = tileRange.startX; x <= tileRange.endX; x++) {
        const tileKey = `${x}-${y}-${lodLevel}`
        newActiveTiles.add(tileKey)

        // 计算瓦片优先级（距离视口中心越近优先级越高）
        const centerX = (tileRange.startX + tileRange.endX) / 2
        const centerY = (tileRange.startY + tileRange.endY) / 2
        const distance = Math.hypot(x - centerX, y - centerY)
        const priority = 1000 - distance

        // 更新或创建瓦片信息
        if (!this.tiles.has(tileKey)) {
          const tileWidth = Math.min(
            this.tileSize,
            this.imageWidth - x * this.tileSize,
          )
          const tileHeight = Math.min(
            this.tileSize,
            this.imageHeight - y * this.tileSize,
          )

          this.tiles.set(tileKey, {
            x,
            y,
            level: lodLevel,
            priority,
            lastAccessed: currentTime,
            isLoading: false,
            width: tileWidth,
            height: tileHeight,
          })
        } else {
          const tile = this.tiles.get(tileKey)!
          tile.priority = priority
          tile.lastAccessed = currentTime
        }
      }
    }

    // 更新活跃瓦片集合
    this.activeTiles = newActiveTiles

    // 清理不再需要的瓦片
    this.cleanupUnusedTiles()
  }

  // 清理不同LOD级别的瓦片
  private cleanupTilesWithDifferentLOD(currentLOD: number) {
    const tilesToRemove: string[] = []

    // 找到所有不是当前LOD级别的瓦片
    for (const [tileKey, tile] of this.tiles.entries()) {
      if (tile.level !== currentLOD) {
        tilesToRemove.push(tileKey)
      }
    }

    // 清理这些瓦片
    for (const tileKey of tilesToRemove) {
      const texture = this.tileCache.get(tileKey)
      const tile = this.tiles.get(tileKey)

      if (texture && tile) {
        this.gl.deleteTexture(texture)
        this.tileCache.delete(tileKey)

        // 更新内存统计
        const freedMemory = tile.width * tile.height * 4
        this.memoryUsage.textures = Math.max(
          0,
          this.memoryUsage.textures - freedMemory,
        )

        console.info(
          `Cleaned up LOD ${tile.level} tile ${tileKey}, freed ${(freedMemory / 1024 / 1024).toFixed(2)} MiB`,
        )
      }

      this.tiles.delete(tileKey)
    }

    if (tilesToRemove.length > 0) {
      console.info(
        `Cleaned up ${tilesToRemove.length} tiles with different LOD levels`,
      )
    }
  }

  private loadRequiredTiles() {
    // 按优先级排序需要加载的瓦片
    const tilesToLoad = Array.from(this.activeTiles)
      .filter(
        (tileKey) =>
          !this.tileCache.has(tileKey) && !this.tileLoadPromises.has(tileKey),
      )
      .map((tileKey) => ({ key: tileKey, tile: this.tiles.get(tileKey)! }))
      .sort((a, b) => b.tile.priority - a.tile.priority)

    // 限制同时加载的瓦片数量（移动设备更保守）
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const maxConcurrentLoads = isMobile ? 2 : 4
    const currentLoads = this.tileLoadPromises.size
    const availableSlots = maxConcurrentLoads - currentLoads

    for (let i = 0; i < Math.min(tilesToLoad.length, availableSlots); i++) {
      const { key: tileKey, tile } = tilesToLoad[i]
      this.loadTile(tileKey, tile)
    }
  }

  private async loadTile(tileKey: string, tile: TileInfo) {
    if (this.tileLoadPromises.has(tileKey)) return

    tile.isLoading = true

    const loadPromise = this.createTileTexture(tile)
    this.tileLoadPromises.set(tileKey, loadPromise)

    try {
      const texture = await loadPromise
      if (texture && this.activeTiles.has(tileKey)) {
        this.tileCache.set(tileKey, texture)
        console.info(`Loaded tile ${tileKey}`)

        // 如果这是视口中心的瓦片，立即重新渲染
        this.render()
      }
    } catch (error) {
      console.error(`Failed to load tile ${tileKey}:`, error)
    } finally {
      tile.isLoading = false
      this.tileLoadPromises.delete(tileKey)
    }
  }

  private async createTileTexture(
    tile: TileInfo,
  ): Promise<WebGLTexture | null> {
    if (!this.originalImageBitmap) return null

    try {
      // 检查内存压力，如果太高则拒绝创建
      const memoryPressure = this.memoryUsage.textures / this.maxMemoryBudget
      if (memoryPressure > 0.9) {
        console.warn(
          `Memory pressure too high (${(memoryPressure * 100).toFixed(1)}%), skipping tile creation`,
        )
        return null
      }

      // 计算瓦片在原图中的位置和大小
      const sourceX = tile.x * this.tileSize
      const sourceY = tile.y * this.tileSize
      const sourceWidth = Math.min(this.tileSize, this.imageWidth - sourceX)
      const sourceHeight = Math.min(this.tileSize, this.imageHeight - sourceY)

      // 根据 LOD 级别调整输出尺寸
      const lodConfig = LOD_LEVELS[tile.level]
      const outputWidth = Math.max(1, Math.round(sourceWidth * lodConfig.scale))
      const outputHeight = Math.max(
        1,
        Math.round(sourceHeight * lodConfig.scale),
      )

      // 限制瓦片纹理最大尺寸（移动设备更严格）
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const maxTileSize = isMobile ? 512 : 1024

      let finalWidth = outputWidth
      let finalHeight = outputHeight

      if (outputWidth > maxTileSize || outputHeight > maxTileSize) {
        const scale = Math.min(
          maxTileSize / outputWidth,
          maxTileSize / outputHeight,
        )
        finalWidth = Math.round(outputWidth * scale)
        finalHeight = Math.round(outputHeight * scale)
      }

      // 使用 Canvas 创建瓦片纹理（iOS Safari 对 OffscreenCanvas 支持不佳）
      const canvas = document.createElement('canvas')
      canvas.width = finalWidth
      canvas.height = finalHeight
      const ctx = canvas.getContext('2d')!

      // 设置渲染质量
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = lodConfig.scale >= 1 ? 'high' : 'medium'

      // 绘制瓦片区域
      ctx.drawImage(
        this.originalImageBitmap,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        finalWidth,
        finalHeight,
      )

      // 创建 WebGL 纹理（不使用内存追踪版本，避免双重计算）
      const tileKey = `${tile.x}-${tile.y}-${tile.level}`
      const texture = this.createTextureRaw(canvas, tile.level)

      // 添加瓦片专用的内存追踪
      if (texture) {
        this.updateTextureMemoryUsage(texture, canvas, tile.level, tileKey)
      }

      return texture
    } catch (error) {
      console.error('Failed to create tile texture:', error)
      // 如果创建瓦片失败，触发内存清理
      this.cleanupUnusedTiles()
      return null
    }
  }

  private cleanupUnusedTiles() {
    if (this.tileCache.size <= this.maxTilesInMemory) return

    // 找到不再活跃的瓦片
    const unusedTiles = Array.from(this.tileCache.keys())
      .filter((tileKey) => !this.activeTiles.has(tileKey))
      .map((tileKey) => ({ key: tileKey, tile: this.tiles.get(tileKey)! }))
      .sort((a, b) => a.tile.lastAccessed - b.tile.lastAccessed) // 按最后访问时间排序

    // 删除最久未使用的瓦片
    const tilesToRemove = Math.min(
      unusedTiles.length,
      this.tileCache.size - this.maxTilesInMemory + 2,
    )

    for (let i = 0; i < tilesToRemove; i++) {
      const { key: tileKey, tile } = unusedTiles[i]
      const texture = this.tileCache.get(tileKey)
      if (texture) {
        this.gl.deleteTexture(texture)
        this.tileCache.delete(tileKey)

        // 更新内存统计
        const freedMemory = tile.width * tile.height * 4
        this.memoryUsage.textures = Math.max(
          0,
          this.memoryUsage.textures - freedMemory,
        )

        this.tiles.delete(tileKey)
        console.info(
          `Cleaned up unused tile ${tileKey}, freed ${(freedMemory / 1024 / 1024).toFixed(2)} MiB`,
        )
      }
    }
  }

  // 高性能纹理创建（无错误检查）
  private createTextureOptimized(
    imageBitmap: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas,
    lodLevel: number,
  ): WebGLTexture | null {
    const texture = this.createTextureRaw(imageBitmap, lodLevel)

    // 计算并更新纹理内存占用
    if (texture) {
      this.updateTextureMemoryUsage(texture, imageBitmap, lodLevel)
    }

    return texture
  }

  // 原始纹理创建（无内存追踪）
  private createTextureRaw(
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

    // 计算并更新纹理内存占用
    this.updateTextureMemoryUsage(texture, imageBitmap, lodLevel)

    return texture
  }

  // 初始化瓦片系统
  private async initializeTiledSystem() {
    if (!this.originalImage) return

    console.info('Initializing tiled rendering system...')

    // 清理现有资源
    this.cleanupTiledSystem()

    // 创建低分辨率的全图纹理作为背景
    await this.createBackgroundTexture()

    // 延迟加载视口内的瓦片，让背景纹理先显示
    setTimeout(() => {
      this.updateVisibleTiles()
    }, 100)
  }

  // 创建低分辨率背景纹理
  private async createBackgroundTexture() {
    if (!this.originalImage || !this.originalImageBitmap) return

    try {
      // 移动设备使用更保守的背景尺寸
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const maxBackgroundSize = isMobile ? 1024 : 2048
      const aspectRatio = this.originalImage.width / this.originalImage.height

      let bgWidth: number, bgHeight: number
      if (aspectRatio > 1) {
        bgWidth = Math.min(maxBackgroundSize, this.originalImage.width)
        bgHeight = Math.round(bgWidth / aspectRatio)
      } else {
        bgHeight = Math.min(maxBackgroundSize, this.originalImage.height)
        bgWidth = Math.round(bgHeight * aspectRatio)
      }

      // 进一步限制内存使用
      const estimatedMemory = (bgWidth * bgHeight * 4) / (1024 * 1024)
      if (estimatedMemory > 32) {
        // 限制背景纹理不超过32MB
        const scale = Math.sqrt(32 / estimatedMemory)
        bgWidth = Math.round(bgWidth * scale)
        bgHeight = Math.round(bgHeight * scale)
      }

      console.info(
        `Creating background texture: ${bgWidth}×${bgHeight} (${((bgWidth * bgHeight * 4) / 1024 / 1024).toFixed(1)}MB)`,
      )

      // 直接创建背景纹理，不使用LOD系统
      const backgroundTexture = await this.createSmallBackgroundTexture(
        bgWidth,
        bgHeight,
      )
      if (backgroundTexture) {
        this.texture = backgroundTexture
        this.render()
        console.info('Background texture loaded')
      }
    } catch (error) {
      console.error('Failed to create background texture:', error)
      // 如果背景纹理创建失败，继续但没有背景
      console.warn('Continuing without background texture')
    }
  }

  // 创建小尺寸背景纹理
  private async createSmallBackgroundTexture(
    width: number,
    height: number,
  ): Promise<WebGLTexture | null> {
    if (!this.originalImageBitmap) return null

    try {
      // 使用 Canvas 创建缩略图（iOS Safari 兼容性更好）
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!

      // 设置高质量缩放
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // 绘制缩放后的图像
      ctx.drawImage(
        this.originalImageBitmap,
        0,
        0,
        this.originalImage!.width,
        this.originalImage!.height,
        0,
        0,
        width,
        height,
      )

      // 创建纹理（不使用内存追踪，因为这是背景纹理）
      const texture = this.createTextureRaw(canvas, 0)

      // 手动追踪背景纹理内存
      if (texture) {
        const memoryUsage = width * height * 4
        this.memoryUsage.textures += memoryUsage
        console.info(
          `Background texture memory: ${(memoryUsage / 1024 / 1024).toFixed(2)} MiB`,
        )
      }

      return texture
    } catch (error) {
      console.error('Failed to create small background texture:', error)
      return null
    }
  }

  // 传统 LOD 系统初始化
  private async initializeLODTextures() {
    if (!this.originalImage) return

    // 清理现有的 LOD 纹理
    this.cleanupLODTextures()

    try {
      // 根据图片大小调整加载策略
      const imagePixels = this.originalImage.width * this.originalImage.height
      const isLargeImage = imagePixels > 50 * 1024 * 1024 // 50M 像素
      const isHugeImage = imagePixels > 100 * 1024 * 1024 // 100M 像素

      console.info(
        `Image size: ${this.originalImage.width}×${this.originalImage.height} (${(imagePixels / 1024 / 1024).toFixed(1)}M pixels)`,
      )

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

      // 对于超大图片，使用更保守的策略
      if (isHugeImage) {
        // 超大图片只在必要时创建更高质量的纹理
        console.info('Huge image detected, using conservative loading strategy')
        return
      }

      // 2. 异步创建中等质量纹理 (LOD 2: 中等分辨率)
      const mediumDelay = isLargeImage ? 100 : 50
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
      }, mediumDelay)

      // 3. 对于大图片，延迟更久才创建高质量纹理
      if (!isLargeImage) {
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
        }, 200)
      }
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
    for (const [level, texture] of this.lodTextures) {
      gl.deleteTexture(texture)

      // 释放内存统计
      if (this.originalImage) {
        const lodConfig = LOD_LEVELS[level]
        const lodWidth = Math.max(
          1,
          Math.round(this.originalImage.width * lodConfig.scale),
        )
        const lodHeight = Math.max(
          1,
          Math.round(this.originalImage.height * lodConfig.scale),
        )
        const freedMemory = lodWidth * lodHeight * 4
        this.memoryUsage.textures = Math.max(
          0,
          this.memoryUsage.textures - freedMemory,
        )
      }
    }
    this.lodTextures.clear()

    // 清理主纹理引用
    this.texture = null

    // 重置内存统计
    this.memoryUsage.textures = 0
  }

  private selectOptimalLOD(): number {
    if (!this.originalImage) return 3 // 默认使用原始分辨率

    // 瓦片模式下使用不同的LOD选择逻辑
    if (this.useTiledRendering) {
      return this.selectOptimalLODForTiles()
    }

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

  // 瓦片模式专用的LOD选择逻辑
  private selectOptimalLODForTiles(): number {
    if (!this.originalImage) return 3

    // 计算当前显示的每像素密度
    // 如果缩放比例 >= 1，说明显示的像素密度等于或超过原图
    const pixelDensity = this.scale

    // 移动设备使用更保守的LOD策略
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

    if (isMobile) {
      // 移动设备LOD策略：更注重性能
      if (pixelDensity >= 4) {
        return 6 // 8x quality for very high zoom
      } else if (pixelDensity >= 2) {
        return 5 // 4x quality for high zoom
      } else if (pixelDensity >= 1) {
        return 4 // 2x quality for original size
      } else if (pixelDensity >= 0.5) {
        return 3 // 1x quality for medium zoom
      } else if (pixelDensity >= 0.25) {
        return 2 // 0.5x quality for low zoom
      } else {
        return 1 // 0.25x quality for very low zoom
      }
    } else {
      // 桌面设备LOD策略：更注重质量
      if (pixelDensity >= 8) {
        return 7 // 16x quality for extreme zoom
      } else if (pixelDensity >= 4) {
        return 6 // 8x quality for very high zoom
      } else if (pixelDensity >= 2) {
        return 5 // 4x quality for high zoom
      } else if (pixelDensity >= 1) {
        return 4 // 2x quality for original size
      } else if (pixelDensity >= 0.5) {
        return 3 // 1x quality for medium zoom
      } else if (pixelDensity >= 0.25) {
        return 2 // 0.5x quality for low zoom
      } else {
        return 1 // 0.25x quality for very low zoom
      }
    }
  }

  private async updateLOD() {
    // 如果 LOD 更新被暂停，直接返回
    if (this.lodUpdateSuspended) {
      return
    }

    // 瓦片渲染模式下更新可见瓦片
    if (this.useTiledRendering) {
      this.updateVisibleTiles()
      return
    }

    const optimalLOD = this.selectOptimalLOD()

    if (optimalLOD === this.currentLOD) {
      return // 无需更新
    }

    // 检查目标 LOD 纹理是否已存在
    let targetTexture = this.lodTextures.get(optimalLOD)

    if (!targetTexture) {
      // 在创建新纹理前检查内存压力
      const memoryPressureRatio =
        this.memoryUsage.textures / this.maxMemoryBudget
      if (memoryPressureRatio > this.memoryPressureThreshold) {
        console.warn(
          `Memory pressure too high (${(memoryPressureRatio * 100).toFixed(1)}%), skipping LOD ${optimalLOD} creation`,
        )
        return
      }

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

      // 预加载相邻的LOD级别以提供更流畅的体验（但要考虑内存压力）
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

      // 检查内存压力和并发LOD限制
      const memoryPressureRatio =
        this.memoryUsage.textures / this.maxMemoryBudget
      if (memoryPressureRatio > this.memoryPressureThreshold * 0.8) {
        console.info(
          `Memory pressure too high for preloading (${(memoryPressureRatio * 100).toFixed(1)}%)`,
        )
        return
      }

      if (this.lodTextures.size >= this.maxConcurrentLODs) {
        console.info(
          `Max concurrent LODs reached (${this.lodTextures.size}/${this.maxConcurrentLODs})`,
        )
        return
      }

      try {
        // 预加载下一个更高质量的 LOD（优先级更高）
        if (currentLOD < LOD_LEVELS.length - 1) {
          const nextLOD = currentLOD + 1
          if (
            !this.lodTextures.has(nextLOD) &&
            this.lodTextures.size < this.maxConcurrentLODs
          ) {
            const texture = await this.createLODTexture(nextLOD)
            if (texture && !this.lodUpdateSuspended) {
              this.lodTextures.set(nextLOD, texture)
            }
          }
        }

        // 预加载下一个更低质量的LOD（用于快速缩小）
        if (currentLOD > 0 && this.lodTextures.size < this.maxConcurrentLODs) {
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

    gl.useProgram(this.program)

    if (this.useTiledRendering) {
      this.renderTiles()
    } else {
      this.renderSingleTexture()
    }

    // Update debug info if enabled
    if (this.config.debug && this.onDebugUpdate) {
      this.updateDebugInfo()
    }
  }

  // 渲染单一纹理（传统模式）
  private renderSingleTexture() {
    const { gl } = this

    if (!this.texture) return

    // Set transformation matrix
    const matrixLocation = gl.getUniformLocation(this.program, 'u_matrix')
    gl.uniformMatrix3fv(matrixLocation, false, this.createMatrix())

    const imageLocation = gl.getUniformLocation(this.program, 'u_image')
    gl.uniform1i(imageLocation, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  // 渲染瓦片（瓦片模式）
  private renderTiles() {
    const { gl } = this

    // 首先渲染背景纹理（如果有）
    if (this.texture) {
      this.renderSingleTexture()
    }

    // 然后渲染高质量瓦片
    const matrixLocation = gl.getUniformLocation(this.program, 'u_matrix')
    const imageLocation = gl.getUniformLocation(this.program, 'u_image')
    gl.uniform1i(imageLocation, 0)
    gl.activeTexture(gl.TEXTURE0)

    // 渲染所有活跃的瓦片
    for (const tileKey of this.activeTiles) {
      const texture = this.tileCache.get(tileKey)
      const tile = this.tiles.get(tileKey)

      if (texture && tile) {
        // 计算瓦片的变换矩阵
        const tileMatrix = this.createTileMatrix(tile)
        gl.uniformMatrix3fv(matrixLocation, false, tileMatrix)

        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      }
    }
  }

  // 创建瓦片专用的变换矩阵
  private createTileMatrix(tile: TileInfo): Float32Array {
    // 计算瓦片在图片中的位置和尺寸
    const tileX = tile.x * this.tileSize
    const tileY = tile.y * this.tileSize
    const tileImageWidth = tile.width
    const tileImageHeight = tile.height

    // 计算瓦片在Canvas中的位置和尺寸
    const scaledTileWidth = tileImageWidth * this.scale
    const scaledTileHeight = tileImageHeight * this.scale

    const scaleX = scaledTileWidth / this.canvasWidth
    const scaleY = scaledTileHeight / this.canvasHeight

    // 计算瓦片相对于图片中心的偏移
    const tileCenterX = tileX + tileImageWidth / 2
    const tileCenterY = tileY + tileImageHeight / 2
    const imageCenterX = this.imageWidth / 2
    const imageCenterY = this.imageHeight / 2

    const offsetX = (tileCenterX - imageCenterX) * this.scale
    const offsetY = (tileCenterY - imageCenterY) * this.scale

    const translateX = ((this.translateX + offsetX) * 2) / this.canvasWidth
    const translateY = (-(this.translateY + offsetY) * 2) / this.canvasHeight

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

  private updateDebugInfo() {
    if (!this.onDebugUpdate) return

    const fitToScreenScale = this.getFitToScreenScale()
    const relativeScale = this.scale / fitToScreenScale

    // 计算有效的最大缩放值
    const originalSizeScale = 1
    const userMaxScale = fitToScreenScale * this.config.maxScale
    const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

    // 获取内存使用信息
    const estimatedTotal = this.getEstimatedTotalMemoryUsage()
    const runtimeMemory = this.getRuntimeMemoryUsage()
    const textureMemoryMiB = this.memoryUsage.textures / (1024 * 1024)
    const estimatedTotalMiB = estimatedTotal / (1024 * 1024)
    const runtimeMemoryMiB = runtimeMemory / (1024 * 1024)
    const memoryBudgetMiB = this.maxMemoryBudget / (1024 * 1024)
    const memoryPressureRatio = this.memoryUsage.textures / this.maxMemoryBudget

    this.onDebugUpdate.current({
      scale: this.scale,
      relativeScale,
      translateX: this.translateX,
      translateY: this.translateY,
      currentLOD: this.useTiledRendering
        ? this.selectOptimalLOD()
        : this.currentLOD,
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
      // 内存使用信息 (MiB 单位)
      memory: {
        textures: Number(textureMemoryMiB.toFixed(2)),
        estimated: Number(estimatedTotalMiB.toFixed(2)),
        runtime:
          runtimeMemory > 0 ? Number(runtimeMemoryMiB.toFixed(2)) : undefined,
        budget: Number(memoryBudgetMiB.toFixed(2)),
        pressure: Number((memoryPressureRatio * 100).toFixed(1)), // 百分比
        activeLODs: this.useTiledRendering ? 0 : this.lodTextures.size,
        maxConcurrentLODs: this.maxConcurrentLODs,
      },
      // 瓦片渲染信息
      tiling: this.useTiledRendering
        ? {
            enabled: true,
            tileSize: this.tileSize,
            activeTiles: this.activeTiles.size,
            cachedTiles: this.tileCache.size,
            maxTiles: this.maxTilesInMemory,
            loadingTiles: this.tileLoadPromises.size,
          }
        : {
            enabled: false,
          },
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

    // 瓦片模式下需要更新可见瓦片
    if (this.useTiledRendering) {
      this.updateVisibleTiles()
    }
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

      // 瓦片模式下需要更新可见瓦片
      if (this.useTiledRendering) {
        this.updateVisibleTiles()
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
    if (this.useTiledRendering) {
      this.cleanupTiledSystem()
    } else {
      this.cleanupLODTextures()
    }

    // 重置内存统计
    this.memoryUsage.textures = 0
    this.memoryUsage.estimated = 0
  }

  private notifyLoadingStateChange(isLoading: boolean, message?: string) {
    if (this.onLoadingStateChange) {
      this.onLoadingStateChange(isLoading, message, this.currentQuality)
    }
  }
}
