/**
 * WebGL图像查看器常量配置
 *
 * 包含所有默认配置值、LOD级别定义等常量
 */

import type {
  AlignmentAnimationConfig,
  DoubleClickConfig,
  PanningConfig,
  PinchConfig,
  VelocityAnimationConfig,
  WheelConfig,
} from './interface'

/**
 * 默认滚轮配置
 */
export const defaultWheelConfig: WheelConfig = {
  step: 0.1,
  wheelDisabled: false,
  touchPadDisabled: false,
}

/**
 * 默认手势缩放配置
 */
export const defaultPinchConfig: PinchConfig = {
  step: 0.5,
  disabled: false,
}

/**
 * 默认双击配置
 */
export const defaultDoubleClickConfig: DoubleClickConfig = {
  step: 2,
  disabled: false,
  mode: 'toggle',
  animationTime: 200,
}

/**
 * 默认平移配置
 */
export const defaultPanningConfig: PanningConfig = {
  disabled: false,
  velocityDisabled: true,
}

/**
 * 默认对齐动画配置
 */
export const defaultAlignmentAnimation: AlignmentAnimationConfig = {
  sizeX: 0,
  sizeY: 0,
  velocityAlignmentTime: 0.2,
}

/**
 * 默认速度动画配置
 */
export const defaultVelocityAnimation: VelocityAnimationConfig = {
  sensitivity: 1,
  animationTime: 0.2,
}

/**
 * LOD (Level of Detail) 级别配置
 * 用于在不同缩放级别下提供合适分辨率的纹理
 */
export const LOD_LEVELS = [
  { scale: 0.125, maxViewportScale: 0.25 }, // LOD 0: 1/8 resolution for very zoomed out
  { scale: 0.25, maxViewportScale: 0.5 }, // LOD 1: 1/4 resolution for zoomed out
  { scale: 0.5, maxViewportScale: 1 }, // LOD 2: 1/2 resolution for normal view
  { scale: 1, maxViewportScale: 2 }, // LOD 3: full resolution for normal view
  { scale: 2, maxViewportScale: 4 }, // LOD 4: 2x resolution for zoomed in
  { scale: 4, maxViewportScale: 8 }, // LOD 5: 4x resolution for very zoomed in
  { scale: 8, maxViewportScale: 16 }, // LOD 6: 8x resolution for extreme zoom
  { scale: 16, maxViewportScale: Infinity }, // LOD 7: 16x resolution for maximum detail
] as const

// 移动设备检测（包含平板）
export const isMobileDevice = (() => {
  if (typeof window === 'undefined') return false
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ) ||
    // 现代检测方式：支持触摸且屏幕较小
    ('ontouchstart' in window && window.screen.width < 1024)
  )
})()

export const isSafari =
  /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)

// iOS设备检测
export const isIOS = (() => {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
})()

// Android设备检测
export const isAndroid = (() => {
  if (typeof window === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
})()

// 平板设备检测
export const isTablet = (() => {
  if (typeof window === 'undefined') return false
  return (
    /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent) ||
    // 现代检测方式：支持触摸且屏幕中等大小
    ('ontouchstart' in window &&
      window.screen.width >= 768 &&
      window.screen.width < 1024)
  )
})()

// 手机设备检测（不包含平板）
export const isPhone = (() => {
  if (typeof window === 'undefined') return false
  return (
    /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ) ||
    // 现代检测方式：支持触摸且屏幕很小
    ('ontouchstart' in window && window.screen.width < 768)
  )
})()

// iOS Safari检测
export const isIOSSafari = (() => {
  if (typeof window === 'undefined') return false
  return isIOS && isSafari
})()

// 设备性能等级估算
export const getDevicePerformanceLevel = (): 'low' | 'medium' | 'high' => {
  if (typeof window === 'undefined') return 'medium'

  // 基于设备类型和一些基本特征估算性能等级
  if (isPhone) {
    // 手机设备通常性能较低
    return window.devicePixelRatio > 2 ? 'medium' : 'low'
  } else if (isTablet) {
    // 平板设备中等性能
    return 'medium'
  } else {
    // 桌面设备通常高性能
    return navigator.hardwareConcurrency >= 8 ? 'high' : 'medium'
  }
}

// 设备内存估算 (MB)
export const getEstimatedDeviceMemory = (): number => {
  if (typeof window === 'undefined') return 2048

  // 尝试使用现代API获取设备内存
  if ('deviceMemory' in navigator) {
    return (navigator as any).deviceMemory * 1024 // GB转MB
  }

  // 基于设备类型估算
  if (isPhone) {
    return isIOS ? 4096 : 3072 // iOS通常内存更多
  } else if (isTablet) {
    return 6144
  } else {
    return 8192 // 桌面设备默认8GB
  }
}
