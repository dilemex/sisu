import { getState } from '../lib/state.js'
import { generateInsights } from '../lib/db/insights.js'
import { escapeHtml } from '../lib/ui.js'

const ICONES = { bom: '✅', info: '💡', atencao: '⚠️', ruim: '🔴' }

export async function renderInsights(root) {
  const { family } = getState()

  root.innerHTML = `<p class="carregando">Analisando seus dados…</p>`

  const insights = await generateInsights(family.id)

  root.innerHTML = `
    <div class="pagina-cabecalho">
      <h2>Diagnóstico</h2>
    </div>

    <p class="dica-info">
      Insights automáticos gerados a partir dos seus lançamentos.
      Quanto mais dados, mais precisos ficam.
    </p>

    <ul class="insights-lista">
      ${insights.map((i) => `
        <li class="insight insight-${i.tipo}">
          <span class="insight-icone">${ICONES[i.tipo]}</span>
          <div>
            <strong>${escapeHtml(i.titulo)}</strong>
            <p>${escapeHtml(i.texto)}</p>
          </div>
        </li>
      `).join('')}
    </ul>
  `
}