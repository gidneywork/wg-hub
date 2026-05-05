import { createClient } from '@supabase/supabase-js'

// Server-side only — uses service role key to bypass RLS.
// NEVER import this in client components.
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
