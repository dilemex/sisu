import { signOut, getCurrentMember } from '../lib/auth.js'

export async function renderDashboard(root) {
  root.innerHTML = `<main class="app"><p class="carregando">Carregando…</p></main>`

  try {
    const membro = await getCurrentMember()

    if (!membro) {
      root.innerHTML = `
        <main class="app">
          <h1>Ops</h1>
          <p>Você está logado, mas ainda não está vinculado a nenhuma família.</p>
          <button id="sair">Sair</button>
        </main>
      `
      root.querySelector('#sair').onclick = signOut
      return
    }

    root.innerHTML = `
      <main class="app">
        <header class="topo">
          <div>
            <h1>Olá, ${membro.name} 👋</h1>
            <p class="familia">${membro.family.name}</p>
          </div>
          <button id="sair" class="botao-secundario">Sair</button>
        </header>

        <section class="placeholder">
          <h2>Dashboard em construção 🚧</h2>
          <p>Aqui vão aparecer seus saldos, orçamento e alertas.</p>
          <ul class="checklist">
            <li>✅ Autenticação funcionando</li>
            <li>✅ Schema criado</li>
            <li>⏳ Contas e cartões (próximo passo)</li>
            <li>⏳ Lançamentos</li>
            <li>⏳ Dashboard</li>
          </ul>
        </section>
      </main>
    `

    root.querySelector('#sair').onclick = signOut
  } catch (err) {
    root.innerHTML = `<main class="app"><p class="erro">Erro: ${err.message}</p></main>`
  }
}