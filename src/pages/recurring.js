import { listRecurring, createRecurring, updateRecurring, deleteRecurring } from '../lib/db/recurring.js'
import { listCategories } from '../lib/db/categories.js'
import { listAccounts } from '../lib/db/accounts.js'
import { listCards } from '../lib/db/cards.js'
import { listMembers } from '../lib/db/members.js'
import { openModal, formatBRL, escapeHtml } from '../lib/ui.js'
import { getState } from '../lib/state.js'

export async function renderRecurring(root) {
  const { family, member } = getState()
  const [categorias, contas, cartoes, membros] = await Promise.all([
    listCategories(family.id),
    listAccounts(family.id),
    listCards(family.id),
    listMembers(family.id)
  ])

  async function carregar() {
    root.innerHTML = `<p class="carregando">Carregando…</p>`
    const lista = await listRecurring(family.id)

    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Recorrências</h2>
        <button id="nova" class="botao-primario">+ Nova</button>
      </div>

      <p class="dica-info">
        Salário, aluguel, Netflix… tudo que se repete todo mês. O Sisu lança automaticamente ao abrir o app.
      </p>

      ${lista.length === 0
        ? `<p class="vazio">Nenhuma recorrência cadastrada.</p>`
        : `<ul class="lista">${lista.map(item).join('')}</ul>`}
    `

    root.querySelector('#nova').onclick = () => abrirForm(null)
    root.querySelectorAll('[data-editar]').forEach((b) => {
      const r = lista.find((x) => x.id === b.dataset.editar)
      b.onclick = () => abrirForm(r)
    })
    root.querySelectorAll('[data-toggle]').forEach((b) => {
      b.onclick = async () => {
        const r = lista.find((x) => x.id === b.dataset.toggle)
        try { await updateRecurring(r.id, { is_active: !r.is_active }); carregar() }
        catch (e) { alert(e.message) }
      }
    })
    root.querySelectorAll('[data-excluir]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Excluir esta recorrência? As transações já geradas não serão afetadas.')) return
        try { await deleteRecurring(b.dataset.excluir); carregar() }
        catch (e) { alert(e.message) }
      }
    })
  }

  function item(r) {
    const icone = r.category?.icon ?? (r.type === 'income' ? '💰' : '🔁')
    const onde = r.card?.name ?? r.account?.name ?? ''
    return `
      <li class="item ${r.is_active ? '' : 'inativo'}">
        <div class="item-icone">${icone}</div>
        <div class="item-info">
          <div class="item-titulo">
            ${escapeHtml(r.description)}
            ${r.is_active ? '' : '<span class="tag">pausada</span>'}
          </div>
          <div class="item-sub">
            ${r.type === 'income' ? 'Entrada' : 'Saída'} · todo dia ${r.day_of_month}
            ${onde ? ' · ' + escapeHtml(onde) : ''}
          </div>
        </div>
        <div class="item-valor ${r.type === 'income' ? 'verde' : 'vermelho'}">${formatBRL(r.amount)}</div>
        <div class="item-acoes">
          <button data-editar="${r.id}" title="Editar">✏️</button>
          <button data-toggle="${r.id}" title="${r.is_active ? 'Pausar' : 'Retomar'}">
            ${r.is_active ? '⏸️' : '▶️'}
          </button>
          <button data-excluir="${r.id}" title="Excluir">🗑️</button>
        </div>
      </li>
    `
  }

  function abrirForm(rec) {
    const editando = !!rec
    const categoriasFiltradas = (tipo) => categorias.filter((c) => c.type === tipo)

    const content = `
      <div class="segmento">
        <label class="segmento-item">
          <input type="radio" name="type" value="expense" ${!rec || rec.type === 'expense' ? 'checked' : ''} />
          <span>Despesa fixa</span>
        </label>
        <label class="segmento-item">
          <input type="radio" name="type" value="income" ${rec?.type === 'income' ? 'checked' : ''} />
          <span>Receita fixa</span>
        </label>
      </div>

      <label>Descrição
        <input name="description" required maxlength="120"
               value="${escapeHtml(rec?.description ?? '')}" placeholder="Ex: Aluguel, Salário…" />
      </label>

      <label>Valor
        <input name="amount" type="number" step="0.01" min="0.01" required
               value="${rec?.amount ?? ''}" placeholder="0,00" />
      </label>

      <div class="linha-dupla">
        <label>Dia do mês
          <input name="day_of_month" type="number" min="1" max="31" required value="${rec?.day_of_month ?? 5}" />
        </label>
        <label>A partir de
          <input name="start_date" type="date" required value="${rec?.start_date ?? new Date().toISOString().slice(0,10)}" />
        </label>
      </div>

      <label>Categoria
        <select name="category_id" id="sel-categoria" required>
          <option value="">— escolha —</option>
          <optgroup label="Despesas" data-grupo="expense">
            ${categoriasFiltradas('expense').map((c) => opt(c, rec?.category_id)).join('')}
          </optgroup>
          <optgroup label="Receitas" data-grupo="income">
            ${categoriasFiltradas('income').map((c) => opt(c, rec?.category_id)).join('')}
          </optgroup>
        </select>
      </label>

      <label>Origem / destino
        <select name="origem" required>
          ${contas.map((a) => `
            <option value="account:${a.id}" ${rec?.account_id === a.id ? 'selected' : ''}>🏦 ${escapeHtml(a.name)}</option>
          `).join('')}
          ${cartoes.map((c) => `
            <option value="card:${c.id}" ${rec?.credit_card_id === c.id ? 'selected' : ''}>💳 ${escapeHtml(c.name)}</option>
          `).join('')}
        </select>
      </label>

      <label>Responsável
        <select name="member_id">
          <option value="">— ninguém —</option>
          ${membros.map((m) => `
            <option value="${m.id}" ${rec?.member_id === m.id || (!rec && m.id === member.id) ? 'selected' : ''}>
              ${escapeHtml(m.name)}
            </option>
          `).join('')}
        </select>
      </label>
    `

    openModal({
      title: editando ? 'Editar recorrência' : 'Nova recorrência',
      content,
      submitLabel: editando ? 'Salvar' : 'Criar',
      onSubmit: async (data) => {
        const [tipoOrigem, origemId] = data.origem.split(':')
        const payload = {
          type: data.type,
          description: data.description.trim(),
          amount: Number(data.amount),
          day_of_month: Number(data.day_of_month),
          start_date: data.start_date,
          category_id: data.category_id || null,
          account_id: tipoOrigem === 'account' ? origemId : null,
          credit_card_id: tipoOrigem === 'card' ? origemId : null,
          member_id: data.member_id || null
        }
        if (editando) await updateRecurring(rec.id, payload)
        else await createRecurring(family.id, payload)
        await carregar()
      }
    })

    // filtro categoria por tipo
    const form = document.querySelector('.modal-form')
    const selCat = form.querySelector('#sel-categoria')
    const optgroups = selCat.querySelectorAll('optgroup')
    const radios = form.querySelectorAll('input[name="type"]')
    function ajustar() {
      const tipo = form.querySelector('input[name="type"]:checked').value
      optgroups.forEach((g) => {
        g.style.display = g.dataset.grupo === tipo ? '' : 'none'
        g.disabled = g.dataset.grupo !== tipo
      })
      const optAtual = selCat.selectedOptions[0]
      if (optAtual && optAtual.closest('optgroup')?.dataset.grupo !== tipo) selCat.value = ''
    }
    radios.forEach((r) => r.addEventListener('change', ajustar))
    ajustar()
  }

  function opt(cat, selecionadoId) {
    const sel = cat.id === selecionadoId ? 'selected' : ''
    const prefixo = cat.parent_id ? '  └ ' : ''
    return `<option value="${cat.id}" ${sel}>${prefixo}${escapeHtml(cat.name)}</option>`
  }

  await carregar()
}