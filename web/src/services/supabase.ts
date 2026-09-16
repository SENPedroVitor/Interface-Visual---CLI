import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

/** Supabase is opt-in so the local, unauthenticated Waddle remains usable. */
export const authEnabled = Boolean(url && key);
export const supabase: SupabaseClient | null = authEnabled ? createClient(url!, key!) : null;

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email: string, password: string): Promise<Session> {
  if (!supabase) throw new Error('Autenticação não configurada.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error('Login sem sessão ativa.');
  return data.session;
}

export async function signUp(email: string, password: string): Promise<Session | null> {
  if (!supabase) throw new Error('Autenticação não configurada.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
