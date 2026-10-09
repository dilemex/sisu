import { supabase } from '../supabase.js'

/**
 * Calcula o "quanto podemos gastar" para o mês corrente.
 * Retorna:
 *   receitasPrevistas, despesasFixas, parcelasMes, disponivel
 */
export async function getPlanning(familyId) {
  const hoje = new Date()
  const y = hoje.getFullYear()
  const m = hoje.getMonth() + 1
  const ym = `${y}-${String(m).padStart(2, '0')}`
  const ultimoDia = new Date(y, m, 0).getDate()
  const from = `${ym}-01`
  const to = `${ym}-${String(ultimoDia).padStart(2, '0')}`

  // Recorrências ativas do tipo income = receitas previstas
  const { data: recIncome, error: e1 } = await supabase
    .from('recurring_transactions')
    .select('amount')
    .eq('family_id', familyId)
    .eq('is_active', true)
    .eq('type', 'income')
  if (e1) throw e1

  // Recorrências ativas do tipo expense = despesas fixas
  const { data: recExpense, error: e2 } = await supabase
    .from('recurring_transactions')
    .select('amount')
    .eq('family_id', familyId)
    .eq('is_active', true)
    .eq('type', 'expense')
  if (e2) throw e2

  // Parcelas do mês: transações com installment_group_id preenchido,
  // do tipo expense, no mês atual
  const { data: parcelas, error: e3 } = await supabase
    .from('transactions')
    .select('amount')
    .eq('family_id', familyId)
    .eq('type', 'expense')
    .not('installment_group_id', 'is', null)
    .gte('date', from)
    .lte('date', to)
  if (e3) throw e3

  const receitasPrevistas = (recIncome ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const despesasFixas    = (recExpense ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const parcelasMes      = (parcelas ?? []).reduce((s, r) => s + Number(r.amount), 0)

  return {
    receitasPrevistas,
    despesasFixas,
    parcelasMes,
    disponivel: receitasPrevistas - despesasFixas - parcelasMes
  }
}