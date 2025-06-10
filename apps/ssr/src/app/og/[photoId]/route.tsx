import { photoLoader } from '@photo-gallery/data'
import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

import geistFont from './Geist-Medium.ttf'
import Sans from './PingFangSC.ttf'

export const runtime = 'edge'

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> },
) => {
  const { photoId } = await params

  const photo = photoLoader.getPhoto(photoId)
  if (!photo) {
    return new Response('Photo not found', { status: 404 })
  }

  try {
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
    const thumbnailBuffer = await Promise.any([
      fetch(
        `http://localhost:3000${photo.thumbnailUrl.replace('.webp', '.jpg')}`,
      ).then((res) => res.arrayBuffer()),
      process.env.NEXT_PUBLIC_APP_URL
        ? fetch(
            `http://${process.env.NEXT_PUBLIC_APP_URL}${photo.thumbnailUrl.replace('.webp', '.jpg')}`,
          ).then((res) => res.arrayBuffer())
        : Promise.reject(),
      fetch(
        `http://${request.nextUrl.host}${photo.thumbnailUrl.replace('.webp', '.jpg')}`,
      ).then((res) => res.arrayBuffer()),
    ])

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
            background:
              'linear-gradient(145deg, #0d0d0d 0%, #1c1c1c 20%, #121212 40%, #1a1a1a 60%, #0f0f0f 80%, #0a0a0a 100%)',
            padding: '40px',
            fontFamily: 'Geist, system-ui, -apple-system, sans-serif',
            position: 'relative',
          }}
        >
          {/* 摄影师风格的网格背景 */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0.03,
              background: `
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(0deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />

          {/* 主光源效果 - 左上角 */}
          <div
            style={{
              position: 'absolute',
              top: '0px',
              left: '0px',
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(60,60,70,0.15) 0%, rgba(40,40,50,0.08) 40%, transparent 70%)',
            }}
          />

          {/* 副光源效果 - 右下角 */}
          <div
            style={{
              position: 'absolute',
              bottom: '0px',
              right: '0px',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(45,45,55,0.12) 0%, rgba(30,30,40,0.06) 50%, transparent 80%)',
            }}
          />

          {/* 摄影工作室的聚光灯效果 */}
          <div
            style={{
              position: 'absolute',
              top: '5%',
              right: '25%',
              width: '120px',
              height: '320px',
              background:
                'linear-gradient(45deg, transparent 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 60%, transparent 100%)',
              transform: 'rotate(15deg)',
            }}
          />

          {/* 胶片装饰元素 */}
          <div
            style={{
              position: 'absolute',
              top: '15%',
              right: '5%',
              width: '20px',
              height: '120px',
              background:
                'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '3px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* 胶片孔 */}
            <div
              style={{
                marginTop: '6px',
                width: '6px',
                height: '6px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                marginTop: '10px',
                width: '6px',
                height: '6px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                marginTop: '10px',
                width: '6px',
                height: '6px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                marginTop: '10px',
                width: '6px',
                height: '6px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                marginTop: '10px',
                width: '6px',
                height: '6px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                marginTop: '10px',
                width: '6px',
                height: '6px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
          </div>

          {/* 几何装饰线条 - 多个层次 */}
          <div
            style={{
              position: 'absolute',
              top: '30%',
              right: '12%',
              width: '80px',
              height: '80px',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '5px',
              transform: 'rotate(12deg)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: '35%',
              right: '15%',
              width: '60px',
              height: '60px',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: '3px',
              transform: 'rotate(-8deg)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: '25%',
              left: '12%',
              width: '48px',
              height: '48px',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '50%',
            }}
          />

          {/* 光圈装饰 */}
          <div
            style={{
              position: 'absolute',
              bottom: '40%',
              right: '8%',
              width: '32px',
              height: '32px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* 内圈 */}
            <div
              style={{
                width: '20px',
                height: '20px',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '50%',
                }}
              />
            </div>
          </div>

          {/* 主要内容区域 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              maxWidth: '55%',
            }}
          >
            {/* 标题 */}
            <h1
              style={{
                fontSize: '44px',
                fontWeight: 'bold',
                color: 'white',
                margin: '0 0 16px 0',
                lineHeight: '1.1',
                letterSpacing: '1px',
                display: 'flex',
              }}
            >
              {photo.title || 'Untitled Photo'}
            </h1>

            {/* 描述 */}
            <p
              style={{
                fontSize: '20px',
                color: 'rgba(255,255,255,0.9)',
                margin: '0 0 16px 0',
                lineHeight: '1.3',
                letterSpacing: '0.3px',
                display: 'flex',
                fontFamily: 'Geist, SF Pro Display',
              }}
            >
              {photo.description || 'Beautiful photography'}
            </p>

            {/* 标签 */}
            {tags && (
              <div
                style={{
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.7)',
                  margin: '0 0 16px 0',
                  letterSpacing: '0.3px',
                  display: 'flex',
                  fontFamily: 'Geist, SF Pro Display',
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
                top: '60px',
                right: '30px',
                width: '240px',
                height: '240px',
                borderRadius: '8px',
                border: '4px solid #f0f0f0',
                boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
                overflow: 'hidden',
                transform: 'rotate(-2deg)',
                display: 'flex',
              }}
            >
              <img
                // @ts-expect-error
                src={thumbnailBuffer}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '8px',
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
              gap: '14px',
            }}
          >
            {/* 拍摄时间 */}
            {formattedDate && (
              <div
                style={{
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.7)',
                  letterSpacing: '0.3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
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
                  letterSpacing: '0.3px',
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
                    gap: '10px',
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.8)',
                  }}
                >
                  {exifInfo.aperture && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '6px 10px',
                        borderRadius: '6px',
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
                        gap: '4px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '6px 10px',
                        borderRadius: '6px',
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
                        gap: '4px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '6px 10px',
                        borderRadius: '6px',
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
                        gap: '4px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '6px 10px',
                        borderRadius: '6px',
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
        width: 800,
        height: 419,
        fonts: [
          {
            name: 'Geist',
            data: geistFont,
            style: 'normal',
            weight: 400,
          },
          {
            name: 'SF Pro Display',
            data: Sans,
            style: 'normal',
            weight: 400,
          },
        ],
        headers: {
          // Cache 1 years
          'Cache-Control':
            'public, max-age=31536000, stale-while-revalidate=31536000',
          'Cloudflare-CDN-Cache-Control':
            'public, max-age=31536000, stale-while-revalidate=31536000',
        },
      },
    )
  } catch (error) {
    console.error('Failed to generate OG image:', error)
    return new Response(`Failed to generate image, ${error.message}`, {
      status: 500,
    })
  }
}
