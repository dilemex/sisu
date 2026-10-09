import { getState } from '../lib/state.js'
import {
  listCategories, createCategory, updateCategory,
  archiveCategory, unarchiveCategory, deleteCategory, countCategoryUsage
} from '../lib/db/categories.js'
import { openModal, escapeHtml } from '../lib/ui.js'
import { Icons } from '../lib/icons.js'

export async function renderCategories(root) {
  const { family } = getState()

  async function carregar() {
    root.innerHTML = `<p class="carregando">Carregando…</p>`

    const [ativas, arquivadas] = await Promise.all([
      listCategories(family.id),
      listCategories(family.id, { incluirArquivadas: true })
        .then((all) => all.filter((c) => c.is_archived))
    ])

    const despesas = ativas.filter((c) => c.type === 'expense')
    const receitas = ativas.filter((c) => c.type === 'income')

    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Categorias</h2>
        <button id="nova" class="botao-primario">+ Nova</button>
      </div>

      <section class="cat-section">
        <h3 class="cat-titulo">Despesas</h3>
        ${renderArvore(despesas)}
      </section>

      <section class="cat-section">
        <h3 class="cat-titulo">Receitas</h3>
        ${renderArvore(receitas.filter((c) => !c.parent_id))}
      </section>

      ${arquivadas.length > 0 ? `
        <section class="cat-section">
          <h3 class="cat-titulo">Arquivadas</h3>
          <ul class="lista">
            ${arquivadas.map((c) => `
              <li class="item inativo">
                <div class="item-icone">${c.icon ?? '—'}</div>
                <div class="item-info">
                  <div class="item-titulo">${escapeHtml(c.name)}</div>
                  <div class="item-sub">${c.type === 'income' ? 'Receita' : 'Despesa'}</div>
                </div>
                <div class="item-acoes">
                  <button data-restaurar="${c.id}" title="Restaurar">>${Icons.restore}</button>
                  <button data-excluir="${c.id}" title="Excluir de vez">>${Icons.trash}</button>
                </div>
              </li>
            `).join('')}
          </ul>
        </section>
      ` : ''}
    `

    root.querySelector('#nova').onclick = () => abrirForm(null)
    root.querySelectorAll('[data-editar]').forEach((b) => {
      const c = ativas.find((x) => x.id === b.dataset.editar)
      b.onclick = () => abrirForm(c)
    })
    root.querySelectorAll('[data-adicionar-sub]').forEach((b) => {
      const pai = ativas.find((x) => x.id === b.dataset.adicionarSub)
      b.onclick = () => abrirForm(null, pai)
    })
    root.querySelectorAll('[data-arquivar]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Arquivar esta categoria? Ela deixa de aparecer em novos lançamentos, mas o histórico é mantido.')) return
        try { await archiveCategory(b.dataset.arquivar); carregar() }
        catch (e) { alert(e.message) }
      }
    })
    root.querySelectorAll('[data-restaurar]').forEach((b) => {
      b.onclick = async () => {
        try { await unarchiveCategory(b.dataset.restaurar); carregar() }
        catch (e) { alert(e.message) }
      }
    })
    root.querySelectorAll('[data-excluir]').forEach((b) => {
      b.onclick = async () => {
        const usos = await countCategoryUsage(b.dataset.excluir)
        if (usos > 0) {
          alert(`Esta categoria tem ${usos} lançamento(s). Não pode ser excluída. Restaure-a e edite.`)
          return
        }
        if (!confirm('Excluir permanentemente?')) return
        try { await deleteCategory(b.dataset.excluir); carregar() }
        catch (e) { alert(e.message) }
      }
    })
  }

  function renderArvore(lista) {
    const raizes = lista.filter((c) => !c.parent_id)
    const porPai = new Map()
    for (const c of lista) {
      if (!c.parent_id) continue
      if (!porPai.has(c.parent_id)) porPai.set(c.parent_id, [])
      porPai.get(c.parent_id).push(c)
    }

    return `
      <ul class="lista">
        ${raizes.map((r) => `
          <li class="cat-grupo">
            <div class="item">
              <div class="item-icone">${r.icon ?? '—'}</div>
              <div class="item-info">
                <div class="item-titulo">${escapeHtml(r.name)}</div>
              </div>
              <div class="item-acoes">
                <button data-adicionar-sub="${r.id}" title="Adicionar subcategoria">＋</button>
                <button data-editar="${r.id}" title="Editar">${Icons.edit}</button>
                <button data-arquivar="${r.id}" title="Arquivar">${Icons.archive}</button>
              </div>
            </div>
            ${(porPai.get(r.id) ?? []).length > 0 ? `
              <ul class="lista cat-subs">
                ${(porPai.get(r.id) ?? []).map((s) => `
                  <li class="item">
                    <div class="item-info">
                      <div class="item-titulo">${escapeHtml(s.name)}</div>
                    </div>
                    <div class="item-acoes">
                      <button data-editar="${s.id}" title="Editar">${Icons.edit}</button>
                      <button data-arquivar="${s.id}" title="Arquivar">${Icons.archive}</button>
                    </div>
                  </li>
                `).join('')}
              </ul>
            ` : ''}
          </li>
        `).join('')}
      </ul>
    `
  }

  function abrirForm(cat, pai) {
    const editando = !!cat
    const tipo = cat?.type ?? pai?.type ?? 'expense'
    const tipoNome = tipo === 'income' ? 'Receita' : 'Despesa'

    const content = `
      ${pai ? `<p class="dica-info">Nova subcategoria de <strong>${escapeHtml(pai.name)}</strong></p>` : ''}
      <label>Nome
        <input name="name" required value="${escapeHtml(cat?.name ?? '')}" maxlength="60" />
      </label>
      <label>Ícone (emoji, opcional)
        <input name="icon" maxlength="4" value="${cat?.icon ?? (pai?.icon ?? '')}" placeholder="🛒" />
      </label>
      ${!editando && !pai ? `
        <label>Tipo
          <select name="type">
            <option value="expense" ${tipo === 'expense' ? 'selected' : ''}>Despesa</option>
            <option value="income" ${tipo === 'income' ? 'selected' : ''}>Receita</option>
          </select>
        </label>
      ` : `<p class="dica-info">Tipo: <strong>${tipoNome}</strong></p>`}
    `

    openModal({
      title: editando ? 'Editar categoria' : pai ? 'Nova subcategoria' : 'Nova categoria',
      content,
      submitLabel: editando ? 'Salvar' : 'Criar',
      onSubmit: async (data) => {
        if (editando) {
          await updateCategory(cat.id, {
            name: data.name.trim(),
            icon: data.icon?.trim() || null
          })
        } else {
          await createCategory(family.id, {
            name: data.name.trim(),
            icon: data.icon?.trim() || null,
            type: data.type || tipo,
            parent_id: pai?.id ?? null
          })
        }
        await carregar()
      }
    })
  }

  await carregar()
}