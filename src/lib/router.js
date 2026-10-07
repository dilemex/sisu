const routes = new Map()

export function registerRoute(path, handler) {
  routes.set(path, handler)
}

export function getCurrentRoute() {
  return window.location.hash.slice(1) || '/'
}

export function navigate(path) {
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
      container.innerHTML = `<p class="erro">Erro: ${err.message}</p>`
    }
  }
  window.addEventListener('hashchange', render)
  render()
}