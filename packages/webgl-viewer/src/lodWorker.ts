interface LODWorkerMessage {
  type: 'CREATE_LOD' | 'CREATE_TILE'
  payload: {
    id: string
    imageBitmap?: ImageBitmap
    imageData?: ImageData
    targetWidth: number
    targetHeight: number
    quality: 'high' | 'medium' | 'low'
    // 瓦片相关参数
    sourceX?: number
    sourceY?: number
    sourceWidth?: number
    sourceHeight?: number
    lodLevel?: number
  }
}

interface _LODWorkerResponse {
  type: 'LOD_CREATED' | 'TILE_CREATED' | 'LOD_ERROR' | 'TILE_ERROR'
  payload: {
    id: string
    imageData?: ImageData
    width?: number
    height?: number
    error?: string
  }
}

/// <reference lib="webworker" />

// Worker 消息处理
self.onmessage = async (event: MessageEvent<LODWorkerMessage>) => {
  const { type, payload } = event.data

  if (type === 'CREATE_LOD') {
    const { id, imageBitmap, targetWidth, targetHeight, quality } = payload

    if (!imageBitmap) {
      self.postMessage({
        type: 'LOD_ERROR',
        payload: {
          id,
          error: 'ImageBitmap is required for LOD creation',
        },
      })
      return
    }

    try {
      // 使用 OffscreenCanvas 完全在后台处理
      const resultImageData = await processImageWithOffscreenCanvas(
        imageBitmap,
        targetWidth,
        targetHeight,
        quality,
      )

      // 发送完成的 ImageData 到主线程
      self.postMessage({
        type: 'LOD_CREATED',
        payload: {
          id,
          imageData: resultImageData,
          width: targetWidth,
          height: targetHeight,
        },
      })
    } catch (error) {
      // 发送错误
      self.postMessage({
        type: 'LOD_ERROR',
        payload: {
          id,
          error: error instanceof Error ? error.message : String(error),
        },
      })
    } finally {
      // 清理输入的 ImageBitmap
      imageBitmap.close()
    }
  } else if (type === 'CREATE_TILE') {
    const {
      id,
      imageBitmap,
      imageData,
      targetWidth,
      targetHeight,
      quality,
      sourceX = 0,
      sourceY = 0,
      sourceWidth,
      sourceHeight,
    } = payload

    try {
      let resultImageData: ImageData

      if (imageBitmap) {
        // 从 ImageBitmap 创建瓦片
        resultImageData = await createTileFromImageBitmap(
          imageBitmap,
          sourceX,
          sourceY,
          sourceWidth || imageBitmap.width,
          sourceHeight || imageBitmap.height,
          targetWidth,
          targetHeight,
          quality,
        )
        // 清理输入的 ImageBitmap
        imageBitmap.close()
      } else if (imageData) {
        // 从 ImageData 创建瓦片
        resultImageData = await createTileFromImageData(
          imageData,
          sourceX,
          sourceY,
          sourceWidth || imageData.width,
          sourceHeight || imageData.height,
          targetWidth,
          targetHeight,
          quality,
        )
      } else {
        throw new Error(
          'Either ImageBitmap or ImageData is required for tile creation',
        )
      }

      // 发送完成的 ImageData 到主线程
      self.postMessage({
        type: 'TILE_CREATED',
        payload: {
          id,
          imageData: resultImageData,
          width: targetWidth,
          height: targetHeight,
        },
      })
    } catch (error) {
      // 发送错误
      self.postMessage({
        type: 'TILE_ERROR',
        payload: {
          id,
          error: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }
}

// 从 ImageBitmap 创建瓦片
async function createTileFromImageBitmap(
  imageBitmap: ImageBitmap,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  quality: 'high' | 'medium' | 'low',
): Promise<ImageData> {
  const canvas = new OffscreenCanvas(targetWidth, targetHeight)
  const ctx = canvas.getContext('2d')!

  // 设置渲染质量
  ctx.imageSmoothingEnabled = true
  if (quality === 'high') {
    ctx.imageSmoothingQuality = 'high'
  } else if (quality === 'medium') {
    ctx.imageSmoothingQuality = 'medium'
  } else {
    ctx.imageSmoothingQuality = 'low'
  }

  // 绘制瓦片区域
  ctx.drawImage(
    imageBitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  )

  // 返回 ImageData
  return ctx.getImageData(0, 0, targetWidth, targetHeight)
}

// 从 ImageData 创建瓦片（直接内存操作，避免 createImageBitmap）
async function createTileFromImageData(
  imageData: ImageData,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  _quality: 'high' | 'medium' | 'low',
): Promise<ImageData> {
  // 快速路径：无需缩放且是完整图片
  if (
    sourceWidth === targetWidth &&
    sourceHeight === targetHeight &&
    sourceX === 0 &&
    sourceY === 0 &&
    imageData.width === sourceWidth &&
    imageData.height === sourceHeight
  ) {
    return imageData
  }

  // 快速路径：无需缩放但需要裁剪
  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return extractImageDataRegion(
      imageData,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
    )
  }

  // 需要缩放的情况
  const targetImageData = new ImageData(targetWidth, targetHeight)

  // 使用优化的处理方法
  if (targetWidth * targetHeight < 256 * 256) {
    // 小瓦片使用简单快速处理
    processImageDataSimple(
      imageData,
      targetImageData,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
    )
  } else {
    // 大瓦片使用分块处理避免阻塞
    await processImageDataInChunks(
      imageData,
      targetImageData,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
    )
  }

  return targetImageData
}

// 快速提取 ImageData 区域（无缩放）
function extractImageDataRegion(
  sourceImageData: ImageData,
  sourceX: number,
  sourceY: number,
  width: number,
  height: number,
): ImageData {
  const targetImageData = new ImageData(width, height)

  for (let y = 0; y < height; y++) {
    const sourceRowStart = ((sourceY + y) * sourceImageData.width + sourceX) * 4
    const targetRowStart = y * width * 4

    // 复制整行像素数据
    for (let x = 0; x < width * 4; x++) {
      targetImageData.data[targetRowStart + x] =
        sourceImageData.data[sourceRowStart + x]
    }
  }

  return targetImageData
}

// 简单快速处理（同步，适用于小瓦片）
function processImageDataSimple(
  sourceImageData: ImageData,
  targetImageData: ImageData,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): void {
  const scaleX = sourceWidth / targetWidth
  const scaleY = sourceHeight / targetHeight

  for (let ty = 0; ty < targetHeight; ty++) {
    const sy = Math.floor(sourceY + ty * scaleY)

    for (let tx = 0; tx < targetWidth; tx++) {
      const sx = Math.floor(sourceX + tx * scaleX)

      if (
        sx >= 0 &&
        sx < sourceImageData.width &&
        sy >= 0 &&
        sy < sourceImageData.height
      ) {
        const sourceIndex = (sy * sourceImageData.width + sx) * 4
        const targetIndex = (ty * targetWidth + tx) * 4

        // 复制像素数据
        targetImageData.data[targetIndex] = sourceImageData.data[sourceIndex]
        targetImageData.data[targetIndex + 1] =
          sourceImageData.data[sourceIndex + 1]
        targetImageData.data[targetIndex + 2] =
          sourceImageData.data[sourceIndex + 2]
        targetImageData.data[targetIndex + 3] =
          sourceImageData.data[sourceIndex + 3]
      }
    }
  }
}

// 分块处理 ImageData，避免长时间阻塞
async function processImageDataInChunks(
  sourceImageData: ImageData,
  targetImageData: ImageData,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Promise<void> {
  const chunkSize = 128 // 增加到128行，减少让出控制权的频率
  const scaleX = sourceWidth / targetWidth
  const scaleY = sourceHeight / targetHeight
  let processedChunks = 0

  for (let targetY = 0; targetY < targetHeight; targetY += chunkSize) {
    const endY = Math.min(targetY + chunkSize, targetHeight)

    // 处理一个块
    for (let ty = targetY; ty < endY; ty++) {
      const sy = Math.floor(sourceY + ty * scaleY)

      for (let tx = 0; tx < targetWidth; tx++) {
        const sx = Math.floor(sourceX + tx * scaleX)

        // 边界检查
        if (
          sx >= 0 &&
          sx < sourceImageData.width &&
          sy >= 0 &&
          sy < sourceImageData.height
        ) {
          const sourceIndex = (sy * sourceImageData.width + sx) * 4
          const targetIndex = (ty * targetWidth + tx) * 4

          // 复制像素数据
          targetImageData.data[targetIndex] = sourceImageData.data[sourceIndex] // R
          targetImageData.data[targetIndex + 1] =
            sourceImageData.data[sourceIndex + 1] // G
          targetImageData.data[targetIndex + 2] =
            sourceImageData.data[sourceIndex + 2] // B
          targetImageData.data[targetIndex + 3] =
            sourceImageData.data[sourceIndex + 3] // A
        }
      }
    }

    processedChunks++
    // 每处理4个块后才让出控制权，减少 setTimeout 开销
    if (targetY + chunkSize < targetHeight && processedChunks % 4 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
}

// 使用 OffscreenCanvas 处理图像
async function processImageWithOffscreenCanvas(
  imageBitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  quality: 'high' | 'medium' | 'low',
): Promise<ImageData> {
  // 创建 OffscreenCanvas
  const canvas = new OffscreenCanvas(targetWidth, targetHeight)
  const ctx = canvas.getContext('2d')!

  // 设置渲染质量
  ctx.imageSmoothingEnabled = true
  if (quality === 'high') {
    ctx.imageSmoothingQuality = 'high'
  } else if (quality === 'medium') {
    ctx.imageSmoothingQuality = 'medium'
  } else {
    ctx.imageSmoothingQuality = 'low'
  }

  // 对于超大图像，使用分步渲染避免内存峰值
  if (targetWidth > 4096 || targetHeight > 4096) {
    return processLargeImageStepwise(
      canvas,
      ctx,
      imageBitmap,
      targetWidth,
      targetHeight,
    )
  }

  // 直接绘制小图像
  ctx.drawImage(
    imageBitmap,
    0,
    0,
    imageBitmap.width,
    imageBitmap.height,
    0,
    0,
    targetWidth,
    targetHeight,
  )

  // 返回 ImageData
  return ctx.getImageData(0, 0, targetWidth, targetHeight)
}

// 分步处理超大图像，避免内存峰值
async function processLargeImageStepwise(
  canvas: OffscreenCanvas,
  ctx: OffscreenCanvasRenderingContext2D,
  imageBitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
): Promise<ImageData> {
  // 计算中间尺寸步骤
  const steps = calculateScalingSteps(
    imageBitmap.width,
    imageBitmap.height,
    targetWidth,
    targetHeight,
  )

  let currentBitmap = imageBitmap
  let needsCleanup = false

  try {
    // 逐步缩放
    for (const [i, step] of steps.entries()) {
      // 创建中间 canvas
      const intermediateCanvas = new OffscreenCanvas(step.width, step.height)
      const intermediateCtx = intermediateCanvas.getContext('2d')!

      intermediateCtx.imageSmoothingEnabled = true
      intermediateCtx.imageSmoothingQuality = 'high'

      // 绘制到中间尺寸
      intermediateCtx.drawImage(
        currentBitmap,
        0,
        0,
        currentBitmap.width,
        currentBitmap.height,
        0,
        0,
        step.width,
        step.height,
      )

      // 清理上一步的结果（除了原始输入）
      if (needsCleanup && currentBitmap !== imageBitmap) {
        currentBitmap.close()
      }

      // 获取中间结果
      currentBitmap = intermediateCanvas.transferToImageBitmap()
      needsCleanup = true

      // 让出控制权
      if (i % 2 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    // 最终绘制到目标 canvas
    if (
      currentBitmap.width !== targetWidth ||
      currentBitmap.height !== targetHeight
    ) {
      ctx.drawImage(
        currentBitmap,
        0,
        0,
        currentBitmap.width,
        currentBitmap.height,
        0,
        0,
        targetWidth,
        targetHeight,
      )

      if (needsCleanup && currentBitmap !== imageBitmap) {
        currentBitmap.close()
      }

      return ctx.getImageData(0, 0, targetWidth, targetHeight)
    }

    // 如果最终结果就是目标尺寸，转换为 ImageData
    const finalCanvas = new OffscreenCanvas(targetWidth, targetHeight)
    const finalCtx = finalCanvas.getContext('2d')!
    finalCtx.drawImage(currentBitmap, 0, 0)

    if (needsCleanup && currentBitmap !== imageBitmap) {
      currentBitmap.close()
    }

    return finalCtx.getImageData(0, 0, targetWidth, targetHeight)
  } catch (error) {
    // 清理资源
    if (needsCleanup && currentBitmap !== imageBitmap) {
      currentBitmap.close()
    }
    throw error
  }
}

// 计算缩放步骤
function calculateScalingSteps(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Array<{ width: number; height: number }> {
  const steps: Array<{ width: number; height: number }> = []

  const scaleX = targetWidth / sourceWidth
  const scaleY = targetHeight / sourceHeight
  const totalScale = Math.min(scaleX, scaleY)

  // 如果放大倍数很大，分多步进行
  if (totalScale > 4) {
    let currentScale = 1
    while (currentScale < totalScale) {
      currentScale = Math.min(currentScale * 2, totalScale)
      steps.push({
        width: Math.round(sourceWidth * currentScale),
        height: Math.round(sourceHeight * currentScale),
      })
    }
  }
  // 如果缩小倍数很大，也分多步进行
  else if (totalScale < 0.25) {
    let currentScale = 1
    while (currentScale > totalScale) {
      currentScale = Math.max(currentScale * 0.5, totalScale)
      steps.push({
        width: Math.round(sourceWidth * currentScale),
        height: Math.round(sourceHeight * currentScale),
      })
    }
  }
  // 中等缩放比例直接处理
  else {
    steps.push({ width: targetWidth, height: targetHeight })
  }

  return steps
}

export {}
