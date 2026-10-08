import { supabase } from '../supabase.js'

const SELECT = `
  *,
  category:categories ( id, name, icon, type ),
  account:accounts ( id, name ),
  card:credit_cards ( id, name ),
  member:family_members ( id, name )
`

export async function listTransactions(familyId, { from, to, type, categoryId } = {}) {
  let q = supabase
    .from('transactions')
    .select(SELECT)
    .eq('family_id', familyId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (from) q = q.gte('date', from)
  if (to) q = q.lte('date', to)
  if (type) q = q.eq('type', type)
  if (categoryId) q = q.eq('category_id', categoryId)

  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createTransaction(familyId, payload) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...payload, family_id: familyId, created_by: user.id })
    .select(SELECT)
    .single()
  if (error) throw error
  return data
}

export async function updateTransaction(id, payload) {
  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw error
  return data
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}