import { type TipoDocumentoSei } from '@/types/classification';

interface CatalogGroup {
  area: string;
  categoria: string;
  subcategoria: string;
  tipos: readonly string[];
}

const SEED_CODIGOS: Readonly<Record<string, string>> = {
  '107': 'Despacho',
  '212': 'Nota Técnica',
  '301': 'Parecer Técnico',
  '420': 'Aviso Consulta Pública',
  '535': 'Prorrogação CP',
  '610': 'Extrato Decisão',
  '711': 'Pauta',
  '812': 'Voto',
};

const GROUPS: readonly CatalogGroup[] = [
  {
    area: 'Administrativo',
    categoria: 'Correspondência Interna',
    subcategoria: 'Comunicações',
    tipos: [
      'Memorando',
      'Comunicação Interna',
      'Circular Interna',
      'Aviso Interno',
      'Comunicado Interno',
      'Informativo Interno',
      'Boletim Interno',
      'Newsletter Interna',
    ],
  },
  {
    area: 'Administrativo',
    categoria: 'Correspondência Externa',
    subcategoria: 'Ofícios e Cartas',
    tipos: [
      'Ofício',
      'Ofício Circular',
      'Carta',
      'Carta Convite',
      'Comunicação Oficial',
      'Notificação',
      'Intimação Administrativa',
      'Convocação',
    ],
  },
  {
    area: 'Administrativo',
    categoria: 'Atos de Gestão',
    subcategoria: 'Despachos e Portarias',
    tipos: [
      'Despacho',
      'Despacho Decisório',
      'Despacho de Encaminhamento',
      'Despacho de Arquivamento',
      'Portaria',
      'Portaria Conjunta',
      'Ordem de Serviço',
      'Instrução Normativa Interna',
    ],
  },
  {
    area: 'Administrativo',
    categoria: 'Solicitações',
    subcategoria: 'Requerimentos',
    tipos: [
      'Requerimento',
      'Solicitação',
      'Pedido',
      'Formulário de Solicitação',
      'Requerimento de Acesso à Informação',
      'Pedido de Reconsideração',
      'Recurso Administrativo',
      'Impugnação',
    ],
  },
  {
    area: 'Administrativo',
    categoria: 'Controle Documental',
    subcategoria: 'Certidões e Termos',
    tipos: [
      'Certidão',
      'Declaração',
      'Atestado',
      'Comprovante de Protocolo',
      'Guia de Remessa',
      'Capa de Processo',
      'Folha de Rosto',
      'Termo de Abertura',
    ],
  },
  {
    area: 'Deliberativo',
    categoria: 'Colegiados',
    subcategoria: 'Reuniões',
    tipos: [
      'Pauta',
      'Ata de Reunião',
      'Ata de Deliberação',
      'Resumo de Reunião',
      'Lista de Presença',
      'Lista de Votação',
      'Voto',
      'Voto em Separado',
      'Declaração de Voto',
    ],
  },
  {
    area: 'Deliberativo',
    categoria: 'Decisões',
    subcategoria: 'Atos Deliberativos',
    tipos: [
      'Resolução',
      'Resolução Administrativa',
      'Deliberação',
      'Decisão',
      'Decisão Liminar',
      'Decisão Colegiada',
      'Extrato Decisão',
      'Acórdão',
    ],
  },
  {
    area: 'Deliberativo',
    categoria: 'Proposições',
    subcategoria: 'Anteprojetos',
    tipos: [
      'Proposta de Deliberação',
      'Proposta de Resolução',
      'Anteprojeto',
      'Projeto de Deliberação',
      'Minuta de Resolução',
      'Parecer de Comissão',
      'Relatório de Comissão',
      'Parecer Preliminar',
    ],
  },
  {
    area: 'Deliberativo',
    categoria: 'Processos Deliberativos',
    subcategoria: 'Tramitação Colegiada',
    tipos: [
      'Certidão de Publicação',
      'Certidão de Intimação',
      'Edital de Convocação',
      'Aviso de Reunião',
      'Convite para Reunião',
      'Nota de Encaminhamento',
      'Informação ao Colegiado',
      'Síntese para Deliberação',
    ],
  },
  {
    area: 'Deliberativo',
    categoria: 'Atas e Registros',
    subcategoria: 'Registros Formais',
    tipos: [
      'Termo de Posse',
      'Termo de Compromisso',
      'Registro de Deliberação',
      'Registro de Votação',
      'Extrato de Ata',
      'Resumo Executivo de Reunião',
      'Quadro Comparativo de Proposições',
      'Planilha de Votação',
    ],
  },
  {
    area: 'Regulatório',
    categoria: 'Normas Regulatórias',
    subcategoria: 'Atos Normativos',
    tipos: [
      'Resolução Normativa',
      'Resolução Homologatória',
      'Resolução Autorizativa',
      'Portaria Regulatória',
      'Portaria de Delegação',
      'Instrução Regulatória',
      'Regulamento Técnico',
      'Norma Regulamentadora',
    ],
  },
  {
    area: 'Regulatório',
    categoria: 'Procedimentos',
    subcategoria: 'Manuais e Roteiros',
    tipos: [
      'Manual de Procedimentos',
      'Manual Regulatório',
      'Procedimento Operacional Padrão',
      'Roteiro de Fiscalização',
      'Guia Regulatório',
      'Diretriz Regulatória',
      'Protocolo Regulatório',
      'Benchmark Regulatório',
    ],
  },
  {
    area: 'Regulatório',
    categoria: 'Tarifas e Preços',
    subcategoria: 'Revisões Tarifárias',
    tipos: [
      'Proposta Tarifária',
      'Revisão Tarifária',
      'Cálculo Tarifário',
      'Planilha Tarifária',
      'Memória de Cálculo Tarifário',
      'Demonstrativo Tarifário',
      'Nota Explicativa Tarifária',
      'Parecer Tarifário',
    ],
  },
  {
    area: 'Regulatório',
    categoria: 'Mercado e Concorrência',
    subcategoria: 'Análises Setoriais',
    tipos: [
      'Relatório de Mercado',
      'Análise de Concorrência',
      'Estudo de Mercado Regulado',
      'Relatório de Barreiras',
      'Monitoramento de Mercado',
      'Indicador de Mercado',
      'Relatório Setorial',
      'Panorama Regulatório',
    ],
  },
  {
    area: 'Regulatório',
    categoria: 'Concessões e Autorizações',
    subcategoria: 'Outorgas',
    tipos: [
      'Outorga de Concessão',
      'Termo de Outorga',
      'Autorização de Funcionamento',
      'Autorização Prévia',
      'Permissão de Uso',
      'Declaração de Utilidade Pública',
      'Homologação Regulatória',
      'Ratificação Regulatória',
    ],
  },
  {
    area: 'Fiscalização',
    categoria: 'Inspeções',
    subcategoria: 'Vistorias',
    tipos: [
      'Relatório de Inspeção',
      'Auto de Inspeção',
      'Termo de Inspeção',
      'Checklist de Inspeção',
      'Registro Fotográfico de Inspeção',
      'Relatório de Vistoria',
      'Termo de Vistoria',
      'Laudo de Vistoria',
    ],
  },
  {
    area: 'Fiscalização',
    categoria: 'Infrações',
    subcategoria: 'Autuações',
    tipos: [
      'Auto de Infração',
      'Notificação de Infração',
      'Termo de Constatação',
      'Relatório de Fiscalização',
      'Despacho de Autuação',
      'Intimação para Defesa',
      'Defesa Prévia',
      'Recurso de Fiscalização',
    ],
  },
  {
    area: 'Fiscalização',
    categoria: 'Monitoramento',
    subcategoria: 'Conformidade',
    tipos: [
      'Relatório de Monitoramento',
      'Planilha de Indicadores de Fiscalização',
      'Relatório de Conformidade',
      'Relatório de Não Conformidade',
      'Parecer de Fiscalização',
      'Nota de Fiscalização',
      'Alerta de Fiscalização',
      'Boletim de Fiscalização',
    ],
  },
  {
    area: 'Fiscalização',
    categoria: 'Sanções',
    subcategoria: 'Penalidades',
    tipos: [
      'Termo de Compromisso de Ajustamento de Conduta',
      'Acordo de Compromisso',
      'Termo de Ajustamento',
      'Multa Administrativa',
      'Notificação de Penalidade',
      'Despacho Sancionador',
      'Decisão Sancionatória',
      'Relatório de Sanção',
    ],
  },
  {
    area: 'Fiscalização',
    categoria: 'Auditoria',
    subcategoria: 'Achados e Recomendações',
    tipos: [
      'Relatório de Auditoria',
      'Plano de Auditoria',
      'Parecer de Auditoria',
      'Achado de Auditoria',
      'Recomendação de Auditoria',
      'Termo de Encerramento de Auditoria',
      'Matriz de Riscos',
      'Plano de Ação Corretiva',
    ],
  },
  {
    area: 'Jurídico',
    categoria: 'Pareceres',
    subcategoria: 'Consultas Jurídicas',
    tipos: [
      'Parecer Jurídico',
      'Parecer Jurídico Conclusivo',
      'Parecer Jurídico Preliminar',
      'Nota Jurídica',
      'Informação Jurídica',
      'Análise Jurídica',
      'Consulta Jurídica',
      'Manifestação Jurídica',
    ],
  },
  {
    area: 'Jurídico',
    categoria: 'Contencioso',
    subcategoria: 'Peças Processuais',
    tipos: [
      'Petição Inicial',
      'Contestação',
      'Réplica',
      'Recurso',
      'Agravo',
      'Embargos',
      'Manifestação Processual',
      'Memoriais',
    ],
  },
  {
    area: 'Jurídico',
    categoria: 'Contratos Jurídicos',
    subcategoria: 'Análise Contratual',
    tipos: [
      'Minuta de Contrato',
      'Aditivo Contratual',
      'Distrato',
      'Termo de Rescisão',
      'Parecer sobre Minuta',
      'Análise de Cláusulas',
      'Certidão Jurídica',
      'Declaração de Conformidade Jurídica',
    ],
  },
  {
    area: 'Jurídico',
    categoria: 'Procuradoria',
    subcategoria: 'Manifestações',
    tipos: [
      'Despacho da Procuradoria',
      'Manifestação da Procuradoria',
      'Nota da Procuradoria',
      'Informação da AGU',
      'Parecer da Procuradoria',
      'Consulta à Procuradoria',
      'Certidão de Tramitação Judicial',
      'Acompanhamento Processual',
    ],
  },
  {
    area: 'Jurídico',
    categoria: 'Compliance',
    subcategoria: 'Conformidade Legal',
    tipos: [
      'Parecer de Compliance',
      'Relatório de Conformidade Legal',
      'Análise de Risco Jurídico',
      'Matriz de Riscos Jurídicos',
      'Política de Compliance',
      'Termo de Responsabilidade',
      'Declaração de Conflito de Interesse',
      'Código de Conduta',
    ],
  },
  {
    area: 'Consulta Pública',
    categoria: 'Abertura',
    subcategoria: 'Publicação',
    tipos: [
      'Aviso Consulta Pública',
      'Edital de Consulta Pública',
      'Documento de Consulta',
      'Texto para Consulta',
      'Apresentação da Consulta',
      'Nota Explicativa da Consulta',
      'Anteprojeto para Consulta',
      'Proposta para Consulta',
    ],
  },
  {
    area: 'Consulta Pública',
    categoria: 'Contribuições',
    subcategoria: 'Manifestações',
    tipos: [
      'Contribuição de Interessado',
      'Manifestação de Contribuinte',
      'Comentário à Consulta',
      'Sugestão de Alteração',
      'Proposta de Emenda',
      'Parecer de Contribuinte',
      'Parecer Institucional',
      'Manifestação do Público',
    ],
  },
  {
    area: 'Consulta Pública',
    categoria: 'Prorrogações',
    subcategoria: 'Retificações',
    tipos: [
      'Prorrogação CP',
      'Ato de Prorrogação de Consulta',
      'Edital de Prorrogação',
      'Retificação de Consulta Pública',
      'Republicação de Consulta',
      'Aditamento à Consulta',
      'Errata de Consulta Pública',
      'Comunicado de Prorrogação',
    ],
  },
  {
    area: 'Consulta Pública',
    categoria: 'Síntese',
    subcategoria: 'Consolidação',
    tipos: [
      'Relatório de Contribuições',
      'Síntese de Contribuições',
      'Análise de Contribuições',
      'Consolidado de Manifestações',
      'Quadro Resumo de Contribuições',
      'Relatório Final de Consulta',
      'Resposta à Consulta',
      'Parecer Pós-Consulta',
    ],
  },
  {
    area: 'Contratações',
    categoria: 'Planejamento',
    subcategoria: 'Demanda',
    tipos: [
      'Termo de Referência',
      'Estudo Técnico Preliminar',
      'Mapa de Riscos de Contratação',
      'Documento de Formalização de Demanda',
      'DFD',
      'Análise de Viabilidade',
      'Justificativa de Contratação',
      'Estimativa de Preços',
    ],
  },
  {
    area: 'Contratações',
    categoria: 'Licitação',
    subcategoria: 'Editais',
    tipos: [
      'Edital',
      'Edital de Pregão',
      'Edital de Concorrência',
      'Aviso de Licitação',
      'Termo de Referência de Licitação',
      'Projeto Básico',
      'Anteprojeto de Licitação',
      'Minuta de Edital',
    ],
  },
  {
    area: 'Contratações',
    categoria: 'Contratos',
    subcategoria: 'Instrumentos',
    tipos: [
      'Contrato',
      'Termo de Contrato',
      'Contrato Administrativo',
      'Termo Aditivo',
      'Apostilamento',
      'Nota de Empenho',
      'Termo de Recebimento',
      'Termo de Aceite',
    ],
  },
  {
    area: 'Contratações',
    categoria: 'Gestão Contratual',
    subcategoria: 'Execução',
    tipos: [
      'Relatório de Execução Contratual',
      'Medição de Serviços',
      'Atesto de Execução',
      'Fatura',
      'Nota Fiscal',
      'Relatório de Fiscalização de Contrato',
      'Parecer de Aprovação de Pagamento',
      'Termo de Encerramento de Contrato',
    ],
  },
  {
    area: 'Técnico',
    categoria: 'Estudos',
    subcategoria: 'Análises Técnicas',
    tipos: [
      'Nota Técnica',
      'Parecer Técnico',
      'Estudo Técnico',
      'Relatório Técnico',
      'Laudo Técnico',
      'Análise Técnica',
      'Avaliação Técnica',
      'Parecer de Engenharia',
    ],
  },
  {
    area: 'Técnico',
    categoria: 'Engenharia',
    subcategoria: 'Projetos',
    tipos: [
      'Projeto Executivo',
      'Projeto Básico de Engenharia',
      'Memorial Descritivo',
      'Especificação Técnica',
      'Planta Técnica',
      'Diagrama Técnico',
      'Desenho Técnico',
      'Croqui Técnico',
    ],
  },
  {
    area: 'Técnico',
    categoria: 'Ambiental',
    subcategoria: 'Licenciamento',
    tipos: [
      'Estudo de Impacto Ambiental',
      'Relatório Ambiental',
      'Parecer Ambiental',
      'Licença Ambiental',
      'Termo de Referência Ambiental',
      'Plano de Controle Ambiental',
      'Monitoramento Ambiental',
      'Certificado Ambiental',
    ],
  },
  {
    area: 'Técnico',
    categoria: 'Econômico-Financeiro',
    subcategoria: 'Viabilidade',
    tipos: [
      'Estudo Econômico-Financeiro',
      'Análise de Viabilidade Econômica',
      'Demonstrativo Financeiro',
      'Planilha de Custos',
      'Orçamento Estimado',
      'Memorial de Cálculo',
      'Análise de Sensibilidade',
      'Projeção Financeira',
    ],
  },
  {
    area: 'Técnico',
    categoria: 'Telecomunicações e Energia',
    subcategoria: 'Setor Elétrico',
    tipos: [
      'Plano de Outorga',
      'Relatório de Qualidade de Serviço',
      'Indicador Técnico de Desempenho',
      'Relatório de Interrupções',
      'Plano de Expansão',
      'Estudo de Demanda Energética',
      'Relatório de Perdas',
      'Balanço Energético',
    ],
  },
  {
    area: 'Externo',
    categoria: 'Interinstitucional',
    subcategoria: 'Cooperação',
    tipos: [
      'Ofício Externo Recebido',
      'Ofício Externo Enviado',
      'Comunicação Interinstitucional',
      'Convênio',
      'Termo de Cooperação',
      'Acordo Interinstitucional',
      'Protocolo de Intenções',
      'Carta de Intenções',
    ],
  },
  {
    area: 'Externo',
    categoria: 'Órgãos de Controle',
    subcategoria: 'Fiscalização Externa',
    tipos: [
      'Manifestação do TCU',
      'Relatório do CGU',
      'Ofício da AGU',
      'Comunicação do MPF',
      'Parecer do TCU',
      'Determinação do TCU',
      'Recomendação do TCU',
      'Relatório de Tomada de Contas',
    ],
  },
  {
    area: 'Externo',
    categoria: 'Entidades Reguladas',
    subcategoria: 'Agentes Regulados',
    tipos: [
      'Documento de Concessionária',
      'Petição de Concessionária',
      'Manifestação de Agente Regulado',
      'Relatório de Concessionária',
      'Plano de Investimentos',
      'Proposta de Concessionária',
      'Requerimento de Concessionária',
      'Comunicação de Agente',
    ],
  },
  {
    area: 'Externo',
    categoria: 'Sociedade Civil',
    subcategoria: 'Participação Social',
    tipos: [
      'Manifestação de Associação',
      'Petição de Entidade',
      'Representação de Usuário',
      'Reclamação de Consumidor',
      'Sugestão de Stakeholder',
      'Carta de Entidade',
      'Documento de OSC',
      'Contribuição de Sociedade Civil',
    ],
  },
  {
    area: 'Arquivo',
    categoria: 'Gestão Documental',
    subcategoria: 'Classificação',
    tipos: [
      'Plano de Classificação',
      'Tabela de Temporalidade',
      'Guia de Arquivamento',
      'Termo de Guarda',
      'Termo de Custódia',
      'Inventário Documental',
      'Listagem de Acervo',
      'Catálogo Documental',
    ],
  },
  {
    area: 'Arquivo',
    categoria: 'Eliminação',
    subcategoria: 'Destinação',
    tipos: [
      'Termo de Eliminação',
      'Listagem de Eliminação',
      'Edital de Eliminação',
      'Ato de Eliminação',
      'Certidão de Eliminação',
      'Autorização de Eliminação',
      'Relatório de Eliminação',
      'Comprovante de Destinação',
    ],
  },
  {
    area: 'Arquivo',
    categoria: 'Digitalização',
    subcategoria: 'Conversão',
    tipos: [
      'Termo de Digitalização',
      'Relatório de Digitalização',
      'Metadados de Digitalização',
      'Certificado de Digitalização',
      'Plano de Digitalização',
      'Controle de Qualidade de Imagem',
      'Log de Digitalização',
      'Hash de Integridade',
    ],
  },
  {
    area: 'Arquivo',
    categoria: 'Preservação',
    subcategoria: 'Conservação',
    tipos: [
      'Relatório de Preservação',
      'Plano de Preservação',
      'Termo de Restauração',
      'Laudo de Conservação',
      'Relatório de Desastre',
      'Plano de Contingência Arquivística',
      'Backup Documental',
      'Certificação de Autenticidade',
    ],
  },
];

function buildCatalog(): readonly TipoDocumentoSei[] {
  const descricaoToCodigo = new Map<string, string>(
    Object.entries(SEED_CODIGOS).map(([codigo, descricao]) => [descricao, codigo]),
  );
  const usedCodes = new Set<string>(Object.keys(SEED_CODIGOS));
  let nextCode = 100;

  const allocateCodigo = (): string => {
    while (usedCodes.has(String(nextCode))) {
      nextCode += 1;
    }
    const codigo = String(nextCode);
    usedCodes.add(codigo);
    nextCode += 1;
    return codigo;
  };

  const entries: TipoDocumentoSei[] = [];

  for (const group of GROUPS) {
    for (const descricao of group.tipos) {
      const codigo = descricaoToCodigo.get(descricao) ?? allocateCodigo();
      if (!descricaoToCodigo.has(descricao)) {
        descricaoToCodigo.set(descricao, codigo);
      }

      entries.push({
        codigo,
        descricao,
        area: group.area,
        categoria: group.categoria,
        subcategoria: group.subcategoria,
      });
    }
  }

  return entries.sort((a, b) => Number(a.codigo) - Number(b.codigo));
}

export const TIPO_DOCUMENTO_SEI_CATALOG: readonly TipoDocumentoSei[] = buildCatalog();

const catalogByCodigo = new Map<string, TipoDocumentoSei>(
  TIPO_DOCUMENTO_SEI_CATALOG.map((entry) => [entry.codigo, entry]),
);

export function getTipoDocumentoByCodigo(codigo: string): TipoDocumentoSei | undefined {
  return catalogByCodigo.get(codigo);
}

export function getTipoDocumentoCatalogSummary(): { total: number; areas: string[] } {
  const areas = [...new Set(TIPO_DOCUMENTO_SEI_CATALOG.map((entry) => entry.area))].sort();
  return {
    total: TIPO_DOCUMENTO_SEI_CATALOG.length,
    areas,
  };
}
