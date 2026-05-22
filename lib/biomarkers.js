export const SUB_MARKERS = {
  testosterone: {
    testosterone_total: { name: 'Total testosterone', unit: 'nmol/L' },
    testosterone_free:  { name: 'Free testosterone',  unit: 'pmol/L' },
    shbg:               { name: 'SHBG',               unit: 'nmol/L' },
  },
  iron_panel: {
    ferritin:    { name: 'Ferritin',    unit: 'µg/L'   },
    serum_iron:  { name: 'Serum iron',  unit: 'µmol/L' },
    transferrin: { name: 'Transferrin', unit: 'g/L'    },
    haemoglobin: { name: 'Haemoglobin',unit: 'g/L'    },
    tibc:        { name: 'TIBC',        unit: 'µmol/L' },
  },
  b12_b9: {
    b12: { name: 'Vitamin B12', unit: 'pmol/L' },
    b9:  { name: 'Folate (B9)', unit: 'nmol/L' },
  },
  standard_lipid_panel: {
    total_cholesterol: { name: 'Total cholesterol', unit: 'mmol/L' },
    hdl:               { name: 'HDL',               unit: 'mmol/L' },
    ldl:               { name: 'LDL',               unit: 'mmol/L' },
    non_hdl:           { name: 'Non-HDL',            unit: 'mmol/L' },
  },
}

export function getStatus(def, latestResult) {
  if (!def) return 'no_data'
  if (def.target_direction === 'qualitative') {
    return latestResult ? 'logged' : 'no_data'
  }
  if (!latestResult || latestResult.value == null) {
    return isOverdue(def, null) ? 'due' : 'no_data'
  }
  const v    = Number(latestResult.value)
  const tDir = def.personal_target_direction || def.target_direction
  const tMin = def.personal_target_min  ?? def.target_min
  const tMax = def.personal_target_max  ?? def.target_max
  let inRange
  if      (tDir === 'above')   inRange = v >= Number(tMin ?? tMax)
  else if (tDir === 'below')   inRange = v <= Number(tMax ?? tMin)
  else if (tDir === 'between') inRange = v >= Number(tMin) && v <= Number(tMax)
  else                         inRange = true

  if (!inRange) return 'out_of_range'
  return isOverdue(def, latestResult) ? 'due' : 'in_range'
}

function isOverdue(def, latestResult) {
  const months = def.default_cadence_months
  if (!months) return false
  if (!latestResult) return true
  const measured = new Date(latestResult.measured_date + 'T00:00:00')
  const due = new Date(measured)
  due.setMonth(due.getMonth() + (latestResult.cadence_override_months ?? months))
  return new Date() > due
}

export function getNextDue(def, latestResult) {
  const months = def?.default_cadence_months
  if (!months) return null
  if (!latestResult) return new Date()
  const measured = new Date(latestResult.measured_date + 'T00:00:00')
  const due = new Date(measured)
  due.setMonth(due.getMonth() + (latestResult.cadence_override_months ?? months))
  return due
}

export function fmtDue(date) {
  if (!date) return null
  const now = new Date()
  if (date < now) return 'Overdue'
  const diffMs     = date - now
  const diffMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.5))
  if (diffMonths <= 0) return 'Due this month'
  if (diffMonths === 1) return 'Due in 1 month'
  return `Due in ${diffMonths} months`
}
