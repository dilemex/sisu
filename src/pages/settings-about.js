export async function renderAbout(root) {
    root.innerHTML = `
      <div class="pagina-cabecalho">
        <h2>Sobre o Sisu</h2>
      </div>
  
      <div class="cartao-info">
        <h3 style="margin-top:0">Sisu · v0.1.0</h3>
        <p>Painel de comando financeiro da família. Feito para responder a uma pergunta simples:</p>
        <p><em>"Como está nossa situação financeira e o que podemos fazer agora sem comprometer nossos objetivos?"</em></p>
        <hr style="border:none;border-top:1px solid var(--borda);margin:1rem 0">
        <p class="dica-info" style="margin:0">
          <strong>Backup:</strong> em breve você poderá exportar seus dados em CSV e JSON.
          Por enquanto, o backup é feito automaticamente pelo Supabase.
        </p>
      </div>
    `
  }