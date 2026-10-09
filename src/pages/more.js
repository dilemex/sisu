import { signOut } from '../lib/auth.js'
import { navigate } from '../lib/router.js'

const ITENS = [
  { rota: '/metas',          icone: '🎯', titulo: 'Metas',          sub: 'Objetivos da família' },
  { rota: '/parcelamentos',  icone: '🧾', titulo: 'Parcelamentos',  sub: 'Compras parceladas em aberto' },
  { rota: '/lancamentos',    icone: '📋', titulo: 'Lançamentos',    sub: 'Histórico completo' },
  { rota: '/contas',         icone: '🏦', titulo: 'Contas',         sub: 'Saldos e cadastro' },
  { rota: '/cartoes',        icone: '💳', titulo: 'Cartões',        sub: 'Faturas e limites' }
]

export async function renderMore(root) {
  root.innerHTML = `
    <div class="pagina-cabecalho">
      <h2>Mais</h2>
    </div>
    <ul class="lista">
      ${ITENS.map((i) => `
        <li class="item item-clicavel" data-rota="${i.rota}">
          <div class="item-icone">${i.icone}</div>
          <div class="item-info">
            <div class="item-titulo">${i.titulo}</div>
            <div class="item-sub">${i.sub}</div>
          </div>
          <div class="item-seta">›</div>
        </li>
      `).join('')}
    </ul>
    <button id="sair2" class="botao-secundario bloco-largo">Sair</button>
  `

  root.querySelectorAll('[data-rota]').forEach((el) => {
    el.onclick = () => navigate(el.dataset.rota)
  })
  root.querySelector('#sair2').onclick = signOut
}