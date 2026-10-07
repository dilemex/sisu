import './style.css'
import { supabase } from './lib/supabase.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <main style="padding:2rem;font-family:system-ui">
    <h1>Sisu</h1>
    <p id="status">Conectando ao Supabase…</p>
  </main>
`

async function checarConexao() {
  const el = document.querySelector('#status')
  const { error } = await supabase.from('_healthcheck').select('*').limit(1)

  // Sucesso: nenhum erro (tabela existe por acaso)
  if (!error) {
    el.textContent = '✅ Conectado ao Supabase'
    return
  }

  // Erros "bons": significam que a conexão chegou no Postgres,
  // só a tabela de teste não existe (é o esperado).
  const errosEsperados = /schema cache|does not exist|relation|not find the table/i
  if (errosEsperados.test(error.message)) {
    el.textContent = '✅ Conectado ao Supabase (schema ainda não criado)'
    return
  }

  // Qualquer outro erro é problema real (auth, URL, rede)
  el.textContent = `❌ Erro: ${error.message}`
}

checarConexao()