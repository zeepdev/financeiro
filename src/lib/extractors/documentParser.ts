import * as XLSX from 'xlsx';
import { toCents } from '@/lib/finance/cents';

export interface ExtractedTransaction {
  id: string;
  data: string; // YYYY-MM-DD
  descricao: string;
  valorCentavos: number;
  tipo: 'receita' | 'despesa';
  categoriaSugerida?: string;
  favorecido?: string;
  instituicao?: string;
  documentoRef?: string;
  confianca?: number; // 0 a 100
}

export interface ParseResult {
  sucesso: boolean;
  tipoArquivo: 'excel' | 'pdf' | 'imagem' | 'csv' | 'desconhecido';
  nomeArquivo: string;
  tamanhoBytes: number;
  transacoes: ExtractedTransaction[];
  textoBruto?: string;
  metadata?: {
    totalItens: number;
    totalCentavos: number;
    pagadorOuFavorecido?: string;
    chavePix?: string;
    banco?: string;
    codigoAutenticacao?: string;
  };
  erro?: string;
}

// Utilitário para limpar e extrair valor em centavos de texto em BRL
export function extrairValorCentavos(texto: string): number {
  if (!texto) return 0;

  // Procura padrões como R$ 1.250,50 ou 1.250,50 ou -150,00 ou 150.00
  const limpo = texto.replace(/[^\d,\.\-]/g, '').trim();
  if (!limpo) return 0;

  let valorNormalizado = limpo;

  // Formato brasileiro com vírgula decimal (ex: 1.250,50)
  if (limpo.includes(',')) {
    valorNormalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if ((limpo.match(/\./g) || []).length > 1) {
    // Caso com múltiplos pontos (ex: 1.000.000)
    valorNormalizado = limpo.replace(/\.(?=.*\.)/g, '');
  }

  const num = parseFloat(valorNormalizado);
  if (isNaN(num)) return 0;

  return Math.round(Math.abs(num) * 100);
}

// Normaliza datas em pt-BR (DD/MM/YYYY ou DD/MM) para YYYY-MM-DD
export function normalizarData(textoData: string): string {
  const hoje = new Date().toISOString().split('T')[0];
  if (!textoData) return hoje;

  // Formato DD/MM/YYYY
  const matchCompleto = textoData.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (matchCompleto) {
    let dia = matchCompleto[1].padStart(2, '0');
    let mes = matchCompleto[2].padStart(2, '0');
    let ano = matchCompleto[3];
    if (ano.length === 2) ano = `20${ano}`;
    return `${ano}-${mes}-${dia}`;
  }

  // Formato DD de Mês de YYYY
  const meses: Record<string, string> = {
    jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
    jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
    janeiro: '01', fevereiro: '02', março: '03', marco: '03', abril: '04',
    maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09',
    outubro: '10', novembro: '11', dezembro: '12'
  };

  const regexMesExtenso = /(\d{1,2})\s+de\s+([a-zA-Zçã]+)(?:\s+de\s+(\d{4}))?/i;
  const matchExtenso = textoData.match(regexMesExtenso);
  if (matchExtenso) {
    const dia = matchExtenso[1].padStart(2, '0');
    const mesNome = matchExtenso[2].toLowerCase();
    const mes = meses[mesNome] || '01';
    const ano = matchExtenso[3] || new Date().getFullYear().toString();
    return `${ano}-${mes}-${dia}`;
  }

  return hoje;
}

// 1. PARSER DE EXCEL E CSV (.xlsx, .xls, .csv)
export async function parseExcelOrCsv(file: File): Promise<ParseResult> {
  try {
    const dataBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(dataBuffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Converte para matriz de objetos
    const rows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '', header: 1 });
    if (!rows || rows.length < 2) {
      return {
        sucesso: false,
        tipoArquivo: file.name.endsWith('.csv') ? 'csv' : 'excel',
        nomeArquivo: file.name,
        tamanhoBytes: file.size,
        transacoes: [],
        erro: 'Arquivo vazio ou sem cabeçalho válido.',
      };
    }

    // Identificar colunas do cabeçalho
    const headerRow = (rows[0] as any[]).map((col) => String(col).toLowerCase().trim());
    let colData = -1;
    let colDescricao = -1;
    let colValor = -1;
    let colTipo = -1;
    let colCategoria = -1;

    headerRow.forEach((h, idx) => {
      if (h.includes('data') || h.includes('dt') || h.includes('date') || h.includes('periodo')) {
        if (colData === -1) colData = idx;
      } else if (h.includes('desc') || h.includes('historico') || h.includes('nome') || h.includes('memo') || h.includes('detalhe')) {
        if (colDescricao === -1) colDescricao = idx;
      } else if (h.includes('valor') || h.includes('quantia') || h.includes('amount') || h.includes('total') || h.includes('saldo')) {
        if (colValor === -1) colValor = idx;
      } else if (h.includes('tipo') || h.includes('d/c') || h.includes('natureza')) {
        if (colTipo === -1) colTipo = idx;
      } else if (h.includes('cat') || h.includes('grupo') || h.includes('classific')) {
        if (colCategoria === -1) colCategoria = idx;
      }
    });

    // Fallbacks inteligentes se não encontrou nomes exatos
    if (colData === -1) colData = 0;
    if (colDescricao === -1) colDescricao = headerRow.length > 1 ? 1 : 0;
    if (colValor === -1) colValor = headerRow.length > 2 ? 2 : headerRow.length - 1;

    const transacoes: ExtractedTransaction[] = [];
    let totalCentavos = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as any[];
      if (!row || row.length === 0 || row.every((c) => c === '')) continue;

      const rawData = row[colData];
      const rawDesc = String(row[colDescricao] || 'Lançamento').trim();
      const rawValor = String(row[colValor] || '');
      const rawTipo = colTipo !== -1 ? String(row[colTipo] || '').toLowerCase() : '';
      const rawCat = colCategoria !== -1 ? String(row[colCategoria] || '') : undefined;

      if (!rawValor && !rawDesc) continue;

      let valorCent = extrairValorCentavos(rawValor);
      if (valorCent === 0 && isNaN(Number(rawValor))) continue;

      let tipo: 'receita' | 'despesa' = 'despesa';

      // Inferência do tipo por sinal ou texto
      if (rawValor.includes('-') || rawTipo.includes('deb') || rawTipo.includes('d') || rawTipo.includes('saida') || rawTipo.includes('despesa')) {
        tipo = 'despesa';
      } else if (rawTipo.includes('cred') || rawTipo.includes('c') || rawTipo.includes('entrada') || rawTipo.includes('receita')) {
        tipo = 'receita';
      } else {
        // Por palavras-chave na descrição
        const descUpper = rawDesc.toUpperCase();
        if (descUpper.includes('RECEB') || descUpper.includes('DEPOSITO') || descUpper.includes('SALARIO') || descUpper.includes('VENDA')) {
          tipo = 'receita';
        } else {
          tipo = 'despesa';
        }
      }

      // Normalização da data
      let dataFormatada = new Date().toISOString().split('T')[0];
      if (rawData instanceof Date) {
        dataFormatada = rawData.toISOString().split('T')[0];
      } else if (typeof rawData === 'string') {
        dataFormatada = normalizarData(rawData);
      } else if (typeof rawData === 'number') {
        // Data serial do Excel
        const excelDate = new Date((rawData - (25567 + 2)) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) {
          dataFormatada = excelDate.toISOString().split('T')[0];
        }
      }

      transacoes.push({
        id: `row_${i}_${Date.now()}`,
        data: dataFormatada,
        descricao: rawDesc || 'Importação Planilha',
        valorCentavos: valorCent,
        tipo,
        categoriaSugerida: rawCat,
        confianca: 95,
      });

      totalCentavos += valorCent;
    }

    return {
      sucesso: true,
      tipoArquivo: file.name.endsWith('.csv') ? 'csv' : 'excel',
      nomeArquivo: file.name,
      tamanhoBytes: file.size,
      transacoes,
      metadata: {
        totalItens: transacoes.length,
        totalCentavos,
      },
    };
  } catch (err: any) {
    return {
      sucesso: false,
      tipoArquivo: 'excel',
      nomeArquivo: file.name,
      tamanhoBytes: file.size,
      transacoes: [],
      erro: err.message || 'Falha ao processar arquivo de planilha.',
    };
  }
}

// 2. PARSER DE PDF (Extratos, Faturas, Recibos)
export async function parsePdf(file: File): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Carrega pdfjs dinamicamente no client
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;
    }

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    // Processar o texto com inteligência financeira brasileira
    return processFinancialText(fullText, 'pdf', file.name, file.size);
  } catch (err: any) {
    return {
      sucesso: false,
      tipoArquivo: 'pdf',
      nomeArquivo: file.name,
      tamanhoBytes: file.size,
      transacoes: [],
      erro: err.message || 'Não foi possível extrair o texto deste PDF.',
    };
  }
}

// 3. PARSER DE IMAGENS & PRINTS (OCR com Tesseract.js)
export async function parseImageOcr(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<ParseResult> {
  try {
    const { createWorker } = await import('tesseract.js');
    onProgress?.(10, 'Iniciando motor de OCR...');

    const worker = await createWorker('por');
    onProgress?.(30, 'Lendo caracteres e comprovante...');

    const ret = await worker.recognize(file);
    const text = ret.data.text;
    onProgress?.(80, 'Interpretando comprovante financeiro...');

    await worker.terminate();
    onProgress?.(100, 'Processamento concluído!');

    return processFinancialText(text, 'imagem', file.name, file.size);
  } catch (err: any) {
    return {
      sucesso: false,
      tipoArquivo: 'imagem',
      nomeArquivo: file.name,
      tamanhoBytes: file.size,
      transacoes: [],
      erro: err.message || 'Falha ao realizar OCR da imagem.',
    };
  }
}

// 4. MOTOR DE HEURÍSTICA E RECONHECIMENTO DE COMPROVANTES BRASILEIROS
export function processFinancialText(
  texto: string,
  tipoArquivo: 'pdf' | 'imagem',
  nomeArquivo: string,
  tamanhoBytes: number
): ParseResult {
  const transacoes: ExtractedTransaction[] = [];
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let pagadorOuFavorecido = '';
  let chavePix = '';
  let banco = '';
  let codigoAutenticacao = '';
  let dataDetectada = '';
  let valorPrincipalCentavos = 0;
  let tipoDetectado: 'receita' | 'despesa' = 'despesa';

  const textoUpper = texto.toUpperCase();

  // Detecta Banco / Fintech
  const bancosConhecidos = [
    'NUBANK', 'BANCO INTER', 'INTER', 'ITAU', 'ITAÚ', 'BRADESCO', 'SANTANDER',
    'BANCO DO BRASIL', 'CAIXA ECONOMICA', 'CAIXA ECONÔMICA', 'C6 BANK', 'MERCADO PAGO',
    'STONE', 'PAGBANK', 'PAGSEGURO', 'PICPAY', 'CORA', 'BTG PACTUAL', 'SICREDI', 'SICOOB'
  ];

  for (const b of bancosConhecidos) {
    if (textoUpper.includes(b)) {
      banco = b;
      break;
    }
  }

  // Detecta se é PIX enviado ou recebido
  if (
    textoUpper.includes('TRANSFERÊNCIA RECEBIDA') ||
    textoUpper.includes('PIX RECEBIDO') ||
    textoUpper.includes('RECEBEMOS SEU PIX') ||
    textoUpper.includes('VOCÊ RECEBEU')
  ) {
    tipoDetectado = 'receita';
  } else if (
    textoUpper.includes('COMPROVANTE DE TRANSFERÊNCIA') ||
    textoUpper.includes('PIX ENVIADO') ||
    textoUpper.includes('PAGAMENTO REALIZADO') ||
    textoUpper.includes('COMPROVANTE DE PAGAMENTO') ||
    textoUpper.includes('BOLETO PAGO') ||
    textoUpper.includes('COMPRA CARTÃO')
  ) {
    tipoDetectado = 'despesa';
  }

  // Procura Beneficiário / Favorecido / Destinatário
  const regexFavorecido = /(?:para|benefici[aá]rio|favorecido|destinat[aá]rio|nome|pago a)\s*[:\-]?\s*([A-Za-zÀ-ÖØ-öø-ÿ0-9\.\s]{3,40})/i;
  const matchFavorecido = texto.match(regexFavorecido);
  if (matchFavorecido && matchFavorecido[1]) {
    pagadorOuFavorecido = matchFavorecido[1].trim();
  }

  // Procura Chave PIX
  const regexPix = /(?:chave\s*pix|chave)\s*[:\-]?\s*([^\s\n\r]{4,50})/i;
  const matchPix = texto.match(regexPix);
  if (matchPix && matchPix[1]) {
    chavePix = matchPix[1].trim();
  }

  // Procura Código de Autenticação
  const regexAutenticacao = /(?:autentica[cç][aã]o|controle|transa[cç][aã]o|id\s*da\s*transa[cç][aã]o)\s*[:\-]?\s*([a-zA-Z0-9\.\-]+)/i;
  const matchAut = texto.match(regexAutenticacao);
  if (matchAut && matchAut[1]) {
    codigoAutenticacao = matchAut[1].trim();
  }

  // Procura Data
  const regexData = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
  const matchData = texto.match(regexData);
  if (matchData) {
    dataDetectada = normalizarData(matchData[1]);
  } else {
    dataDetectada = normalizarData(texto);
  }

  // Procura Valores (R$)
  // Procura padrões como "Valor: R$ 150,00" ou "R$ 1.500,00" ou "Total: 89,90"
  const regexValores = /(?:R\$\s*|VALOR\s*(?:TOTAL|PAGO)?\s*[:\-]?\s*R?\$\s*)([0-9]{1,3}(?:\.[0-9]{3})*\,[0-9]{2}|[0-9]+\,[0-9]{2})/gi;
  let matchVal;
  const valoresEncontrados: number[] = [];

  while ((matchVal = regexValores.exec(texto)) !== null) {
    const v = extrairValorCentavos(matchVal[1]);
    if (v > 0) {
      valoresEncontrados.push(v);
    }
  }

  // Se for um print de comprovante único (típico de PIX ou Recibo)
  if (tipoArquivo === 'imagem' || valoresEncontrados.length <= 3) {
    // Pega o maior valor encontrado que represente o total da transação
    valorPrincipalCentavos = valoresEncontrados.length > 0 ? Math.max(...valoresEncontrados) : 0;

    let descFinal = '';
    if (pagadorOuFavorecido) {
      descFinal = `${tipoDetectado === 'receita' ? 'Recebido de' : 'Pagamento para'} ${pagadorOuFavorecido}`;
    } else if (banco) {
      descFinal = `Comprovante ${banco}`;
    } else {
      descFinal = `Lançamento via ${tipoArquivo.toUpperCase()}`;
    }

    if (valorPrincipalCentavos > 0) {
      transacoes.push({
        id: `extracted_single_${Date.now()}`,
        data: dataDetectada,
        descricao: descFinal,
        valorCentavos: valorPrincipalCentavos,
        tipo: tipoDetectado,
        favorecido: pagadorOuFavorecido,
        instituicao: banco,
        confianca: pagadorOuFavorecido && valorPrincipalCentavos > 0 ? 95 : 80,
      });
    }
  } else {
    // Se for extrato com várias linhas (ex: PDF de extrato com múltiplos lançamentos)
    // Varre linha por linha procurando padrão [DATA] [DESCRICAO] [VALOR]
    const regexLinhaExtrato = /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+([+-]?\s*R?\$?\s*[\d\.]+,\d{2})\s*([DC+-])?/i;

    linhas.forEach((linha, idx) => {
      const matchLinha = linha.match(regexLinhaExtrato);
      if (matchLinha) {
        const dt = normalizarData(matchLinha[1]);
        const desc = matchLinha[2].trim();
        const vRaw = matchLinha[3];
        const dc = matchLinha[4] || '';

        const vCent = extrairValorCentavos(vRaw);
        if (vCent > 0) {
          let tipoLinha: 'receita' | 'despesa' = 'despesa';
          if (vRaw.includes('+') || dc.toUpperCase() === 'C' || desc.toUpperCase().includes('CRED')) {
            tipoLinha = 'receita';
          }

          transacoes.push({
            id: `line_${idx}_${Date.now()}`,
            data: dt,
            descricao: desc,
            valorCentavos: vCent,
            tipo: tipoLinha,
            instituicao: banco,
            confianca: 90,
          });
        }
      }
    });

    // Se a busca por linha não achou nada, mas achamos valores no texto, usa o resumo
    if (transacoes.length === 0 && valoresEncontrados.length > 0) {
      valorPrincipalCentavos = Math.max(...valoresEncontrados);
      transacoes.push({
        id: `extracted_summary_${Date.now()}`,
        data: dataDetectada,
        descricao: pagadorOuFavorecido ? `Pagamento ${pagadorOuFavorecido}` : `Documento ${nomeArquivo}`,
        valorCentavos: valorPrincipalCentavos,
        tipo: tipoDetectado,
        favorecido: pagadorOuFavorecido,
        instituicao: banco,
        confianca: 75,
      });
    }
  }

  const totalCentavos = transacoes.reduce((acc, t) => acc + t.valorCentavos, 0);

  return {
    sucesso: transacoes.length > 0,
    tipoArquivo,
    nomeArquivo,
    tamanhoBytes,
    transacoes,
    textoBruto: texto,
    metadata: {
      totalItens: transacoes.length,
      totalCentavos,
      pagadorOuFavorecido,
      chavePix,
      banco,
      codigoAutenticacao,
    },
  };
}
