import { supabase } from '../supabase.js'

/**
 * Saldo real de cada conta = initial_balance + income - expense.
 * Considera apenas lançamentos em contas (não cartões).
 * Retorna um objeto { [account_id]: delta }.
 */
export async function getAccountBalances(familyId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, account_id')
    .eq('family_id', familyId)
    .not('account_id', 'is', null)
  if (error) throw error

  const deltaPorConta = {}
  for (const t of data) {
    if (!t.account_id) continue
    deltaPorConta[t.account_id] ??= 0
    deltaPorConta[t.account_id] += t.type === 'income'
      ? Number(t.amount)
      : -Number(t.amount)
  }
  return deltaPorConta
}

/**
 * Fatura de cada cartão = soma dos lançamentos (expense) no cartão
 * dentro do intervalo de datas informado.
 * Retorna um objeto { [credit_card_id]: total }.
 */
export async function getCardInvoices(familyId, { from, to }) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, credit_card_id')
    .eq('family_id', familyId)
    .not('credit_card_id', 'is', null)
    .gte('date', from)
    .lte('date', to)
  if (error) throw error

  const porCartao = {}
  for (const t of data) {
    if (!t.credit_card_id) continue
    porCartao[t.credit_card_id] ??= 0
    porCartao[t.credit_card_id] += Number(t.amount)
  }
  return porCartao
}
/**
 * Resumo do período: total entradas, saídas e saldo.
 */
export async function getPeriodSummary(familyId, { from, to }) {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('family_id', familyId)
    .gte('date', from)
    .lte('date', to)
  if (error) throw error

  let receitas = 0, despesas = 0
  for (const t of data) {
    if (t.type === 'income') receitas += Number(t.amount)
    else despesas += Number(t.amount)
  }
  return { receitas, despesas, saldo: receitas - despesas }
}

/**
 * Top N categorias de despesa no período.
 * Retorna [{ category, total }, ...] ordenado desc.
 */
export async function getTopExpenseCategories(familyId, { from, to, limit = 5 }) {
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

  const acumulado = new Map()
  for (const t of data) {
    const id = t.category?.id ?? '__sem_categoria__'
    const nome = t.category?.name ?? 'Sem categoria'
    const icone = t.category?.icon ?? '❓'
    if (!acumulado.has(id)) acumulado.set(id, { id, nome, icone, total: 0 })
    acumulado.get(id).total += Number(t.amount)
  }

  return [...acumulado.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

/**
 * Próximos cartões a vencer (≤ N dias) a partir de hoje.
 */
export async function getUpcomingCardDue(familyId, withinDays = 3) {
  const { data, error } = await supabase
    .from('credit_cards')
    .select('id, name, due_day, closing_day')
    .eq('family_id', familyId)
    .eq('is_active', true)
  if (error) throw error

  const hoje = new Date()
  const diaHoje = hoje.getDate()
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()

  const alertas = []
  for (const c of data) {
    let dias = c.due_day - diaHoje
    if (dias < 0) {
      // já passou nesse mês → próximo mês
      dias += ultimoDiaMes
    }
    if (dias <= withinDays) {
      alertas.push({ ...c, diasParaVencer: dias })
    }
  }
  return alertas.sort((a, b) => a.diasParaVencer - b.diasParaVencer)
}

/**
 * Limite comprometido = soma de todas as despesas no cartão
 * a partir do início do mês corrente (inclui parcelas futuras).
 * É o que o banco "reserva" do limite assim que a compra é feita.
 */
export async function getCardCommitted(familyId) {
  const hoje = new Date()
  const ym = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const inicioMes = `${ym}-01`

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, credit_card_id')
    .eq('family_id', familyId)
    .eq('type', 'expense')
    .not('credit_card_id', 'is', null)
    .gte('date', inicioMes)
  if (error) throw error

  const porCartao = {}
  for (const t of data) {
    if (!t.credit_card_id) continue
    porCartao[t.credit_card_id] ??= 0
    porCartao[t.credit_card_id] += Number(t.amount)
  }
  return porCartao
}