import { listGoals, createGoal, updateGoal, deleteGoal, addContribution } from '../lib/db/goals.js'
import { listMembers } from '../lib/db/members.js'
import { openModal, formatBRL, escapeHtml } from '../lib/ui.js'
import { getState } from '../lib/state.js'
import { Icons } from '../lib/icons.js'

export async function renderGoals(root) {
  const { family, member } = getState()
  const membros = await listMembers(family.id)

  async function carregar() {
    root.innerHTML = `<p class="carregando">Carregando…</p>`
    const metas = await listGoals(family.id)

    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Metas</h2>
        <button id="nova" class="botao-primario">+ Nova</button>
      </div>

      ${metas.length === 0
        ? `<p class="vazio">Nenhuma meta cadastrada. Que tal começar pela reserva de emergência?</p>`
        : `<ul class="lista-metas">${metas.map(card).join('')}</ul>`}
    `

    root.querySelector('#nova').onclick = () => abrirFormMeta(null)
    root.querySelectorAll('[data-aporte]').forEach((b) => {
      const meta = metas.find((m) => m.id === b.dataset.aporte)
      b.onclick = () => abrirFormAporte(meta)
    })
    root.querySelectorAll('[data-editar]').forEach((b) => {
      const meta = metas.find((m) => m.id === b.dataset.editar)
      b.onclick = () => abrirFormMeta(meta)
    })
    root.querySelectorAll('[data-excluir]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Excluir esta meta e todos os aportes?')) return
        try { await deleteGoal(b.dataset.excluir); carregar() }
        catch (e) { alert(e.message) }
      }
    })
  }

  function card(m) {
    const pct = Math.min(100, Math.round((m.atual / Number(m.target_amount)) * 100))
    const faltam = Math.max(0, Number(m.target_amount) - m.atual)
    const concluida = pct >= 100
    const deadlineStr = m.deadline
      ? new Date(m.deadline + 'T12:00').toLocaleDateString('pt-BR')
      : null

    return `
      <li class="meta-card ${concluida ? 'concluida' : ''}" style="--cor: ${m.color}">
        <header class="meta-header">
          <div class="meta-titulo">
            <span class="meta-icone">${m.icon}</span>
            <div>
              <strong>${escapeHtml(m.name)}</strong>
              ${deadlineStr ? `<div class="item-sub">até ${deadlineStr}</div>` : ''}
            </div>
          </div>
          <div class="item-acoes">
            <button data-editar="${m.id}" title="Editar">${Icons.edit}</button>
            <button data-excluir="${m.id}" title="Excluir">${Icons.trash}</button>
          </div>
        </header>

        <div class="meta-progresso">
          <div class="meta-track"><div class="meta-fill" style="width:${pct}%"></div></div>
          <span class="meta-pct">${pct}%</span>
        </div>

        <div class="meta-valores">
          <div>
            <span class="label">Atual</span>
            <strong>${formatBRL(m.atual)}</strong>
          </div>
          <div>
            <span class="label">Meta</span>
            <strong>${formatBRL(m.target_amount)}</strong>
          </div>
          ${!concluida
            ? `<div><span class="label">Faltam</span><strong>${formatBRL(faltam)}</strong></div>`
            : `<div><span class="label">Status</span><strong class="verde">Concluída 🎉</strong></div>`}
        </div>

        <button class="botao-secundario bloco-largo" data-aporte="${m.id}">+ Registrar aporte</button>
      </li>
    `
  }

  function abrirFormMeta(meta) {
    const editando = !!meta
    const content = `
      <label>Nome
        <input name="name" required value="${escapeHtml(meta?.name ?? '')}" placeholder="Reserva de emergência" />
      </label>
      <div class="linha-dupla">
        <label>Ícone
          <input name="icon" maxlength="2" value="${meta?.icon ?? '🎯'}" />
        </label>
        <label>Cor
          <input name="color" type="color" value="${meta?.color ?? '#38bdf8'}" />
        </label>
      </div>
      <label>Valor alvo
        <input name="target_amount" type="number" step="0.01" min="0.01" required
               value="${meta?.target_amount ?? ''}" placeholder="30000" />
      </label>
      <label>Prazo (opcional)
        <input name="deadline" type="date" value="${meta?.deadline ?? ''}" />
      </label>
    `
    openModal({
      title: editando ? 'Editar meta' : 'Nova meta',
      content,
      submitLabel: editando ? 'Salvar' : 'Criar',
      onSubmit: async (data) => {
        const payload = {
          name: data.name,
          icon: data.icon || '🎯',
          color: data.color || '#38bdf8',
          target_amount: Number(data.target_amount),
          deadline: data.deadline || null
        }
        if (editando) await updateGoal(meta.id, payload)
        else await createGoal(family.id, payload)
        await carregar()
      }
    })
  }

  function abrirFormAporte(meta) {
    const content = `
      <p class="aporte-meta">Aporte para <strong>${escapeHtml(meta.name)}</strong></p>
      <label>Valor
        <input name="amount" type="number" step="0.01" min="0.01" required inputmode="decimal" />
      </label>
      <label>Data
        <input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}" />
      </label>
      <label>Responsável
        <select name="member_id">
          <option value="">— ninguém —</option>
          ${membros.map((m) => `
            <option value="${m.id}" ${m.id === member.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>
          `).join('')}
        </select>
      </label>
      <label>Observação (opcional)
        <input name="notes" maxlength="200" />
      </label>
    `
    openModal({
      title: 'Registrar aporte',
      content,
      submitLabel: 'Aportar',
      onSubmit: async (data) => {
        await addContribution(meta.id, {
          amount: data.amount,
          date: data.date,
          notes: data.notes,
          memberId: data.member_id
        })
        await carregar()
      }
    })
  }

  await carregar()
}