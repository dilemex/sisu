import { signOut } from '../lib/auth.js'
import { navigate } from '../lib/router.js'

const ITENS = [
  { rota: '/planejamento',  icone: '🧭', titulo: 'Planejamento',  sub: 'Quanto podemos gastar este mês?' },
  { rota: '/relatorios',    icone: '📈', titulo: 'Relatórios',    sub: 'Análises e comparações' },
  { rota: '/diagnostico',   icone: '🔎', titulo: 'Diagnóstico',   sub: 'Insights sobre suas finanças' },
  { rota: '/orcamentos',    icone: '📊', titulo: 'Orçamentos',    sub: 'Limites por categoria' },
  { rota: '/metas',         icone: '🎯', titulo: 'Metas',         sub: 'Objetivos da família' },
  { rota: '/recorrencias',  icone: '🔁', titulo: 'Recorrências',  sub: 'Salário, aluguel, assinaturas' },
  { rota: '/parcelamentos', icone: '🧾', titulo: 'Parcelamentos', sub: 'Compras parceladas em aberto' },
  { rota: '/lancamentos',   icone: '📋', titulo: 'Lançamentos',   sub: 'Histórico completo' },
  { rota: '/contas',        icone: '🏦', titulo: 'Contas',        sub: 'Saldos e cadastro' },
  { rota: '/cartoes',       icone: '💳', titulo: 'Cartões',       sub: 'Faturas e limites' },
  { rota: '/config',        icone: '⚙️', titulo: 'Configurações', sub: 'Perfil, categorias, backup' }
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