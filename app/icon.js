import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

// Cadence monogram 512×512: same geometry as apple-icon, scaled ×2.844.
// Center (256,256), radius 165, strokeWidth 51, dot radius 20.
// Gap endpoints at ±40°: (382,150) top, (382,362) bottom.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: 512, height: 512, background: '#6B7A5A', display: 'flex' }}>
        <svg width="512" height="512" viewBox="0 0 512 512">
          <path
            d="M 382 150 A 165 165 0 1 0 382 362"
            stroke="#F5F2EC"
            strokeWidth="51"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="421" cy="256" r="20" fill="#F5F2EC" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
