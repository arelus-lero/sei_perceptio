export type SeiTermKey =
  | 'nup'
  | 'processo'
  | 'tramitacao'
  | 'andamento'
  | 'remessa'
  | 'unidade'
  | 'anexacao'
  | 'desanexacao'
  | 'distribuicao'
  | 'relatoria'
  | 'diretor_relator'
  | 'consulta_publica'
  | 'documento'
  | 'numero_sei'
  | 'sigilo'
  | 'monitoramento'
  | 'notebook'
  | 'fonte'
  | 'citacao'
  | 'sei'
  | 'prazo'
  | 'conclusao'
  | 'resultado_deliberativo';

export type SeiGlossaryCategory =
  | 'processo'
  | 'tramitacao'
  | 'colegiado'
  | 'participacao'
  | 'documento'
  | 'plataforma';

export interface SeiGlossaryEntry {
  term: string;
  shortLabel?: string;
  definition: string;
  category: SeiGlossaryCategory;
}

export const SEI_GLOSSARY_CATEGORY_LABELS: Record<SeiGlossaryCategory, string> = {
  processo: 'Processo e identificação',
  tramitacao: 'Tramitação e andamentos',
  colegiado: 'Colegiado e relatoria',
  participacao: 'Participação e consultas',
  documento: 'Documentos',
  plataforma: 'SEI-Perceptio',
};

export const SEI_GLOSSARY: Record<SeiTermKey, SeiGlossaryEntry> = {
  nup: {
    term: 'NUP',
    shortLabel: 'NUP',
    definition:
      'Número Único de Processo: identificador nacional no formato AAAAA.NNNNNN/AAAA-DD, com dígitos verificadores. No contexto ANEEL, o prefixo costuma ser 48500.',
    category: 'processo',
  },
  processo: {
    term: 'Processo',
    definition:
      'Conjunto de documentos e andamentos administrativos tratados como uma unidade no SEI, identificado por um NUP e tramitando entre unidades.',
    category: 'processo',
  },
  tramitacao: {
    term: 'Tramitação',
    definition:
      'Movimentação do processo entre unidades ou fases, registrada por andamentos como remessas, recebimentos, conclusões e distribuições.',
    category: 'tramitacao',
  },
  andamento: {
    term: 'Andamento',
    definition:
      'Registro cronológico de evento no processo (ex.: remessa, conclusão, anexação), com data, unidade e descrição.',
    category: 'tramitacao',
  },
  remessa: {
    term: 'Remessa',
    definition:
      'Andamento que encaminha o processo de uma unidade para outra, alterando a unidade de localização atual.',
    category: 'tramitacao',
  },
  unidade: {
    term: 'Unidade',
    definition:
      'Setor ou área organizacional responsável pelo processo em determinado momento (ex.: STD, SFT, gabinete).',
    category: 'tramitacao',
  },
  anexacao: {
    term: 'Anexação',
    definition:
      'Vinculação de um processo filho ao processo principal, mantendo históricos separados mas agrupados para análise conjunta.',
    category: 'tramitacao',
  },
  desanexacao: {
    term: 'Desanexação',
    definition:
      'Desfazimento da vinculação entre processo filho e principal, registrado com data e, quando aplicável, chamado de suporte.',
    category: 'tramitacao',
  },
  distribuicao: {
    term: 'Distribuição',
    definition:
      'Designação de responsável ou relatoria sobre o processo em colegiado, frequentemente registrada por sorteio ou pauta.',
    category: 'colegiado',
  },
  relatoria: {
    term: 'Relatoria',
    definition:
      'Responsabilidade de análise e proposição de decisão atribuída a um diretor-relator em processos da Diretoria Colegiada.',
    category: 'colegiado',
  },
  diretor_relator: {
    term: 'Diretor-relator',
    definition:
      'Membro da Diretoria Colegiada designado para relatar o processo, elaborar voto e conduzir a deliberação.',
    category: 'colegiado',
  },
  resultado_deliberativo: {
    term: 'Resultado deliberativo',
    definition:
      'Decisão colegiada extraída de extratos e atas (ex.: aprovação, arquivamento), registrada textualmente nos autos.',
    category: 'colegiado',
  },
  consulta_publica: {
    term: 'Consulta pública',
    definition:
      'Período formal de participação da sociedade sobre proposta regulatória, com abertura, manifestações e encerramento (possivelmente prorrogado).',
    category: 'participacao',
  },
  documento: {
    term: 'Documento',
    definition:
      'Peça formal indexada no processo SEI (despacho, parecer, extrato etc.), identificada por número SEI e tipo documental.',
    category: 'documento',
  },
  numero_sei: {
    term: 'Número SEI',
    shortLabel: 'Nº SEI',
    definition:
      'Identificador único de cada documento dentro do SEI, usado para citação e rastreabilidade nas respostas do chat.',
    category: 'documento',
  },
  sigilo: {
    term: 'Sigilo',
    definition:
      'Restrição de acesso a processos ou documentos sensíveis. No SEI-Perceptio, processos sigilosos são bloqueados na ingestão e consulta.',
    category: 'processo',
  },
  conclusao: {
    term: 'Conclusão',
    definition:
      'Andamento que encerra a análise em uma unidade e pode encaminhar o processo para decisão, arquivamento ou outra instância.',
    category: 'tramitacao',
  },
  prazo: {
    term: 'Prazo',
    definition:
      'Data limite para manifestação, resposta ou encerramento de fase (ex.: consulta pública, diligência, resposta a ofício).',
    category: 'participacao',
  },
  monitoramento: {
    term: 'Monitoramento',
    definition:
      'Acompanhamento automático de processos cadastrados pelo usuário, com alertas sobre andamentos, status, prazos e anexações.',
    category: 'plataforma',
  },
  notebook: {
    term: 'Notebook',
    definition:
      'Espaço temático que agrupa fontes documentais e conversas de IA sobre um assunto, isolado de outros notebooks do órgão.',
    category: 'plataforma',
  },
  fonte: {
    term: 'Fonte',
    definition:
      'Documento ou conteúdo ingerido no notebook (upload, URL ou seed), chunkado e indexado para consultas RAG.',
    category: 'plataforma',
  },
  citacao: {
    term: 'Citação',
    definition:
      'Referência rastreável na resposta da IA ao trecho de origem (número SEI, tipo, unidade e score de relevância).',
    category: 'plataforma',
  },
  sei: {
    term: 'SEI',
    definition:
      'Sistema Eletrônico de Informações: plataforma federal de processos e documentos administrativos. O SEI-Perceptio analisa dados estruturados compatíveis com o SEI.',
    category: 'plataforma',
  },
};

export const SEI_GLOSSARY_KEYS = Object.keys(SEI_GLOSSARY) as SeiTermKey[];

export function getSeiGlossaryEntry(key: SeiTermKey): SeiGlossaryEntry {
  return SEI_GLOSSARY[key];
}

export function getSeiGlossaryByCategory(): Array<{
  category: SeiGlossaryCategory;
  label: string;
  entries: Array<{ key: SeiTermKey; entry: SeiGlossaryEntry }>;
}> {
  const grouped = new Map<SeiGlossaryCategory, Array<{ key: SeiTermKey; entry: SeiGlossaryEntry }>>();

  for (const key of SEI_GLOSSARY_KEYS) {
    const entry = SEI_GLOSSARY[key];
    const list = grouped.get(entry.category) ?? [];
    list.push({ key, entry });
    grouped.set(entry.category, list);
  }

  return (Object.keys(SEI_GLOSSARY_CATEGORY_LABELS) as SeiGlossaryCategory[]).map(
    (category) => ({
      category,
      label: SEI_GLOSSARY_CATEGORY_LABELS[category],
      entries: grouped.get(category) ?? [],
    }),
  );
}
