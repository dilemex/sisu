import { supabase } from '../supabase.js'

export async function listAccounts(familyId) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('family_id', familyId)
    .order('name')
  if (error) throw error
  return data
}

export async function createAccount({ familyId, name, type, institution, initialBalance }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      family_id: familyId,
      name,
      type,
      institution: institution || null,
      initial_balance: Number(initialBalance) || 0,
      created_by: user.id
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAccount(id, patch) {
  const { data, error } = await supabase
    .from('accounts')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleAccountActive(id) {
  const { data: acc, error: e1 } = await supabase
    .from('accounts').select('is_active').eq('id', id).single()
  if (e1) throw e1
  return updateAccount(id, { is_active: !acc.is_active })
}