import { supabase } from '../supabase.js'

export async function listBudgets(familyId) {
  const { data, error } = await supabase
    .from('budgets')
    .select(`
      *,
      category:categories ( id, name, icon, parent_id )
    `)
    .eq('family_id', familyId)
    .eq('is_active', true)
    .order('created_at')
  if (error) throw error
  return data
}

export async function createBudget(familyId, { category_id, amount }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('budgets')
    .insert({
      family_id: familyId,
      category_id,
      amount: Number(amount),
      created_by: user.id
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBudget(id, { amount }) {
  const { data, error } = await supabase
    .from('budgets')
    .update({ amount: Number(amount) })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBudget(id) {
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) throw error
}

/**
 * Gasto real por categoria no período. Mesma estrutura de
 * getTopExpenseCategories, mas sem limit e sem sort.
 */
export async function getCategorySpending(familyId, { from, to }) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, category_id')
    .eq('family_id', familyId)
    .eq('type', 'expense')
    .gte('date', from)
    .lte('date', to)
  if (error) throw error

  const por = {}
  for (const t of data) {
    if (!t.category_id) continue
    por[t.category_id] = (por[t.category_id] ?? 0) + Number(t.amount)
  }
  return por
}