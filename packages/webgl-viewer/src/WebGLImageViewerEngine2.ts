import type { DebugInfo, WebGLImageViewerProps } from './interface'
import {
  createShader,
  FRAGMENT_SHADER_SOURCE,
  VERTEX_SHADER_SOURCE,
} from './shaders'

// 可视区域信息
interface VisibleRegion {
  x: number // 在原图中的x坐标
  y: number // 在原图中的y坐标
  width: number // 可视区域在原图中的宽度
  height: number // 可视区域在原图中的高度
}

export class WebGLImageViewerEngine2 {
  // 基础属性
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private program!: WebGLProgram

  // 图像相关
  private originalImage: HTMLImageElement | null = null
  private visibleTexture: WebGLTexture | null = null // 当前可视区域的纹理
  private previousTexture: WebGLTexture | null = null // 上一帧的纹理，用作背景
  private imageLoaded = false
  private originalImageSrc = ''

  // 变换状态
  private scale = 1
  private translateX = 0
  private translateY = 0

  // 画布和图像尺寸
  private canvasWidth = 0
  private canvasHeight = 0
  private imageWidth = 0
  private imageHeight = 0

  // 交互状态
  private isDragging = false
  private lastMouseX = 0
  private lastMouseY = 0
  private lastTouchDistance = 0

  // 触摸双击检测
  private lastTouchTime = 0
  private lastTouchX = 0
  private lastTouchY = 0
  private lastDoubleClickTime = 0
  private isOriginalSize = false

  // 防抖相关
  private updateDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private updateDebounceDelay = 150 // 缩放/平移结束后的防抖延迟

  // 可视区域缓存
  private lastVisibleRegion: VisibleRegion | null = null
  private visibleCanvas: HTMLCanvasElement | null = null // 用于创建可视区域纹理的离屏canvas

  // 临时偏移（用于实时交互）
  private tempOffsetX = 0
  private tempOffsetY = 0
  private isInteracting = false // 是否正在交互（拖拽或缩放）

  // 动画状态
  private isAnimating = false
  private animationStartTime = 0
  private animationDuration = 300 // ms
  private startScale = 1
  private targetScale = 1
  private startTranslateX = 0
  private startTranslateY = 0
  private targetTranslateX = 0
  private targetTranslateY = 0
  private pinchCenter: { x: number; y: number } | null = null // 双指缩放中心点

  // 配置和回调
  private config: Required<WebGLImageViewerProps>
  private onZoomChange?: (originalScale: number, relativeScale: number) => void
  private onImageCopied?: () => void
  private onLoadingStateChange?: (
    isLoading: boolean,
    message?: string,
    quality?: 'high' | 'medium' | 'low' | 'unknown',
  ) => void
  private onDebugUpdate?: React.RefObject<(debugInfo: DebugInfo) => void>

  // 绑定的事件处理器
  private boundHandleMouseDown: (e: MouseEvent) => void
  private boundHandleMouseMove: (e: MouseEvent) => void
  private boundHandleMouseUp: () => void
  private boundHandleWheel: (e: WheelEvent) => void
  private boundHandleDoubleClick: (e: MouseEvent) => void
  private boundHandleTouchStart: (e: TouchEvent) => void
  private boundHandleTouchMove: (e: TouchEvent) => void
  private boundHandleTouchEnd: (e: TouchEvent) => void
  private boundResizeCanvas: () => void

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

    // 通知初始化开始
    this.notifyLoadingStateChange(true, 'WebGL 初始化中...')

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    })

    if (!gl) {
      throw new Error('WebGL not supported')
    }

    this.gl = gl

    // 绑定事件处理器
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
    this.setupEventListeners()

    // 初始化完成
    this.notifyLoadingStateChange(false)
  }

  private setupCanvas() {
    this.resizeCanvas()
    window.addEventListener('resize', this.boundResizeCanvas)
  }

  private resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect()
    const devicePixelRatio = window.devicePixelRatio || 1

    this.canvasWidth = rect.width
    this.canvasHeight = rect.height

    // 设置canvas的实际像素尺寸
    const actualWidth = Math.round(rect.width * devicePixelRatio)
    const actualHeight = Math.round(rect.height * devicePixelRatio)

    this.canvas.width = actualWidth
    this.canvas.height = actualHeight
    this.gl.viewport(0, 0, actualWidth, actualHeight)

    if (this.imageLoaded) {
      // 窗口大小改变时，需要更新可视区域
      this.debouncedUpdateVisibleRegion()
      this.constrainScaleAndPosition()
      this.render()
      this.notifyZoomChange()
    }
  }

  private initWebGL() {
    const { gl } = this

    // 创建着色器
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

    // 创建程序
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

    // 启用混合以支持透明度
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    // 创建几何体（用于渲染纹理的矩形）
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ])

    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0])

    // 位置缓冲区
    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    // 纹理坐标缓冲区
    const texCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)

    const texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord')
    gl.enableVertexAttribArray(texCoordLocation)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)
  }

  async loadImage(
    url: string,
    preknownWidth?: number,
    preknownHeight?: number,
  ) {
    this.originalImageSrc = url
    this.notifyLoadingStateChange(true, '图片加载中...')

    // 如果提供了预知的尺寸，可以立即设置
    if (preknownWidth && preknownHeight) {
      this.imageWidth = preknownWidth
      this.imageHeight = preknownHeight
      this.setupInitialScaling()
    }

    const image = new Image()
    image.crossOrigin = 'anonymous'

    return new Promise<void>((resolve, reject) => {
      image.onload = async () => {
        try {
          this.originalImage = image

          // 如果没有预知尺寸，现在获取
          if (!preknownWidth || !preknownHeight) {
            this.imageWidth = image.width
            this.imageHeight = image.height
            this.setupInitialScaling()
          }

          this.notifyLoadingStateChange(true, '创建纹理中...')

          this.imageLoaded = true
          this.notifyLoadingStateChange(false)
          this.render()
          this.notifyZoomChange()

          requestAnimationFrame(() => {
            this.updateVisibleRegion()
          })
          resolve()
        } catch (error) {
          this.notifyLoadingStateChange(false)
          reject(error)
        }
      }

      image.onerror = () => {
        this.notifyLoadingStateChange(false)
        reject(new Error('Failed to load image'))
      }

      image.src = url
    })
  }

  private setupInitialScaling() {
    if (this.config.centerOnInit) {
      this.fitImageToScreen()
    } else {
      const fitToScreenScale = this.getFitToScreenScale()
      this.scale = fitToScreenScale * this.config.initialScale
    }
  }

  private fitImageToScreen() {
    const scaleX = this.canvasWidth / this.imageWidth
    const scaleY = this.canvasHeight / this.imageHeight
    const fitToScreenScale = Math.min(scaleX, scaleY)

    this.scale = fitToScreenScale * this.config.initialScale
    this.translateX = 0
    this.translateY = 0
    this.isOriginalSize = false
  }

  private getFitToScreenScale(): number {
    const scaleX = this.canvasWidth / this.imageWidth
    const scaleY = this.canvasHeight / this.imageHeight
    return Math.min(scaleX, scaleY)
  }

  // 计算当前可视区域（考虑临时偏移）
  private calculateVisibleRegion(): VisibleRegion {
    // 计算可视区域在图像坐标系中的范围
    const viewportWidth = this.canvasWidth / this.scale
    const viewportHeight = this.canvasHeight / this.scale

    // 考虑临时偏移
    const totalTranslateX = this.translateX + this.tempOffsetX
    const totalTranslateY = this.translateY + this.tempOffsetY

    // 视口中心在图像坐标系中的位置
    const centerX = this.imageWidth / 2 - totalTranslateX / this.scale
    const centerY = this.imageHeight / 2 - totalTranslateY / this.scale

    // 计算可视区域的边界
    const left = Math.max(0, centerX - viewportWidth / 2)
    const top = Math.max(0, centerY - viewportHeight / 2)
    const right = Math.min(this.imageWidth, centerX + viewportWidth / 2)
    const bottom = Math.min(this.imageHeight, centerY + viewportHeight / 2)

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    }
  }

  // 更新可视区域纹理
  private async updateVisibleRegion(): Promise<void> {
    if (!this.originalImage || !this.imageLoaded) return

    // 合并临时偏移到永久位置
    if (this.tempOffsetX !== 0 || this.tempOffsetY !== 0) {
      this.translateX += this.tempOffsetX
      this.translateY += this.tempOffsetY
      this.tempOffsetX = 0
      this.tempOffsetY = 0
    }

    const visibleRegion = this.calculateVisibleRegion()

    // 检查可视区域是否发生显著变化
    if (
      this.lastVisibleRegion &&
      this.isRegionSimilar(visibleRegion, this.lastVisibleRegion)
    ) {
      return
    }

    this.lastVisibleRegion = visibleRegion

    // 创建新的可视区域纹理
    const newTexture = await this.createVisibleTexture(visibleRegion)

    if (newTexture) {
      // 保存当前纹理作为背景纹理
      if (
        this.previousTexture &&
        this.previousTexture !== this.visibleTexture
      ) {
        this.gl.deleteTexture(this.previousTexture)
      }
      this.previousTexture = this.visibleTexture

      this.visibleTexture = newTexture
      this.render()
    }
  }

  // 检查两个区域是否相似（避免频繁更新）
  private isRegionSimilar(
    region1: VisibleRegion,
    region2: VisibleRegion,
  ): boolean {
    const threshold = 5 // 像素阈值
    return (
      Math.abs(region1.x - region2.x) < threshold &&
      Math.abs(region1.y - region2.y) < threshold &&
      Math.abs(region1.width - region2.width) < threshold &&
      Math.abs(region1.height - region2.height) < threshold
    )
  }

  // 创建可视区域的纹理（裁切 + 超采样）
  private async createVisibleTexture(
    region: VisibleRegion,
  ): Promise<WebGLTexture | null> {
    if (!this.originalImage) return null

    const devicePixelRatio = window.devicePixelRatio || 1

    // 计算输出尺寸（可视大小 × devicePixelRatio）
    const outputWidth = Math.round(this.canvasWidth * devicePixelRatio)
    const outputHeight = Math.round(this.canvasHeight * devicePixelRatio)

    // 创建或复用离屏canvas
    if (
      !this.visibleCanvas ||
      this.visibleCanvas.width !== outputWidth ||
      this.visibleCanvas.height !== outputHeight
    ) {
      this.visibleCanvas = document.createElement('canvas')
      this.visibleCanvas.width = outputWidth
      this.visibleCanvas.height = outputHeight
    }

    const ctx = this.visibleCanvas.getContext('2d')!

    // 清空画布
    ctx.clearRect(0, 0, outputWidth, outputHeight)

    // 设置高质量渲染
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // 计算源区域和目标区域，保持宽高比
    let destX = 0
    let destY = 0
    let destWidth = outputWidth
    let destHeight = outputHeight

    // 如果源区域的宽高比与画布不同，需要调整目标区域以保持比例
    const sourceAspect = region.width / region.height
    const canvasAspect = outputWidth / outputHeight

    if (Math.abs(sourceAspect - canvasAspect) > 0.001) {
      if (sourceAspect > canvasAspect) {
        // 源更宽，调整高度
        destHeight = outputWidth / sourceAspect
        destY = (outputHeight - destHeight) / 2
      } else {
        // 源更高，调整宽度
        destWidth = outputHeight * sourceAspect
        destX = (outputWidth - destWidth) / 2
      }
    }

    // 将可视区域的图像绘制到离屏canvas（超采样）
    ctx.drawImage(
      this.originalImage,
      region.x, // 源图像的x坐标
      region.y, // 源图像的y坐标
      region.width, // 源图像的宽度
      region.height, // 源图像的高度
      destX, // 目标canvas的x坐标
      destY, // 目标canvas的y坐标
      destWidth, // 目标canvas的宽度
      destHeight, // 目标canvas的高度
    )

    // 创建WebGL纹理
    const { gl } = this
    const texture = gl.createTexture()
    if (!texture) return null

    gl.bindTexture(gl.TEXTURE_2D, texture)

    // 设置纹理参数
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    // 上传纹理数据
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.visibleCanvas,
    )

    return texture
  }

  // 防抖更新可视区域
  private debouncedUpdateVisibleRegion() {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer)
    }

    this.updateDebounceTimer = setTimeout(() => {
      this.updateDebounceTimer = null
      this.isInteracting = false
      this.updateVisibleRegion()
    }, this.updateDebounceDelay)
  }

  private render() {
    const { gl } = this

    // 确保视口设置正确
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)

    // 清除画布
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.program)

    const matrixLocation = gl.getUniformLocation(this.program, 'u_matrix')
    const imageLocation = gl.getUniformLocation(this.program, 'u_image')

    // 如果正在交互并且有背景纹理，先渲染背景纹理
    if (this.isInteracting && this.previousTexture && this.visibleTexture) {
      // 背景纹理也需要应用相同的变换，这样才能对齐
      gl.uniformMatrix3fv(matrixLocation, false, this.createMatrix())
      gl.uniform1i(imageLocation, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.previousTexture)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    // 渲染当前纹理
    if (this.visibleTexture) {
      gl.uniformMatrix3fv(matrixLocation, false, this.createMatrix())
      gl.uniform1i(imageLocation, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.visibleTexture)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    // 更新调试信息
    if (this.config.debug && this.onDebugUpdate) {
      this.updateDebugInfo()
    }
  }

  private createMatrix(): Float32Array {
    // 如果正在交互，应用临时偏移
    if (
      this.isInteracting &&
      (this.tempOffsetX !== 0 || this.tempOffsetY !== 0)
    ) {
      // 计算临时偏移在NDC空间中的值
      const translateX = (this.tempOffsetX * 2) / this.canvasWidth
      const translateY = -(this.tempOffsetY * 2) / this.canvasHeight

      return new Float32Array([1, 0, 0, 0, 1, 0, translateX, translateY, 1])
    }

    // 默认情况下，纹理已经是正确的可视区域，不需要变换
    return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
  }

  private constrainImagePosition() {
    if (!this.config.limitToBounds) return

    const fitScale = this.getFitToScreenScale()

    // 如果当前缩放小于或等于适应屏幕的缩放，居中图像
    if (this.scale <= fitScale) {
      this.translateX = 0
      this.translateY = 0
      return
    }

    // 否则，限制图像在合理范围内
    const scaledWidth = this.imageWidth * this.scale
    const scaledHeight = this.imageHeight * this.scale

    // 计算最大允许的平移量
    const maxTranslateX = Math.max(0, (scaledWidth - this.canvasWidth) / 2)
    const maxTranslateY = Math.max(0, (scaledHeight - this.canvasHeight) / 2)

    // 限制平移
    this.translateX = Math.max(
      -maxTranslateX,
      Math.min(maxTranslateX, this.translateX),
    )
    this.translateY = Math.max(
      -maxTranslateY,
      Math.min(maxTranslateY, this.translateY),
    )
  }

  private constrainTempOffset() {
    if (!this.config.limitToBounds) return

    const fitScale = this.getFitToScreenScale()

    // 如果当前缩放小于或等于适应屏幕的缩放，重置偏移
    if (this.scale <= fitScale) {
      this.tempOffsetX = -this.translateX
      this.tempOffsetY = -this.translateY
      return
    }

    // 计算带临时偏移的总偏移
    const totalTranslateX = this.translateX + this.tempOffsetX
    const totalTranslateY = this.translateY + this.tempOffsetY

    // 计算最大允许的平移量
    const scaledWidth = this.imageWidth * this.scale
    const scaledHeight = this.imageHeight * this.scale
    const maxTranslateX = Math.max(0, (scaledWidth - this.canvasWidth) / 2)
    const maxTranslateY = Math.max(0, (scaledHeight - this.canvasHeight) / 2)

    // 计算约束后的总偏移
    const constrainedTotalX = Math.max(
      -maxTranslateX,
      Math.min(maxTranslateX, totalTranslateX),
    )
    const constrainedTotalY = Math.max(
      -maxTranslateY,
      Math.min(maxTranslateY, totalTranslateY),
    )

    // 更新临时偏移
    this.tempOffsetX = constrainedTotalX - this.translateX
    this.tempOffsetY = constrainedTotalY - this.translateY
  }

  private constrainScaleAndPosition() {
    // 限制缩放倍数
    const fitToScreenScale = this.getFitToScreenScale()
    const absoluteMinScale = fitToScreenScale * this.config.minScale
    const originalSizeScale = 1
    const userMaxScale = fitToScreenScale * this.config.maxScale
    const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

    if (this.scale < absoluteMinScale) {
      this.scale = absoluteMinScale
    } else if (this.scale > effectiveMaxScale) {
      this.scale = effectiveMaxScale
    }

    // 限制位置
    this.constrainImagePosition()
  }

  // 事件处理
  private setupEventListeners() {
    this.canvas.addEventListener('mousedown', this.boundHandleMouseDown)
    this.canvas.addEventListener('mousemove', this.boundHandleMouseMove)
    this.canvas.addEventListener('mouseup', this.boundHandleMouseUp)
    this.canvas.addEventListener('wheel', this.boundHandleWheel)
    this.canvas.addEventListener('dblclick', this.boundHandleDoubleClick)
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

    this.isAnimating = false
    this.isDragging = true
    this.isInteracting = true
    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isDragging || this.config.panning.disabled) return

    const deltaX = e.clientX - this.lastMouseX
    const deltaY = e.clientY - this.lastMouseY

    // 更新临时偏移
    this.tempOffsetX += deltaX
    this.tempOffsetY += deltaY

    // 应用边界约束
    this.constrainTempOffset()

    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY

    // 立即渲染以实现实时跟手
    this.render()

    // 拖动时防抖更新可视区域
    this.debouncedUpdateVisibleRegion()
  }

  private handleMouseUp() {
    this.isDragging = false

    // 如果有临时偏移，触发最终的可视区域更新
    if (this.tempOffsetX !== 0 || this.tempOffsetY !== 0) {
      this.debouncedUpdateVisibleRegion()
    }
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault()

    if (this.config.wheel.wheelDisabled) return

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

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault()

    if (this.isAnimating) {
      this.isAnimating = false
      return
    }

    if (e.touches.length === 1 && !this.config.panning.disabled) {
      const touch = e.touches[0]
      const now = Date.now()

      // 检测双击
      if (
        !this.config.doubleClick.disabled &&
        now - this.lastTouchTime < 300 &&
        Math.abs(touch.clientX - this.lastTouchX) < 50 &&
        Math.abs(touch.clientY - this.lastTouchY) < 50
      ) {
        this.handleTouchDoubleTap(touch.clientX, touch.clientY)
        this.lastTouchTime = 0
        return
      }

      this.isDragging = true
      this.isInteracting = true
      this.lastMouseX = touch.clientX
      this.lastMouseY = touch.clientY
      this.lastTouchTime = now
      this.lastTouchX = touch.clientX
      this.lastTouchY = touch.clientY
    } else if (e.touches.length === 2 && !this.config.pinch.disabled) {
      this.isDragging = false
      this.isInteracting = true
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      this.lastTouchDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2),
      )

      const rect = this.canvas.getBoundingClientRect()
      this.pinchCenter = {
        x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
        y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
      }
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

      // 更新临时偏移
      this.tempOffsetX += deltaX
      this.tempOffsetY += deltaY

      // 应用边界约束
      this.constrainTempOffset()

      this.lastMouseX = e.touches[0].clientX
      this.lastMouseY = e.touches[0].clientY

      // 立即渲染以实现实时跟手
      this.render()

      // 触摸移动时防抖更新可视区域
      this.debouncedUpdateVisibleRegion()
    } else if (e.touches.length === 2 && !this.config.pinch.disabled) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2),
      )

      if (this.lastTouchDistance > 0 && this.pinchCenter) {
        const scaleFactor = distance / this.lastTouchDistance
        const newScale = this.scale * scaleFactor

        // 获取当前的双指中心点
        const currentCenterX = (touch1.clientX + touch2.clientX) / 2
        const currentCenterY = (touch1.clientY + touch2.clientY) / 2

        const rect = this.canvas.getBoundingClientRect()
        const centerX = currentCenterX - rect.left
        const centerY = currentCenterY - rect.top

        // 限制缩放范围
        const fitToScreenScale = this.getFitToScreenScale()
        const absoluteMinScale = fitToScreenScale * this.config.minScale
        const originalSizeScale = 1
        const userMaxScale = fitToScreenScale * this.config.maxScale
        const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

        if (newScale >= absoluteMinScale && newScale <= effectiveMaxScale) {
          // 计算缩放中心点在图像坐标系中的位置
          const zoomX =
            (centerX - this.canvasWidth / 2 - this.translateX) / this.scale
          const zoomY =
            (centerY - this.canvasHeight / 2 - this.translateY) / this.scale

          // 更新缩放
          this.scale = newScale

          // 更新平移以保持缩放中心点不变
          this.translateX = centerX - this.canvasWidth / 2 - zoomX * this.scale
          this.translateY = centerY - this.canvasHeight / 2 - zoomY * this.scale

          // 立即渲染以实现实时跟手
          this.render()
          this.notifyZoomChange()
        }
      }

      this.lastTouchDistance = distance
    }
  }

  private handleTouchEnd(_e: TouchEvent) {
    this.isDragging = false

    // 如果刚结束双指缩放
    if (this.lastTouchDistance > 0) {
      this.lastTouchDistance = 0
      this.pinchCenter = null

      // 触发可视区域更新
      this.debouncedUpdateVisibleRegion()

      // 如果开启了平滑动画，进行边界约束动画
      if (this.config.smooth) {
        // 应用缩放和位置约束
        const tempScale = this.scale
        const tempTranslateX = this.translateX
        const tempTranslateY = this.translateY

        this.constrainScaleAndPosition()

        // 如果约束后的值与当前值不同，启动动画
        if (
          Math.abs(this.scale - tempScale) > 0.001 ||
          Math.abs(this.translateX - tempTranslateX) > 1 ||
          Math.abs(this.translateY - tempTranslateY) > 1
        ) {
          const targetScale = this.scale
          const targetTranslateX = this.translateX
          const targetTranslateY = this.translateY

          this.scale = tempScale
          this.translateX = tempTranslateX
          this.translateY = tempTranslateY

          this.startAnimation(
            targetScale,
            targetTranslateX,
            targetTranslateY,
            200,
          )
        }
      } else {
        // 没有动画时直接应用约束
        this.constrainScaleAndPosition()
        this.render()
      }
    }

    // 如果有临时偏移（拖拽结束），触发最终的可视区域更新
    if (this.tempOffsetX !== 0 || this.tempOffsetY !== 0) {
      this.debouncedUpdateVisibleRegion()
    }
  }

  private handleTouchDoubleTap(clientX: number, clientY: number) {
    if (this.config.doubleClick.disabled) return

    const rect = this.canvas.getBoundingClientRect()
    const touchX = clientX - rect.left
    const touchY = clientY - rect.top

    this.performDoubleClickAction(touchX, touchY)
  }

  private performDoubleClickAction(x: number, y: number) {
    this.isAnimating = false

    if (this.config.doubleClick.mode === 'toggle') {
      const fitToScreenScale = this.getFitToScreenScale()
      const absoluteMinScale = fitToScreenScale * this.config.minScale
      const originalSizeScale = 1
      const userMaxScale = fitToScreenScale * this.config.maxScale
      const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

      if (this.isOriginalSize) {
        // 动画到适应屏幕大小
        const targetScale = Math.max(
          absoluteMinScale,
          Math.min(effectiveMaxScale, fitToScreenScale),
        )

        const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
        const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale

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
        // 动画到原始大小
        const targetScale = Math.max(
          absoluteMinScale,
          Math.min(effectiveMaxScale, originalSizeScale),
        )

        const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
        const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale

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
      // 缩放模式
      this.zoomAt(x, y, this.config.doubleClick.step, true)
    }
  }

  private zoomAt(x: number, y: number, scaleFactor: number, animated = false) {
    const newScale = this.scale * scaleFactor
    const fitToScreenScale = this.getFitToScreenScale()

    const absoluteMinScale = fitToScreenScale * this.config.minScale
    const originalSizeScale = 1
    const userMaxScale = fitToScreenScale * this.config.maxScale
    const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

    // 限制缩放
    if (newScale < absoluteMinScale || newScale > effectiveMaxScale) return

    if (animated && this.config.smooth) {
      // 动画缩放
      const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
      const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale

      const targetTranslateX = x - this.canvasWidth / 2 - zoomX * newScale
      const targetTranslateY = y - this.canvasHeight / 2 - zoomY * newScale

      this.startAnimation(newScale, targetTranslateX, targetTranslateY)
    } else {
      // 立即缩放
      const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
      const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale

      this.scale = newScale

      this.translateX = x - this.canvasWidth / 2 - zoomX * this.scale
      this.translateY = y - this.canvasHeight / 2 - zoomY * this.scale

      this.constrainImagePosition()
      this.render()
      this.notifyZoomChange()

      // 缩放后防抖更新可视区域
      this.debouncedUpdateVisibleRegion()
    }
  }

  // 动画相关
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
    this.animationStartTime = performance.now()
    this.animationDuration = animationTime || (this.config.smooth ? 300 : 0)
    this.startScale = this.scale
    this.targetScale = targetScale
    this.startTranslateX = this.translateX
    this.startTranslateY = this.translateY

    // 应用约束到目标位置
    const tempScale = this.scale
    const tempTranslateX = this.translateX
    const tempTranslateY = this.translateY

    this.scale = targetScale
    this.translateX = targetTranslateX
    this.translateY = targetTranslateY
    this.constrainImagePosition()

    this.targetTranslateX = this.translateX
    this.targetTranslateY = this.translateY

    // 恢复当前状态
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

    // 插值缩放和平移
    this.scale =
      this.startScale + (this.targetScale - this.startScale) * easedProgress
    this.translateX =
      this.startTranslateX +
      (this.targetTranslateX - this.startTranslateX) * easedProgress
    this.translateY =
      this.startTranslateY +
      (this.targetTranslateY - this.startTranslateY) * easedProgress

    // 动画期间也需要更新可视区域
    this.updateVisibleRegion()
    this.notifyZoomChange()

    if (progress < 1) {
      requestAnimationFrame(() => this.animate())
    } else {
      this.isAnimating = false
      // 确保最终值精确
      this.scale = this.targetScale
      this.translateX = this.targetTranslateX
      this.translateY = this.targetTranslateY
      this.render()
      this.notifyZoomChange()

      // 动画完成后最终更新可视区域
      this.updateVisibleRegion()
    }
  }

  private notifyZoomChange() {
    if (this.onZoomChange) {
      const originalScale = this.scale
      const fitToScreenScale = this.getFitToScreenScale()
      const relativeScale = this.scale / fitToScreenScale

      this.onZoomChange(originalScale, relativeScale)
    }
  }

  private notifyLoadingStateChange(isLoading: boolean, message?: string) {
    if (this.onLoadingStateChange) {
      this.onLoadingStateChange(isLoading, message, 'high')
    }
  }

  private updateDebugInfo() {
    if (!this.onDebugUpdate?.current) return

    const fitToScreenScale = this.getFitToScreenScale()
    const relativeScale = this.scale / fitToScreenScale
    const visibleRegion =
      this.lastVisibleRegion || this.calculateVisibleRegion()

    this.onDebugUpdate.current({
      scale: this.scale,
      relativeScale,
      translateX: this.translateX,
      translateY: this.translateY,
      currentLOD: 0, // 新算法不使用LOD
      lodLevels: 1,
      canvasSize: { width: this.canvasWidth, height: this.canvasHeight },
      imageSize: { width: this.imageWidth, height: this.imageHeight },
      fitToScreenScale,
      userMaxScale: fitToScreenScale * this.config.maxScale,
      effectiveMaxScale: Math.max(fitToScreenScale * this.config.maxScale, 1),
      originalSizeScale: 1,
      renderCount: performance.now(),
      maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
      quality: 'high',
      isLoading: false,
      memory: {
        textures: 0, // 简化的内存统计
        estimated: 0,
        runtime: undefined,
        budget: 0,
        pressure: 0,
        activeLODs: 0,
        maxConcurrentLODs: 0,
        onDemandStrategy: true,
      },
      tiling: {
        enabled: false,
      },
      // 新增可视区域信息
      visibleRegion: {
        x: Math.round(visibleRegion.x),
        y: Math.round(visibleRegion.y),
        width: Math.round(visibleRegion.width),
        height: Math.round(visibleRegion.height),
      },
    })
  }

  // 公共方法
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

  async copyOriginalImageToClipboard() {
    try {
      const response = await fetch(this.originalImageSrc)
      const blob = await response.blob()

      if (!navigator.clipboard || !navigator.clipboard.write) {
        console.warn('Clipboard API not supported')
        return
      }

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

  public destroy() {
    this.removeEventListeners()
    window.removeEventListener('resize', this.boundResizeCanvas)

    // 停止动画
    this.isAnimating = false

    // 清理防抖定时器
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer)
      this.updateDebounceTimer = null
    }

    // 清理WebGL资源
    if (this.visibleTexture) {
      this.gl.deleteTexture(this.visibleTexture)
      this.visibleTexture = null
    }

    if (this.previousTexture) {
      this.gl.deleteTexture(this.previousTexture)
      this.previousTexture = null
    }

    // 清理离屏canvas
    this.visibleCanvas = null

    // 清理图像引用
    this.originalImage = null
    this.lastVisibleRegion = null
  }
}
