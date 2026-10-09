import { signOut } from '../lib/auth.js'
import { navigate } from '../lib/router.js'
import { Icons } from '../lib/icons.js'

const ITENS = [
  { rota: '/planejamento',  ic: 'compass',    titulo: 'Planejamento',  sub: 'Quanto podemos gastar este mês?' },
  { rota: '/relatorios',    ic: 'chartLine',  titulo: 'Relatórios',    sub: 'Análises e comparações' },
  { rota: '/diagnostico',   ic: 'search',     titulo: 'Diagnóstico',   sub: 'Insights sobre suas finanças' },
  { rota: '/orcamentos',    ic: 'chartBar',   titulo: 'Orçamentos',    sub: 'Limites por categoria' },
  { rota: '/metas',         ic: 'target',     titulo: 'Metas',         sub: 'Objetivos da família' },
  { rota: '/recorrencias',  ic: 'repeat',     titulo: 'Recorrências',  sub: 'Salário, aluguel, assinaturas' },
  { rota: '/parcelamentos', ic: 'receipt',    titulo: 'Parcelamentos', sub: 'Compras parceladas em aberto' },
  { rota: '/lancamentos',   ic: 'list',       titulo: 'Lançamentos',   sub: 'Histórico completo' },
  { rota: '/contas',        ic: 'bank',       titulo: 'Contas',        sub: 'Saldos e cadastro' },
  { rota: '/cartoes',       ic: 'creditCard', titulo: 'Cartões',       sub: 'Faturas e limites' },
  { rota: '/config',        ic: 'settings',   titulo: 'Configurações', sub: 'Perfil, categorias, backup' }
]

export async function renderMore(root) {
  root.innerHTML = `
    <div class="pagina-cabecalho">
      <h2>Mais</h2>
    </div>
    <ul class="lista">
      ${ITENS.map((i) => `
        <li class="item item-clicavel" data-rota="${i.rota}">
          <div class="item-icone">${Icons[i.ic] ?? ''}</div>
          <div class="item-info">
            <div class="item-titulo">${i.titulo}</div>
            <div class="item-sub">${i.sub}</div>
          </div>
          <div class="item-seta">${Icons.chevronRight}</div>
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