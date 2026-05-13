/**
 * Cadence — body graph SVG path data and shading helper.
 *
 * ViewBox: 0 0 100 220 per figure (1:2.2 aspect, ~120px rendered width at desktop).
 * Stroke rules: 1.5px rounded for silhouette, 1px for active muscle regions, 0.75px for inert.
 * Used exclusively by components/cadence/history/BodyGraph.jsx.
 */

// ── Silhouette elements (rendered on top of muscle regions to keep outlines crisp).
// type: 'circle' | 'path'. Same for both front and back views.
export const SILHOUETTE = [
  // Head
  { type: 'circle', cx: 50, cy: 17, r: 12 },

  // Neck + shoulders + torso + hips (arms excluded — separate paths below).
  // Traces: neck → left shoulder slope → left armpit → left torso side → hip → right → back.
  {
    type: 'path',
    d: 'M 44 29 C 34 31 22 36 16 44 C 14 50 18 54 26 54 L 34 56 L 34 112 C 34 122 38 130 50 132 C 62 130 66 122 66 112 L 66 56 L 74 54 C 82 54 86 50 84 44 C 78 36 66 31 56 29 Z',
  },

  // Left arm — from shoulder to wrist
  {
    type: 'path',
    d: 'M 16 44 L 8 46 L 6 118 C 6 122 10 126 14 126 C 18 126 20 122 20 118 L 20 54 C 20 50 18 46 16 44 Z',
  },

  // Right arm — mirror of left
  {
    type: 'path',
    d: 'M 84 44 L 92 46 L 94 118 C 94 122 90 126 86 126 C 82 126 80 122 80 118 L 80 54 C 80 50 82 46 84 44 Z',
  },

  // Legs — left and right from hip, separated at crotch
  {
    type: 'path',
    d: 'M 34 132 L 28 218 L 42 218 L 46 148 C 48 138 52 138 54 148 L 58 218 L 72 218 L 66 132 C 60 134 40 134 34 132 Z',
  },
]

// ── Front-view muscle regions.
// Render order matters: earlier entries appear beneath later entries.
// Shoulders are rendered before chest so chest layers over the shoulder–pec overlap area.
export const FRONT_REGIONS = [
  { muscle: 'legs',      type: 'ellipse', cx: 37,  cy: 164, rx: 9,   ry: 18 }, // left quad
  { muscle: 'legs',      type: 'ellipse', cx: 63,  cy: 164, rx: 9,   ry: 18 }, // right quad
  { muscle: 'core',      type: 'ellipse', cx: 50,  cy: 106, rx: 14,  ry: 20 }, // abs
  { muscle: 'arms',      type: 'ellipse', cx: 13,  cy: 88,  rx: 7,   ry: 16 }, // left bicep
  { muscle: 'arms',      type: 'ellipse', cx: 87,  cy: 88,  rx: 7,   ry: 16 }, // right bicep
  { muscle: 'shoulders', type: 'ellipse', cx: 14,  cy: 52,  rx: 9,   ry: 12 }, // left delt
  { muscle: 'shoulders', type: 'ellipse', cx: 86,  cy: 52,  rx: 9,   ry: 12 }, // right delt
  { muscle: 'chest',     type: 'ellipse', cx: 38,  cy: 72,  rx: 13,  ry: 14 }, // left pec
  { muscle: 'chest',     type: 'ellipse', cx: 62,  cy: 72,  rx: 13,  ry: 14 }, // right pec
]

// ── Back-view muscle regions.
// Back (lats/traps) is rendered before shoulders so shoulder fills layer on top.
export const BACK_REGIONS = [
  { muscle: 'legs',      type: 'ellipse', cx: 37,  cy: 164, rx: 9,   ry: 18 }, // left hamstring
  { muscle: 'legs',      type: 'ellipse', cx: 63,  cy: 164, rx: 9,   ry: 18 }, // right hamstring
  { muscle: 'glutes',    type: 'ellipse', cx: 37,  cy: 140, rx: 13,  ry: 10 }, // left glute
  { muscle: 'glutes',    type: 'ellipse', cx: 63,  cy: 140, rx: 13,  ry: 10 }, // right glute
  { muscle: 'core',      type: 'ellipse', cx: 50,  cy: 106, rx: 12,  ry: 16 }, // lower back / erectors
  // Back region: wide rounded trapezoid — wider at shoulders, narrows to waist.
  { muscle: 'back',      type: 'path',    d: 'M 24 52 L 76 52 C 80 60 78 96 66 118 L 34 118 C 22 96 20 60 24 52 Z' },
  { muscle: 'arms',      type: 'ellipse', cx: 13,  cy: 86,  rx: 8,   ry: 18 }, // left tricep
  { muscle: 'arms',      type: 'ellipse', cx: 87,  cy: 86,  rx: 8,   ry: 18 }, // right tricep
  { muscle: 'shoulders', type: 'ellipse', cx: 14,  cy: 52,  rx: 9,   ry: 12 }, // left rear delt
  { muscle: 'shoulders', type: 'ellipse', cx: 86,  cy: 52,  rx: 9,   ry: 12 }, // right rear delt
]

// Returns the fill-opacity for a muscle region given its tonnage and the week's peak.
// 0 for zero tonnage (inert region — no fill, inert stroke applied by caller).
// Minimum 0.15 for any active region — mirrors Session 2's 4% bar-width floor.
export function muscleOpacity(tonnage, maxTonnage) {
  if (!tonnage || !maxTonnage) return 0
  return Math.max(0.15, tonnage / maxTonnage)
}
