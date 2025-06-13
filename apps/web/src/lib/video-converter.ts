import { ArrayBufferTarget, Muxer } from 'mp4-muxer'

import { isSafari } from './device-viewport'
import { LRUCache } from './lru-cache'

interface ConversionProgress {
  isConverting: boolean
  progress: number
  message: string
}

interface ConversionResult {
  success: boolean
  videoUrl?: string
  error?: string
  convertedSize?: number
  method?: 'webcodecs'
}

// Global video cache instance using the generic LRU cache with custom cleanup
const videoCache: LRUCache<string, ConversionResult> = new LRUCache<
  string,
  ConversionResult
>(10, (value, key, reason) => {
  if (value.videoUrl) {
    try {
      URL.revokeObjectURL(value.videoUrl)
      console.info(`Video cache: Revoked blob URL - ${reason}`)
    } catch (error) {
      console.warn(`Failed to revoke video blob URL (${reason}):`, error)
    }
  }
})

// 检查 WebCodecs 支持
export function isWebCodecsSupported(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined' &&
    typeof EncodedVideoChunk !== 'undefined'
  )
}

// 检查浏览器是否支持视频转换（WebCodecs 或 FFmpeg）
export function isVideoConversionSupported(): boolean {
  return (
    isWebCodecsSupported() ||
    (typeof WebAssembly !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      typeof SharedArrayBuffer !== 'undefined')
  )
}

// 使用简化的 MediaRecorder 方式转换视频
function convertVideoWithWebCodecs(
  videoUrl: string,
  onProgress?: (progress: ConversionProgress) => void,
  preferMp4 = true,
): Promise<ConversionResult> {
  return new Promise((resolve) => {
    let muxer: Muxer<ArrayBufferTarget> | null = null
    let encoder: VideoEncoder | null = null
    let conversionHasFailed = false

    const cleanup = () => {
      if (encoder?.state !== 'closed') encoder?.close()
      muxer = null
      encoder = null
    }

    const startConversion = async () => {
      try {
        onProgress?.({
          isConverting: true,
          progress: 0,
          message: 'Initializing video converter...',
        })

        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.muted = true
        video.playsInline = true

        onProgress?.({
          isConverting: true,
          progress: 10,
          message: 'Loading video file...',
        })

        await new Promise<void>((videoResolve, videoReject) => {
          video.onloadedmetadata = () => videoResolve()
          video.onerror = (e) =>
            videoReject(new Error(`Failed to load video metadata: ${e}`))
          video.src = videoUrl
        })

        const { videoWidth, videoHeight, duration } = video
        if (!duration || !Number.isFinite(duration)) {
          throw new Error(
            'Could not determine video duration or duration is not finite.',
          )
        }
        const frameRate = 30 // Desired frame rate

        console.info(
          `Original video: ${videoWidth}x${videoHeight}, duration: ${duration.toFixed(
            2,
          )}s`,
        )

        let mimeType = 'video/webm; codecs=vp9'
        let codec = 'vp09.00.10.08' // VP9, profile 0, level 1.0, 8-bit
        let outputFormat = 'WebM'

        if (preferMp4) {
          const avcConfigs = [
            // From highest quality/level to lowest
            { codec: 'avc1.640033', name: 'H.264 High @L5.1' }, // 4K+
            { codec: 'avc1.64002A', name: 'H.264 High @L4.2' }, // 1080p
            { codec: 'avc1.4D4029', name: 'H.264 Main @L4.1' }, // 1080p
            { codec: 'avc1.42E01F', name: 'H.264 Baseline @L3.1' }, // 720p
          ]

          for (const config of avcConfigs) {
            if (
              await VideoEncoder.isConfigSupported({
                codec: config.codec,
                width: videoWidth,
                height: videoHeight,
              })
            ) {
              mimeType = `video/mp4; codecs=${config.codec}`
              codec = config.codec
              outputFormat = 'MP4'
              console.info(
                `Using supported codec: ${config.name} (${config.codec})`,
              )
              break
            }
          }
        }

        if (outputFormat === 'WebM' && preferMp4) {
          console.warn(
            'Could not find a supported MP4 codec for this resolution. Falling back to WebM.',
          )
        }

        console.info(`Target format: ${outputFormat} (${codec})`)

        muxer = new Muxer({
          target: new ArrayBufferTarget(),
          video: {
            codec: outputFormat === 'MP4' ? 'avc' : 'vp9',
            width: videoWidth,
            height: videoHeight,
            frameRate,
          },
          fastStart: 'fragmented',
          firstTimestampBehavior: 'offset',
        })

        encoder = new VideoEncoder({
          output: (chunk, meta) => {
            if (conversionHasFailed) return
            muxer!.addVideoChunk(chunk, meta)
          },
          error: (e) => {
            if (conversionHasFailed) return
            conversionHasFailed = true
            console.error('VideoEncoder error:', e)
            resolve({ success: false, error: e.message })
          },
        })
        encoder.configure({
          codec,
          width: videoWidth,
          height: videoHeight,
          bitrate: 5_000_000, // 5 Mbps
          framerate: frameRate,
        })

        const totalFrames = Math.floor(duration * frameRate)

        onProgress?.({
          isConverting: true,
          progress: 20,
          message: 'Starting conversion...',
        })

        const frameInterval = 1 / frameRate
        for (let i = 0; i < totalFrames; i++) {
          if (conversionHasFailed) {
            console.warn('Aborting conversion due to encoder error.')
            return
          }

          const time = i * frameInterval
          video.currentTime = time
          await new Promise((r) => (video.onseeked = r))

          const frame = new VideoFrame(video, {
            timestamp: time * 1_000_000,
            duration: frameInterval * 1_000_000,
          })

          await encoder.encode(frame)
          frame.close()

          const progress = 20 + ((i + 1) / totalFrames) * 70
          onProgress?.({
            isConverting: true,
            progress,
            message: `Converting... ${i + 1}/${totalFrames} frames`,
          })
        }

        if (conversionHasFailed) return

        await encoder.flush()
        muxer.finalize()

        const { buffer } = muxer.target
        const blob = new Blob([buffer], { type: mimeType })
        const url = URL.createObjectURL(blob)

        onProgress?.({
          isConverting: false,
          progress: 100,
          message: 'Conversion complete',
        })

        resolve({
          success: true,
          videoUrl: url,
          convertedSize: blob.size,
          method: 'webcodecs',
        })
      } catch (error) {
        console.error('Video conversion failed:', error)
        resolve({
          success: false,
          error:
            error instanceof Error ? error.message : 'Video conversion failed',
        })
      } finally {
        cleanup()
      }
    }
    startConversion()
  })
}

// 检测浏览器是否原生支持 MOV 格式
function isBrowserSupportMov(): boolean {
  // 创建一个临时的 video 元素来测试格式支持
  const video = document.createElement('video')

  // 检测是否支持 MOV 容器格式
  const canPlayMov = video.canPlayType('video/quicktime')

  // Safari 通常原生支持 MOV
  if (isSafari) {
    return true
  }

  // 对于其他浏览器，只有当 canPlayType 明确返回支持时才认为支持
  // 'probably' 或 'maybe' 表示支持，空字符串表示不支持
  return canPlayMov === 'probably' || canPlayMov === 'maybe'
}

// 检测是否需要转换 mov 文件
export function needsVideoConversion(url: string): boolean {
  const lowerUrl = url.toLowerCase()
  const isMovFile = lowerUrl.includes('.mov') || lowerUrl.endsWith('.mov')

  // 如果不是 MOV 文件，不需要转换
  if (!isMovFile) {
    return false
  }

  // 如果浏览器原生支持 MOV，不需要转换
  if (isBrowserSupportMov()) {
    console.info('Browser natively supports MOV format, skipping conversion')
    return false
  }

  // 浏览器不支持 MOV，需要转换
  console.info('Browser does not support MOV format, conversion needed')
  return true
}

export async function convertMovToMp4(
  videoUrl: string,
  onProgress?: (progress: ConversionProgress) => void,
  forceReconvert = false, // 添加强制重新转换参数
  preferMp4 = true, // 新增参数：是否优先选择MP4格式
): Promise<ConversionResult> {
  // Check cache first, unless forced to reconvert
  if (!forceReconvert) {
    const cachedResult = videoCache.get(videoUrl)
    if (cachedResult) {
      console.info('Using cached video conversion result')
      onProgress?.({
        isConverting: false,
        progress: 100,
        message: '使用缓存结果',
      })
      console.info(`Cached video conversion result:`, cachedResult)
      return cachedResult
    }
  } else {
    console.info('Force reconversion: clearing cached result for', videoUrl)
    videoCache.delete(videoUrl)
  }

  // 优先尝试 WebCodecs
  if (isWebCodecsSupported()) {
    console.info('Using WebCodecs for HIGH QUALITY video conversion...')
    console.info(
      `🎯 Target format: ${preferMp4 ? 'MP4 (H.264)' : 'WebM (VP8/VP9)'}`,
    )
    onProgress?.({
      isConverting: true,
      progress: 0,
      message: '使用高质量 WebCodecs 转换器...',
    })

    const result = await convertVideoWithWebCodecs(
      videoUrl,
      onProgress,
      preferMp4,
    )

    // Cache the result
    videoCache.set(videoUrl, result)

    if (result.success) {
      console.info('WebCodecs conversion completed successfully and cached')
    } else {
      console.error('WebCodecs conversion failed:', result.error)
    }

    return result
  }

  console.info('WebCodecs not supported, falling back to FFmpeg...')

  const fallbackResult = {
    success: false,
    error: 'WebCodecs not supported in this browser',
  }

  return fallbackResult
}
