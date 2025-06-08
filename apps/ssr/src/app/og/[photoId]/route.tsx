import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

import { photoLoader } from '../../../../../web/src/data/photos'

export const runtime = 'edge'

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> },
) => {
  // 加载 Geist 字体
  const geistFontPromise = fetch(
    new URL('Geist-Regular.ttf', import.meta.url),
  ).then((res) => res.arrayBuffer())

  const { photoId } = await params

  const photo = photoLoader.getPhoto(photoId)
  if (!photo) {
    return new Response('Photo not found', { status: 404 })
  }

  try {
    // 加载 Geist 字体
    const geistFont = await geistFontPromise
    // 格式化拍摄时间
    const dateTaken = photo.exif?.Photo?.DateTimeOriginal || photo.lastModified
    const formattedDate = dateTaken
      ? new Date(dateTaken).toLocaleDateString('zh-CN')
      : ''

    // 处理标签
    const tags = photo.tags?.slice(0, 3).join(' • ') || ''

    // Format EXIF information
    const formatExifInfo = () => {
      if (!photo.exif) return null

      const photoExif = photo.exif.Photo || {}
      const imageExif = photo.exif.Image || {}

      const info = {
        focalLength: photoExif.FocalLengthIn35mmFilm
          ? `${Math.round(photoExif.FocalLengthIn35mmFilm)}mm`
          : null,
        aperture: photoExif.FNumber ? `f/${photoExif.FNumber}` : null,
        iso: photoExif.ISOSpeedRatings || imageExif.ISOSpeedRatings || null,
        shutterSpeed: null as string | null,
        camera:
          imageExif.Make && imageExif.Model
            ? `${imageExif.Make} ${imageExif.Model}`
            : null,
      }

      // Format shutter speed
      const exposureTime = photoExif.ExposureTime
      if (exposureTime) {
        info.shutterSpeed =
          exposureTime >= 1
            ? `${exposureTime}s`
            : `1/${Math.round(1 / exposureTime)}`
      }

      return info
    }

    const exifInfo = formatExifInfo()

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundImage:
              'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #0a0a0a 100%)',
            padding: '60px',
            fontFamily: 'Geist, system-ui, -apple-system, sans-serif',
            position: 'relative',
          }}
        >
          {/* 装饰性渐变圆圈 */}
          <div
            style={{
              position: 'absolute',
              top: '20%',
              right: '20%',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(200,200,200,0.3) 0%, rgba(0,0,0,0) 70%)',
              zIndex: 0,
            }}
          />

          {/* 主要内容区域 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              zIndex: 1,
              maxWidth: '60%',
            }}
          >
            {/* 标题 */}
            <h1
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: 'white',
                margin: '0 0 20px 0',
                lineHeight: '1.2',
                letterSpacing: '2px',
                display: 'flex',
              }}
            >
              {photo.title || 'Untitled Photo'}
            </h1>

            {/* 描述 */}
            <p
              style={{
                fontSize: '24px',
                color: 'rgba(255,255,255,0.9)',
                margin: '0 0 20px 0',
                lineHeight: '1.4',
                letterSpacing: '1px',
                display: 'flex',
              }}
            >
              {photo.description || 'Beautiful photography'}
            </p>

            {/* 标签 */}
            {tags && (
              <div
                style={{
                  fontSize: '18px',
                  color: 'rgba(255,255,255,0.7)',
                  margin: '0 0 20px 0',
                  letterSpacing: '0.5px',
                  display: 'flex',
                }}
              >
                {tags}
              </div>
            )}
          </div>

          {/* 照片缩略图 */}
          {photo.thumbnailUrl && (
            <div
              style={{
                position: 'absolute',
                top: '140px',
                right: '60px',
                width: '350px',
                height: '350px',
                borderRadius: '12px',
                border: '6px solid #f0f0f0',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                overflow: 'hidden',
                transform: 'rotate(-2deg)',
                display: 'flex',
              }}
            >
              <img
                src={`${request.nextUrl.origin}${photo.thumbnailUrl.replace('.webp', '.jpg')}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '12px',
                }}
              />
            </div>
          )}

          {/* 底部信息 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '20px',
              zIndex: 1,
            }}
          >
            {/* 拍摄时间 */}
            {formattedDate && (
              <div
                style={{
                  fontSize: '18px',
                  color: 'rgba(255,255,255,0.7)',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                📸 {formattedDate}
              </div>
            )}
            {/* 相机信息 */}
            {exifInfo?.camera && (
              <div
                style={{
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.6)',
                  letterSpacing: '0.5px',
                  display: 'flex',
                }}
              >
                📷 {exifInfo.camera}
              </div>
            )}
            {/* EXIF 信息 */}
            {exifInfo &&
              (exifInfo.aperture ||
                exifInfo.shutterSpeed ||
                exifInfo.iso ||
                exifInfo.focalLength) && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    fontSize: '16px',
                    color: 'rgba(255,255,255,0.8)',
                  }}
                >
                  {exifInfo.aperture && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      ⚫ {exifInfo.aperture}
                    </div>
                  )}

                  {exifInfo.shutterSpeed && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      ⏱️ {exifInfo.shutterSpeed}
                    </div>
                  )}

                  {exifInfo.iso && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      📊 ISO {exifInfo.iso}
                    </div>
                  )}

                  {exifInfo.focalLength && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      🔍 {exifInfo.focalLength}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Geist',
            data: geistFont,
            style: 'normal',
            weight: 400,
          },
        ],
      },
    )
  } catch (error) {
    console.error('Failed to generate OG image:', error)
    return new Response(`Failed to generate image, ${error.message}`, {
      status: 500,
    })
  }
}
