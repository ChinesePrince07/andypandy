/// <reference lib="webworker" />

let originalImage: ImageBitmap | null = null

const TILE_SIZE = 512 // Must be same as in WebGLImageViewerEngine.ts

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data

  if (type === 'init') {
    originalImage = payload.imageBitmap
    self.postMessage({ type: 'init-done' })
  } else if (type === 'create-tile') {
    if (!originalImage) {
      console.warn('Worker has not been initialized with an image.')
      return
    }

    const { x, y, lodLevel, lodConfig, imageWidth, imageHeight, key } = payload

    try {
      const { cols, rows } = getTileGridSize(
        imageWidth,
        imageHeight,
        lodLevel,
        lodConfig,
      )

      // Calculate tile region in the original image
      const sourceWidth = imageWidth / cols
      const sourceHeight = imageHeight / rows // Assuming square tiles from a square grid on the image
      const sourceX = x * sourceWidth
      const sourceY = y * sourceHeight

      const actualSourceWidth = Math.min(sourceWidth, imageWidth - sourceX)
      const actualSourceHeight = Math.min(sourceHeight, imageHeight - sourceY)

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

      // Use OffscreenCanvas to draw the tile
      const canvas = new OffscreenCanvas(targetWidth, targetHeight)
      const ctx = canvas.getContext('2d')!

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = lodConfig.scale >= 1 ? 'high' : 'medium'

      ctx.drawImage(
        originalImage,
        sourceX,
        sourceY,
        actualSourceWidth,
        actualSourceHeight,
        0,
        0,
        targetWidth,
        targetHeight,
      )

      const imageBitmap = canvas.transferToImageBitmap()
      self.postMessage(
        { type: 'tile-created', payload: { key, imageBitmap, lodLevel } },
        [imageBitmap],
      )
    } catch (error) {
      console.error('Error creating tile in worker:', error)
      self.postMessage({ type: 'tile-error', payload: { key, error } })
    }
  }
}

function getTileGridSize(
  imageWidth: number,
  imageHeight: number,
  _lodLevel: number,
  lodConfig: { scale: number },
): { cols: number; rows: number } {
  const scaledWidth = imageWidth * lodConfig.scale
  const scaledHeight = imageHeight * lodConfig.scale

  const cols = Math.ceil(scaledWidth / TILE_SIZE)
  const rows = Math.ceil(scaledHeight / TILE_SIZE)

  return { cols, rows }
}
