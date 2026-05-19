/**
 * Cadence — body graph SVG path data and shading helper.
 *
 * ViewBox: 0 0 100 220 per figure (1:2.2 aspect, ~120px rendered width at desktop).
 * Candidate C in-house geometric — anatomically proportioned male figure:
 *   shoulders 68 wide → chest 40 → waist 28 → hip flare → upper thigh 24 → knee 18 → calf → ankle.
 * Silhouette drawn on top of muscle regions; regions use type 'ellipse' or 'path'.
 * Used exclusively by components/cadence/history/BodyGraph.jsx.
 */

// ── Silhouette elements (rendered on top of muscle regions to keep outlines crisp).
// Same outline used for both front and back views.
export const SILHOUETTE = [
  // Head
  { type: 'circle', cx: 50, cy: 17, r: 11 },

  // Torso: broad shoulders → chest (40 wide) → waist indent (28 wide) → hip flare.
  {
    type: 'path',
    d: 'M 44 28 C 34 30 20 36 16 44 C 13 50 18 55 26 55 L 32 58 L 30 68 C 30 82 36 100 36 112 C 34 122 42 130 50 132 C 58 130 66 122 64 112 C 64 100 70 82 70 68 L 68 58 L 74 55 C 82 55 87 50 84 44 C 80 36 66 30 56 28 Z',
  },

  // Left arm: wider at bicep (y≈80), tapers toward wrist.
  {
    type: 'path',
    d: 'M 16 44 C 13 47 7 50 7 54 L 6 80 C 6 92 7 104 8 118 C 8 124 10 128 14 128 C 18 128 20 124 20 118 C 21 104 21 92 21 80 L 21 54 C 21 50 19 47 16 44 Z',
  },

  // Right arm: mirror of left.
  {
    type: 'path',
    d: 'M 84 44 C 87 47 93 50 93 54 L 94 80 C 94 92 93 104 92 118 C 92 124 90 128 86 128 C 82 128 80 124 80 118 C 79 104 79 92 79 80 L 79 54 C 79 50 81 47 84 44 Z',
  },

  // Legs: quad width at thigh (24 wide each), knee narrows, calf shape, ankle taper.
  {
    type: 'path',
    d: 'M 34 132 C 28 134 24 140 24 152 L 26 162 C 27 170 26 178 26 184 L 28 206 C 28 212 32 216 36 217 L 44 217 C 46 215 48 210 48 206 L 48 184 C 48 178 48 170 48 162 L 48 152 C 50 142 50 138 52 152 L 52 162 C 52 170 52 178 52 184 L 52 206 C 52 210 54 215 56 217 L 64 217 C 68 216 72 212 72 206 L 74 184 C 74 178 73 170 74 162 L 76 152 C 76 140 72 134 66 132 C 60 134 40 134 34 132 Z',
  },
]

// ── Front-view muscle regions.
// Render order: shoulders before chest so pec fills layer over the shoulder-pec seam.
export const FRONT_REGIONS = [
  { muscle: 'legs',      type: 'ellipse', cx: 36,  cy: 152, rx: 9,  ry: 14 }, // left quad
  { muscle: 'legs',      type: 'ellipse', cx: 64,  cy: 152, rx: 9,  ry: 14 }, // right quad
  { muscle: 'core',      type: 'ellipse', cx: 50,  cy: 100, rx: 10, ry: 16 }, // abs
  { muscle: 'arms',      type: 'ellipse', cx: 13,  cy: 84,  rx: 7,  ry: 14 }, // left bicep
  { muscle: 'arms',      type: 'ellipse', cx: 87,  cy: 84,  rx: 7,  ry: 14 }, // right bicep
  { muscle: 'shoulders', type: 'ellipse', cx: 14,  cy: 50,  rx: 8,  ry: 10 }, // left front delt
  { muscle: 'shoulders', type: 'ellipse', cx: 86,  cy: 50,  rx: 8,  ry: 10 }, // right front delt
  { muscle: 'chest',     type: 'ellipse', cx: 37,  cy: 74,  rx: 12, ry: 13 }, // left pec
  { muscle: 'chest',     type: 'ellipse', cx: 63,  cy: 74,  rx: 12, ry: 13 }, // right pec
]

// ── Back-view muscle regions.
// Back (lats) rendered before shoulders so delt fills layer on top at overlap.
export const BACK_REGIONS = [
  { muscle: 'legs',      type: 'ellipse', cx: 36,  cy: 155, rx: 9,  ry: 14 }, // left hamstring
  { muscle: 'legs',      type: 'ellipse', cx: 64,  cy: 155, rx: 9,  ry: 14 }, // right hamstring
  { muscle: 'glutes',    type: 'ellipse', cx: 36,  cy: 144, rx: 14, ry: 12 }, // left glute
  { muscle: 'glutes',    type: 'ellipse', cx: 64,  cy: 144, rx: 14, ry: 12 }, // right glute
  { muscle: 'core',      type: 'ellipse', cx: 50,  cy: 102, rx: 10, ry: 14 }, // lumbar / erectors
  // Lats + traps: trapezoidal fan from armpit width to waist width.
  { muscle: 'back',      type: 'path',    d: 'M 26 55 L 74 55 C 78 65 76 90 66 110 L 34 110 C 24 90 22 65 26 55 Z' },
  { muscle: 'arms',      type: 'ellipse', cx: 13,  cy: 82,  rx: 8,  ry: 16 }, // left tricep
  { muscle: 'arms',      type: 'ellipse', cx: 87,  cy: 82,  rx: 8,  ry: 16 }, // right tricep
  { muscle: 'shoulders', type: 'ellipse', cx: 14,  cy: 52,  rx: 8,  ry: 10 }, // left rear delt
  { muscle: 'shoulders', type: 'ellipse', cx: 86,  cy: 52,  rx: 8,  ry: 10 }, // right rear delt
]

// Returns fill-opacity for a muscle region given its tonnage and the week's peak.
// 0 for zero tonnage (inert — no fill applied by caller).
// Minimum 0.15 for any active region — prevents active muscles from being imperceptible.
export function muscleOpacity(tonnage, maxTonnage) {
  if (!tonnage || !maxTonnage) return 0
  return Math.max(0.15, tonnage / maxTonnage)
}
