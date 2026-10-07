let modalEl = null

export function openModal({ title, content, onSubmit, submitLabel = 'Salvar' }) {
  closeModal()

  modalEl = document.createElement('div')
  modalEl.className = 'modal-overlay'
  modalEl.innerHTML = `
    <div class="modal">
      <header class="modal-header">
        <h3>${title}</h3>
        <button type="button" class="modal-fechar" aria-label="Fechar">✕</button>
      </header>
      <form class="modal-form">
        <div class="modal-corpo">${content}</div>
        <footer class="modal-rodape">
          <button type="button" class="botao-secundario" data-fechar>Cancelar</button>
          <button type="submit" class="botao-primario">${submitLabel}</button>
        </footer>
      </form>
    </div>
  `
  document.body.appendChild(modalEl)

  const fechar = () => closeModal()
  modalEl.querySelector('.modal-fechar').onclick = fechar
  modalEl.querySelector('[data-fechar]').onclick = fechar
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) fechar()
  })

  const form = modalEl.querySelector('form')
  form.onsubmit = async (e) => {
    e.preventDefault()
    const btn = form.querySelector('button[type="submit"]')
    btn.disabled = true
    btn.textContent = 'Salvando…'
    try {
      await onSubmit(readForm(form))
      fechar()
    } catch (err) {
      alert(err.message)
      btn.disabled = false
      btn.textContent = submitLabel
    }
  }

  setTimeout(() => modalEl?.querySelector('input, select, textarea')?.focus(), 50)
}

export function closeModal() {
  if (modalEl) {
    modalEl.remove()
    modalEl = null
  }
}

export function readForm(form) {
  const obj = {}
  for (const [k, v] of new FormData(form).entries()) {
    obj[k] = v
  }
  return obj
}

export function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(v) || 0)
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  )
}