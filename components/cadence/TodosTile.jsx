'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '../../lib/db'
import { filterTodosForDate } from '../../lib/todos'
import { localIso } from './helpers'

const MAX_SHOWN = 5

export default function TodosTile({ setView }) {
  const [todos,       setTodos      ] = useState([])
  const [completions, setCompletions] = useState([])

  const today = useMemo(() => localIso(), [])

  useEffect(() => {
    Promise.all([db.listTodos(), db.listTodoCompletions()]).then(([t, c]) => {
      setTodos(t)
      setCompletions(c)
    })
  }, [])

  const { pending } = useMemo(
    () => filterTodosForDate(todos, completions, today),
    [todos, completions, today]
  )

  const shown    = pending.slice(0, MAX_SHOWN)
  const overflow = pending.length > MAX_SHOWN ? pending.length - MAX_SHOWN : 0

  async function handleComplete(todo) {
    setCompletions(prev => [...prev, { todo_id: todo.id, completion_date: today }])
    try {
      await db.completeTodo(todo.id, today)
    } catch (e) {
      console.error('completeTodo failed:', e)
      setCompletions(prev => prev.filter(c => !(c.todo_id === todo.id && c.completion_date === today)))
    }
  }

  return (
    <section className="section r r-7">
      <div className="section-head">
        <h2>To-dos</h2>
        {setView && (
          <button type="button" className="link" onClick={() => setView('planner')}>
            Planner →
          </button>
        )}
      </div>
      <div className="todos-tile-card">
        {shown.length === 0 ? (
          <div className="todos-tile-empty">All clear.</div>
        ) : (
          shown.map(todo => (
            <div key={todo.id} className="todos-tile-row">
              <button
                type="button"
                className="todo-check"
                aria-label={`Complete: ${todo.title}`}
                onClick={() => handleComplete(todo)}
              />
              <span className="todos-tile-title">{todo.title}</span>
            </div>
          ))
        )}
        {overflow > 0 && (
          <div className="todos-tile-overflow">
            +{overflow} more
            {setView && (
              <button type="button" className="todos-tile-more-link" onClick={() => setView('planner')}>
                View all in Planner
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
