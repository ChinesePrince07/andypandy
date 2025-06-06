export interface WheelConfig {
  step: number
  wheelDisabled?: boolean
  touchPadDisabled?: boolean
}
export interface PinchConfig {
  step: number
  disabled?: boolean
}
export interface DoubleClickConfig {
  step: number
  disabled?: boolean
  mode: 'toggle' | 'zoom'
  animationTime: number
}
export interface PanningConfig {
  disabled?: boolean
  velocityDisabled?: boolean
}
export interface AlignmentAnimationConfig {
  sizeX: number
  sizeY: number
  velocityAlignmentTime: number
}
export interface VelocityAnimationConfig {
  sensitivity: number
  animationTime: number
}
export interface WebGLImageViewerProps {
  src: string
  className?: string
  width?: number // 可选的预知图片宽度，用于优化加载
  height?: number // 可选的预知图片高度，用于优化加载
  initialScale?: number
  minScale?: number
  maxScale?: number
  wheel?: WheelConfig
  pinch?: PinchConfig
  doubleClick?: DoubleClickConfig
  panning?: PanningConfig
  limitToBounds?: boolean
  centerOnInit?: boolean
  smooth?: boolean
  alignmentAnimation?: AlignmentAnimationConfig
  velocityAnimation?: VelocityAnimationConfig
  onZoomChange?: (originalScale: number, relativeScale: number) => void
  onImageCopied?: () => void
  onLoadingStateChange?: (
    isLoading: boolean,
    message?: string,
    quality?: 'high' | 'medium' | 'low' | 'unknown',
  ) => void
  debug?: boolean
}
export interface WebGLImageViewerRef {
  zoomIn: (animated?: boolean) => void
  zoomOut: (animated?: boolean) => void
  resetView: () => void
  getScale: () => number
}

export interface DebugInfo {
  scale: number
  relativeScale: number
  translateX: number
  translateY: number
  currentLOD: number
  lodLevels: number
  canvasSize: { width: number; height: number }
  imageSize: { width: number; height: number }
  fitToScreenScale: number
  userMaxScale: number
  effectiveMaxScale: number
  originalSizeScale: number
  renderCount: number
  maxTextureSize: number
  quality: 'high' | 'medium' | 'low' | 'unknown'
  isLoading: boolean
  memory: {
    textures: number // MiB
    estimated: number // MiB
    runtime?: number // MiB (如果可用)
    budget: number // MiB
    pressure: number // 百分比
    activeLODs: number
    maxConcurrentLODs: number
    onDemandStrategy?: boolean // 是否使用按需策略
  }
  tiling: {
    enabled: boolean
    tileSize?: number
    activeTiles?: number
    cachedTiles?: number
    maxTiles?: number
    loadingTiles?: number
  }
  visibleRegion?: {
    // 当前可视区域信息
    x: number
    y: number
    width: number
    height: number
  }
}
