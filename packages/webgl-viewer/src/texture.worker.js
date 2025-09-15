// @ts-nocheck
/// <reference lib="webworker" />

// Keep only the original image Blob and parsed dimensions to avoid
// holding a decoded 100MP ImageBitmap in memory (iOS Safari crash risk)
let originalBlob = null
let originalWidth = 0
let originalHeight = 0
let supportsRegionDecode = false
let baseBitmap = null // fallback decoded, downscaled whole image

function isIOS() {
  try {
    // In workers, navigator.userAgent is available
    const ua = (self.navigator && self.navigator.userAgent) || ''
    return /iP(?:ad|hone|od)/.test(ua)
  } catch {
    return false
  }
}

const MAX_BASE_DECODE_DIM = isIOS() ? 4096 : 8192

const TILE_SIZE = 512 // Must be same as in WebGLImageViewerEngine.ts

// 简化的 LOD 级别
const WORKER_SIMPLE_LOD_LEVELS = [
  { scale: 0.25 }, // 极低质量
  { scale: 0.5 }, // 低质量
  { scale: 1 }, // 正常质量
  { scale: 2 }, // 高质量
  { scale: 4 }, // 超高质量
]
/**
 *
 * @param {MessageEvent} e
 * @returns
 */
self.onmessage = async (e) => {
  const { type, payload } = e.data
  console.info('[Worker] Received message:', type)

  switch (type) {
    case 'load-image': {
      const { url } = payload
      try {
        const response = await fetch(url, { mode: 'cors' })
        const blob = await response.blob()

        // Parse image dimensions from headers to avoid decoding full image
        const { width, height } = await getImageSizeFromBlob(blob)
        if (!width || !height) {
          // Fallback: if we cannot parse, last resort decode just to get size
          // Note: this may be heavy; try to downscale aggressively
          const probe = await createImageBitmap(blob, {
            resizeWidth: 64,
            resizeHeight: 64,
          })
          // Width/height unknown from probe; we must bail with an error
          // and let main thread handle sizing.
          probe.close()
          throw new Error('Unsupported image format for header parsing')
        }

        originalBlob = blob
        originalWidth = width
        originalHeight = height

        // Feature detect region decode
        supportsRegionDecode = true
        try {
          const test = await createImageBitmap(originalBlob, 0, 0, 1, 1)
          test.close()
        } catch {
          supportsRegionDecode = false
        }

        // If region decode is not supported, prepare a downscaled base bitmap
        if (!supportsRegionDecode) {
          const scale = Math.min(
            1,
            MAX_BASE_DECODE_DIM / Math.max(width, height),
          )
          const decW = Math.max(1, Math.round(width * scale))
          const decH = Math.max(1, Math.round(height * scale))
          baseBitmap = await createImageBitmap(originalBlob, {
            resizeWidth: decW,
            resizeHeight: decH,
            resizeQuality: 'medium',
          })
        }

        self.postMessage({ type: 'init-done' })

        // Create a small initial LOD bitmap directly from Blob or baseBitmap
        const lodLevel = 1 // initial medium LOD
        const lodConfig = WORKER_SIMPLE_LOD_LEVELS[lodLevel]
        const finalWidth = Math.max(1, Math.round(width * lodConfig.scale))
        const finalHeight = Math.max(1, Math.round(height * lodConfig.scale))

        let initialLODBitmap
        if (supportsRegionDecode) {
          initialLODBitmap = await createImageBitmap(originalBlob, {
            resizeWidth: finalWidth,
            resizeHeight: finalHeight,
            resizeQuality: 'medium',
          })
        } else if (baseBitmap) {
          // Scale baseBitmap again to the target LOD size
          // Use OffscreenCanvas if available, otherwise createImageBitmap(baseBitmap)
          if (typeof OffscreenCanvas !== 'undefined') {
            const canvas = new OffscreenCanvas(finalWidth, finalHeight)
            const ctx = canvas.getContext('2d')
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'medium'
            ctx.drawImage(baseBitmap, 0, 0, finalWidth, finalHeight)
            initialLODBitmap = canvas.transferToImageBitmap()
          } else {
            initialLODBitmap = await createImageBitmap(baseBitmap, {
              resizeWidth: finalWidth,
              resizeHeight: finalHeight,
              resizeQuality: 'medium',
            })
          }
        }

        self.postMessage(
          {
            type: 'image-loaded',
            payload: {
              imageBitmap: initialLODBitmap,
              imageWidth: width,
              imageHeight: height,
              lodLevel,
            },
          },
          [initialLODBitmap],
        )
      } catch (error) {
        console.error('[Worker] Error loading image:', error)
        self.postMessage({
          type: 'load-error',
          payload: { error: String(error) },
        })
      }
      break
    }
    case 'init': {
      // Deprecated path; keep for compatibility
      self.postMessage({ type: 'init-done' })
      break
    }
    case 'create-tile': {
      if (!originalBlob) {
        console.warn('Worker has not been initialized with a Blob.')
        return
      }

      const { x, y, lodLevel, lodConfig, imageWidth, imageHeight, key } =
        payload

      try {
        const { cols, rows } = getTileGridSize(
          imageWidth,
          imageHeight,
          lodLevel,
          lodConfig,
        )

        // Compute source rect at original resolution for this tile
        const srcW = imageWidth / cols
        const srcH = imageHeight / rows
        const sourceX = Math.floor(x * srcW)
        const sourceY = Math.floor(y * srcH)

        const actualSourceWidth = Math.min(srcW, imageWidth - sourceX)
        const actualSourceHeight = Math.min(srcH, imageHeight - sourceY)

        // Target tile size remains constant (<= TILE_SIZE)
        const targetWidth = Math.min(
          TILE_SIZE,
          Math.ceil(actualSourceWidth * lodConfig.scale),
        )
        const targetHeight = Math.min(
          TILE_SIZE,
          Math.ceil(actualSourceHeight * lodConfig.scale),
        )

        if (targetWidth <= 0 || targetHeight <= 0) {
          return
        }

        // Decode only the needed region, resized to the tile target size
        let imageBitmap
        if (supportsRegionDecode) {
          imageBitmap = await createImageBitmap(
            originalBlob,
            sourceX,
            sourceY,
            actualSourceWidth,
            actualSourceHeight,
            {
              resizeWidth: targetWidth,
              resizeHeight: targetHeight,
              resizeQuality: lodConfig.scale >= 1 ? 'high' : 'medium',
            },
          )
        } else if (baseBitmap) {
          // Crop from baseBitmap using canvas (preferred) or ImageBitmap crop if supported
          if (typeof OffscreenCanvas !== 'undefined') {
            const canvas = new OffscreenCanvas(targetWidth, targetHeight)
            const ctx = canvas.getContext('2d')
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = lodConfig.scale >= 1 ? 'high' : 'medium'

            const scaleX = baseBitmap.width / originalWidth
            const scaleY = baseBitmap.height / originalHeight

            ctx.drawImage(
              baseBitmap,
              Math.floor(sourceX * scaleX),
              Math.floor(sourceY * scaleY),
              Math.ceil(actualSourceWidth * scaleX),
              Math.ceil(actualSourceHeight * scaleY),
              0,
              0,
              targetWidth,
              targetHeight,
            )
            imageBitmap = canvas.transferToImageBitmap()
          } else {
            // Last resort: try cropping via createImageBitmap on baseBitmap
            // Safari support may vary; wrap in try/catch
            try {
              const scaleX = baseBitmap.width / originalWidth
              const scaleY = baseBitmap.height / originalHeight
              imageBitmap = await createImageBitmap(
                baseBitmap,
                Math.floor(sourceX * scaleX),
                Math.floor(sourceY * scaleY),
                Math.ceil(actualSourceWidth * scaleX),
                Math.ceil(actualSourceHeight * scaleY),
                {
                  resizeWidth: targetWidth,
                  resizeHeight: targetHeight,
                  resizeQuality: lodConfig.scale >= 1 ? 'high' : 'medium',
                },
              )
            } catch (e) {
              throw new Error(`Tile crop fallback failed: ${e}`)
            }
          }
        }
        self.postMessage(
          { type: 'tile-created', payload: { key, imageBitmap, lodLevel } },
          [imageBitmap],
        )
      } catch (error) {
        console.error('Error creating tile in worker:', error)
        self.postMessage({
          type: 'tile-error',
          payload: { key, error: String(error) },
        })
      }
      break
    }
  }
}

/**
 *
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {number} _lodLevel
 * @param {object} lodConfig
 * @returns
 */
function getTileGridSize(imageWidth, imageHeight, _lodLevel, lodConfig) {
  const scaledWidth = imageWidth * lodConfig.scale
  const scaledHeight = imageHeight * lodConfig.scale

  const cols = Math.ceil(scaledWidth / TILE_SIZE)
  const rows = Math.ceil(scaledHeight / TILE_SIZE)

  return { cols, rows }
}

// Read image size from Blob without fully decoding (supports PNG, JPEG, WebP VP8X)
async function getImageSizeFromBlob(blob) {
  // Helper to read a range from the Blob
  const read = async (start, length) => {
    const buf = await blob.slice(start, start + length).arrayBuffer()
    return new DataView(buf)
  }

  // Read first 32 bytes to detect type
  const head = await read(0, 64)

  // PNG: signature 89 50 4E 47 0D 0A 1A 0A, IHDR at offset 8
  if (
    head.getUint32(0, false) === 0x89504e47 &&
    head.getUint32(4, false) === 0x0d0a1a0a
  ) {
    // IHDR chunk starts at 8, next 4 bytes length, then 'IHDR'
    // IHDR data: width(4), height(4) big-endian
    const ihdr = await read(16, 8)
    const width = ihdr.getUint32(0, false)
    const height = ihdr.getUint32(4, false)
    return { width, height }
  }

  // JPEG: SOI 0xFFD8, then scan markers to SOF0/2 etc.
  if (head.getUint16(0, false) === 0xffd8) {
    let offset = 2
    const maxScan = Math.min(blob.size, 1 << 20) // scan up to 1MB
    while (offset < maxScan) {
      const dv = await read(offset, 4)
      if (dv.getUint8(0) !== 0xff) break
      const marker = dv.getUint8(1)
      const size = dv.getUint16(2, false)
      if (
        marker === 0xc0 || // SOF0
        marker === 0xc1 || // SOF1
        marker === 0xc2 || // SOF2
        marker === 0xc3 ||
        marker === 0xc5 ||
        marker === 0xc6 ||
        marker === 0xc7 ||
        marker === 0xc9 ||
        marker === 0xca ||
        marker === 0xcb ||
        marker === 0xcd ||
        marker === 0xce ||
        marker === 0xcf
      ) {
        const sof = await read(offset + 5, 4)
        const height = sof.getUint16(0, false)
        const width = sof.getUint16(2, false)
        return { width, height }
      }
      offset += 2 + size
    }
  }

  // WebP: RIFF, WEBP, VP8X chunk with canvas size
  if (head.getUint32(0, true) === 0x46464952 /* RIFF */) {
    const webpTag = await read(8, 4)
    if (webpTag.getUint32(0, false) === 0x57454250 /* 'WEBP' */) {
      // Read chunk header at 12
      const chunkHead = await read(12, 8)
      const chunkFourCC = chunkHead.getUint32(0, false)

      // 'VP8X'
      if (chunkFourCC === 0x56503858) {
        const vp8x = await read(20, 10)
        // width-1 in 24 bits at bytes 4..6, height-1 at bytes 7..9, little-endian
        const w =
          1 +
          (vp8x.getUint8(4) |
            (vp8x.getUint8(5) << 8) |
            (vp8x.getUint8(6) << 16))
        const h =
          1 +
          (vp8x.getUint8(7) |
            (vp8x.getUint8(8) << 8) |
            (vp8x.getUint8(9) << 16))
        return { width: w, height: h }
      }
    }
  }

  return { width: 0, height: 0 }
}
