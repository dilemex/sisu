import { supabase } from '../supabase.js'

export async function listCards(familyId) {
  const { data, error } = await supabase
    .from('credit_cards')
    .select(`
      *,
      payment_account:accounts ( id, name )
    `)
    .eq('family_id', familyId)
    .order('name')
  if (error) throw error
  return data
}

export async function createCard({
  familyId, name, institution, limit_amount, closing_day, due_day, payment_account_id
}) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('credit_cards')
    .insert({
      family_id: familyId,
      name,
      institution: institution || null,
      limit_amount: limit_amount ?? null,
      closing_day,
      due_day,
      payment_account_id: payment_account_id || null,
      created_by: user.id
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCard(id, patch) {
  const { data, error } = await supabase
    .from('credit_cards')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleCardActive(id) {
  const { data: c, error: e1 } = await supabase
    .from('credit_cards').select('is_active').eq('id', id).single()
  if (e1) throw e1
  return updateCard(id, { is_active: !c.is_active })
}