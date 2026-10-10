import './style.css'
import { supabase } from './lib/supabase.js'
import { getCurrentMember } from './lib/auth.js'
import { setState } from './lib/state.js'
import { registerRoute } from './lib/router.js'
import { generateDueRecurrences } from './lib/db/recurring.js'

import { renderLogin } from './pages/login.js'
import { renderAppShell } from './pages/shell.js'
import { renderDashboard } from './pages/dashboard.js'
import { renderAccounts } from './pages/accounts.js'
import { renderCards } from './pages/cards.js'
import { renderMore } from './pages/more.js'
import { renderTransactions } from './pages/transactions.js'
import { renderTransfers } from './pages/transfers.js'
import { renderGoals } from './pages/goals.js'
import { renderInstallments } from './pages/installments.js'
import { renderRecurring } from './pages/recurring.js'
import { renderPlanning } from './pages/planning.js'
import { renderBudgets } from './pages/budgets.js'
import { renderReports } from './pages/reports.js'
import { renderInsights } from './pages/insights.js'
import { renderSettings } from './pages/settings.js'
import { renderProfile } from './pages/settings-perfil.js'
import { renderCategories } from './pages/settings-categories.js'
import { renderAbout } from './pages/settings-about.js'
import { renderExport } from './pages/settings-export.js'

const app = document.querySelector('#app')

// Evita remontar o shell em cada refresh de token
let membroAtual = null

// ---- Rotas ----
registerRoute('/',                  renderDashboard)
registerRoute('/contas',            renderAccounts)
registerRoute('/cartoes',           renderCards)
registerRoute('/lancamentos',       renderTransactions)
registerRoute('/transferencias',    renderTransfers)
registerRoute('/metas',             renderGoals)
registerRoute('/parcelamentos',     renderInstallments)
registerRoute('/recorrencias',      renderRecurring)
registerRoute('/planejamento',      renderPlanning)
registerRoute('/orcamentos',        renderBudgets)
registerRoute('/relatorios',        renderReports)
registerRoute('/diagnostico',       renderInsights)
registerRoute('/config',            renderSettings)
registerRoute('/config/perfil',     renderProfile)
registerRoute('/config/categorias', renderCategories)
registerRoute('/config/sobre',      renderAbout)
registerRoute('/config/export',     renderExport)
registerRoute('/mais',              renderMore)

// ---- Auth ----
supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    // logout real (ou token expirado)
    membroAtual = null
    mostrarLogin()
  }
  // login e refresh de token são tratados pelo boot() / pela flag membroAtual
})

async function mostrarLogin() {
  app.innerHTML = ''
  renderLogin(app)
}

async function mostrarApp() {
  if (membroAtual) {
    // Shell já está montado — não remonta
    return
  }
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

    membroAtual = membro
    setState({ member: membro, family: membro.family })

    // Gera recorrências em background (não bloqueia a UI)
    generateDueRecurrences(membro.family.id).catch((e) => {
      console.warn('Falha ao gerar recorrências:', e.message)
    })

    app.innerHTML = ''
    renderAppShell(app, membro)
  } catch (err) {
    console.error('[Sisu] erro em mostrarApp:', err)
    app.innerHTML = `<p class="erro">Erro: ${err.message}</p>`
  }
}

async function boot() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) mostrarApp()
  else mostrarLogin()
}

boot()