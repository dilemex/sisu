export async function renderDashboard(root) {
  root.innerHTML = `
    <section class="cartao-info">
      <h2>Painel em construção 🚧</h2>
      <p>Aqui vão aparecer saldos, orçamento, alertas e evolução das metas.</p>
      <ul class="checklist">
        <li>✅ Autenticação</li>
        <li>✅ Schema + RLS</li>
        <li>✅ Contas e cartões</li>
        <li>⏳ Lançamentos</li>
        <li>⏳ Dashboard real</li>
        <li>⏳ Planejamento e metas</li>
      </ul>
    </section>
  `
}