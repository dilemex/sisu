import { supabase } from '../supabase.js'

export async function listMembers(familyId) {
  const { data, error } = await supabase
    .from('family_members')
    .select('id, name, role')
    .eq('family_id', familyId)
    .order('name')
  if (error) throw error
  return data
}