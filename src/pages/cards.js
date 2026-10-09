import { listCards, createCard, updateCard, toggleCardActive } from '../lib/db/cards.js'
import { listAccounts } from '../lib/db/accounts.js'
import { openModal, formatBRL, escapeHtml } from '../lib/ui.js'
import { getState } from '../lib/state.js'
import { getCardInvoices, getCardCommitted } from '../lib/db/balances.js'

export async function renderCards(root) {
  async function carregar() {
    root.innerHTML = `<p class="carregando">Carregando…</p>`
    const { family } = getState()

    const agora = new Date()
    const ym = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
    const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
    const from = `${ym}-01`
    const to = `${ym}-${String(ultimoDia).padStart(2, '0')}`

    const [cartoes, contas, faturas, comprometidos] = await Promise.all([
      listCards(family.id),
      listAccounts(family.id),
      getCardInvoices(family.id, { from, to }),
      getCardCommitted(family.id)
    ])

    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Cartões</h2>
        <button id="novo" class="botao-primario">+ Novo</button>
      </div>
      ${cartoes.length === 0
        ? `<p class="vazio">Nenhum cartão cadastrado ainda.</p>`
        : `<ul class="lista">${cartoes.map((c) =>
            item(c, faturas[c.id] ?? 0, comprometidos[c.id] ?? 0)
          ).join('')}</ul>`}
    `

    root.querySelector('#novo').onclick = () => abrirForm(null, contas, carregar)
    root.querySelectorAll('[data-editar]').forEach((b) => {
      const c = cartoes.find((x) => x.id === b.dataset.editar)
      b.onclick = () => abrirForm(c, contas, carregar)
    })
    root.querySelectorAll('[data-toggle]').forEach((b) => {
      b.onclick = async () => {
        try { await toggleCardActive(b.dataset.toggle); carregar() }
        catch (e) { alert(e.message) }
      }
    })
  }

  function item(c, fatura, comprometido) {
    const limite = c.limit_amount ? Number(c.limit_amount) : null
    const disponivel = limite != null ? limite - comprometido : null
    const pctUsado = limite ? Math.min(100, Math.round((comprometido / limite) * 100)) : 0

    return `
      <li class="item item-card ${c.is_active ? '' : 'inativo'}">
        <div class="item-info">
          <div class="item-titulo">
            ${escapeHtml(c.name)}
            ${c.is_active ? '' : '<span class="tag">inativo</span>'}
          </div>
          <div class="item-sub">
            ${c.institution ? escapeHtml(c.institution) + ' · ' : ''}
            fecha ${c.closing_day}, vence ${c.due_day}
            ${c.payment_account ? ' · paga em ' + escapeHtml(c.payment_account.name) : ''}
          </div>
          ${limite != null ? `
            <div class="card-bar-track">
              <div class="card-bar-fill" style="width:${pctUsado}%"></div>
            </div>
            <div class="card-metricas">
              <span>${pctUsado}% do limite comprometido</span>
              <span>Limite ${formatBRL(limite)}</span>
            </div>
          ` : ''}
        </div>
        <div class="item-valor card-valores">
          <div>
            <span class="label-mini">Fatura do mês</span>
            <strong>${formatBRL(fatura)}</strong>
          </div>
          ${disponivel != null ? `
            <div>
              <span class="label-mini">Disponível</span>
              <strong class="${disponivel < 0 ? 'vermelho' : 'verde'}">${formatBRL(disponivel)}</strong>
            </div>
          ` : ''}
        </div>
        <div class="item-acoes">
          <button data-editar="${c.id}" title="Editar">✏️</button>
          <button data-toggle="${c.id}" title="${c.is_active ? 'Desativar' : 'Reativar'}">
            ${c.is_active ? '🗑️' : '↩️'}
          </button>
        </div>
      </li>
    `
  }

  function abrirForm(cartao, contas, aoSalvar) {
    const { family } = getState()
    const editando = !!cartao

    const content = `
      <label>Nome
        <input name="name" required value="${escapeHtml(cartao?.name ?? '')}" />
      </label>
      <label>Instituição (opcional)
        <input name="institution" value="${escapeHtml(cartao?.institution ?? '')}" placeholder="Nubank, Itaú…" />
      </label>
      <label>Limite (opcional)
        <input name="limitAmount" type="number" step="0.01" value="${cartao?.limit_amount ?? ''}" />
      </label>
      <div class="linha-dupla">
        <label>Fecha dia
          <input name="closingDay" type="number" min="1" max="31" required value="${cartao?.closing_day ?? 25}" />
        </label>
        <label>Vence dia
          <input name="dueDay" type="number" min="1" max="31" required value="${cartao?.due_day ?? 2}" />
        </label>
      </div>
      <label>Conta de pagamento (opcional)
        <select name="paymentAccountId">
          <option value="">— Nenhuma —</option>
          ${contas.map((a) => `
            <option value="${a.id}" ${cartao?.payment_account_id === a.id ? 'selected' : ''}>
              ${escapeHtml(a.name)}
            </option>
          `).join('')}
        </select>
      </label>
    `

    openModal({
      title: editando ? 'Editar cartão' : 'Novo cartão',
      content,
      submitLabel: editando ? 'Salvar' : 'Criar',
      onSubmit: async (data) => {
        const payload = {
          name: data.name,
          institution: data.institution || null,
          limit_amount: data.limitAmount ? Number(data.limitAmount) : null,
          closing_day: Number(data.closingDay),
          due_day: Number(data.dueDay),
          payment_account_id: data.paymentAccountId || null
        }
        if (editando) {
          await updateCard(cartao.id, payload)
        } else {
          await createCard({ familyId: family.id, ...payload })
        }
        await aoSalvar()
      }
    })
  }

  await carregar()
}