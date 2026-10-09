import { supabase } from '../supabase.js'

export async function listMembers(familyId) {
  const { data, error } = await supabase
    .from('family_members')
    .select('id, name, role, user_id')
    .eq('family_id', familyId)
    .order('name')
  if (error) throw error
  return data
}

export async function updateMember(id, patch) {
  const { data, error } = await supabase
    .from('family_members')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}