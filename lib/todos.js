/**
 * Pure helpers for the Cadence to-do system.
 * No DB calls — just business logic over plain data shapes.
 */

// Returns true if a todo applies on the given ISO date string.
// Handles soft-deletes, date bounds, and all four repeat kinds.
export function isTodoApplicable(todo, isoDate) {
  if (todo.deleted_at) return false
  if (isoDate < todo.start_date) return false
  if (todo.end_date && isoDate > todo.end_date) return false

  const d = new Date(isoDate + 'T00:00:00')
  const jsDay = d.getDay()
  const isoDay = jsDay === 0 ? 6 : jsDay - 1  // Mon=0…Sun=6

  switch (todo.repeat_kind) {
    case 'none':    return isoDate === todo.start_date
    case 'daily':   return true
    case 'weekday': return isoDay <= 4
    case 'weekly':  return isoDay === todo.repeat_weekday
    case 'monthly': return d.getDate() === todo.repeat_day_of_month
    default:        return false
  }
}

// Splits todos applicable on isoDate into pending and completed buckets.
// completions: array of { todo_id, completion_date } rows.
export function filterTodosForDate(todos, completions, isoDate) {
  const done = new Set(
    completions.filter(c => c.completion_date === isoDate).map(c => c.todo_id)
  )
  const applicable = todos.filter(t => isTodoApplicable(t, isoDate))
  return {
    pending:   applicable.filter(t => !done.has(t.id)),
    completed: applicable.filter(t =>  done.has(t.id)),
  }
}
