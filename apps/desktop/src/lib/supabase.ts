import { createClient } from '@supabase/supabase-js'
import {
  SUPABASE_URL as DEFAULT_SUPABASE_URL,
  SUPABASE_ANON_KEY as DEFAULT_SUPABASE_ANON_KEY,
} from '@oneway/shared'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
