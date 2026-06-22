import { addDays, format } from 'date-fns';

function formatDateBr(date: Date): string {
  return format(date, 'dd/MM/yyyy');
}

function formatDateExtenso(date: Date): string {
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: undefined });
}

export function buildDespacho(params: {
  nup: string;
  unidade: string;
  data: Date;
  sequencial: number;
}): string {
  return [
    `DESPACHO Nº ${params.sequencial}/${params.data.getFullYear()}`,
    '',
    `Processo: ${params.nup}`,
    `Unidade: ${params.unidade}`,
    '',
    'Encaminho os autos à unidade competente para manifestação técnica,',
    'com prazo de 10 (dez) dias úteis, nos termos da Resolução Normativa ANEEL.',
    '',
    `Brasília, ${formatDateExtenso(params.data)}.`,
  ].join('\n');
}

export function buildNotaTecnica(params: {
  nup: string;
  unidade: string;
  tema: string;
}): string {
  return [
    'NOTA TÉCNICA',
    '',
    `Processo: ${params.nup}`,
    `Unidade Geradora: ${params.unidade}`,
    '',
    `Assunto: ${params.tema}`,
    '',
    '1. OBJETO',
    'Análise técnica dos documentos encaminhados no processo em referência,',
    'com foco em conformidade regulatória e impactos tarifários.',
    '',
    '2. CONCLUSÃO',
    'Recomenda-se o encaminhamento à Diretoria Colegiada para deliberação.',
  ].join('\n');
}

export function buildAvisoConsultaPublica(params: {
  nup: string;
  dataAbertura: Date;
  dataEncerramento: Date;
}): string {
  return [
    'AVISO DE CONSULTA PÚBLICA',
    '',
    `Processo: ${params.nup}`,
    '',
    `Abertura: ${formatDateBr(params.dataAbertura)} (${formatDateExtenso(params.dataAbertura)})`,
    `Encerramento: ${formatDateBr(params.dataEncerramento)} (${formatDateExtenso(params.dataEncerramento)})`,
    '',
    'A ANEEL torna pública consulta para recebimento de contribuições da sociedade',
    'sobre a proposta regulatória vinculada ao processo em epígrafe.',
  ].join('\n');
}

export function buildAvisoProrrogacao(params: {
  nup: string;
  dataEncerramentoNova: Date;
}): string {
  return [
    'AVISO DE PRORROGAÇÃO DA CONSULTA PÚBLICA (Código 535)',
    '',
    `Processo: ${params.nup}`,
    '',
    `Fica prorrogado o prazo de encerramento da consulta pública até ${formatDateBr(params.dataEncerramentoNova)},`,
    `equivalente a ${formatDateExtenso(params.dataEncerramentoNova)}.`,
  ].join('\n');
}

export function buildExtratoDeliberacao(params: {
  nup: string;
  relatorNome: string;
  acao: string;
  quorum: 'unanimidade' | 'maioria';
}): string {
  return [
    'EXTRATO DA DECISÃO DA DIRETORIA',
    '',
    `Processo: ${params.nup}`,
    `Diretor-Relator: ${params.relatorNome}`,
    '',
    `A Diretoria Colegiada decidiu, por ${params.quorum}, ${params.acao}.`,
    '',
    'A decisão integra a íntegra dos autos do processo.',
  ].join('\n');
}

export function buildVotoRelator(params: {
  nup: string;
  relatorNome: string;
  sessao: string;
}): string {
  return [
    'VOTO DO DIRETOR-RELATOR',
    '',
    `Processo: ${params.nup}`,
    `Sessão: ${params.sessao}`,
    `Relator: ${params.relatorNome}`,
    '',
    'Voto no sentido de acolher a proposta da Superintendência de Fiscalização',
    'Técnica dos Serviços de Energia Elétrica (SFT).',
  ].join('\n');
}

export function buildPautaReuniao(params: {
  nup: string;
  sessao: string;
  data: Date;
}): string {
  return [
    'PAUTA DE REUNIÃO DA DIRETORIA COLEGIADA',
    '',
    `Sessão ${params.sessao} — ${formatDateBr(params.data)}`,
    '',
    `Item: Deliberar sobre o processo ${params.nup}.`,
  ].join('\n');
}

export function buildDatasConsultaPublica(dataGeracao: Date): {
  dataAbertura: Date;
  dataEncerramentoOriginal: Date;
  prorrogacoes: Date[];
} {
  const dataAbertura = addDays(dataGeracao, 15);
  const dataEncerramentoOriginal = addDays(dataAbertura, 30);
  const prorrogacoes = [
    addDays(dataEncerramentoOriginal, 15),
    addDays(dataEncerramentoOriginal, 30),
    addDays(dataEncerramentoOriginal, 45),
  ];

  return {
    dataAbertura,
    dataEncerramentoOriginal,
    prorrogacoes,
  };
}

export function maxDateIso(dates: Date[]): string {
  const maxTime = Math.max(...dates.map((date) => date.getTime()));
  return format(new Date(maxTime), 'yyyy-MM-dd');
}

export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function addDaysToIso(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T12:00:00.000Z`);
  return toIsoDate(addDays(base, days));
}
