export const MAINTAIN_TOLERANCE_KCAL = 300

export function getCalorieTargetMode(settings) {
  return settings?.calorieTargetMode ?? null
}

export function evaluateCalorieDelta(consumed, burnt, mode) {
  if (consumed == null || burnt == null) return { status: 'no_data', delta: null }
  if (mode == null) return { status: 'no_mode', delta: consumed - burnt }
  const delta = consumed - burnt
  const onTarget =
    mode === 'deficit'  ? delta < 0 :
    mode === 'surplus'  ? delta > 0 :
    mode === 'maintain' ? Math.abs(delta) <= MAINTAIN_TOLERANCE_KCAL :
    false
  return { status: onTarget ? 'on_target' : 'off_target', delta }
}

export function evaluateDelta(delta, mode) {
  if (delta == null) return { status: 'no_data', delta: null }
  if (mode == null) return { status: 'no_mode', delta }
  const onTarget =
    mode === 'deficit'  ? delta < 0 :
    mode === 'surplus'  ? delta > 0 :
    mode === 'maintain' ? Math.abs(delta) <= MAINTAIN_TOLERANCE_KCAL :
    false
  return { status: onTarget ? 'on_target' : 'off_target', delta }
}
