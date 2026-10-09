import { getState } from '../lib/state.js'
import { listAccounts } from '../lib/db/accounts.js'
import { listMembers } from '../lib/db/members.js'
import { createTransfer, listTransactions } from '../lib/db/transactions.js'
import { openModal, formatBRL, escapeHtml } from '../lib/ui.js'
import { Icons } from '../lib/icons.js'

export async function renderTransfers(root) {
  const { family, member } = getState()

  let contas = []
  let membros = []
  try {
    contas = await listAccounts(family.id)
    membros = await listMembers(family.id)
  } catch (e) {
    console.error('[transfers] erro ao carregar contas/membros:', e)
    root.innerHTML = `<p class="erro">Erro: ${e.message}</p>`
    return
  }

  async function carregar() {
    root.innerHTML = `<p class="carregando">Carregando…</p>`

    let lista = []
    try {
      lista = await listTransactions(family.id, { type: 'transfer' })
    } catch (e) {
      console.error('[transfers] erro ao listar:', e)
      root.innerHTML = `<p class="erro">Erro ao carregar transferências: ${e.message}</p>`
      return
    }

    const ultimas = (lista ?? []).slice(0, 20)

    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Transferências</h2>
        <button id="nova" class="botao-primario" ${contas.length < 2 ? 'disabled' : ''}>+ Nova</button>
      </div>

      <p class="dica-info">
        Movimentações entre suas contas. Não entram como despesa nem receita —
        só movem dinheiro de um lugar pro outro.
      </p>

      ${contas.length < 2
        ? `<p class="vazio">Cadastre pelo menos 2 contas para transferir entre elas.</p>`
        : ultimas.length === 0
          ? `<p class="vazio">Nenhuma transferência ainda.</p>`
          : `<ul class="lista">${ultimas.map(item).join('')}</ul>`}
    `

    const btnNova = root.querySelector('#nova')
    if (btnNova && contas.length >= 2) {
      btnNova.onclick = () => abrirForm()
    }
  }

  function item(t) {
    return `
      <li class="item">
        <div class="item-icone">${Icons.repeat}</div>
        <div class="item-info">
          <div class="item-titulo">
            ${escapeHtml(t.account?.name ?? '?')} → ${escapeHtml(t.account_to?.name ?? '?')}
          </div>
          <div class="item-sub">
            ${t.date.split('-').reverse().join('/')}${t.description ? ' · ' + escapeHtml(t.description) : ''}
          </div>
        </div>
        <div class="item-valor">${formatBRL(t.amount)}</div>
      </li>
    `
  }

  function abrirForm() {
    const content = `
      <label>De
        <select name="account_from" required>
          ${contas.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </label>
      <label>Para
        <select name="account_to" required>
          ${contas.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </label>
      <label>Valor
        <input name="amount" type="number" step="0.01" min="0.01" required inputmode="decimal" placeholder="0,00" />
      </label>
      <label>Data
        <input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}" />
      </label>
      <label>Descrição (opcional)
        <input name="description" maxlength="80" placeholder="Ex: Reserva mensal" />
      </label>
      <label>Responsável
        <select name="member_id">
          <option value="">— ninguém —</option>
          ${membros.map((m) => `
            <option value="${m.id}" ${m.id === member.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>
          `).join('')}
        </select>
      </label>
    `

    openModal({
      title: 'Nova transferência',
      content,
      submitLabel: 'Transferir',
      onSubmit: async (data) => {
        if (data.account_from === data.account_to) {
          throw new Error('As contas de origem e destino precisam ser diferentes.')
        }
        await createTransfer(family.id, {
          amount: data.amount,
          date: data.date,
          description: data.description,
          account_from: data.account_from,
          account_to: data.account_to,
          member_id: data.member_id
        })
        await carregar()
      }
    })

    setTimeout(() => document.querySelector('.modal-form input[name="amount"]')?.focus(), 100)
  }

  await carregar()
}