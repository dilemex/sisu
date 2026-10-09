import { signOut } from '../lib/auth.js'
import { getCurrentRoute, startRouter } from '../lib/router.js'
import { escapeHtml } from '../lib/ui.js'

const NAV_ITENS = [
  { rota: '/',             icone: '🏠', label: 'Início'       },
  { rota: '/lancamentos',  icone: '📋', label: 'Lançamentos'  },
  { rota: '/planejamento', icone: '🧭', label: 'Planejamento' },
  { rota: '/mais',         icone: '⋯',  label: 'Mais'         }
]

export function renderAppShell(root, membro) {
  root.innerHTML = `
    <div class="shell">
      <header class="topo">
        <div class="topo-info">
          <h1>Olá, ${escapeHtml(membro.name)} 👋</h1>
          <p class="familia">${escapeHtml(membro.family.name)}</p>
        </div>
        <button id="sair" class="botao-secundario">Sair</button>
      </header>

      <main id="main" class="conteudo"></main>

      <nav class="bottom-nav">
        ${NAV_ITENS.map((i) => `
          <a href="#${i.rota}" data-route="${i.rota}">
            <span class="icone">${i.icone}</span>
            <span class="label">${i.label}</span>
          </a>
        `).join('')}
      </nav>
    </div>
  `

  root.querySelector('#sair').onclick = signOut

  const links = root.querySelectorAll('.bottom-nav a')
  function atualizarAtivo() {
    const atual = getCurrentRoute()
    links.forEach((a) => {
      a.classList.toggle('ativo', a.dataset.route === atual)
    })
  }
  window.addEventListener('hashchange', atualizarAtivo)
  atualizarAtivo()

  startRouter(document.querySelector('#main'))
}