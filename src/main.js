import './style.css'
import { supabase } from './lib/supabase.js'
import { getCurrentMember } from './lib/auth.js'
import { setState } from './lib/state.js'
import { registerRoute } from './lib/router.js'
import { renderLogin } from './pages/login.js'
import { renderAppShell } from './pages/shell.js'
import { renderDashboard } from './pages/dashboard.js'
import { renderAccounts } from './pages/accounts.js'
import { renderCards } from './pages/cards.js'
import { renderMore } from './pages/more.js'
import { renderTransactions } from './pages/transactions.js'
import { renderGoals } from './pages/goals.js'
import { renderInstallments } from './pages/installments.js'

// Detecta nova versão do Service Worker e recarrega
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing
        if (!novo) return
        novo.addEventListener('statechange', () => {
          if (novo.state === 'activated' && navigator.serviceWorker.controller) {
            console.log('Sisu: nova versão detectada, recarregando…')
            window.location.reload()
          }
        })
      })
      reg.update()
    })
  })
}

const app = document.querySelector('#app')

registerRoute('/', renderDashboard)
registerRoute('/contas', renderAccounts)
registerRoute('/cartoes', renderCards)
registerRoute('/mais', renderMore)

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) mostrarApp()
  else mostrarLogin()
})

async function mostrarLogin() {
  app.innerHTML = ''
  renderLogin(app)
}

async function mostrarApp() {
  try {
    const membro = await getCurrentMember()
    if (!membro) {
      app.innerHTML = `
        <main class="app">
          <p>Você está logado, mas não está vinculado a nenhuma família.</p>
          <button id="sair" class="botao-secundario">Sair</button>
        </main>
      `
      app.querySelector('#sair').onclick = () => supabase.auth.signOut()
      return
    }
    setState({ member: membro, family: membro.family })
    app.innerHTML = ''
    renderAppShell(app, membro)
  } catch (err) {
    app.innerHTML = `<p class="erro">Erro: ${err.message}</p>`
  }
}

async function boot() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) mostrarApp()
  else mostrarLogin()
}
registerRoute('/metas', renderGoals)
registerRoute('/parcelamentos', renderInstallments)
registerRoute('/lancamentos', renderTransactions)
boot()