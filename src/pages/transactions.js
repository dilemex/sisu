import {
    listTransactions, createTransaction, updateTransaction, deleteTransaction
  } from '../lib/db/transactions.js'
  import { listCategories } from '../lib/db/categories.js'
  import { listAccounts } from '../lib/db/accounts.js'
  import { listCards } from '../lib/db/cards.js'
  import { listMembers } from '../lib/db/members.js'
  import { openModal, formatBRL, escapeHtml } from '../lib/ui.js'
  import { getState } from '../lib/state.js'
  
  // ---------- Helpers de data ----------
  
  function ymHoje() {
    return new Date().toISOString().slice(0, 7) // YYYY-MM
  }
  
  function intervaloDoMes(ym) {
    const [y, m] = ym.split('-').map(Number)
    const from = `${ym}-01`
    const ultimo = new Date(y, m, 0).getDate()
    const to = `${ym}-${String(ultimo).padStart(2, '0')}`
    return { from, to }
  }
  
  function formataData(iso) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}`
  }
  
  // ---------- Página ----------
  
  export async function renderTransactions(root) {
    const { family, member } = getState()
    const [categorias, contas, cartoes, membros] = await Promise.all([
      listCategories(family.id),
      listAccounts(family.id),
      listCards(family.id),
      listMembers(family.id)
    ])
  
    const estado = {
      mes: ymHoje(),
      filtroTipo: '',
      transacoes: []
    }
  
    async function carregar() {
      const { from, to } = intervaloDoMes(estado.mes)
      estado.transacoes = await listTransactions(family.id, {
        from, to,
        type: estado.filtroTipo || undefined
      })
      render()
    }
  
    function render() {
      const totalReceitas = estado.transacoes
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + Number(t.amount), 0)
      const totalDespesas = estado.transacoes
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + Number(t.amount), 0)
  
      // agrupa por dia
      const porDia = new Map()
      for (const t of estado.transacoes) {
        if (!porDia.has(t.date)) porDia.set(t.date, [])
        porDia.get(t.date).push(t)
      }
  
      root.innerHTML = `
        <div class="pagina-cabecalho">
          <h2>Lançamentos</h2>
          <button id="novo" class="botao-primario">+ Novo</button>
        </div>
  
        <div class="filtros">
          <input type="month" id="mes" value="${estado.mes}" />
          <select id="tipo">
            <option value="">Tudo</option>
            <option value="income" ${estado.filtroTipo === 'income' ? 'selected' : ''}>Só entradas</option>
            <option value="expense" ${estado.filtroTipo === 'expense' ? 'selected' : ''}>Só saídas</option>
          </select>
        </div>
  
        <div class="resumo-mes">
          <div>
            <span class="label">Entradas</span>
            <strong class="verde">+${formatBRL(totalReceitas)}</strong>
          </div>
          <div>
            <span class="label">Saídas</span>
            <strong class="vermelho">−${formatBRL(totalDespesas)}</strong>
          </div>
          <div>
            <span class="label">Saldo</span>
            <strong class="${totalReceitas - totalDespesas >= 0 ? 'verde' : 'vermelho'}">
              ${formatBRL(totalReceitas - totalDespesas)}
            </strong>
          </div>
        </div>
  
        ${estado.transacoes.length === 0
          ? `<p class="vazio">Nenhum lançamento neste período.</p>`
          : [...porDia.entries()].map(([dia, itens]) => `
              <section class="dia">
                <h3 class="dia-titulo">${formataData(dia)}</h3>
                <ul class="lista">
                  ${itens.map(item).join('')}
                </ul>
              </section>
            `).join('')
        }
      `
  
      root.querySelector('#novo').onclick = () => abrirForm(null)
      root.querySelector('#mes').onchange = (e) => {
        estado.mes = e.target.value || ymHoje()
        carregar()
      }
      root.querySelector('#tipo').onchange = (e) => {
        estado.filtroTipo = e.target.value
        carregar()
      }
      root.querySelectorAll('[data-editar]').forEach((b) => {
        const t = estado.transacoes.find((x) => x.id === b.dataset.editar)
        b.onclick = () => abrirForm(t)
      })
      root.querySelectorAll('[data-excluir]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm('Excluir este lançamento?')) return
          try {
            await deleteTransaction(b.dataset.excluir)
            await carregar()
          } catch (e) { alert(e.message) }
        }
      })
    }
  
    function item(t) {
      const sinal = t.type === 'income' ? '+' : '−'
      const cor = t.type === 'income' ? 'verde' : 'vermelho'
      const icone = t.category?.icon ?? (t.type === 'income' ? '💰' : '💸')
      const nomeCat = t.category?.name ?? (t.type === 'income' ? 'Entrada' : 'Saída')
      const onde = t.account?.name ?? t.card?.name ?? ''
      return `
        <li class="item">
          <div class="item-icone">${icone}</div>
          <div class="item-info">
            <div class="item-titulo">${escapeHtml(t.description || nomeCat)}</div>
            <div class="item-sub">
              ${escapeHtml(nomeCat)}${onde ? ' · ' + escapeHtml(onde) : ''}${t.member ? ' · ' + escapeHtml(t.member.name) : ''}
            </div>
          </div>
          <div class="item-valor ${cor}">${sinal}${formatBRL(t.amount).replace('R$', '').trim()}</div>
          <div class="item-acoes">
            <button data-editar="${t.id}" title="Editar">✏️</button>
            <button data-excluir="${t.id}" title="Excluir">🗑️</button>
          </div>
        </li>
      `
    }
  
    // ---------- Form ----------
  
    function abrirForm(transacao) {
      const editando = !!transacao
      const categoriasFiltradas = (tipo) => categorias.filter((c) => c.type === tipo)
  
      const content = `
        <div class="segmento" role="tablist">
          <label class="segmento-item">
            <input type="radio" name="type" value="expense" ${!transacao || transacao.type === 'expense' ? 'checked' : ''} />
            <span>Despesa</span>
          </label>
          <label class="segmento-item">
            <input type="radio" name="type" value="income" ${transacao?.type === 'income' ? 'checked' : ''} />
            <span>Receita</span>
          </label>
        </div>
  
        <label>Valor
          <input name="amount" type="number" step="0.01" min="0.01" required inputmode="decimal"
                 value="${transacao?.amount ?? ''}" placeholder="0,00" />
        </label>
  
        <label>Data
          <input name="date" type="date" required value="${transacao?.date ?? new Date().toISOString().slice(0,10)}" />
        </label>
  
        <label>Descrição (opcional)
          <input name="description" maxlength="120" value="${escapeHtml(transacao?.description ?? '')}"
                 placeholder="Ex: Mercado do mês" />
        </label>
  
        <label>Categoria
          <select name="category_id" id="sel-categoria" required>
            <option value="">— escolha —</option>
            <optgroup label="Despesas" data-grupo="expense">
              ${categoriasFiltradas('expense').map((c) => opt(c, transacao?.category_id)).join('')}
            </optgroup>
            <optgroup label="Receitas" data-grupo="income">
              ${categoriasFiltradas('income').map((c) => opt(c, transacao?.category_id)).join('')}
            </optgroup>
          </select>
        </label>
  
        <label>Origem / destino
          <select name="origem" id="sel-origem" required>
            ${contas.map((a) => `
              <option value="account:${a.id}"
                ${transacao?.account_id === a.id ? 'selected' : ''}>
                🏦 ${escapeHtml(a.name)}
              </option>
            `).join('')}
            ${cartoes.map((c) => `
              <option value="card:${c.id}"
                ${transacao?.credit_card_id === c.id ? 'selected' : ''}>
                💳 ${escapeHtml(c.name)}
              </option>
            `).join('')}
          </select>
        </label>
  
        <label>Responsável
          <select name="member_id">
            <option value="">— ninguém —</option>
            ${membros.map((m) => `
              <option value="${m.id}" ${transacao?.member_id === m.id || (!transacao && m.id === member.id) ? 'selected' : ''}>
                ${escapeHtml(m.name)}
              </option>
            `).join('')}
          </select>
        </label>
  
        <label>Observação (opcional)
          <textarea name="notes" rows="2" maxlength="500">${escapeHtml(transacao?.notes ?? '')}</textarea>
        </label>
      `
  
      openModal({
        title: editando ? 'Editar lançamento' : 'Novo lançamento',
        content,
        submitLabel: editando ? 'Salvar' : 'Lançar',
        onSubmit: async (data) => {
          const [tipoOrigem, origemId] = data.origem.split(':')
          const payload = {
            type: data.type,
            amount: Number(data.amount),
            date: data.date,
            description: data.description?.trim() || null,
            category_id: data.category_id || null,
            account_id: tipoOrigem === 'account' ? origemId : null,
            credit_card_id: tipoOrigem === 'card' ? origemId : null,
            member_id: data.member_id || null,
            notes: data.notes?.trim() || null
          }
          if (editando) {
            await updateTransaction(transacao.id, payload)
          } else {
            await createTransaction(family.id, payload)
          }
          await carregar()
        }
      })
  
      // filtra categorias conforme tipo selecionado
      const form = document.querySelector('.modal-form')
      const selCat = form.querySelector('#sel-categoria')
      const optgroups = selCat.querySelectorAll('optgroup')
      const radios = form.querySelectorAll('input[name="type"]')
  
      function ajustarCategorias() {
        const tipo = form.querySelector('input[name="type"]:checked').value
        optgroups.forEach((g) => {
          g.style.display = g.dataset.grupo === tipo ? '' : 'none'
          g.disabled = g.dataset.grupo !== tipo
        })
        // Se categoria atual não bate com o tipo, limpa
        const optAtual = selCat.selectedOptions[0]
        if (optAtual && optAtual.closest('optgroup')?.dataset.grupo !== tipo) {
          selCat.value = ''
        }
      }
      radios.forEach((r) => r.addEventListener('change', ajustarCategorias))
      ajustarCategorias()
  
      // foco no valor
      setTimeout(() => form.querySelector('input[name="amount"]')?.focus(), 100)
    }
  
    function opt(cat, selecionadoId) {
      const sel = cat.id === selecionadoId ? 'selected' : ''
      const prefixo = cat.parent_id ? '  └ ' : ''
      return `<option value="${cat.id}" ${sel}>${prefixo}${escapeHtml(cat.name)}</option>`
    }
  
    await carregar()
  }