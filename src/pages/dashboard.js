import { getState } from '../lib/state.js'
import { getAccountBalances, getCardInvoices, getPeriodSummary, getTopExpenseCategories, getUpcomingCardDue } from '../lib/db/balances.js'
import { listAccounts } from '../lib/db/accounts.js'
import { listTransactions } from '../lib/db/transactions.js'
import { formatBRL, escapeHtml } from '../lib/ui.js'
import { navigate } from '../lib/router.js'

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
  // 'mes' (default)
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

    const [
      contas,
      deltas,
      cartoes,
      faturas,
      resumo,
      topCategorias,
      ultimos,
      alertasCartao
    ] = await Promise.all([
      listAccounts(family.id),
      getAccountBalances(family.id),
      listCardsAtivos(family.id),
      getCardInvoices(family.id, { from, to }),
      getPeriodSummary(family.id, { from, to }),
      getTopExpenseCategories(family.id, { from, to, limit: 5 }),
      listTransactions(family.id, { from, to }).then((arr) => arr.slice(0, 5)),
      getUpcomingCardDue(family.id, 3)
    ])

    const saldoContas = contas
      .filter((c) => c.is_active)
      .reduce((s, c) => s + Number(c.initial_balance) + (deltas[c.id] ?? 0), 0)

    const faturaTotal = Object.values(faturas).reduce((s, v) => s + v, 0)

    const maxCategoria = topCategorias[0]?.total ?? 1

    root.innerHTML = `
      <section class="dash">
        <div class="dash-seletor">
          <button data-periodo="mes" class="${periodo === 'mes' ? 'ativo' : ''}">Mês atual</button>
          <button data-periodo="30d" class="${periodo === '30d' ? 'ativo' : ''}">Últimos 30 dias</button>
        </div>

        <h2 class="dash-titulo">${escapeHtml(member.name)}, aqui está seu resumo</h2>
        <p class="dash-sub">${label}</p>

        ${alertasCartao.length > 0 ? renderAlertas(alertasCartao) : ''}

        <div class="dash-grid">
          ${card('Saldo em contas', formatBRL(saldoContas), 'grad-azul')}
          ${card('Entradas', formatBRL(resumo.receitas), 'grad-verde')}
          ${card('Saídas', formatBRL(resumo.despesas), 'grad-vermelho')}
          ${card('Fatura dos cartões', formatBRL(faturaTotal), 'grad-roxo')}
        </div>

        <section class="dash-bloco">
          <header class="dash-bloco-header">
            <h3>Gastos por categoria</h3>
            <button class="link" data-ir="/lancamentos">Ver lançamentos →</button>
          </header>
          ${topCategorias.length === 0
            ? `<p class="vazio-inline">Nenhuma despesa no período.</p>`
            : `<ul class="bar-list">${topCategorias.map((c) => barra(c, maxCategoria)).join('')}</ul>`}
        </section>

        <section class="dash-bloco">
          <header class="dash-bloco-header">
            <h3>Últimos lançamentos</h3>
            <button class="link" data-ir="/lancamentos">Ver todos →</button>
          </header>
          ${ultimos.length === 0
            ? `<p class="vazio-inline">Nada por aqui ainda.</p>`
            : `<ul class="lista">${ultimos.map(miniItem).join('')}</ul>`}
        </section>
      </section>
    `

    // listeners
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

  function card(label, valor, classe) {
    return `
      <div class="dash-card ${classe}">
        <span class="dash-label">${label}</span>
        <strong class="dash-valor">${valor}</strong>
      </div>
    `
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

  function barra(c, max) {
    const pct = Math.max(4, Math.round((c.total / max) * 100))
    return `
      <li class="bar-item">
        <div class="bar-topo">
          <span class="bar-nome">${c.icone} ${escapeHtml(c.nome)}</span>
          <span class="bar-valor">${formatBRL(c.total)}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      </li>
    `
  }

  function miniItem(t) {
    const sinal = t.type === 'income' ? '+' : '−'
    const cor = t.type === 'income' ? 'verde' : 'vermelho'
    const icone = t.category?.icon ?? (t.type === 'income' ? '💰' : '💸')
    const onde = t.account?.name ?? t.card?.name ?? ''
    return `
      <li class="item">
        <div class="item-icone">${icone}</div>
        <div class="item-info">
          <div class="item-titulo">${escapeHtml(t.description || t.category?.name || (t.type === 'income' ? 'Entrada' : 'Saída'))}</div>
          <div class="item-sub">${onde ? escapeHtml(onde) + ' · ' : ''}${t.date.split('-').reverse().join('/')}</div>
        </div>
        <div class="item-valor ${cor}">${sinal}${formatBRL(t.amount).replace('R$', '').trim()}</div>
      </li>
    `
  }

  // helper local pra listar cartões ativos sem importar cards.js (evita import circular)
  async function listCardsAtivos(familyId) {
    const { supabase } = await import('../lib/supabase.js')
    const { data, error } = await supabase
      .from('credit_cards')
      .select('id, name, is_active')
      .eq('family_id', familyId)
      .eq('is_active', true)
    if (error) throw error
    return data
  }

  await carregar()
}