import { getState } from '../lib/state.js'
import { getReportByCategory, getReportMonthly, getSavingsRate } from '../lib/db/reports.js'
import { formatBRL, escapeHtml } from '../lib/ui.js'

const LS_KEY = 'sisu:reports:periodo'

const PERIODOS = {
  '3m': { meses: 3, label: '3 meses' },
  '6m': { meses: 6, label: '6 meses' },
  '12m': { meses: 12, label: '12 meses' }
}

function intervalo(meses) {
  const hoje = new Date()
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1)
  return {
    from: inicio.toISOString().slice(0, 10),
    to: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10)
  }
}

export async function renderReports(root) {
  const { family } = getState()
  let periodo = localStorage.getItem(LS_KEY) ?? '6m'

  async function carregar() {
    root.innerHTML = `<p class="carregando">Carregando…</p>`

    const meses = PERIODOS[periodo].meses
    const { from, to } = intervalo(meses)

    const [porCategoria, porMes, sr] = await Promise.all([
      getReportByCategory(family.id, { from, to }),
      getReportMonthly(family.id, meses),
      getSavingsRate(family.id, { from, to })
    ])

    const maxCat = porCategoria.itens[0]?.total ?? 1
    const maxMes = Math.max(...porMes.map((m) => Math.max(m.receitas, m.despesas)), 1)
    const pctSobra = Math.round(sr.taxa * 100)

    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Relatórios</h2>
      </div>

      <div class="dash-seletor">
        ${Object.entries(PERIODOS).map(([k, v]) => `
          <button data-periodo="${k}" class="${periodo === k ? 'ativo' : ''}">${v.label}</button>
        `).join('')}
      </div>

      <div class="resumo-mes">
        <div>
          <span class="label">Receitas</span>
          <strong class="verde">+${formatBRL(sr.receitas)}</strong>
        </div>
        <div>
          <span class="label">Despesas</span>
          <strong class="vermelho">−${formatBRL(sr.despesas)}</strong>
        </div>
        <div>
          <span class="label">Taxa de sobra</span>
          <strong class="${pctSobra >= 20 ? 'verde' : pctSobra >= 0 ? '' : 'vermelho'}">${pctSobra}%</strong>
        </div>
      </div>

      <section class="dash-bloco">
        <div class="dash-bloco-header">
          <h3>Receitas × Despesas</h3>
        </div>
        <div class="chart chart-duplo">
          ${porMes.map((m, i) => {
            const hR = Math.max(2, Math.round((m.receitas / maxMes) * 100))
            const hD = Math.max(2, Math.round((m.despesas / maxMes) * 100))
            const atual = i === porMes.length - 1
            return `
              <div class="chart-col-duplo ${atual ? 'atual' : ''}">
                <div class="chart-bars">
                  <div class="chart-bar-r" style="height:${hR}%"></div>
                  <div class="chart-bar-d" style="height:${hD}%"></div>
                </div>
                <span class="chart-label">${m.label}</span>
              </div>
            `
          }).join('')}
        </div>
        <div class="legenda">
          <span><span class="dot dot-r"></span>Receitas</span>
          <span><span class="dot dot-d"></span>Despesas</span>
        </div>
      </section>

      <section class="dash-bloco">
        <div class="dash-bloco-header">
          <h3>Gastos por categoria</h3>
          <span class="item-sub">Total ${formatBRL(porCategoria.total)}</span>
        </div>
        ${porCategoria.itens.length === 0
          ? `<p class="vazio-inline">Nenhuma despesa no período.</p>`
          : `<ul class="bar-list">
              ${porCategoria.itens.slice(0, 10).map((c) => {
                const pct = Math.max(4, Math.round((c.total / maxCat) * 100))
                const pctTotal = porCategoria.total > 0
                  ? Math.round((c.total / porCategoria.total) * 100)
                  : 0
                return `
                  <li class="bar-item">
                    <div class="bar-topo">
                      <span class="bar-nome">${c.icone} ${escapeHtml(c.nome)}</span>
                      <span class="bar-valor">${formatBRL(c.total)} · ${pctTotal}%</span>
                    </div>
                    <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
                  </li>
                `
              }).join('')}
             </ul>`}
      </section>
    `

    root.querySelectorAll('[data-periodo]').forEach((b) => {
      b.onclick = () => {
        periodo = b.dataset.periodo
        localStorage.setItem(LS_KEY, periodo)
        carregar()
      }
    })
  }

  await carregar()
}