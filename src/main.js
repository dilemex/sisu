import './style.css'
import { supabase } from './lib/supabase.js'
import { renderLogin } from './pages/login.js'
import { renderDashboard } from './pages/dashboard.js'

const app = document.querySelector('#app')

// Sempre que o Supabase detectar login/logout, redireciona
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    renderDashboard(app)
  } else {
    renderLogin(app)
  }
})

// Boot inicial: checa se já tem sessão salva
async function boot() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    renderDashboard(app)
  } else {
    renderLogin(app)
  }
}

boot()