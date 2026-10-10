const routes = new Map()
let initialized = false

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

export function startRouter(container) {
  async function render() {
    const route = getCurrentRoute()
    const handler = routes.get(route) || routes.get('/')
    container.innerHTML = ''
    try {
      await handler(container)
    } catch (err) {
      console.error('[Sisu] erro ao renderizar', route, err)
      container.innerHTML = `<p class="erro">Erro em ${route}: ${err.message}</p>`
    }
  }

  // ⚠️ Só registra o listener UMA vez na vida do app
  if (!initialized) {
    window.addEventListener('hashchange', render)
    initialized = true
  }
  render()
}