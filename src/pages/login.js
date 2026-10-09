import { signIn } from '../lib/auth.js'

export function renderLogin(root) {
  root.innerHTML = `
<main class="tela-login">
  <div class="card">
    <div class="login-logo">
      <img src="${import.meta.env.BASE_URL}logo/logo-verde.png" alt="Sisu" />
    </div>
    <p class="subtitulo">O painel financeiro da sua família</p>

    <form id="login-form">
      <label>
        Email
        <input type="email" name="email" required autocomplete="email" autofocus />
      </label>
      <label>
        Senha
        <input type="password" name="password" required autocomplete="current-password" />
      </label>
      <button type="submit">Entrar</button>
      <p id="erro" class="erro"></p>
    </form>
  </div>
</main>
  `

  const form = root.querySelector('#login-form')
  const erro = root.querySelector('#erro')
  const btn = form.querySelector('button')

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    erro.textContent = ''
    btn.disabled = true
    btn.textContent = 'Entrando…'

    const fd = new FormData(form)
    try {
      await signIn(fd.get('email'), fd.get('password'))
      // onAuthStateChange no main.js vai redirecionar
    } catch (err) {
      erro.textContent = traduzErro(err.message)
      btn.disabled = false
      btn.textContent = 'Entrar'
    }
  })
}

function traduzErro(msg) {
  if (/invalid login credentials/i.test(msg)) return 'Email ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Email ainda não confirmado.'
  if (/failed to fetch/i.test(msg)) return 'Falha de conexão. Verifique sua internet.'
  return msg
}