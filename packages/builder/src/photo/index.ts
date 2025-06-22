// 主要处理器
export type { PhotoProcessorOptions } from './processor.js'
export { processPhoto } from './processor.js'

// 图片处理管道
export type {
  PhotoProcessingContext,
  ProcessedImageData,
} from './image-pipeline.js'
export {
  executePhotoProcessingPipeline,
  preprocessImage,
  processImageWithSharp,
  processPhotoWithPipeline,
} from './image-pipeline.js'

// 缓存管理
export type { CacheableData, ThumbnailResult } from './cache-manager.js'
export {
  processExifData,
  processThumbnailAndBlurhash,
  processToneAnalysis,
  shouldProcessPhoto,
} from './cache-manager.js'

// Live Photo 处理
export type { LivePhotoResult } from './live-photo-handler.js'
export { createLivePhotoMap, processLivePhoto } from './live-photo-handler.js'

// 信息提取
export { extractPhotoInfo } from './info-extractor.js'

// Logger 适配器
export type { PhotoLogger, PhotoProcessingLoggers } from './logger-adapter.js'
export {
  CompatibleLoggerAdapter,
  createPhotoProcessingLoggers,
  getGlobalLoggers,
  LoggerAdapter,
  setGlobalLoggers,
  WorkerLoggerAdapter,
} from './logger-adapter.js'
