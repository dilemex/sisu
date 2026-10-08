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