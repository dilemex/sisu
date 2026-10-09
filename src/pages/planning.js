import { getPlanning } from '../lib/db/planning.js'
import { getState } from '../lib/state.js'
import { formatBRL } from '../lib/ui.js'

export async function renderPlanning(root) {
  const { family } = getState()

  root.innerHTML = `<p class="carregando">Carregando…</p>`

  const p = await getPlanning(family.id)

  const disponivelPositivo = p.disponivel >= 0
  const porDia = disponivelPositivo ? p.disponivel / diasRestantesNoMes() : 0

  root.innerHTML = `
    <div class="pagina-cabecalho">
      <h2>Planejamento</h2>
    </div>

    <section class="planejamento-hero ${disponivelPositivo ? 'ok' : 'ruim'}">
      <span class="label">Quanto podemos gastar este mês</span>
      <strong class="valor-grande">${formatBRL(p.disponivel)}</strong>
      ${disponivelPositivo
        ? `<p class="sub">≈ ${formatBRL(porDia)} por dia nos ${diasRestantesNoMes()} dias restantes</p>`
        : `<p class="sub">Vocês estão ${formatBRL(Math.abs(p.disponivel))} acima do previsto.</p>`}
    </section>

    <section class="dash-bloco">
      <h3 style="margin:0 0 .75rem">Como chegamos nesse número</h3>
      <ul class="breakdown">
        <li>
          <span>Receitas previstas</span>
          <strong class="verde">+${formatBRL(p.receitasPrevistas)}</strong>
        </li>
        <li>
          <span>Despesas fixas</span>
          <strong class="vermelho">−${formatBRL(p.despesasFixas)}</strong>
        </li>
        <li>
          <span>Parcelas do mês</span>
          <strong class="vermelho">−${formatBRL(p.parcelasMes)}</strong>
        </li>
        <li class="total">
          <span>Disponível livre</span>
          <strong>${formatBRL(p.disponivel)}</strong>
        </li>
      </ul>
    </section>

    <p class="dica-info">
      <strong>Como funciona:</strong> receitas e despesas fixas vêm das suas recorrências.
      Parcelas vêm das compras parceladas. Atualize essas duas abas para o cálculo ficar preciso.
    </p>
  `
}

function diasRestantesNoMes() {
  const hoje = new Date()
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  return Math.max(1, ultimo - hoje.getDate() + 1)
}