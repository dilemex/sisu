const routes = new Map()
let initialized = false
let renderToken = 0   // identifica o render atual

export function registerRoute(path, handler) {
  routes.set(path, handler)
}

export function getCurrentRoute() {
  return window.location.hash.slice(1) || '/'
}

export function navigate(path) {
  if (getCurrentRoute() === path) return
  window.location.hash = path
}

export async function render() {
  const token = ++renderToken        // este render ganha um token único
  const route = getCurrentRoute()
  const handler = routes.get(route) || routes.get('/')

  const target = document.querySelector('#main')
  if (!target) return

  target.innerHTML = ''

  try {
    await handler(target)
    // Se outra navegação começou depois desta, ignora o resultado
    if (token !== renderToken) return
  } catch (err) {
    if (token !== renderToken) return
    console.error('[Sisu] erro ao renderizar', route, err)
    target.innerHTML = `<p class="erro">Erro em ${route}: ${err.message}</p>`
  }
}

export function startRouter() {
  if (!initialized) {
    window.addEventListener('hashchange', () => {
      // Cancela qualquer render em vôo
      renderToken++
      // Pequeno delay pra consolidar cliques rápidos
      setTimeout(render, 0)
    })
    initialized = true
  }
  render()
}