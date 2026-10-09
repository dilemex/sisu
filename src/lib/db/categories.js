import { supabase } from '../supabase.js'

export async function listCategories(familyId, { incluirArquivadas = false } = {}) {
  let q = supabase
    .from('categories')
    .select('*')
    .eq('family_id', familyId)
    .order('type')
    .order('sort_order')
    .order('name')

  if (!incluirArquivadas) q = q.eq('is_archived', false)

  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createCategory(familyId, { name, type, icon, parent_id }) {
  // sort_order = último da lista +1
  const { data: irmas } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('family_id', familyId)
    .eq('type', type)
    .is('parent_id', parent_id ?? null)
    .order('sort_order', { ascending: false })
    .limit(1)

  const proximoSort = (irmas?.[0]?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('categories')
    .insert({
      family_id: familyId,
      name,
      type,
      icon: icon || null,
      parent_id: parent_id || null,
      sort_order: proximoSort
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id, patch) {
  const { data, error } = await supabase
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function archiveCategory(id) {
  return updateCategory(id, { is_archived: true })
}

export async function unarchiveCategory(id) {
  return updateCategory(id, { is_archived: false })
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

/**
 * Verifica se a categoria tem transações vinculadas.
 * Se tiver, melhor arquivar do que apagar.
 */
export async function countCategoryUsage(categoryId) {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
  if (error) throw error
  return count ?? 0
}