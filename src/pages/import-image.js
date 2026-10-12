import { getState } from '../lib/state.js'
import { listCategories } from '../lib/db/categories.js'
import { listAccounts } from '../lib/db/accounts.js'
import { listCards } from '../lib/db/cards.js'
import { listMembers } from '../lib/db/members.js'
import { createTransaction } from '../lib/db/transactions.js'
import { escapeHtml, formatBRL } from '../lib/ui.js'
import { extrairTexto, parseTransacoes } from '../lib/ocr.js'

export async function renderImportImage(root) {
  const { family, member } = getState()

  const [categorias, contas, cartoes, membros] = await Promise.all([
    listCategories(family.id),
    listAccounts(family.id),
    listCards(family.id),
    listMembers(family.id)
  ])

  const categoriasDespesa = categorias.filter((c) => c.type === 'expense')
  const categoriasReceita = categorias.filter((c) => c.type === 'income')

  let candidatos = []
  let status = ''

  function render() {
    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Importar de imagem</h2>
      </div>

      <p class="dica-info">
        Envie um print do extrato do banco ou do cartão. O Sisu tenta ler
        os lançamentos. <strong>Revise sempre antes de salvar</strong> — OCR não é 100% preciso.
      </p>

      <div class="upload-box" id="drop">
        <input type="file" id="file" accept="image/*" hidden />
        <p class="upload-texto">
          <strong>Escolher imagem</strong> ou arrastar aqui
        </p>
        <p class="item-sub" style="text-align:center">PNG, JPG, WEBP · máx. 5MB</p>
      </div>

      ${status ? `<p class="upload-status">${status}</p>` : ''}

      ${candidatos.length > 0 ? `
        <div class="pagina-cabecalho" style="margin-top:1.5rem">
          <h3 style="margin:0;font-size:1rem">Lançamentos encontrados</h3>
          <span class="item-sub">${candidatos.length} itens</span>
        </div>

        <ul class="lista">
          ${candidatos.map((c, i) => linha(i)).join('')}
        </ul>

        <button id="salvar" class="botao-primario bloco-largo">Importar ${candidatos.length} lançamentos</button>
      ` : ''}
    `

    const drop = root.querySelector('#drop')
    const file = root.querySelector('#file')

    drop.onclick = () => file.click()
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('drag') }
    drop.ondragleave = () => drop.classList.remove('drag')
    drop.ondrop = (e) => {
      e.preventDefault()
      drop.classList.remove('drag')
      const f = e.dataTransfer.files[0]
      if (f) processar(f)
    }
    file.onchange = (e) => {
      const f = e.target.files[0]
      if (f) processar(f)
    }

    if (candidatos.length > 0) {
      root.querySelector('#salvar').onclick = salvarTodos

      root.querySelectorAll('[data-rm]').forEach((b) => {
        b.onclick = () => {
          candidatos.splice(Number(b.dataset.rm), 1)
          render()
        }
      })

      root.querySelectorAll('[data-idx]').forEach((el) => {
        const i = Number(el.dataset.idx)
        el.oninput = () => {
          const campo = el.dataset.campo
          if (campo === 'valor') {
            candidatos[i].valor = Number(el.value) || 0
          } else {
            candidatos[i][campo] = el.value
          }
        }
      })
    }
  }

  function linha(i) {
    const c = candidatos[i]
    return `
      <li class="import-item">
        <div class="import-grid">
          <input type="date" class="import-input" data-idx="${i}" data-campo="data" value="${c.data}" />
          <input type="number" step="0.01" class="import-input" data-idx="${i}" data-campo="valor" value="${c.valor}" />
        </div>
        <input type="text" class="import-input" data-idx="${i}" data-campo="descricao"
               value="${escapeHtml(c.descricao)}" placeholder="Descrição" />
        <div class="import-grid">
          <select class="import-input" data-idx="${i}" data-campo="tipo">
            <option value="expense" ${c.tipo === 'expense' ? 'selected' : ''}>Despesa</option>
            <option value="income" ${c.tipo === 'income' ? 'selected' : ''}>Receita</option>
          </select>
          <select class="import-input" data-idx="${i}" data-campo="origem">
            <optgroup label="Contas">
              ${contas.map((a) => `<option value="acc:${a.id}">🏦 ${escapeHtml(a.name)}</option>`).join('')}
            </optgroup>
            <optgroup label="Cartões">
              ${cartoes.map((k) => `<option value="card:${k.id}">💳 ${escapeHtml(k.name)}</option>`).join('')}
            </optgroup>
          </select>
        </div>
        <div class="import-grid">
          <select class="import-input" data-idx="${i}" data-campo="categoria">
            <option value="">— categoria —</option>
            ${categoriasDespesa.map((x) => `
              <option value="${x.id}">${x.icon ? x.icon + ' ' : ''}${escapeHtml(x.name)}</option>
            `).join('')}
          </select>
          <button class="botao-secundario" data-rm="${i}" type="button">Remover</button>
        </div>
      </li>
    `
  }

  async function processar(arquivo) {
    status = 'Lendo imagem… isso pode levar até 30s na primeira vez'
    render()

    try {
      const texto = await extrairTexto(arquivo, (s, p) => {
        status = `OCR: ${s} (${Math.round(p * 100)}%)`
        const el = root.querySelector('.upload-status')
        if (el) el.textContent = status
      })

      const encontrados = parseTransacoes(texto)

      if (encontrados.length === 0) {
        status = 'Não consegui identificar lançamentos. Tente um print mais nítido ou recortado.'
        render()
        return
      }

      candidatos = encontrados
      status = `✅ ${encontrados.length} lançamentos encontrados. Revise e edite abaixo.`
      render()
    } catch (e) {
      console.error('[import] erro OCR:', e)
      status = 'Erro ao processar imagem: ' + e.message
      render()
    }
  }

  async function salvarTodos() {
    if (!confirm(`Importar ${candidatos.length} lançamentos?`)) return

    let salvos = 0
    for (const c of candidatos) {
      try {
        const [tipo, id] = (c.origem || '').split(':')
        const payload = {
          type: c.tipo,
          amount: Number(c.valor),
          date: c.data,
          description: c.descricao?.trim() || null,
          category_id: c.categoria || null,
          account_id: tipo === 'acc' ? id : null,
          credit_card_id: tipo === 'card' ? id : null,
          member_id: member.id,
          notes: null
        }
        if (!payload.amount || payload.amount <= 0) continue
        await createTransaction(family.id, payload)
        salvos++
      } catch (e) {
        console.warn('Falha ao salvar 1 item:', e.message)
      }
    }

    alert(`✅ ${salvos} lançamentos importados.`)
    candidatos = []
    status = ''
    render()
  }

  render()
}