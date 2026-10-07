import { signOut } from '../lib/auth.js'

export async function renderMore(root) {
  root.innerHTML = `
    <div class="pagina-cabecalho">
      <h2>Mais</h2>
    </div>
    <ul class="lista">
      <li class="item"><div class="item-info"><div class="item-titulo">Categorias</div><div class="item-sub">Em breve</div></div></li>
      <li class="item"><div class="item-info"><div class="item-titulo">Metas</div><div class="item-sub">Em breve</div></div></li>
      <li class="item"><div class="item-info"><div class="item-titulo">Orçamentos</div><div class="item-sub">Em breve</div></div></li>
      <li class="item"><div class="item-info"><div class="item-titulo">Relatórios</div><div class="item-sub">Em breve</div></div></li>
    </ul>
    <button id="sair2" class="botao-secundario bloco-largo">Sair</button>
  `
  root.querySelector('#sair2').onclick = signOut
}