import { createWorker } from 'tesseract.js'

/**
 * Roda OCR na imagem e devolve o texto bruto reconhecido.
 * onProgress recebe { status, progress } (0..1).
 */
export async function extrairTexto(imageFile, onProgress) {
  const worker = await createWorker('por+eng', 1, {
    logger: (m) => {
      if (onProgress && typeof m.progress === 'number') {
        onProgress(m.status, m.progress)
      }
    }
  })
  try {
    const { data: { text } } = await worker.recognize(imageFile)
    return text
  } finally {
    await worker.terminate()
  }
}

/**
 * Tenta extrair transações do texto reconhecido.
 * Heurística simples: procura linhas que tenham DATA e VALOR.
 * Retorna array de candidatos: { data, valor, descricao, tipo }.
 */
export function parseTransacoes(texto) {
  const linhas = texto
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const candidatos = []
  const ano = new Date().getFullYear()

  // Padrões
  const reData = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/
  const reValor = /(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})/g

  for (const linha of linhas) {
    const mData = linha.match(reData)
    if (!mData) continue

    const valores = [...linha.matchAll(reValor)].map((m) => m[1])
    if (valores.length === 0) continue

    const dia = mData[1].padStart(2, '0')
    const mes = mData[2].padStart(2, '0')
    const anoTxt = mData[3]
    let anoFinal = ano
    if (anoTxt) {
      anoFinal = anoTxt.length === 2 ? `20${anoTxt}` : anoTxt
    }

    // Valor: pega o maior (geralmente é o da transação, não o saldo)
    const valorStr = valores[valores.length - 1]
    const valorNum = Number(valorStr.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(valorNum) || valorNum === 0) continue

    // Heurística pra sinal: se a linha tem "-" antes do valor, é despesa
    const isNeg = /-\s*R?\$?\s*\d/.test(linha)

    // Descrição: tira data, valores e deixa o resto
    let descricao = linha
      .replace(reData, '')
      .replace(reValor, '')
      .replace(/R\$\s*/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '')
      .trim()

    if (descricao.length > 80) descricao = descricao.slice(0, 80).trim()

    candidatos.push({
      data: `${anoFinal}-${mes}-${dia}`,
      valor: Math.abs(valorNum),
      descricao: descricao || 'Lançamento importado',
      tipo: isNeg ? 'expense' : (valorNum > 0 && !isNeg ? 'expense' : 'expense')
    })
  }

  return candidatos
}