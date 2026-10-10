import { supabase } from '../supabase.js'

/**
 * Saldo real de cada conta = initial_balance + income - expense.
 * Considera apenas lançamentos em contas (não cartões).
 * Retorna um objeto { [account_id]: delta }.
 */
export async function getAccountBalances(familyId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, account_id, account_to_id')
    .eq('family_id', familyId)
  if (error) throw error

  const delta = {}
  for (const t of data) {
    const v = Number(t.amount)
    if (t.type === 'income' && t.account_id) {
      delta[t.account_id] = (delta[t.account_id] ?? 0) + v
    } else if (t.type === 'expense' && t.account_id) {
      delta[t.account_id] = (delta[t.account_id] ?? 0) - v
    } else if (t.type === 'transfer') {
      if (t.account_id)    delta[t.account_id]    = (delta[t.account_id] ?? 0) - v
      if (t.account_to_id) delta[t.account_to_id] = (delta[t.account_to_id] ?? 0) + v
    }
  }
  return delta
}
/**
 * Resumo do período: total entradas, saídas e saldo.
 */
export async function getPeriodSummary(familyId, { from, to }) {
  // Cap em hoje: ignora lançamentos futuros
  const hoje = new Date().toISOString().slice(0, 10)
  const effectiveTo = to > hoje ? hoje : to

  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('family_id', familyId)
    .neq('type', 'transfer')
    .not('account_id', 'is', null)   // só conta — cartão fica fora
    .gte('date', from)
    .lte('date', effectiveTo)
  if (error) throw error

  let receitas = 0, despesas = 0
  for (const t of data) {
    if (t.type === 'income') receitas += Number(t.amount)
    else despesas += Number(t.amount)
  }
  return { receitas, despesas, saldo: receitas - despesas }
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

/**
 * Evolução dos últimos N meses de despesas (para mini gráfico).
 * Retorna [{ ym: '2026-10', label: 'Out', total: 1234.56 }, ...]
 */
export async function getMonthEvolution(familyId, months = 6) {
  const hoje = new Date()
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (months - 1), 1)

  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount, type')
    .eq('family_id', familyId)
    .eq('type', 'expense')
    .gte('date', inicio.toISOString().slice(0, 10))
  if (error) throw error

  const porMes = {}
  for (const t of data) {
    const ym = t.date.slice(0, 7)
    porMes[ym] = (porMes[ym] ?? 0) + Number(t.amount)
  }

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const out = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ ym, label: MESES[d.getMonth()], total: porMes[ym] ?? 0 })
  }
  return out
}

/**
 * Retorna dois mapas por conta:
 *   { atual: {...}, projetado: {...} }
 * atual = só transações até hoje
 * projetado = todas (inclui futuras)
 */
export async function getAccountBalancesDetailed(familyId) {
  const hoje = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, account_id, account_to_id, date')
    .eq('family_id', familyId)
  if (error) throw error

  const atual = {}
  const projetado = {}

  const add = (map, id, v) => {
    if (!id) return
    map[id] = (map[id] ?? 0) + v
  }

  for (const t of data) {
    const v = Number(t.amount)
    const isPast = t.date <= hoje

    if (t.type === 'income') {
      add(projetado, t.account_id, v)
      if (isPast) add(atual, t.account_id, v)
    } else if (t.type === 'expense') {
      add(projetado, t.account_id, -v)
      if (isPast) add(atual, t.account_id, -v)
    } else if (t.type === 'transfer') {
      add(projetado, t.account_id, -v)
      add(projetado, t.account_to_id, v)
      if (isPast) {
        add(atual, t.account_id, -v)
        add(atual, t.account_to_id, v)
      }
    }
  }

  return { atual, projetado }
}