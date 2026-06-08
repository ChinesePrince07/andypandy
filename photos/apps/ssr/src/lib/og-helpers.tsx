import siteConfig from '@config'
import type { PhotoManifestItem } from '@afilmory/typing'

export function getOGImageLayout(
  title: string,
  subtitle: string,
  photos: PhotoManifestItem[],
) {
  const gridPhotos = photos.slice(0, 4)

  return {
    element: (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#0a0a0a',
          position: 'relative',
        }}
      >
        {/* Photo grid background */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            opacity: 0.4,
          }}
        >
          {gridPhotos.map((photo) => (
            <img
              key={photo.id}
              src={photo.thumbnailUrl}
              width={gridPhotos.length <= 1 ? 1200 : 600}
              height={gridPhotos.length <= 1 ? 630 : 315}
              style={{
                objectFit: 'cover',
                width: gridPhotos.length <= 1 ? '100%' : '50%',
                height: gridPhotos.length <= 1 ? '100%' : '50%',
              }}
            />
          ))}
        </div>
        {/* Dark overlay */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%)',
          }}
        />
        {/* Text content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '60px',
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
            {siteConfig.title}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 56,
              fontWeight: 600,
              color: 'white',
              lineHeight: 1.1,
              marginBottom: 8,
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: 'rgba(255,255,255,0.7)' }}>
            {subtitle}
          </div>
        </div>
      </div>
    ),
    options: {
      width: 1200,
      height: 630,
    },
  }
}
