import { listAccounts, createAccount, updateAccount, toggleAccountActive } from '../lib/db/accounts.js'
import { getAccountBalances } from '../lib/db/balances.js'
import { openModal, formatBRL, escapeHtml } from '../lib/ui.js'
import { getState } from '../lib/state.js'

const TIPOS = [
  { valor: 'checking',   label: 'Conta corrente' },
  { valor: 'savings',    label: 'Poupança' },
  { valor: 'cash',       label: 'Dinheiro' },
  { valor: 'investment', label: 'Investimento' },
  { valor: 'other',      label: 'Outro' }
]

const labelTipo = (t) => TIPOS.find((x) => x.valor === t)?.label ?? t

export async function renderAccounts(root) {
  async function carregar() {
    root.innerHTML = `<p class="carregando">Carregando…</p>`
    const { family } = getState()

    const [contas, deltas] = await Promise.all([
      listAccounts(family.id),
      getAccountBalances(family.id)
    ])

    const total = contas
      .filter((c) => c.is_active)
      .reduce((s, c) => s + Number(c.initial_balance) + (deltas[c.id] ?? 0), 0)

    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Contas</h2>
        <button id="nova" class="botao-primario">+ Nova</button>
      </div>

      <div class="saldo-total">
        <span class="label">Saldo total</span>
        <strong>${formatBRL(total)}</strong>
      </div>

      ${contas.length === 0
        ? `<p class="vazio">Nenhuma conta cadastrada ainda.</p>`
        : `<ul class="lista">${contas.map((c) => item(c, deltas[c.id] ?? 0)).join('')}</ul>`}
    `

    root.querySelector('#nova').onclick = () => abrirForm(null, carregar)
    root.querySelectorAll('[data-editar]').forEach((b) => {
      const c = contas.find((x) => x.id === b.dataset.editar)
      b.onclick = () => abrirForm(c, carregar)
    })
    root.querySelectorAll('[data-toggle]').forEach((b) => {
      b.onclick = async () => {
        try { await toggleAccountActive(b.dataset.toggle); carregar() }
        catch (e) { alert(e.message) }
      }
    })
  }

  function item(c, delta) {
    const saldo = Number(c.initial_balance) + delta
    return `
      <li class="item ${c.is_active ? '' : 'inativo'}">
        <div class="item-info">
          <div class="item-titulo">
            ${escapeHtml(c.name)}
            ${c.is_active ? '' : '<span class="tag">inativa</span>'}
          </div>
          <div class="item-sub">
            ${labelTipo(c.type)}${c.institution ? ' · ' + escapeHtml(c.institution) : ''}
          </div>
        </div>
        <div class="item-valor ${saldo < 0 ? 'vermelho' : ''}">${formatBRL(saldo)}</div>
        <div class="item-acoes">
          <button data-editar="${c.id}" title="Editar">✏️</button>
          <button data-toggle="${c.id}" title="${c.is_active ? 'Desativar' : 'Reativar'}">
            ${c.is_active ? '🗑️' : '↩️'}
          </button>
        </div>
      </li>
    `
  }

  function abrirForm(conta, aoSalvar) {
    const { family } = getState()
    const editando = !!conta

    const content = `
      <label>Nome
        <input name="name" required value="${escapeHtml(conta?.name ?? '')}" />
      </label>
      <label>Tipo
        <select name="type" required>
          ${TIPOS.map((t) => `
            <option value="${t.valor}" ${conta?.type === t.valor ? 'selected' : ''}>${t.label}</option>
          `).join('')}
        </select>
      </label>
      <label>Instituição (opcional)
        <input name="institution" value="${escapeHtml(conta?.institution ?? '')}" placeholder="Nubank, Itaú…" />
      </label>
      <label>Saldo inicial
        <input name="initialBalance" type="number" step="0.01" value="${conta?.initial_balance ?? 0}" />
        <small class="dica">Saldo no momento em que você começou a usar o Sisu.</small>
      </label>
    `

    openModal({
      title: editando ? 'Editar conta' : 'Nova conta',
      content,
      submitLabel: editando ? 'Salvar' : 'Criar',
      onSubmit: async (data) => {
        if (editando) {
          await updateAccount(conta.id, {
            name: data.name,
            type: data.type,
            institution: data.institution || null,
            initial_balance: Number(data.initialBalance) || 0
          })
        } else {
          await createAccount({
            familyId: family.id,
            name: data.name, type: data.type,
            institution: data.institution,
            initialBalance: data.initialBalance
          })
        }
        await aoSalvar()
      }
    })
  }

  await carregar()
}