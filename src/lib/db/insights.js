import { supabase } from '../supabase.js'
import { getReportByCategory, getSavingsRate } from './reports.js'

/**
 * Gera insights automáticos baseados em comparações mês a mês.
 * Retorna array de { tipo: 'bom' | 'atencao' | 'ruim' | 'info', titulo, texto }
 */
export async function generateInsights(familyId) {
  const insights = []

  const hoje = new Date()
  const y = hoje.getFullYear(), m = hoje.getMonth()
  const mesAtualFrom = new Date(y, m, 1).toISOString().slice(0, 10)
  const mesAtualTo = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  const mesPassadoFrom = new Date(y, m - 1, 1).toISOString().slice(0, 10)
  const mesPassadoTo = new Date(y, m, 0).toISOString().slice(0, 10)

  // ---- Taxa de sobra do mês
  const sr = await getSavingsRate(familyId, { from: mesAtualFrom, to: mesAtualTo })
  if (sr.receitas > 0) {
    const pct = Math.round(sr.taxa * 100)
    if (pct >= 20) {
      insights.push({ tipo: 'bom', titulo: `Taxa de sobra em ${pct}%`, texto: 'Excelente! Acima do recomendado (20%).' })
    } else if (pct >= 5) {
      insights.push({ tipo: 'info', titulo: `Taxa de sobra em ${pct}%`, texto: 'Dentro da faixa aceitável. Tente chegar a 20%.' })
    } else if (pct >= 0) {
      insights.push({ tipo: 'atencao', titulo: `Taxa de sobra em ${pct}%`, texto: 'Bem apertado. Reveja gastos variáveis.' })
    } else {
      insights.push({ tipo: 'ruim', titulo: `Vocês gastaram mais do que ganharam`, texto: `Déficit de ${formatBRLSimples(sr.sobra * -1)} neste mês.` })
    }
  }

  // ---- Comparativo de categorias mês a mês
  const [catAtual, catPassado] = await Promise.all([
    getReportByCategory(familyId, { from: mesAtualFrom, to: mesAtualTo }),
    getReportByCategory(familyId, { from: mesPassadoFrom, to: mesPassadoTo })
  ])

  const mapaPassado = new Map(catPassado.itens.map((i) => [i.id, i.total]))
  const variacoes = catAtual.itens
    .filter((i) => i.id !== '__sem__')
    .map((i) => {
      const antes = mapaPassado.get(i.id) ?? 0
      if (antes < 50) return null
      const delta = ((i.total - antes) / antes) * 100
      return { ...i, antes, delta }
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  for (const v of variacoes.slice(0, 3)) {
    if (v.delta >= 15) {
      insights.push({
        tipo: 'atencao',
        titulo: `${v.icone} ${v.nome} subiu ${Math.round(v.delta)}%`,
        texto: `De ${formatBRLSimples(v.antes)} para ${formatBRLSimples(v.total)} vs mês passado.`
      })
    } else if (v.delta <= -15) {
      insights.push({
        tipo: 'bom',
        titulo: `${v.icone} ${v.nome} caiu ${Math.round(Math.abs(v.delta))}%`,
        texto: `De ${formatBRLSimples(v.antes)} para ${formatBRLSimples(v.total)} vs mês passado.`
      })
    }
  }

  // ---- Parcelas futuras
  const { data: parcelas } = await supabase
    .from('transactions')
    .select('amount')
    .eq('family_id', familyId)
    .not('installment_group_id', 'is', null)
    .gte('date', hoje.toISOString().slice(0, 10))

  if (parcelas?.length) {
    const total = parcelas.reduce((s, p) => s + Number(p.amount), 0)
    insights.push({
      tipo: total > sr.receitas * 1.5 ? 'atencao' : 'info',
      titulo: `${formatBRLSimples(total)} em parcelas futuras`,
      texto: `${parcelas.length} parcelas a vencer nos próximos meses.`
    })
  }

  // ---- Sem dados
  if (insights.length === 0) {
    insights.push({
      tipo: 'info',
      titulo: 'Sem dados suficientes ainda',
      texto: 'Assim que houver lançamentos em pelo menos 2 meses, os insights aparecem aqui.'
    })
  }

  return insights
}

function formatBRLSimples(v) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(Math.abs(v))
}