interface LODWorkerMessage {
  type: 'CREATE_LOD'
  payload: {
    id: string
    imageBitmap: ImageBitmap
    targetWidth: number
    targetHeight: number
    quality: 'high' | 'medium' | 'low'
  }
}

// LODWorkerResponse interface removed as it's not used directly

// 图像缩放质量配置已移到函数内部，避免未使用警告

// Worker 消息处理
self.onmessage = async (event: MessageEvent<LODWorkerMessage>) => {
  const { type, payload } = event.data

  if (type === 'CREATE_LOD') {
    const { id, imageBitmap, targetWidth, targetHeight, quality } = payload

    try {
      // 使用 OffscreenCanvas 完全在后台处理
      const resultBitmap = await processImageWithOffscreenCanvas(
        imageBitmap,
        targetWidth,
        targetHeight,
        quality,
      )

      // 发送完成的 ImageBitmap 到主线程
      ;(self as any).postMessage(
        {
          type: 'LOD_CREATED',
          payload: {
            id,
            imageBitmap: resultBitmap,
            width: targetWidth,
            height: targetHeight,
          },
        },
        [resultBitmap],
      )
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
  }
}

// 使用 OffscreenCanvas 处理图像
async function processImageWithOffscreenCanvas(
  imageBitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  quality: 'high' | 'medium' | 'low',
): Promise<ImageBitmap> {
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

  // 返回 ImageBitmap
  return canvas.transferToImageBitmap()
}

// 分步处理超大图像，避免内存峰值
async function processLargeImageStepwise(
  canvas: OffscreenCanvas,
  ctx: OffscreenCanvasRenderingContext2D,
  imageBitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
): Promise<ImageBitmap> {
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

      return canvas.transferToImageBitmap()
    }

    return currentBitmap
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
