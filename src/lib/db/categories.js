import { supabase } from '../supabase.js'

export async function listCategories(familyId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('family_id', familyId)
    .order('type')
    .order('sort_order')
    .order('name')
  if (error) throw error
  return data
}