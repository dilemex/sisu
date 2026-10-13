import { createWorker } from 'tesseract.js'

/**
 * Pré-processa a imagem: escala 2x, converte pra preto-e-branco,
 * inverte se estiver em modo escuro, e aplica threshold.
 */
async function preprocessImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = 2 // upscale ajuda muito o Tesseract
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
  
        // Detecta se é modo escuro (média de brilho baixa)
        let soma = 0
        const amostras = Math.min(data.length / 4, 5000)
        for (let i = 0; i < amostras; i++) {
          const idx = i * 4
          soma += (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        }
        const isDark = (soma / amostras) < 128
  
        for (let i = 0; i < data.length; i += 4) {
          let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          if (isDark) gray = 255 - gray
          // Threshold: > 140 vira branco puro, < vira cinza escuro
          gray = gray > 140 ? 255 : Math.max(0, gray * 0.3)
          data[i] = data[i + 1] = data[i + 2] = gray
        }
  
        ctx.putImageData(imageData, 0, 0)
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha no processamento')), 'image/png')
      }
      img.onerror = () => reject(new Error('Imagem inválida'))
      img.src = URL.createObjectURL(file)
    })
  }

/**
 * Roda OCR na imagem e devolve o texto bruto reconhecido.
 * onProgress recebe { status, progress } (0..1).
 */
export async function extrairTexto(imageFile, onProgress) {
    // 1. Pré-processa
    const processed = await preprocessImage(imageFile)
  
    // 2. Cria worker
    const worker = await createWorker('por+eng', 1, {
      logger: (m) => {
        if (onProgress && typeof m.progress === 'number') {
          onProgress(m.status, m.progress)
        }
      }
    })
  
    try {
      // 3. PSM 6 = assume bloco uniforme de texto (bom pra extratos)
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1'
      })
      const { data: { text } } = await worker.recognize(processed)
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

  const reData = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/
  const reValor = /(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})/g
  // Parcela: "1 de 2", "1/2", "1/02", "(1/2)" — exige contexto
  const reParcela = /(?:\(|\s|^)(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})(?:\)|\s|$)/i

  for (const linha of linhas) {
    const mData = linha.match(reData)
    if (!mData) continue
    if (/-\s*R?\$?\s*\d/.test(linha)) continue

    const valores = [...linha.matchAll(reValor)].map((m) => m[1])
    if (valores.length === 0) continue

    const dia = mData[1].padStart(2, '0')
    const mes = mData[2].padStart(2, '0')
    const anoTxt = mData[3]
    const anoFinal = anoTxt
      ? (anoTxt.length === 2 ? `20${anoTxt}` : anoTxt)
      : String(ano)

    const valorStr = valores[valores.length - 1]
    const valorNum = Number(valorStr.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(valorNum) || valorNum === 0) continue

    // ⭐ Remove a data (e o valor) da linha ANTES de buscar parcela
    const linhaSemData = linha.replace(reData, '  ').replace(reValor, '  ')
    const mParcela = linhaSemData.match(reParcela)

    let parcelaAtual = null
    let parcelaTotal = null
    if (mParcela) {
      const a = Number(mParcela[1])
      const b = Number(mParcela[2])
      if (a >= 1 && b >= 2 && a <= b) {
        parcelaAtual = a
        parcelaTotal = b
      }
    }

    let descricao = linha
      .replace(reData, '')
      .replace(reValor, '')
      .replace(reParcela, ' ')
      .replace(/R\$\s*/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '')
      .trim()

    if (descricao.length > 80) descricao = descricao.slice(0, 80).trim()

    candidatos.push({
      data: `${anoFinal}-${mes}-${dia}`,
      valor: Math.abs(valorNum),
      descricao: descricao || 'Lançamento importado',
      tipo: 'expense',
      parcela_atual: parcelaAtual,
      parcela_total: parcelaTotal
    })
  }

  return candidatos
}