import { supabase } from '../supabase.js'

export async function listRecurring(familyId) {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(`
      *,
      category:categories ( id, name, icon ),
      account:accounts ( id, name ),
      card:credit_cards ( id, name ),
      member:family_members ( id, name )
    `)
    .eq('family_id', familyId)
    .order('is_active', { ascending: false })
    .order('description')
  if (error) throw error
  return data
}

export async function createRecurring(familyId, payload) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({ ...payload, family_id: familyId, created_by: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRecurring(id, patch) {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRecurring(id) {
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
  if (error) throw error
}

/**
 * Gera as transações do mês corrente para todas as recorrências ativas
 * que ainda não foram geradas neste mês.
 * Retorna a lista de transações criadas (pode ser vazia).
 */
export async function generateDueRecurrences(familyId) {
  const hoje = new Date()
  const y = hoje.getFullYear()
  const m = hoje.getMonth() + 1
  const ym = `${y}-${String(m).padStart(2, '0')}`
  const ultimoDia = new Date(y, m, 0).getDate()

  // Recorrências ativas cujo start_date é <= último dia do mês
  const { data: recorrentes, error: e1 } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('family_id', familyId)
    .eq('is_active', true)
    .lte('start_date', `${ym}-${String(ultimoDia).padStart(2, '0')}`)
  if (e1) throw e1

  // Já geradas neste mês
  const { data: jaGeradas, error: e2 } = await supabase
    .from('transactions')
    .select('recurring_id')
    .eq('family_id', familyId)
    .not('recurring_id', 'is', null)     // CORRETO
    .gte('date', `${ym}-01`)
    .lte('date', `${ym}-${String(ultimoDia).padStart(2, '0')}`)
  if (e2) throw e2

  const idsGerados = new Set((jaGeradas ?? []).map((t) => t.recurring_id))

  const { data: { user } } = await supabase.auth.getUser()
  const novas = []

  for (const r of recorrentes) {
    if (idsGerados.has(r.id)) continue
    if (r.end_date && r.end_date < `${ym}-01`) continue

    const dia = Math.min(r.day_of_month, ultimoDia)
    const dataISO = `${ym}-${String(dia).padStart(2, '0')}`

    novas.push({
      family_id: familyId,
      type: r.type,
      amount: r.amount,
      date: dataISO,
      description: r.description,
      category_id: r.category_id,
      account_id: r.account_id,
      credit_card_id: r.credit_card_id,
      member_id: r.member_id,
      notes: r.notes,
      recurring_id: r.id,
      created_by: user.id
    })
  }

  if (novas.length === 0) return []

  const { data, error } = await supabase
    .from('transactions')
    .insert(novas)
    .select()
  if (error) throw error
  return data
}