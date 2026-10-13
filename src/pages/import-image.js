import { getState } from '../lib/state.js'
import { listCategories } from '../lib/db/categories.js'
import { listAccounts } from '../lib/db/accounts.js'
import { listCards } from '../lib/db/cards.js'
import { listMembers } from '../lib/db/members.js'
import { createTransaction, createSingleInstallment } from '../lib/db/transactions.js'
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

  let candidatos = []
  let status = ''
  let textoBruto = ''

  function render() {
    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Importar de imagem</h2>
      </div>

      <p class="dica-info">
        Envie um print do extrato do banco ou do cartão. O Sisu tenta ler
        os lançamentos. <strong>Revise sempre antes de salvar</strong> — OCR não é 100% preciso.
      </p>

      ${textoBruto ? `
        <details class="texto-bruto">
          <summary>Ver texto bruto do OCR</summary>
          <pre>${escapeHtml(textoBruto)}</pre>
        </details>
      ` : ''}

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

        <div class="bulk-bar">
          <div class="bulk-titulo">Aplicar a todos os ${candidatos.length} itens</div>
          <div class="bulk-grid">
            <select id="bulk-origem" class="import-input">
              <optgroup label="Contas">
                ${contas.map((a) => `<option value="acc:${a.id}">🏦 ${escapeHtml(a.name)}</option>`).join('')}
              </optgroup>
              <optgroup label="Cartões">
                ${cartoes.map((k) => `<option value="card:${k.id}">💳 ${escapeHtml(k.name)}</option>`).join('')}
              </optgroup>
            </select>
            <select id="bulk-categoria" class="import-input">
              <option value="">— categoria (opcional) —</option>
              ${categoriasDespesa.map((x) => `
                <option value="${x.id}">${x.icon ? x.icon + ' ' : ''}${escapeHtml(x.name)}</option>
              `).join('')}
            </select>
          </div>
          <button id="bulk-aplicar" type="button" class="botao-primario bloco-largo">
            Aplicar aos ${candidatos.length} itens
          </button>
        </div>

        <ul class="lista" style="margin-top:1rem">
          ${candidatos.map((_, i) => linha(i)).join('')}
        </ul>

        <button id="salvar" class="botao-primario bloco-largo">Importar ${candidatos.length} lançamentos</button>
      ` : ''}
    `

    // Upload
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

    if (candidatos.length === 0) return

    // Bulk apply
    root.querySelector('#bulk-aplicar').onclick = () => {
      const origem = root.querySelector('#bulk-origem').value
      const cat = root.querySelector('#bulk-categoria').value
      candidatos.forEach((c) => {
        c.origem = origem
        if (cat) c.categoria = cat
      })
      render()
    }

    // Salvar
    root.querySelector('#salvar').onclick = salvarTodos

    // Remover item
    root.querySelectorAll('[data-rm]').forEach((b) => {
      b.onclick = () => {
        candidatos.splice(Number(b.dataset.rm), 1)
        render()
      }
    })

    // Edições item-por-item
    root.querySelectorAll('[data-idx]').forEach((el) => {
      const handler = () => {
        const i = Number(el.dataset.idx)
        const campo = el.dataset.campo
        if (campo === 'valor') {
          candidatos[i].valor = Number(el.value) || 0
        } else {
          candidatos[i][campo] = el.value
        }
      }
      el.oninput = handler
      el.onchange = handler
    })
  }

  function linha(i) {
    const c = candidatos[i]
    const temParcela = c.parcela_atual != null && c.parcela_total != null
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
          <div class="parcela-inline">
            <input type="number" min="1" max="99" class="import-input parcela-campo"
                   placeholder="Parc."
                   data-idx="${i}" data-campo="parcela_atual"
                   value="${c.parcela_atual ?? ''}" />
            <span class="parcela-de">de</span>
            <input type="number" min="2" max="99" class="import-input parcela-campo"
                   placeholder="Total"
                   data-idx="${i}" data-campo="parcela_total"
                   value="${c.parcela_total ?? ''}" />
          </div>
        </div>

        <div class="import-grid">
          <select class="import-input" data-idx="${i}" data-campo="origem">
            <optgroup label="Contas">
              ${contas.map((a) => `
                <option value="acc:${a.id}" ${c.origem === 'acc:' + a.id ? 'selected' : ''}>🏦 ${escapeHtml(a.name)}</option>
              `).join('')}
            </optgroup>
            <optgroup label="Cartões">
              ${cartoes.map((k) => `
                <option value="card:${k.id}" ${c.origem === 'card:' + k.id ? 'selected' : ''}>💳 ${escapeHtml(k.name)}</option>
              `).join('')}
            </optgroup>
          </select>
          <select class="import-input" data-idx="${i}" data-campo="categoria">
            <option value="">— categoria —</option>
            ${categoriasDespesa.map((x) => `
              <option value="${x.id}" ${c.categoria === x.id ? 'selected' : ''}>${x.icon ? x.icon + ' ' : ''}${escapeHtml(x.name)}</option>
            `).join('')}
          </select>
        </div>
        <button class="botao-secundario" data-rm="${i}" type="button">Remover</button>
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
      textoBruto = texto

      const encontrados = parseTransacoes(texto)

      if (encontrados.length === 0) {
        status = 'Não consegui identificar lançamentos. Tente um print mais nítido ou recortado.'
        render()
        return
      }

      // Default da origem: 1ª conta (se houver) ou 1º cartão
      const origemDefault = contas.length > 0
        ? `acc:${contas[0].id}`
        : (cartoes.length > 0 ? `card:${cartoes[0].id}` : '')

      candidatos = encontrados.map((c) => ({
        ...c,
        origem: origemDefault,
        categoria: ''
      }))

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

    const itens = []
    root.querySelectorAll('.import-item').forEach((card) => {
      const get = (campo) => {
        const el = card.querySelector(`[data-campo="${campo}"]`)
        return el ? el.value : ''
      }
      itens.push({
        data: get('data'),
        valor: Number(get('valor')) || 0,
        descricao: get('descricao'),
        tipo: get('tipo') || 'expense',
        origem: get('origem'),
        categoria: get('categoria'),
        parcela_atual: get('parcela_atual') ? Number(get('parcela_atual')) : null,
        parcela_total: get('parcela_total') ? Number(get('parcela_total')) : null
      })
    })

    let salvos = 0
    let parcelasSalvas = 0
    const erros = []

    for (const it of itens) {
      try {
        const [tipo, id] = (it.origem || '').split(':')
        if (!tipo || !id) throw new Error('Origem não definida')
        if (!it.valor || it.valor <= 0) throw new Error('Valor inválido')

        const payload = {
          type: it.tipo,
          amount: it.valor,
          date: it.data,
          description: it.descricao?.trim() || null,
          category_id: it.categoria || null,
          account_id: tipo === 'acc' ? id : null,
          credit_card_id: tipo === 'card' ? id : null,
          member_id: member.id,
          notes: null
        }

        // Se tem parcela válida, salva como parcela real
        const isParcela = it.parcela_atual && it.parcela_total &&
                          it.parcela_atual >= 1 && it.parcela_total >= 2 &&
                          it.parcela_atual <= it.parcela_total

        if (isParcela) {
          await createSingleInstallment(family.id, payload, {
            parcelaAtual: it.parcela_atual,
            parcelaTotal: it.parcela_total
          })
          parcelasSalvas++
        } else {
          await createTransaction(family.id, payload)
        }
        salvos++
      } catch (e) {
        erros.push(`${it.descricao || 'item'}: ${e.message}`)
      }
    }

    let msg = `✅ ${salvos} lançamentos importados.`
    if (parcelasSalvas > 0) msg += `\n📆 ${parcelasSalvas} marcados como parcela.`
    if (erros.length > 0) {
      msg += `\n\n⚠️ ${erros.length} falharam:\n${erros.slice(0, 3).join('\n')}`
      if (erros.length > 3) msg += `\n…e mais ${erros.length - 3}`
    }
    alert(msg)

    if (salvos > 0) {
      candidatos = []
      status = ''
      textoBruto = ''
    }
    render()
  }

  render()
}