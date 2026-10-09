import { signOut } from '../lib/auth.js'
import { navigate } from '../lib/router.js'
import { getState } from '../lib/state.js'
import { escapeHtml } from '../lib/ui.js'
import { Icons } from '../lib/icons.js'

const ITENS = [
  { rota: '/config/perfil',      ic: 'user',  titulo: 'Meu perfil',   sub: 'Nome, membro logado' },
  { rota: '/config/categorias',  ic: 'tag',   titulo: 'Categorias',   sub: 'Personalizar categorias' },
  { rota: '/config/sobre',       ic: 'info',  titulo: 'Sobre o Sisu', sub: 'Versão, créditos, backup' }
]

export async function renderSettings(root) {
  const { member, family } = getState()

  root.innerHTML = `
    <div class="pagina-cabecalho">
      <h2>Configurações</h2>
    </div>

    <div class="perfil-resumo">
      <div class="perfil-avatar">${escapeHtml(member.name[0].toUpperCase())}</div>
      <div>
        <strong>${escapeHtml(member.name)}</strong>
        <div class="item-sub">${escapeHtml(family.name)} · ${member.role === 'owner' ? 'Proprietário' : 'Membro'}</div>
      </div>
    </div>

    <ul class="lista">
      ${ITENS.map((i) => `
        <li class="item item-clicavel" data-rota="${i.rota}">
          <div class="item-icone">${Icons[i.ic] ?? ''}</div>
          <div class="item-info">
            <div class="item-titulo">${i.titulo}</div>
            <div class="item-sub">${i.sub}</div>
          </div>
          <div class="item-seta">${Icons.chevronRight}</div>
        </li>
      `).join('')}
    </ul>

    <button id="sair2" class="botao-secundario bloco-largo">Sair da conta</button>
  `

  root.querySelectorAll('[data-rota]').forEach((el) => {
    el.onclick = () => navigate(el.dataset.rota)
  })
  root.querySelector('#sair2').onclick = signOut
}