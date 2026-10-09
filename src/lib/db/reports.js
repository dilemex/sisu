import { supabase } from '../supabase.js'

/**
 * Gastos por categoria num período. Retorna array ordenado desc,
 * com nome, ícone e total.
 */
export async function getReportByCategory(familyId, { from, to }) {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      amount,
      category:categories ( id, name, icon )
    `)
    .eq('family_id', familyId)
    .eq('type', 'expense')
    .gte('date', from)
    .lte('date', to)
  if (error) throw error

  const map = new Map()
  let total = 0
  for (const t of data) {
    total += Number(t.amount)
    const id = t.category?.id ?? '__sem__'
    const nome = t.category?.name ?? 'Sem categoria'
    const icone = t.category?.icon ?? '❓'
    if (!map.has(id)) map.set(id, { id, nome, icone, total: 0 })
    map.get(id).total += Number(t.amount)
  }

  return {
    total,
    itens: [...map.values()].sort((a, b) => b.total - a.total)
  }
}

/**
 * Receitas x Despesas mês a mês, para N meses para trás.
 */
export async function getReportMonthly(familyId, months = 6) {
  const hoje = new Date()
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (months - 1), 1)

  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount, type')
    .eq('family_id', familyId)
    .gte('date', inicio.toISOString().slice(0, 10))
  if (error) throw error

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const buckets = new Map()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(ym, { ym, label: MESES[d.getMonth()], receitas: 0, despesas: 0 })
  }

  for (const t of data) {
    const ym = t.date.slice(0, 7)
    const b = buckets.get(ym)
    if (!b) continue
    if (t.type === 'income') b.receitas += Number(t.amount)
    else b.despesas += Number(t.amount)
  }

  return [...buckets.values()]
}

/**
 * Taxa de sobra = (receitas - despesas) / receitas, no período.
 */
export async function getSavingsRate(familyId, { from, to }) {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('family_id', familyId)
    .gte('date', from)
    .lte('date', to)
  if (error) throw error

  let r = 0, d = 0
  for (const t of data) {
    if (t.type === 'income') r += Number(t.amount)
    else d += Number(t.amount)
  }
  const rate = r > 0 ? (r - d) / r : 0
  return { receitas: r, despesas: d, sobra: r - d, taxa: rate }
}