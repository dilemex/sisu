import { supabase } from './supabase.js'

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Busca o membro da família vinculado ao usuário logado.
 * Retorna { id, name, role, family_id, family: { id, name } } ou null.
 */
export async function getCurrentMember() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('family_members')
    .select(`
      id,
      name,
      role,
      family_id,
      family:families ( id, name )
    `)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  return data
}