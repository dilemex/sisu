import { getState } from '../lib/state.js'
import {
  getAccountBalances, getPeriodSummary,
  getUpcomingCardDue, getMonthEvolution
} from '../lib/db/balances.js'
import { listAccounts } from '../lib/db/accounts.js'
import { formatBRL, escapeHtml } from '../lib/ui.js'
import { navigate } from '../lib/router.js'
import { supabase } from '../lib/supabase.js'
import { Icons } from '../lib/icons.js'

const LS_KEY = 'sisu:dashboard:periodo'

function intervalo(periodo) {
  const hoje = new Date()
  if (periodo === '30d') {
    const from = new Date(hoje); from.setDate(from.getDate() - 29)
    return {
      from: from.toISOString().slice(0, 10),
      to: hoje.toISOString().slice(0, 10),
      label: 'Últimos 30 dias'
    }
  }
  const y = hoje.getFullYear(), m = hoje.getMonth() + 1
  const ym = `${y}-${String(m).padStart(2, '0')}`
  const ultimo = new Date(y, m, 0).getDate()
  return {
    from: `${ym}-01`,
    to: `${ym}-${String(ultimo).padStart(2, '0')}`,
    label: 'Mês atual'
  }
}

export async function renderDashboard(root) {
  const { family, member } = getState()
  let periodo = localStorage.getItem(LS_KEY) ?? 'mes'

  async function carregar() {
    root.innerHTML = `<p class="carregando">Carregando…</p>`
    const { from, to, label } = intervalo(periodo)

    const [contas, deltas, resumo, evolucao, alertas, proximos] = await Promise.all([
      listAccounts(family.id),
      getAccountBalances(family.id),
      getPeriodSummary(family.id, { from, to }),
      getMonthEvolution(family.id, 6),
      getUpcomingCardDue(family.id, 3),
      getProximosCompromissos(family.id)
    ])

    const saldoContas = contas
      .filter((c) => c.is_active)
      .reduce((s, c) => s + Number(c.initial_balance) + (deltas[c.id] ?? 0), 0)

    const maxMes = Math.max(...evolucao.map((m) => m.total), 1)
    const pctTrend = resumo.receitas > 0
      ? Math.round((resumo.saldo / resumo.receitas) * 100)
      : 0

    root.innerHTML = `
      <section class="dash">
        <div class="dash-hero">
          <span class="dash-label">Saldo total em contas</span>
          <strong class="dash-valor-grande">${formatBRL(saldoContas)}</strong>
          <span class="trend">
            <span class="pct ${pctTrend < 0 ? 'neg' : ''}">
              ${pctTrend >= 0 ? '↑' : '↓'} ${Math.abs(pctTrend)}%
            </span>
            taxa de sobra em ${label.toLowerCase()}
          </span>
        </div>

        <div class="dash-seletor">
          <button data-periodo="mes" class="${periodo === 'mes' ? 'ativo' : ''}">Mês atual</button>
          <button data-periodo="30d" class="${periodo === '30d' ? 'ativo' : ''}">Últimos 30 dias</button>
        </div>

        ${alertas.length > 0 ? renderAlertas(alertas) : ''}

        <div class="dash-metricas">
          <div class="metrica-card">
            <div class="metrica-topo">
              <div class="metrica-icone entrada">↑</div>
            </div>
            <span class="dash-label">Entradas</span>
            <strong class="dash-valor">${formatBRL(resumo.receitas)}</strong>
          </div>
          <div class="metrica-card">
            <div class="metrica-topo">
              <div class="metrica-icone saida">↓</div>
            </div>
            <span class="dash-label">Saídas</span>
            <strong class="dash-valor">${formatBRL(resumo.despesas)}</strong>
          </div>
        </div>

        <section class="dash-bloco">
          <div class="dash-bloco-header">
            <h3>Visão geral dos meses</h3>
          </div>
          <div class="chart">
            ${evolucao.map((m, i) => {
              const pct = Math.max(4, Math.round((m.total / maxMes) * 100))
              const atual = i === evolucao.length - 1
              return `
                <div class="chart-col ${atual ? 'atual' : ''}">
                  <div class="chart-bar" style="height:${pct}%"></div>
                  <span class="chart-label">${m.label}</span>
                </div>
              `
            }).join('')}
          </div>
        </section>

        <section class="dash-bloco">
          <div class="dash-bloco-header">
            <h3>Próximos compromissos</h3>
            <button class="link" data-ir="/lancamentos">Ver tudo →</button>
          </div>
          ${proximos.length === 0
            ? `<p class="vazio-inline">Nada previsto para os próximos dias. 🎉</p>`
            : `<ul class="lista">${proximos.map(miniItem).join('')}</ul>`}
        </section>
      </section>
    `

    root.querySelectorAll('[data-periodo]').forEach((b) => {
      b.onclick = () => {
        periodo = b.dataset.periodo
        localStorage.setItem(LS_KEY, periodo)
        carregar()
      }
    })
    root.querySelectorAll('[data-ir]').forEach((b) => {
      b.onclick = () => navigate(b.dataset.ir)
    })
  }

  function renderAlertas(cartoes) {
    return `
      <div class="alertas">
        ${cartoes.map((c) => `
          <div class="alerta">
            ⚠️ <strong>${escapeHtml(c.name)}</strong>
            ${c.diasParaVencer === 0
              ? 'vence <strong>hoje</strong>'
              : `vence em <strong>${c.diasParaVencer} dia${c.diasParaVencer > 1 ? 's' : ''}</strong>`}
            (dia ${c.due_day})
          </div>
        `).join('')}
      </div>
    `
  }

  function miniItem(c) {
    return `
      <li class="item">
        <div class="item-icone">${c.icone}</div>
        <div class="item-info">
          <div class="item-titulo">${escapeHtml(c.titulo)}</div>
          <div class="item-sub">${c.sub}</div>
        </div>
        ${c.valor != null ? `<div class="item-valor">${formatBRL(c.valor)}</div>` : ''}
      </li>
    `
  }

  await carregar()
}

/**
 * Junta cartões a vencer + recorrências dos próximos 15 dias
 * num só array pronto pra renderizar.
 */
async function getProximosCompromissos(familyId) {
  const hoje = new Date()
  const y = hoje.getFullYear(), m = hoje.getMonth()
  const ultimo = new Date(y, m + 1, 0).getDate()
  const diaHoje = hoje.getDate()

  const out = []

  const { data: cards } = await supabase
    .from('credit_cards')
    .select('id, name, due_day')
    .eq('family_id', familyId)
    .eq('is_active', true)

  for (const c of cards ?? []) {
    let dia = c.due_day
    let data = new Date(y, m, Math.min(dia, ultimo))
    if (dia < diaHoje) data = new Date(y, m + 1, Math.min(dia, new Date(y, m + 2, 0).getDate()))
    const diff = Math.round((data - hoje) / (1000 * 60 * 60 * 24))
    if (diff >= 0 && diff <= 15) {
      out.push({
        icone: Icons.creditCard,      //
        titulo: `Fatura do cartão ${c.name}`,
        sub: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        valor: null,
        ordem: data
      })
    }
  }

  const { data: recs } = await supabase
    .from('recurring_transactions')
    .select('description, amount, day_of_month, type')
    .eq('family_id', familyId)
    .eq('is_active', true)
    .eq('type', 'expense')

  for (const r of recs ?? []) {
    const dia = Math.min(r.day_of_month, ultimo)
    let data = new Date(y, m, dia)
    if (dia < diaHoje) data = new Date(y, m + 1, dia)
    const diff = Math.round((data - hoje) / (1000 * 60 * 60 * 24))
    if (diff >= 0 && diff <= 15) {
      out.push({
        icone: Icons.calendar,
        titulo: r.description,
        sub: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        valor: Number(r.amount),
        ordem: data
      })
    }
  }

  return out.sort((a, b) => a.ordem - b.ordem).slice(0, 5)
}