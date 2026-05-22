let supabase = null;

export async function getSupabaseClient() {
  if (supabase) return supabase;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  const { createClient } = await import("@supabase/supabase-js");
  supabase = createClient(url, anonKey);
  return supabase;
}

export function getCachedSupabaseClient() {
  return supabase;
}
