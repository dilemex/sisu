import { supabase } from '../supabase.js'

const TABELAS = [
  'families',
  'family_members',
  'accounts',
  'credit_cards',
  'categories',
  'transactions',
  'recurring_transactions',
  'budgets',
  'goals'
]

export async function exportAllData(familyId) {
  const resultado = { exportado_em: new Date().toISOString(), familia_id: familyId }

  for (const t of TABELAS) {
    const { data, error } = await supabase.from(t).select('*').eq('family_id', familyId)
    resultado[t] = error ? [] : (data ?? [])
  }

  const goalIds = (resultado.goals ?? []).map((g) => g.id)
  if (goalIds.length > 0) {
    const { data } = await supabase
      .from('goal_contributions')
      .select('*')
      .in('goal_id', goalIds)
    resultado.goal_contributions = data ?? []
  } else {
    resultado.goal_contributions = []
  }

  return resultado
}

export async function exportTransactionsCSV(familyId, { from, to }) {
  let q = supabase
    .from('transactions')
    .select(`
      date, type, amount, description, notes,
      category:categories ( name ),
      account:accounts!account_id ( name ),
      account_to:accounts!account_to_id ( name ),
      card:credit_cards ( name ),
      member:family_members ( name )
    `)
    .eq('family_id', familyId)
    .order('date', { ascending: false })

  if (from) q = q.gte('date', from)
  if (to) q = q.lte('date', to)

  const { data, error } = await q
  if (error) throw error

  const header = ['Data','Tipo','Valor','Descrição','Categoria','Conta','Conta destino','Cartão','Membro','Observação']
  const linhas = [header.join(';')]

  for (const t of data) {
    linhas.push([
      fmtData(t.date),
      traduzTipo(t.type),
      fmtValor(t.amount, t.type),
      esc(t.description),
      esc(t.category?.name),
      esc(t.account?.name),
      esc(t.account_to?.name),
      esc(t.card?.name),
      esc(t.member?.name),
      esc(t.notes)
    ].join(';'))
  }

  return linhas.join('\n')
}

function fmtData(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtValor(v, tipo) {
  const n = Number(v)
  const sinal = tipo === 'expense' ? '-' : ''
  return `${sinal}${n.toFixed(2).replace('.', ',')}`
}

function traduzTipo(t) {
  return { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' }[t] ?? t
}

function esc(s) {
  if (s == null) return ''
  const str = String(s)
  return /[;"\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export function baixarArquivo(conteudo, nome, tipo = 'text/plain') {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}