/**
 * lib/api.js — client-side fetch wrapper that attaches the session (FC-075a).
 *
 * The /api/* routes run under the service role and resolve the acting user from
 * the Bearer token (see lib/auth-server.js → resolveUserId). Every in-app call
 * must therefore carry the current session's access token. Use apiFetch in
 * place of fetch for all /api/* calls; it is otherwise a transparent pass-through
 * (body, method, and any caller headers are preserved — do not set Content-Type
 * for FormData bodies, the browser handles that).
 */
import { supabase } from './supabase'

export async function apiFetch(path, opts = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  const headers = new Headers(opts.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(path, { ...opts, headers })
}

// Kick off an OAuth connect (Strava / WHOOP). The connect routes now resolve the
// user from the Bearer token and return the provider URL as JSON (with the user
// id baked into the OAuth state) rather than redirecting themselves (FC-075a).
// So: ask via apiFetch, then navigate. `path` is '/api/strava/connect' etc.
export async function startConnect(path) {
  const res = await apiFetch(path)
  const { url } = await res.json().catch(() => ({}))
  if (url) window.location.href = url
}
