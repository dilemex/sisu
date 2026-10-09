import { getState, setState } from '../lib/state.js'
import { updateMember } from '../lib/db/members.js'
import { openModal, escapeHtml } from '../lib/ui.js'

export async function renderProfile(root) {
  const { member, family } = getState()

  root.innerHTML = `
    <div class="pagina-cabecalho">
      <h2>Meu perfil</h2>
    </div>

    <div class="cartao-info">
      <p><span class="label-mini">Nome</span><br><strong>${escapeHtml(member.name)}</strong></p>
      <p><span class="label-mini">Família</span><br><strong>${escapeHtml(family.name)}</strong></p>
      <p><span class="label-mini">Papel</span><br><strong>${member.role === 'owner' ? 'Proprietário' : 'Membro'}</strong></p>
    </div>

    <button id="editar" class="botao-primario bloco-largo">Editar meu nome</button>
  `

  root.querySelector('#editar').onclick = () => {
    openModal({
      title: 'Editar nome',
      content: `<label>Nome <input name="name" required value="${escapeHtml(member.name)}" /></label>`,
      submitLabel: 'Salvar',
      onSubmit: async (data) => {
        const atualizado = await updateMember(member.id, { name: data.name.trim() })
        setState({ member: { ...member, name: atualizado.name } })
        renderProfile(root)
      }
    })
  }
}