import { listBudgets, createBudget, updateBudget, deleteBudget, getCategorySpending } from '../lib/db/budgets.js'
import { listCategories } from '../lib/db/categories.js'
import { openModal, formatBRL, escapeHtml } from '../lib/ui.js'
import { getState } from '../lib/state.js'
import { Icons } from '../lib/icons.js'

function intervaloMesAtual() {
  const hoje = new Date()
  const y = hoje.getFullYear(), m = hoje.getMonth() + 1
  const ym = `${y}-${String(m).padStart(2, '0')}`
  const ultimo = new Date(y, m, 0).getDate()
  return { from: `${ym}-01`, to: `${ym}-${String(ultimo).padStart(2, '0')}` }
}

export async function renderBudgets(root) {
  const { family } = getState()
  const categorias = await listCategories(family.id)
  const categoriasDespesa = categorias.filter((c) => c.type === 'expense' && c.parent_id)

  async function carregar() {
    root.innerHTML = `<p class="carregando">Carregando…</p>`
    const { from, to } = intervaloMesAtual()
    const [orcamentos, gastos] = await Promise.all([
      listBudgets(family.id),
      getCategorySpending(family.id, { from, to })
    ])

    const totalOrcado = orcamentos.reduce((s, b) => s + Number(b.amount), 0)
    const totalGasto = orcamentos.reduce((s, b) => s + (gastos[b.category_id] ?? 0), 0)

    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Orçamentos do mês</h2>
        <button id="novo" class="botao-primario">+ Novo</button>
      </div>

      ${orcamentos.length > 0 ? `
        <div class="resumo-duplo">
          <div>
            <span class="label">Orçado</span>
            <strong>${formatBRL(totalOrcado)}</strong>
          </div>
          <div>
            <span class="label">Gasto</span>
            <strong class="${totalGasto > totalOrcado ? 'vermelho' : ''}">${formatBRL(totalGasto)}</strong>
          </div>
        </div>
      ` : ''}

      ${orcamentos.length === 0
        ? `<p class="vazio">Nenhum orçamento definido. Que tal começar pelo Mercado?</p>`
        : `<ul class="lista-budgets">${orcamentos.map((b) =>
            card(b, gastos[b.category_id] ?? 0)
          ).join('')}</ul>`}
    `

    root.querySelector('#novo').onclick = () => abrirForm(null)
    root.querySelectorAll('[data-editar]').forEach((b) => {
      const orc = orcamentos.find((x) => x.id === b.dataset.editar)
      b.onclick = () => abrirForm(orc)
    })
    root.querySelectorAll('[data-excluir]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Remover orçamento?')) return
        try { await deleteBudget(b.dataset.excluir); carregar() }
        catch (e) { alert(e.message) }
      }
    })
  }

  function card(b, gasto) {
    const orcado = Number(b.amount)
    const pct = Math.min(100, Math.round((gasto / orcado) * 100))
    const disponivel = orcado - gasto
    const estourou = gasto > orcado
    const quase = !estourou && pct >= 85

    const cor = estourou ? 'vermelho' : quase ? 'amarelo' : 'azul'
    const icone = b.category?.icon ?? '🎯'

    return `
      <li class="budget-card cor-${cor}">
        <header class="budget-header">
          <div class="item-titulo">
            <span class="item-icone">${icone}</span>
            <strong>${escapeHtml(b.category?.name ?? '—')}</strong>
          </div>
          <div class="item-acoes">
            <button data-editar="${b.id}" title="Editar">${Icons.edit}</button>
            <button data-excluir="${b.id}" title="Remover">${Icons.trash}</button>
          </div>
        </header>

        <div class="budget-track"><div class="budget-fill" style="width:${pct}%"></div></div>

        <div class="budget-metricas">
          <span>${formatBRL(gasto)} de ${formatBRL(orcado)}</span>
          <strong>${pct}%</strong>
        </div>

        <p class="budget-status">
          ${estourou
            ? `Estourou ${formatBRL(gasto - orcado)} 😬`
            : `Restam ${formatBRL(disponivel)}`}
        </p>
      </li>
    `
  }

  function abrirForm(orcamento) {
    const editando = !!orcamento
    const usados = new Set() // pra filtrar categorias já orçadas (no create)

    const content = editando
      ? `
        <p class="dica-info">Categoria: <strong>${escapeHtml(orcamento.category?.name)}</strong></p>
        <label>Valor mensal
          <input name="amount" type="number" step="0.01" min="0.01" required value="${orcamento.amount}" />
        </label>
      `
      : `
        <label>Categoria
          <select name="category_id" required>
            <option value="">— escolha —</option>
            ${categoriasDespesa.map((c) => `
              <option value="${c.id}">
                ${c.icon ? c.icon + ' ' : ''}${escapeHtml(c.name)}
              </option>
            `).join('')}
          </select>
        </label>
        <label>Valor mensal
          <input name="amount" type="number" step="0.01" min="0.01" required placeholder="1000" />
        </label>
      `

    openModal({
      title: editando ? 'Editar orçamento' : 'Novo orçamento',
      content,
      submitLabel: editando ? 'Salvar' : 'Criar',
      onSubmit: async (data) => {
        if (editando) await updateBudget(orcamento.id, { amount: data.amount })
        else await createBudget(family.id, { category_id: data.category_id, amount: data.amount })
        await carregar()
      }
    })
  }

  await carregar()
}