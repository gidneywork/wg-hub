import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Cadence monogram: bone C arc + bone dot on moss field.
// Two-arc C (280° span, 80° gap on the right) centred at (90,90), radius 58.
// Gap endpoints at ±40° from the right: (134,53) top, (134,127) bottom.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, background: '#6B7A5A', display: 'flex' }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* C arc: from top-of-gap (134,53) counterclockwise 280° to bottom-of-gap (134,127) */}
          <path
            d="M 134 53 A 58 58 0 1 0 134 127"
            stroke="#F5F2EC"
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
          />
          {/* Cadence dot: centred in the C's right-side opening */}
          <circle cx="148" cy="90" r="7" fill="#F5F2EC" />
        </svg>
      </div>
    ),
    { width: 180, height: 180 }
  )
}
