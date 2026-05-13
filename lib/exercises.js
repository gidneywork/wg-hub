/**
 * Cadence — exercise database and muscle taxonomy.
 *
 * 53 exercises across 8 coarse muscle groups. Single primary muscle per entry.
 * Cardio entries carry cardio:true so callers can filter them (e.g. LiftsSection
 * excludes them; the planner will use them).
 *
 * Helpers:
 *   getExerciseByName(name)  — case-insensitive lookup, returns object or undefined
 *   resolveMuscle(name)      — returns primary muscle string or null
 *   listExercises()          — all entries in declaration order
 *   getMuscleGroups()        — the 8 canonical group names
 */

const EXERCISES = [

  // ── Chest
  { id: 'bench-press',           name: 'Bench press',           muscle: 'chest',     bodyweight: false },
  { id: 'incline-bench-press',   name: 'Incline bench press',   muscle: 'chest',     bodyweight: false },
  { id: 'decline-bench-press',   name: 'Decline bench press',   muscle: 'chest',     bodyweight: false },
  { id: 'dumbbell-fly',          name: 'Dumbbell fly',          muscle: 'chest',     bodyweight: false },
  { id: 'push-up',               name: 'Push-up',               muscle: 'chest',     bodyweight: true  },
  { id: 'dips',                  name: 'Dips',                  muscle: 'chest',     bodyweight: true  },

  // ── Back
  { id: 'deadlift',              name: 'Deadlift',              muscle: 'back',      bodyweight: false },
  { id: 'pull-up-weighted',      name: 'Pull-up · weighted',    muscle: 'back',      bodyweight: false },
  { id: 'pull-up-bodyweight',    name: 'Pull-up · bodyweight',  muscle: 'back',      bodyweight: true  },
  { id: 'chin-up-weighted',      name: 'Chin-up · weighted',    muscle: 'back',      bodyweight: false },
  { id: 'barbell-row',           name: 'Barbell row',           muscle: 'back',      bodyweight: false },
  { id: 'dumbbell-row',          name: 'Dumbbell row',          muscle: 'back',      bodyweight: false },
  { id: 'cable-row',             name: 'Cable row',             muscle: 'back',      bodyweight: false },
  { id: 'lat-pulldown',          name: 'Lat pulldown',          muscle: 'back',      bodyweight: false },
  { id: 'face-pull',             name: 'Face pull',             muscle: 'back',      bodyweight: false },

  // ── Shoulders
  { id: 'overhead-press',        name: 'Overhead press',        muscle: 'shoulders', bodyweight: false },
  { id: 'dumbbell-shoulder-press', name: 'Dumbbell shoulder press', muscle: 'shoulders', bodyweight: false },
  { id: 'arnold-press',          name: 'Arnold press',          muscle: 'shoulders', bodyweight: false },
  { id: 'lateral-raise',         name: 'Lateral raise',         muscle: 'shoulders', bodyweight: false },
  { id: 'front-raise',           name: 'Front raise',           muscle: 'shoulders', bodyweight: false },
  { id: 'rear-delt-fly',         name: 'Rear delt fly',         muscle: 'shoulders', bodyweight: false },

  // ── Arms
  { id: 'barbell-curl',          name: 'Barbell curl',          muscle: 'arms',      bodyweight: false },
  { id: 'dumbbell-curl',         name: 'Dumbbell curl',         muscle: 'arms',      bodyweight: false },
  { id: 'hammer-curl',           name: 'Hammer curl',           muscle: 'arms',      bodyweight: false },
  { id: 'tricep-pushdown',       name: 'Tricep pushdown',       muscle: 'arms',      bodyweight: false },
  { id: 'skull-crusher',         name: 'Skull crusher',         muscle: 'arms',      bodyweight: false },
  { id: 'overhead-tricep-extension', name: 'Overhead tricep extension', muscle: 'arms', bodyweight: false },
  { id: 'close-grip-bench-press', name: 'Close-grip bench press', muscle: 'arms',    bodyweight: false },
  { id: 'chin-up-bodyweight',    name: 'Chin-up · bodyweight',  muscle: 'arms',      bodyweight: true  },

  // ── Core
  { id: 'plank',                 name: 'Plank',                 muscle: 'core',      bodyweight: true  },
  { id: 'ab-wheel',              name: 'Ab wheel',              muscle: 'core',      bodyweight: true  },
  { id: 'hanging-leg-raise',     name: 'Hanging leg raise',     muscle: 'core',      bodyweight: true  },
  { id: 'cable-crunch',          name: 'Cable crunch',          muscle: 'core',      bodyweight: false },
  { id: 'pallof-press',          name: 'Pallof press',          muscle: 'core',      bodyweight: false },
  { id: 'russian-twist',         name: 'Russian twist',         muscle: 'core',      bodyweight: true  },
  { id: 'sit-up',                name: 'Sit-up',                muscle: 'core',      bodyweight: true  },

  // ── Legs
  { id: 'back-squat',            name: 'Back squat',            muscle: 'legs',      bodyweight: false },
  { id: 'front-squat',           name: 'Front squat',           muscle: 'legs',      bodyweight: false },
  { id: 'leg-press',             name: 'Leg press',             muscle: 'legs',      bodyweight: false },
  { id: 'romanian-deadlift',     name: 'Romanian deadlift',     muscle: 'legs',      bodyweight: false },
  { id: 'leg-curl',              name: 'Leg curl',              muscle: 'legs',      bodyweight: false },
  { id: 'leg-extension',         name: 'Leg extension',         muscle: 'legs',      bodyweight: false },
  { id: 'hack-squat',            name: 'Hack squat',            muscle: 'legs',      bodyweight: false },
  { id: 'bulgarian-split-squat', name: 'Bulgarian split squat', muscle: 'legs',      bodyweight: false },
  { id: 'lunge',                 name: 'Lunge',                 muscle: 'legs',      bodyweight: true  },
  { id: 'step-up',               name: 'Step-up',               muscle: 'legs',      bodyweight: true  },

  // ── Glutes
  { id: 'hip-thrust',            name: 'Hip thrust',            muscle: 'glutes',    bodyweight: false },
  { id: 'glute-bridge',          name: 'Glute bridge',          muscle: 'glutes',    bodyweight: true  },
  { id: 'cable-kickback',        name: 'Cable kickback',        muscle: 'glutes',    bodyweight: false },
  { id: 'single-leg-hip-thrust', name: 'Single-leg hip thrust', muscle: 'glutes',    bodyweight: true  },

  // ── Cardio (cardio:true — excluded from LiftsSection combobox, available for planner)
  { id: 'run-easy',              name: 'Run — easy',            muscle: 'cardio',    bodyweight: false, cardio: true },
  { id: 'run-threshold',         name: 'Run — threshold',       muscle: 'cardio',    bodyweight: false, cardio: true },
  { id: 'run-intervals',         name: 'Run — intervals',       muscle: 'cardio',    bodyweight: false, cardio: true },
  { id: 'run-long',              name: 'Run — long',            muscle: 'cardio',    bodyweight: false, cardio: true },
  { id: 'bike',                  name: 'Bike',                  muscle: 'cardio',    bodyweight: false, cardio: true },
  { id: 'swim',                  name: 'Swim',                  muscle: 'cardio',    bodyweight: false, cardio: true },
  { id: 'row-machine',           name: 'Row (machine)',         muscle: 'cardio',    bodyweight: false, cardio: true },
]

export function getExerciseByName(name) {
  if (!name) return undefined
  const key = name.trim().toLowerCase()
  return EXERCISES.find(e => e.name.toLowerCase() === key)
}

export function resolveMuscle(name) {
  return getExerciseByName(name)?.muscle ?? null
}

export function listExercises() {
  return EXERCISES
}

export function getMuscleGroups() {
  return ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes', 'cardio']
}
