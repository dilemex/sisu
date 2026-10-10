import {
  listTransactions, createTransaction, updateTransaction, deleteTransaction,
  createInstallmentPurchase
} from '../lib/db/transactions.js'
import { listCategories } from '../lib/db/categories.js'
import { listAccounts } from '../lib/db/accounts.js'
import { listCards } from '../lib/db/cards.js'
import { listMembers } from '../lib/db/members.js'
import { openModal, formatBRL, escapeHtml } from '../lib/ui.js'
import { getState } from '../lib/state.js'
import { Icons } from '../lib/icons.js'
import { navigate } from '../lib/router.js'
import { cached, invalidate } from '../lib/cache.js'

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
    cached(`cat:${family.id}`, () => listCategories(family.id)),
    cached(`acc:${family.id}`, () => listAccounts(family.id)),
    cached(`card:${family.id}`, () => listCards(family.id)),
    cached(`mem:${family.id}`, () => listMembers(family.id))
  ])

  const estado = {
    mes: ymHoje(),
    filtroTipo: '',
    transacoes: [],
    mostrarFuturos: false
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
    const hoje = new Date().toISOString().slice(0, 10)

    // Separa passado (até hoje) do futuro
    const passadas = estado.transacoes.filter((t) => t.date <= hoje)
    const futuras  = estado.transacoes.filter((t) => t.date >  hoje)

    // Cálculos: só passadas, apenas transações em contas (cartão fica de fora)
    const totalReceitas = passadas
      .filter((t) => t.type === 'income' && t.account_id)
      .reduce((s, t) => s + Number(t.amount), 0)
    const totalDespesas = passadas
      .filter((t) => t.type === 'expense' && t.account_id)
      .reduce((s, t) => s + Number(t.amount), 0)
    const totalFatura = passadas
      .filter((t) => t.credit_card_id)
      .reduce((s, t) => s + Number(t.amount), 0)

    // Agrupa passadas por dia (mais recente primeiro)
    const porDia = new Map()
    for (const t of passadas) {
      if (!porDia.has(t.date)) porDia.set(t.date, [])
      porDia.get(t.date).push(t)
    }

    // Agrupa futuras por dia (próxima primeiro)
    const porDiaFuturo = new Map()
    for (const t of futuras) {
      if (!porDiaFuturo.has(t.date)) porDiaFuturo.set(t.date, [])
      porDiaFuturo.get(t.date).push(t)
    }

    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Lançamentos</h2>
        <div style="display:flex;gap:.5rem">
          <button id="transferir" class="botao-secundario">Transferir</button>
          <button id="novo" class="botao-primario">+ Novo</button>
        </div>
      </div>

      <div class="filtros">
        <input type="month" id="mes" value="${estado.mes}" />
        <select id="tipo">
          <option value="">Tudo</option>
          <option value="income" ${estado.filtroTipo === 'income' ? 'selected' : ''}>Só entradas</option>
          <option value="expense" ${estado.filtroTipo === 'expense' ? 'selected' : ''}>Só saídas</option>
          <option value="transfer" ${estado.filtroTipo === 'transfer' ? 'selected' : ''}>Transferências</option>
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

      ${totalFatura > 0 ? `
        <p class="info-fatura">
          💳 Compras no cartão no período: <strong>${formatBRL(totalFatura)}</strong>
          <span class="dica-inline">— entram como saída quando a fatura for paga</span>
        </p>
      ` : ''}

           ${futuras.length > 0 ? `
        <section class="futuros-section">
          <button id="toggle-futuros" class="futuros-toggle" type="button">
            <span class="futuros-icone">${estado.mostrarFuturos ? '▾' : '▸'}</span>
            <span>${futuras.length} lançamento${futuras.length > 1 ? 's' : ''} futuro${futuras.length > 1 ? 's' : ''}</span>
            <span class="futuros-chevron">${estado.mostrarFuturos ? 'Ocultar' : 'Ver'}</span>
          </button>

          ${estado.mostrarFuturos ? `
            <div class="futuros-conteudo">
              ${[...porDiaFuturo.entries()].map(([dia, itens]) => `
                <section class="dia">
                  <h3 class="dia-titulo">${formataData(dia)}</h3>
                  <ul class="lista">
                    ${itens.map(item).join('')}
                  </ul>
                </section>
              `).join('')}
            </div>
          ` : ''}
        </section>
      ` : ''}

      ${estado.transacoes.length === 0
        ? `<p class="vazio">Nenhum lançamento neste período.</p>`
        : porDia.size === 0
          ? `<p class="vazio">Nada lançado até hoje neste período.</p>`
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

    // Listeners
    root.querySelector('#novo').onclick = () => abrirForm(null)
    root.querySelector('#transferir').onclick = () => navigate('/transferencias')

    root.querySelector('#mes').onchange = (e) => {
      estado.mes = e.target.value || ymHoje()
      carregar()
    }
    root.querySelector('#tipo').onchange = (e) => {
      estado.filtroTipo = e.target.value
      carregar()
    }

    const btnToggle = root.querySelector('#toggle-futuros')
    if (btnToggle) {
      btnToggle.onclick = () => {
        estado.mostrarFuturos = !estado.mostrarFuturos
        render()
      }
    }

    root.querySelectorAll('[data-editar]').forEach((b) => {
      const t = estado.transacoes.find((x) => x.id === b.dataset.editar)
      b.onclick = () => abrirForm(t)
    })
    root.querySelectorAll('[data-excluir]').forEach((b) => {
      b.onclick = async () => {
        const t = estado.transacoes.find((x) => x.id === b.dataset.excluir)
        const msg = t?.installment_group_id
          ? 'Esta é uma parcela de uma compra parcelada. Excluir SÓ esta parcela?'
          : 'Excluir este lançamento?'
        if (!confirm(msg)) return
        try {
          await deleteTransaction(b.dataset.excluir)
          await carregar()
        } catch (e) { alert(e.message) }
      }
    })
  }

  function item(t) {
    if (t.type === 'transfer') {
      return `
        <li class="item">
          <div class="item-icone">${Icons.repeat}</div>
          <div class="item-info">
            <div class="item-titulo">
              ${escapeHtml(t.account?.name ?? '?')} → ${escapeHtml(t.account_to?.name ?? '?')}
            </div>
            <div class="item-sub">Transferência${t.member ? ' · ' + escapeHtml(t.member.name) : ''}</div>
          </div>
          <div class="item-valor">${formatBRL(t.amount)}</div>
          <div class="item-acoes">
            <button data-excluir="${t.id}" title="Excluir">${Icons.trash}</button>
          </div>
        </li>
      `
    }

    const sinal = t.type === 'income' ? '+' : '−'
    const cor = t.type === 'income' ? 'verde' : 'vermelho'
    const icone = t.category?.icon
      ? t.category.icon
      : (t.type === 'income' ? Icons.arrowUp : Icons.arrowDown)
    const nomeCat = t.category?.name ?? (t.type === 'income' ? 'Entrada' : 'Saída')
    const onde = t.account?.name ?? t.card?.name ?? ''
    const parcelaTag = t.installment_number && t.installment_total
      ? ` <span class="tag">${t.installment_number}/${t.installment_total}</span>`
      : ''
    return `
      <li class="item">
        <div class="item-icone">${icone}</div>
        <div class="item-info">
          <div class="item-titulo">
            ${escapeHtml(t.description || nomeCat)}${parcelaTag}
          </div>
          <div class="item-sub">
            ${escapeHtml(nomeCat)}${onde ? ' · ' + escapeHtml(onde) : ''}${t.member ? ' · ' + escapeHtml(t.member.name) : ''}
          </div>
        </div>
        <div class="item-valor ${cor}">${sinal}${formatBRL(t.amount).replace('R$', '').trim()}</div>
        <div class="item-acoes">
          <button data-editar="${t.id}" title="Editar">${Icons.edit}</button>
          <button data-excluir="${t.id}" title="Excluir">${Icons.trash}</button>
        </div>
      </li>
    `
  }

  // ---------- Form ----------

  function abrirForm(transacao) {
    const editando = !!transacao
    const isParcelada = editando && !!transacao.installment_group_id
    const categoriasFiltradas = (tipo) => categorias.filter((c) => c.type === tipo)

    const content = `
      ${isParcelada ? `
        <div class="dica-info">
          🧾 Esta é a <strong>parcela ${transacao.installment_number} de ${transacao.installment_total}</strong>.
          Para alterar valor, data ou número de parcelas, exclua o parcelamento e crie de novo.
        </div>
      ` : ''}

      <div class="segmento" role="tablist">
        <label class="segmento-item">
          <input type="radio" name="type" value="expense"
                 ${!transacao || transacao.type === 'expense' ? 'checked' : ''}
                 ${isParcelada ? 'disabled' : ''} />
          <span>Despesa</span>
        </label>
        <label class="segmento-item">
          <input type="radio" name="type" value="income"
                 ${transacao?.type === 'income' ? 'checked' : ''}
                 ${isParcelada ? 'disabled' : ''} />
          <span>Receita</span>
        </label>
      </div>

      <label>Valor ${isParcelada ? '(travado)' : 'total'}
        <input name="amount" type="number" step="0.01" min="0.01" required inputmode="decimal"
               value="${transacao?.amount ?? ''}" placeholder="0,00"
               ${isParcelada ? 'disabled' : ''} />
      </label>

      ${!editando ? `
        <div class="parcelar-box" id="parcelar-box">
          <label class="checkbox-linha">
            <input type="checkbox" name="parcelar" id="parcelar" />
            <span>Compra parcelada?</span>
          </label>
          <div class="parcelar-campos" id="parcelar-campos" hidden>
            <label>Número de parcelas
              <input name="installments" type="number" min="2" max="48" value="2" />
            </label>
            <p class="preview-parcela" id="preview-parcela"></p>
          </div>
        </div>
      ` : ''}

      <label>Data
        <input name="date" type="date" required
               value="${transacao?.date ?? new Date().toISOString().slice(0,10)}"
               ${isParcelada ? 'disabled' : ''} />
      </label>

      <label>Descrição (opcional)
        <input name="description" maxlength="120"
               value="${escapeHtml(transacao?.description ?? '')}"
               placeholder="Ex: TV da sala" />
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
            <option value="account:${a.id}" ${transacao?.account_id === a.id ? 'selected' : ''}>
              🏦 ${escapeHtml(a.name)}
            </option>
          `).join('')}
          ${cartoes.map((c) => `
            <option value="card:${c.id}" ${transacao?.credit_card_id === c.id ? 'selected' : ''}>
              💳 ${escapeHtml(c.name)}
            </option>
          `).join('')}
        </select>
      </label>

      <label>Responsável
        <select name="member_id">
          <option value="">— ninguém —</option>
          ${membros.map((m) => `
            <option value="${m.id}"
              ${transacao?.member_id === m.id || (!transacao && m.id === member.id) ? 'selected' : ''}>
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
      title: editando
        ? (isParcelada
            ? `Editar parcela ${transacao.installment_number}/${transacao.installment_total}`
            : 'Editar lançamento')
        : 'Novo lançamento',
      content,
      submitLabel: editando ? 'Salvar' : 'Lançar',
      onSubmit: async (data) => {
        const [tipoOrigem, origemId] = data.origem.split(':')

        // Em parceladas, preserva amount, date e type do registro original
        const payload = {
          type: isParcelada ? transacao.type : data.type,
          amount: isParcelada ? transacao.amount : Number(data.amount),
          date: isParcelada ? transacao.date : data.date,
          description: data.description?.trim() || null,
          category_id: data.category_id || null,
          account_id: tipoOrigem === 'account' ? origemId : null,
          credit_card_id: tipoOrigem === 'card' ? origemId : null,
          member_id: data.member_id || null,
          notes: data.notes?.trim() || null
        }

        if (editando) {
          await updateTransaction(transacao.id, payload)
        } else if (data.parcelar === 'on' && Number(data.installments) >= 2) {
          await createInstallmentPurchase(family.id, payload, Number(data.installments))
        } else {
          await createTransaction(family.id, payload)
        }
        await carregar()
      }
    })

    const form = document.querySelector('.modal-form')
    const selCat = form.querySelector('#sel-categoria')
    const optgroups = selCat.querySelectorAll('optgroup')
    const radios = form.querySelectorAll('input[name="type"]:not(:disabled)')

    function ajustarCategorias() {
      const checked = form.querySelector('input[name="type"]:checked')
      const tipo = checked ? checked.value : 'expense'
      optgroups.forEach((g) => {
        g.style.display = g.dataset.grupo === tipo ? '' : 'none'
        g.disabled = g.dataset.grupo !== tipo
      })
      const optAtual = selCat.selectedOptions[0]
      if (optAtual && optAtual.closest('optgroup')?.dataset.grupo !== tipo) {
        selCat.value = ''
      }
    }
    radios.forEach((r) => r.addEventListener('change', ajustarCategorias))
    ajustarCategorias()

    // Parcelamento (só quando NÃO editando)
    const chkParcelar = form.querySelector('#parcelar')
    if (chkParcelar) {
      const camposParcelar = form.querySelector('#parcelar-campos')
      const inputParcelas = form.querySelector('input[name="installments"]')
      const inputValor = form.querySelector('input[name="amount"]')
      const preview = form.querySelector('#preview-parcela')

      function atualizarPreview() {
        const total = Number(inputValor.value) || 0
        const n = Number(inputParcelas.value) || 1
        preview.textContent = (total > 0 && n >= 2)
          ? `${n}x de ${formatBRL(total / n)}`
          : ''
      }

      chkParcelar.addEventListener('change', () => {
        camposParcelar.hidden = !chkParcelar.checked
        if (chkParcelar.checked) {
          atualizarPreview()
          inputParcelas.focus()
        }
      })
      inputParcelas.addEventListener('input', atualizarPreview)
      inputValor.addEventListener('input', atualizarPreview)
    }

    setTimeout(() => {
      form.querySelector('input[name="amount"]:not(:disabled)')?.focus()
    }, 100)
  }

  function opt(cat, selecionadoId) {
    const sel = cat.id === selecionadoId ? 'selected' : ''
    const prefixo = cat.parent_id ? '  └ ' : ''
    return `<option value="${cat.id}" ${sel}>${prefixo}${escapeHtml(cat.name)}</option>`
  }

  await carregar()
}