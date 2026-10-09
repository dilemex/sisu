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

/**
 * Cria uma compra parcelada: gera N transações, uma por mês.
 * A última parcela absorve a diferença de arredondamento.
 * Retorna um array de transações criadas.
 */
export async function createInstallmentPurchase(familyId, payload, totalParcelas) {
  const { data: { user } } = await supabase.auth.getUser()

  const total = Number(payload.amount)
  const parcelaBase = Math.floor((total / totalParcelas) * 100) / 100
  const groupId = crypto.randomUUID()

  const [ano, mes, dia] = payload.date.split('-').map(Number)

  const linhas = []
  let acumulado = 0
  for (let i = 0; i < totalParcelas; i++) {
    const ultima = i === totalParcelas - 1
    const valor = ultima
      ? Math.round((total - acumulado) * 100) / 100
      : parcelaBase
    acumulado += valor

    const d = new Date(ano, mes - 1 + i, dia)
    const dataISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    linhas.push({
      ...payload,
      amount: valor,
      date: dataISO,
      installment_group_id: groupId,
      installment_number: i + 1,
      installment_total: totalParcelas,
      family_id: familyId,
      created_by: user.id
    })
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(linhas)
    .select(SELECT)

  if (error) throw error
  return data
}

/**
 * Deleta uma compra parcelada inteira (todas as parcelas).
 */
export async function deleteInstallmentGroup(groupId) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('installment_group_id', groupId)
  if (error) throw error
}

/**
 * Lista todas as parcelas futuras de compras parceladas,
 * agrupadas por installment_group_id.
 */
export async function listActiveInstallments(familyId) {
  const hoje = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id, amount, date, description,
      installment_group_id, installment_number, installment_total,
      card:credit_cards ( id, name ),
      account:accounts ( id, name ),
      category:categories ( id, name, icon )
    `)
    .eq('family_id', familyId)
    .not('installment_group_id', 'is', null)
    .gte('date', hoje)
    .order('date')
  if (error) throw error

  const grupos = new Map()
  for (const t of data) {
    if (!grupos.has(t.installment_group_id)) {
      grupos.set(t.installment_group_id, {
        group_id: t.installment_group_id,
        description: t.description,
        card: t.card,
        account: t.account,
        category: t.category,
        total: t.installment_total,
        parcela_atual: t.installment_number,
        valor_parcela: Number(t.amount),
        restantes: t.installment_total - t.installment_number + 1,
        total_restante: 0,
        proxima_data: t.date
      })
    }
    const g = grupos.get(t.installment_group_id)
    g.total_restante += Number(t.amount)
  }
  return [...grupos.values()].sort((a, b) => a.proxima_data.localeCompare(b.proxima_data))
}