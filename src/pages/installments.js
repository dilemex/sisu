import { listActiveInstallments, deleteInstallmentGroup } from '../lib/db/transactions.js'
import { formatBRL, escapeHtml } from '../lib/ui.js'
import { getState } from '../lib/state.js'
import { Icons } from '../lib/icons.js'

export async function renderInstallments(root) {
  const { family } = getState()

  async function carregar() {
    root.innerHTML = `<p class="carregando">Carregando…</p>`
    const grupos = await listActiveInstallments(family.id)

    const totalMes = grupos.reduce((s, g) => s + g.valor_parcela, 0)
    const totalRestante = grupos.reduce((s, g) => s + g.total_restante, 0)

    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Parcelamentos ativos</h2>
      </div>

      <div class="resumo-duplo">
        <div>
          <span class="label">Comprometido por mês</span>
          <strong>${formatBRL(totalMes)}</strong>
        </div>
        <div>
          <span class="label">Total a pagar</span>
          <strong class="vermelho">${formatBRL(totalRestante)}</strong>
        </div>
      </div>

      ${grupos.length === 0
        ? `<p class="vazio">Nenhum parcelamento ativo. 🎉</p>`
        : `<ul class="lista">${grupos.map(item).join('')}</ul>`}
    `

    root.querySelectorAll('[data-excluir]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Isso vai excluir TODAS as parcelas futuras dessa compra. Continuar?')) return
        try {
          await deleteInstallmentGroup(b.dataset.excluir)
          carregar()
        } catch (e) { alert(e.message) }
      }
    })
  }

  function item(g) {
    const onde = g.card?.name ?? g.account?.name ?? ''
    const icone = g.category?.icon ?? Icons.creditCard
    const nome = g.description || g.category?.name || 'Compra parcelada'
    return `
      <li class="item">
        <div class="item-icone">${icone}</div>
        <div class="item-info">
          <div class="item-titulo">${escapeHtml(nome)}</div>
          <div class="item-sub">
            ${escapeHtml(onde)} · parcela ${g.parcela_atual}/${g.total} · faltam ${g.restantes}
          </div>
        </div>
        <div class="item-valor">
          <div>${formatBRL(g.valor_parcela)}<small>/mês</small></div>
          <div class="item-sub" style="text-align:right">Total ${formatBRL(g.total_restante)}</div>
        </div>
        <div class="item-acoes">
          <button data-excluir="${g.group_id}" title="Excluir todas as parcelas">🗑️</button>
        </div>
      </li>
    `
  }

  await carregar()
}