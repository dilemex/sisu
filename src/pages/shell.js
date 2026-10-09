import { getCurrentRoute, startRouter, navigate } from '../lib/router.js'

const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="0.9" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="0.9" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="0.9" fill="currentColor" stroke="none"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20.5c0-4.2 3.4-7.5 7.5-7.5s7.5 3.3 7.5 7.5"/></svg>`
}

const NAV_ITENS = [
  { rota: '/',             icon: 'home',   label: 'Início'       },
  { rota: '/lancamentos',  icon: 'list',   label: 'Lançamentos'  },
  { rota: '/planejamento', icon: 'target', label: 'Planejamento' },
  { rota: '/mais',         icon: 'more',   label: 'Mais'         }
]

export function renderAppShell(root) {
  root.innerHTML = `
    <div class="shell">
      <header class="app-header">
        <div class="app-header-inner">
          <div class="app-header-topo">
            <div class="logo">
              <svg class="logo-marca" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M16 5 L28 26 L4 26 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <path d="M16 13 L22 26 L10 26 Z" fill="currentColor"/>
              </svg>
              <span class="logo-texto">SISU</span>
            </div>
            <button class="avatar" data-ir="/mais" aria-label="Perfil">
              ${ICONS.user}
            </button>
          </div>
          <p class="app-tagline">O painel financeiro da sua família</p>
        </div>
      </header>

      <main id="main" class="conteudo"></main>

      <nav class="bottom-nav">
        ${NAV_ITENS.map((i) => `
          <a href="#${i.rota}" data-route="${i.rota}">
            <span class="icone">${ICONS[i.icon]}</span>
            <span class="label">${i.label}</span>
          </a>
        `).join('')}
      </nav>
    </div>
  `

  root.querySelector('.avatar').onclick = () => navigate('/mais')

  const links = root.querySelectorAll('.bottom-nav a')
  function atualizarAtivo() {
    const atual = getCurrentRoute()
    links.forEach((a) => a.classList.toggle('ativo', a.dataset.route === atual))
  }
  window.addEventListener('hashchange', atualizarAtivo)
  atualizarAtivo()

  startRouter(document.querySelector('#main'))
}