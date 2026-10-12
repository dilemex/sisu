import { getCurrentRoute, startRouter, navigate } from '../lib/router.js'

const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="0.9" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="0.9" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="0.9" fill="currentColor" stroke="none"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20.5c0-4.2 3.4-7.5 7.5-7.5s7.5 3.3 7.5 7.5"/></svg>`,
  eye:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
}

const NAV_ITENS = [
  { rota: '/',             icon: 'home',   label: 'Início'       },
  { rota: '/lancamentos',  icon: 'list',   label: 'Lançamentos'  },
  { rota: '/planejamento', icon: 'target', label: 'Planejamento' },
  { rota: '/mais',         icon: 'more',   label: 'Mais'         }
]

const BASE = import.meta.env.BASE_URL || '/sisu/'

export function renderAppShell(root) {
  root.innerHTML = `
    <div class="shell">
      <header class="app-header">
        <div class="app-header-inner">
          <div class="app-header-topo">
            <button class="logo">
              <img src="${BASE}logo/simbolo-branco.png" alt="" aria-hidden="true" />
              <img src="${BASE}logo/wordmark-branco.png" alt="Sisu" class="logo-wordmark" />
            </button>
    <div class="header-acoes">
      <button class="icone-header" id="toggle-valores" aria-label="Ocultar valores">
        ${ICONS.eye}
      </button>
      <button class="avatar" data-ir="/mais" aria-label="Perfil">
        ${ICONS.user}
      </button>
    </div>  
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
  const HIDE_KEY = 'sisu:hideValues'
const eyeBtn = root.querySelector('#toggle-valores')
if (localStorage.getItem(HIDE_KEY) === '1') {
  document.body.classList.add('hide-values')
  eyeBtn.innerHTML = ICONS.eyeOff
}
eyeBtn.onclick = () => {
  const hidden = document.body.classList.toggle('hide-values')
  localStorage.setItem(HIDE_KEY, hidden ? '1' : '0')
  eyeBtn.innerHTML = hidden ? ICONS.eyeOff : ICONS.eye
}
  root.querySelector('.logo').onclick = () => navigate('/')

  const links = root.querySelectorAll('.bottom-nav a')
  function atualizarAtivo() {
    const atual = getCurrentRoute()
    links.forEach((a) => a.classList.toggle('ativo', a.dataset.route === atual))
  }
  window.addEventListener('hashchange', atualizarAtivo)
  atualizarAtivo()

  startRouter()
}