import { getState } from '../lib/state.js'
import { exportAllData, exportTransactionsCSV, baixarArquivo } from '../lib/db/export.js'

export async function renderExport(root) {
  const { family } = getState()

  root.innerHTML = `
    <div class="pagina-cabecalho">
      <h2>Backup e exportação</h2>
    </div>

    <p class="dica-info">
      Seus dados ficam no Supabase, com backup automático. Mas você pode
      exportar quando quiser — é bom ter uma cópia local.
    </p>

    <section class="dash-bloco">
      <h3 style="margin-top:0">Exportar para CSV</h3>
      <p class="item-sub">Planilha com todos os lançamentos, pronta para Excel ou Google Sheets.</p>

      <div class="linha-dupla">
        <label>De
          <input type="date" id="csv-from" />
        </label>
        <label>Até
          <input type="date" id="csv-to" value="${new Date().toISOString().slice(0,10)}" />
        </label>
      </div>

      <button id="csv" class="botao-primario bloco-largo">Baixar CSV</button>
    </section>

    <section class="dash-bloco" style="margin-top:1rem">
      <h3 style="margin-top:0">Backup completo</h3>
      <p class="item-sub">
        Arquivo JSON com tudo: contas, cartões, categorias, lançamentos, metas,
        recorrências, orçamentos. Guarde em local seguro.
      </p>
      <button id="json" class="botao-secundario bloco-largo">Baixar backup (JSON)</button>
    </section>
  `

  root.querySelector('#csv').onclick = async () => {
    const btn = root.querySelector('#csv')
    btn.disabled = true
    btn.textContent = 'Gerando…'
    try {
      const from = root.querySelector('#csv-from').value || undefined
      const to = root.querySelector('#csv-to').value || undefined
      const csv = await exportTransactionsCSV(family.id, { from, to })
      baixarArquivo(csv, `sisu-lancamentos-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv')
    } catch (e) {
      alert('Erro ao gerar CSV: ' + e.message)
    } finally {
      btn.disabled = false
      btn.textContent = 'Baixar CSV'
    }
  }

  root.querySelector('#json').onclick = async () => {
    const btn = root.querySelector('#json')
    btn.disabled = true
    btn.textContent = 'Gerando…'
    try {
      const dados = await exportAllData(family.id)
      baixarArquivo(
        JSON.stringify(dados, null, 2),
        `sisu-backup-${new Date().toISOString().slice(0,10)}.json`,
        'application/json'
      )
    } catch (e) {
      alert('Erro ao gerar backup: ' + e.message)
    } finally {
      btn.disabled = false
      btn.textContent = 'Baixar backup (JSON)'
    }
  }
}