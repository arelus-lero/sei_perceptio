export type PromptTemplateId =
  | 'conformidade-licitatoria'
  | 'prazos-legais'
  | 'resumo-andamentos'
  | 'cruzamento-anexados'
  | 'lacunas-instrucionais';

export interface ConformidadeLicitatoriaParams {
  nup?: string;
  faseProcedimento?: string;
  aspectos?: string[];
}

export interface PrazosLegaisParams {
  nup?: string;
  dataReferencia?: string;
  tiposPrazo?: string[];
}

export interface ResumoAndamentosParams {
  nup?: string;
  dataInicio?: string;
  dataFim?: string;
  unidades?: string[];
}

export interface CruzamentoAnexadosParams {
  nupPrincipal?: string;
  nupsAnexados?: string[];
  eixoAnalise?: string;
}

export interface LacunasInstrucionaisParams {
  nup?: string;
  checklist?: string[];
  orgaoDemandante?: string;
}

export type PromptTemplateParamsMap = {
  'conformidade-licitatoria': ConformidadeLicitatoriaParams;
  'prazos-legais': PrazosLegaisParams;
  'resumo-andamentos': ResumoAndamentosParams;
  'cruzamento-anexados': CruzamentoAnexadosParams;
  'lacunas-instrucionais': LacunasInstrucionaisParams;
};

export interface PromptTemplate<TId extends PromptTemplateId = PromptTemplateId> {
  id: TId;
  label: string;
  description: string;
  defaultParams: () => PromptTemplateParamsMap[TId];
  buildPrompt: (params: PromptTemplateParamsMap[TId]) => string;
}

function formatList(items: string[] | undefined, fallback: string): string {
  if (!items || items.length === 0) {
    return fallback;
  }
  return items.map((item) => `- ${item}`).join('\n');
}

function formatOptional(value: string | undefined, placeholder: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : placeholder;
}

export const conformidadeLicitatoriaTemplate: PromptTemplate<'conformidade-licitatoria'> =
  {
    id: 'conformidade-licitatoria',
    label: 'Conformidade licitatória (Lei 14.133/2021)',
    description:
      'Analisa aderência do processo à Lei 14.133/2021 com base exclusiva nas fontes do notebook.',
    defaultParams: () => ({
      nup: '',
      faseProcedimento: 'planejamento / preparatória / licitação / contratação direta',
      aspectos: [
        'Estudos técnicos preliminares (ETP) e termo de referência',
        'Pesquisa de preços e estimativa de custos',
        'Habilitação jurídica, fiscal, trabalhista e qualificação técnica',
        'Critérios de julgamento e vedações (art. 14 e seguintes)',
        'Garantias, prazos contratuais e cláusulas essenciais',
      ],
    }),
    buildPrompt: (params) => {
      const nup = formatOptional(params.nup, '[informar NUP ou deixar em branco para inferir]');
      const fase = formatOptional(
        params.faseProcedimento,
        'todas as fases identificáveis nas fontes',
      );

      return `Com base exclusivamente nas fontes disponíveis, realize uma análise de conformidade licitatória do processo ${nup} à Lei nº 14.133/2021, considerando a fase: ${fase}.

Verifique, citando número SEI, tipo documental e unidade geradora:
${formatList(params.aspectos, '- Requisitos aplicáveis identificados nas fontes')}

Para cada item, indique: (1) evidência encontrada; (2) conformidade (conforme / parcial / não conforme / não evidenciado); (3) fundamento normativo citado nas fontes ou lacuna explícita.

Apresente conclusão executiva, divergências entre documentos e recomendações objetivas de complementação instrucional.`;
    },
  };

export const prazosLegaisTemplate: PromptTemplate<'prazos-legais'> = {
  id: 'prazos-legais',
  label: 'Verificação de prazos legais',
  description:
    'Identifica marcos temporais, prazos regulamentares e eventuais vencimentos ou atrasos.',
  defaultParams: () => ({
    nup: '',
    dataReferencia: new Date().toISOString().slice(0, 10),
    tiposPrazo: [
      'Consulta pública e manifestações',
      'Resposta a diligências e complementações',
      'Tramitação entre unidades',
      'Publicação de atos e ciência de interessados',
      'Vigência de contratos, aditivos e prorrogações',
    ],
  }),
  buildPrompt: (params) => {
    const nup = formatOptional(params.nup, '[informar NUP ou inferir das fontes]');
    const referencia = formatOptional(params.dataReferencia, 'data atual');

    return `Analise os prazos legais e administrativos relacionados ao processo ${nup}, usando a data de referência ${referencia}.

Para cada categoria abaixo, extraia das fontes: marco inicial, prazo previsto, data limite, status (em dia / vencido / indeterminado / não evidenciado) e dias decorridos ou restantes:
${formatList(params.tiposPrazo, '- Prazos identificados nos documentos')}

Organize em tabela markdown com colunas: Evento | Documento (Nº SEI) | Início | Limite | Situação | Observação.

Destaque prazos críticos, prorrogações formalizadas e inconsistências entre andamentos e documentos.`;
  },
};

export const resumoAndamentosTemplate: PromptTemplate<'resumo-andamentos'> = {
  id: 'resumo-andamentos',
  label: 'Resumo de andamentos por período',
  description:
    'Sintetiza tramitações, remessas, conclusões e distribuições em um intervalo de datas.',
  defaultParams: () => ({
    nup: '',
    dataInicio: '',
    dataFim: '',
    unidades: [],
  }),
  buildPrompt: (params) => {
    const nup = formatOptional(params.nup, '[informar NUP ou inferir das fontes]');
    const inicio = formatOptional(params.dataInicio, 'início do histórico disponível');
    const fim = formatOptional(params.dataFim, 'último andamento registrado');
    const unidades =
      params.unidades && params.unidades.length > 0
        ? params.unidades.join(', ')
        : 'todas as unidades mencionadas';

    return `Elabore um resumo cronológico dos andamentos do processo ${nup} no período de ${inicio} a ${fim}, limitado às unidades: ${unidades}.

Para cada andamento relevante, informe: data/hora, unidade, tipo (recebimento, remessa, conclusão, distribuição etc.), descrição sintética e documento SEI associado quando houver.

Agrupe por fase processual quando possível e indique mudanças de relatoria, retorno de diligência e encaminhamentos externos.

Conclua com linha do tempo em bullet points e síntese do status atual inferido das fontes.`;
  },
};

export const cruzamentoAnexadosTemplate: PromptTemplate<'cruzamento-anexados'> = {
  id: 'cruzamento-anexados',
  label: 'Cruzamento entre processos anexados',
  description:
    'Compara processo principal e anexados, identificando vínculos, duplicidades e conflitos.',
  defaultParams: () => ({
    nupPrincipal: '',
    nupsAnexados: [],
    eixoAnalise: 'interessados, objeto, prazos e decisões',
  }),
  buildPrompt: (params) => {
    const principal = formatOptional(
      params.nupPrincipal,
      '[informar NUP principal ou inferir das fontes]',
    );
    const anexados =
      params.nupsAnexados && params.nupsAnexados.length > 0
        ? params.nupsAnexados.join(', ')
        : '[listar NUPs anexados identificados nas fontes]';
    const eixo = formatOptional(params.eixoAnalise, 'objeto, partes e cronologia');

    return `Realize cruzamento analítico entre o processo principal ${principal} e os processos anexados: ${anexados}.

Eixo de análise: ${eixo}.

Compare, com citação de fontes:
- Identificação e qualificação dos interessados em comum ou divergentes
- Objeto e escopo de cada processo
- Decisões, despachos e votos que se referenciam mutuamente
- Prazos e marcos temporais sobrepostos ou conflitantes
- Documentos duplicados ou versões distintas do mesmo conteúdo

Apresente matriz de correspondência (Principal × Anexado) e liste riscos de inconsistência instrucional ou decisória.`;
  },
};

export const lacunasInstrucionaisTemplate: PromptTemplate<'lacunas-instrucionais'> = {
  id: 'lacunas-instrucionais',
  label: 'Lacunas instrucionais',
  description:
    'Verifica completude documental e requisitos instrutórios ainda não atendidos.',
  defaultParams: () => ({
    nup: '',
    orgaoDemandante: '',
    checklist: [
      'Documentos de identificação do objeto e justificativa',
      'Estudos técnicos, notas e pareceres exigidos',
      'Manifestação jurídica/controle interno quando aplicável',
      'Comprovação de publicidade e ciência',
      'Anexos referenciados no corpo dos documentos',
    ],
  }),
  buildPrompt: (params) => {
    const nup = formatOptional(params.nup, '[informar NUP ou inferir das fontes]');
    const orgao = formatOptional(
      params.orgaoDemandante,
      'órgão/unidade inferida das fontes',
    );

    return `Identifique lacunas instrucionais no processo ${nup}, considerando o contexto de ${orgao}.

Verifique item a item se há evidência nas fontes ou lacuna:
${formatList(params.checklist, '- Requisitos instrucionais aplicáveis')}

Para cada lacuna, classifique severidade (alta / média / baixa), indique documento ou andamento que sinaliza a exigência e sugira providência objetiva para saneamento.

Liste também referências cruzadas a anexos inexistentes, menções a documentos não localizados nas fontes e inconsistências de numeração SEI.`;
  },
};

export const PROMPT_TEMPLATES = [
  conformidadeLicitatoriaTemplate,
  prazosLegaisTemplate,
  resumoAndamentosTemplate,
  cruzamentoAnexadosTemplate,
  lacunasInstrucionaisTemplate,
] as const;

export const PROMPT_TEMPLATE_IDS = PROMPT_TEMPLATES.map(
  (template) => template.id,
) as PromptTemplateId[];

const templateById = new Map<PromptTemplateId, PromptTemplate<PromptTemplateId>>(
  PROMPT_TEMPLATES.map((template) => [
    template.id,
    template as PromptTemplate<PromptTemplateId>,
  ]),
);

export function getPromptTemplate(id: PromptTemplateId): PromptTemplate | undefined {
  return templateById.get(id);
}

export function isPromptTemplateId(value: string): value is PromptTemplateId {
  return templateById.has(value as PromptTemplateId);
}

export function buildPromptFromTemplate(
  id: PromptTemplateId,
  params?: Partial<PromptTemplateParamsMap[PromptTemplateId]>,
): string {
  const template = getPromptTemplate(id);
  if (!template) {
    throw new Error(`Template de prompt desconhecido: ${id}`);
  }

  const merged = {
    ...template.defaultParams(),
    ...params,
  } as PromptTemplateParamsMap[typeof id];

  return template.buildPrompt(merged);
}

export function listPromptTemplates(): Array<{
  id: PromptTemplateId;
  label: string;
  description: string;
}> {
  return PROMPT_TEMPLATES.map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
}
