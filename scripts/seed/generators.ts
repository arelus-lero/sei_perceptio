import { addDays, addHours } from 'date-fns';

import type {
  AndamentoTipo,
  ProcessoStatus,
} from '../../src/lib/db/schema';
import { extrairResultadoDeliberativo, gerarNup, validarNup } from '../../src/lib/utils/nup';
import {
  ANDAMENTO_TIPOS_ROTATIVOS,
  RELATORES_SEED,
  SHOWCASE_SCENARIOS,
  TIPOS_DOCUMENTO,
  TIPOS_PROCESSO,
  UNIDADES_ANEEL,
  type SeedScenario,
  type SeedScenarioConfig,
} from './constants';
import {
  buildAvisoConsultaPublica,
  buildAvisoProrrogacao,
  buildDatasConsultaPublica,
  buildDespacho,
  buildExtratoDeliberacao,
  buildNotaTecnica,
  buildPautaReuniao,
  buildVotoRelator,
  maxDateIso,
  toIsoDate,
} from './content-templates';
import { seedUuid } from './deterministic-id';

export interface SeedProcessPlan {
  index: number;
  nup: string;
  id: string;
  config: SeedScenarioConfig;
  tipoProcesso: (typeof TIPOS_PROCESSO)[number];
  unidadeGeradora: string;
  dataGeracao: string;
  dataInclusao: string;
}

export interface SeedDocumentPlan {
  id: string;
  processoId: string;
  nup: string;
  numeroSei: string;
  tipoDocumentoCodigo: string;
  tipoDocumentoDesc: string;
  unidadeGeradora: string;
  dataDocumento: string;
  dataInclusao: string;
  conteudoTexto: string;
}

export interface SeedAndamentoPlan {
  id: string;
  processoId: string;
  nup: string;
  dataHora: string;
  unidade: string;
  tipo: AndamentoTipo;
  descricao: string;
  processoReferenciadoId?: string;
  relatorId?: string;
  sessaoDistribuicao?: string;
  resultadoDeliberativo?: string;
}

export interface SeedConsultaPublicaPlan {
  id: string;
  processoId: string;
  nup: string;
  dataAbertura: string;
  dataEncerramentoOriginal: string;
  dataEncerramentoEfetiva: string;
  statusInferido: 'em_andamento' | 'encerrada';
  prorrogacoes: Array<{
    id: string;
    documentoSeiId: string;
    dataEncerramentoNova: string;
  }>;
}

export interface SeedAnexacaoPlan {
  id: string;
  processoPaiId: string;
  processoFilhoId: string;
  dataAnexacao: string;
}

export interface SeedGenerationResult {
  processos: SeedProcessPlan[];
  documentos: SeedDocumentPlan[];
  andamentos: SeedAndamentoPlan[];
  consultasPublicas: SeedConsultaPublicaPlan[];
  anexacoes: SeedAnexacaoPlan[];
}

function resolveScenarioConfig(index: number): SeedScenarioConfig {
  if (index <= SHOWCASE_SCENARIOS.length) {
    return SHOWCASE_SCENARIOS[index - 1]!;
  }

  const mod = index % 10;
  if (mod === 8 || mod === 9 || mod === 0) {
    const paiIndex = mod === 0 ? index - 3 : index - (mod - 7);
    return {
      scenario: 'anexado_filho',
      status: 'em_tramitacao',
      documentCount: 8,
      andamentoCount: 14,
      prorrogacoes: 0,
      paiIndex,
    };
  }
  if (mod === 1 || mod === 2 || mod === 3) {
    return {
      scenario: 'tramitacao',
      status: 'em_tramitacao',
      documentCount: 8 + (index % 5),
      andamentoCount: 14 + (index % 10),
      prorrogacoes: 0,
    };
  }
  if (mod === 4) {
    return {
      scenario: 'concluido',
      status: 'concluido',
      documentCount: 12 + (index % 6),
      andamentoCount: 20 + (index % 12),
      prorrogacoes: 0,
    };
  }
  if (mod === 5 || mod === 6) {
    return {
      scenario: 'consulta_publica',
      status: index % 2 === 0 ? 'em_tramitacao' : 'concluido',
      documentCount: 10 + (index % 4),
      andamentoCount: 16 + (index % 8),
      prorrogacoes: index % 4,
    };
  }
  if (mod === 7) {
    return {
      scenario: 'anexado_pai',
      status: 'em_tramitacao',
      documentCount: 9,
      andamentoCount: 18,
      prorrogacoes: 0,
    };
  }
  return {
    scenario: 'distribuicao',
    status: 'em_tramitacao',
    documentCount: 11 + (index % 5),
    andamentoCount: 18 + (index % 10),
    prorrogacoes: 0,
  };
}

function buildProcessDates(index: number): { dataGeracao: string; dataInclusao: string } {
  const base = new Date(Date.UTC(2024, (index % 12), 1 + (index % 20)));
  const dataGeracao = toIsoDate(base);
  const dataInclusao = toIsoDate(addDays(base, index % 5));
  return { dataGeracao, dataInclusao };
}

function pickRelatorId(index: number, relatorIds: Map<string, string>): string {
  const relator = RELATORES_SEED[index % RELATORES_SEED.length]!;
  const relatorId = relatorIds.get(relator.key);
  if (!relatorId) {
    throw new Error(`ID auth não provisionado para relator seed ${relator.key}`);
  }
  return relatorId;
}

function pickRelatorNome(index: number): string {
  return RELATORES_SEED[index % RELATORES_SEED.length]!.nome;
}

function buildDocumentPlans(
  plan: SeedProcessPlan,
  config: SeedScenarioConfig,
  relatorNome: string,
): SeedDocumentPlan[] {
  const docs: SeedDocumentPlan[] = [];
  const dataBase = new Date(`${plan.dataGeracao}T12:00:00.000Z`);
  const cpDatas =
    config.scenario === 'consulta_publica'
      ? buildDatasConsultaPublica(dataBase)
      : null;

  for (let docIndex = 0; docIndex < config.documentCount; docIndex += 1) {
    const tipo = TIPOS_DOCUMENTO[docIndex % TIPOS_DOCUMENTO.length]!;
    const docDate = addDays(dataBase, docIndex + 1);
    const numeroSei = `${plan.nup.replace(/\D/g, '').slice(0, 11)}${(docIndex + 1).toString().padStart(3, '0')}`;

    let conteudoTexto = buildDespacho({
      nup: plan.nup,
      unidade: plan.unidadeGeradora,
      data: docDate,
      sequencial: plan.index * 100 + docIndex + 1,
    });

    if (tipo.codigo === '212') {
      conteudoTexto = buildNotaTecnica({
        nup: plan.nup,
        unidade: plan.unidadeGeradora,
        tema: plan.tipoProcesso.descricao,
      });
    }

    if (tipo.codigo === '420' && cpDatas) {
      conteudoTexto = buildAvisoConsultaPublica({
        nup: plan.nup,
        dataAbertura: cpDatas.dataAbertura,
        dataEncerramento: cpDatas.dataEncerramentoOriginal,
      });
    }

    if (tipo.codigo === '535' && cpDatas && config.prorrogacoes > 0) {
      const prorrogacaoIndex = docIndex % config.prorrogacoes;
      conteudoTexto = buildAvisoProrrogacao({
        nup: plan.nup,
        dataEncerramentoNova: cpDatas.prorrogacoes[prorrogacaoIndex] ?? cpDatas.prorrogacoes[0]!,
      });
    }

    if (tipo.codigo === '610' && config.scenario === 'distribuicao') {
      conteudoTexto = buildExtratoDeliberacao({
        nup: plan.nup,
        relatorNome,
        acao: 'aprovar o relatório de fiscalização e determinar o cumprimento das recomendações',
        quorum: docIndex % 2 === 0 ? 'unanimidade' : 'maioria',
      });
    }

    if (tipo.codigo === '812' && config.scenario === 'distribuicao') {
      conteudoTexto = buildVotoRelator({
        nup: plan.nup,
        relatorNome,
        sessao: `DC-${plan.index}/2025`,
      });
    }

    if (tipo.codigo === '711' && config.scenario === 'distribuicao') {
      conteudoTexto = buildPautaReuniao({
        nup: plan.nup,
        sessao: `DC-${plan.index}/2025`,
        data: docDate,
      });
    }

    docs.push({
      id: seedUuid('documento', `${plan.nup}:${docIndex}`),
      processoId: plan.id,
      nup: plan.nup,
      numeroSei,
      tipoDocumentoCodigo: tipo.codigo,
      tipoDocumentoDesc: tipo.descricao,
      unidadeGeradora: plan.unidadeGeradora,
      dataDocumento: toIsoDate(docDate),
      dataInclusao: toIsoDate(addDays(docDate, 1)),
      conteudoTexto,
    });
  }

  return docs;
}

function buildAndamentoPlans(
  plan: SeedProcessPlan,
  config: SeedScenarioConfig,
  relatorId: string,
  extratoDoc?: SeedDocumentPlan,
  filhoPlan?: SeedProcessPlan,
): SeedAndamentoPlan[] {
  const andamentos: SeedAndamentoPlan[] = [];
  const start = new Date(`${plan.dataInclusao}T08:00:00.000Z`);

  for (let andIndex = 0; andIndex < config.andamentoCount; andIndex += 1) {
    const tipo = ANDAMENTO_TIPOS_ROTATIVOS[andIndex % ANDAMENTO_TIPOS_ROTATIVOS.length]!;
    const unidade = UNIDADES_ANEEL[andIndex % UNIDADES_ANEEL.length]!;
    const dataHora = addHours(start, andIndex * 6).toISOString();

    let descricao = `${tipo.toUpperCase()} registrado automaticamente no processo ${plan.nup}.`;
    let processoReferenciadoId: string | undefined;
    let relatorIdValue: string | undefined;
    let sessaoDistribuicao: string | undefined;
    let resultadoDeliberativo: string | undefined;

    if (tipo === 'anexacao' && filhoPlan) {
      descricao = `Processo ${filhoPlan.nup} anexado ao processo principal ${plan.nup}.`;
      processoReferenciadoId = filhoPlan.id;
    }

    if (tipo === 'distribuicao' && config.scenario === 'distribuicao') {
      relatorIdValue = relatorId;
      sessaoDistribuicao = `Sessão DC-${plan.index}/2025`;
      descricao = `Distribuição por sorteio. Diretor-Relator designado para o processo ${plan.nup}.`;
      if (extratoDoc) {
        resultadoDeliberativo =
          extrairResultadoDeliberativo(extratoDoc.conteudoTexto) ?? undefined;
      }
    }

    andamentos.push({
      id: seedUuid('andamento', `${plan.nup}:${andIndex}`),
      processoId: plan.id,
      nup: plan.nup,
      dataHora,
      unidade,
      tipo,
      descricao,
      processoReferenciadoId,
      relatorId: relatorIdValue,
      sessaoDistribuicao,
      resultadoDeliberativo,
    });
  }

  return andamentos;
}

function buildConsultaPublicaPlan(
  plan: SeedProcessPlan,
  config: SeedScenarioConfig,
  documentos: SeedDocumentPlan[],
): SeedConsultaPublicaPlan | null {
  if (config.scenario !== 'consulta_publica') {
    return null;
  }

  const cpDatas = buildDatasConsultaPublica(new Date(`${plan.dataGeracao}T12:00:00.000Z`));
  const prorrogacaoDocs = documentos.filter(
    (doc) => doc.tipoDocumentoCodigo === '535',
  );

  const prorrogacoes = prorrogacaoDocs.slice(0, config.prorrogacoes).map((doc, index) => ({
    id: seedUuid('prorrogacao', `${plan.nup}:${index}`),
    documentoSeiId: doc.id,
    dataEncerramentoNova: toIsoDate(cpDatas.prorrogacoes[index] ?? cpDatas.prorrogacoes[0]!),
  }));

  const encerramentoCandidates = [
    cpDatas.dataEncerramentoOriginal,
    ...prorrogacoes.map((item) => new Date(`${item.dataEncerramentoNova}T12:00:00.000Z`)),
  ];

  const dataEncerramentoEfetiva = maxDateIso(encerramentoCandidates);
  const statusInferido: 'em_andamento' | 'encerrada' =
    new Date(`${dataEncerramentoEfetiva}T23:59:59.000Z`) < new Date()
      ? 'encerrada'
      : 'em_andamento';

  return {
    id: seedUuid('consulta-publica', plan.nup),
    processoId: plan.id,
    nup: plan.nup,
    dataAbertura: toIsoDate(cpDatas.dataAbertura),
    dataEncerramentoOriginal: toIsoDate(cpDatas.dataEncerramentoOriginal),
    dataEncerramentoEfetiva,
    statusInferido,
    prorrogacoes,
  };
}

export function generateSeedData(
  processTotal: number,
  relatorIds: Map<string, string>,
): SeedGenerationResult {
  const processos: SeedProcessPlan[] = [];
  const processByIndex = new Map<number, SeedProcessPlan>();

  for (let index = 1; index <= processTotal; index += 1) {
    const ano = 2024 + (index % 3);
    const nup = gerarNup(index, ano);
    if (!validarNup(nup)) {
      throw new Error(`NUP inválido gerado: ${nup}`);
    }

    const { dataGeracao, dataInclusao } = buildProcessDates(index);
    let config = resolveScenarioConfig(index);

    if (index >= 211 && index <= 213) {
      config = {
        scenario: 'anexado_filho',
        status: 'em_tramitacao',
        documentCount: 7,
        andamentoCount: 12,
        prorrogacoes: 0,
        paiIndex: 4,
      };
    }

    const plan: SeedProcessPlan = {
      index,
      nup,
      id: seedUuid('processo', nup),
      config,
      tipoProcesso: TIPOS_PROCESSO[index % TIPOS_PROCESSO.length]!,
      unidadeGeradora: UNIDADES_ANEEL[index % UNIDADES_ANEEL.length]!,
      dataGeracao,
      dataInclusao,
    };

    processos.push(plan);
    processByIndex.set(index, plan);
  }

  const documentos: SeedDocumentPlan[] = [];
  const andamentos: SeedAndamentoPlan[] = [];
  const consultasPublicas: SeedConsultaPublicaPlan[] = [];
  const anexacoes: SeedAnexacaoPlan[] = [];

  for (const plan of processos) {
    const relatorId = pickRelatorId(plan.index, relatorIds);
    const relatorNome = pickRelatorNome(plan.index);
    const docs = buildDocumentPlans(plan, plan.config, relatorNome);
    documentos.push(...docs);

    let filhoPlan: SeedProcessPlan | undefined;
    if (plan.config.scenario === 'anexado_pai') {
      filhoPlan = processos.find(
        (entry) =>
          entry.config.scenario === 'anexado_filho' &&
          entry.config.paiIndex === plan.index,
      );
    }

    const extratoDoc = docs.find((doc) => doc.tipoDocumentoCodigo === '610');
    andamentos.push(
      ...buildAndamentoPlans(plan, plan.config, relatorId, extratoDoc, filhoPlan),
    );

    const consulta = buildConsultaPublicaPlan(plan, plan.config, docs);
    if (consulta) {
      consultasPublicas.push(consulta);
    }
  }

  for (const plan of processos) {
    if (plan.config.scenario !== 'anexado_filho' || !plan.config.paiIndex) {
      continue;
    }

    const pai = processByIndex.get(plan.config.paiIndex);
    if (!pai) {
      continue;
    }

    anexacoes.push({
      id: seedUuid('anexacao', `${pai.nup}:${plan.nup}`),
      processoPaiId: pai.id,
      processoFilhoId: plan.id,
      dataAnexacao: plan.dataInclusao,
    });
  }

  return {
    processos,
    documentos,
    andamentos,
    consultasPublicas,
    anexacoes,
  };
}

export function mapProcessoStatus(config: SeedScenarioConfig): ProcessoStatus {
  return config.status;
}

export function countByScenario(processos: SeedProcessPlan[]): Record<SeedScenario, number> {
  const counts: Record<SeedScenario, number> = {
    tramitacao: 0,
    concluido: 0,
    consulta_publica: 0,
    anexado_pai: 0,
    anexado_filho: 0,
    distribuicao: 0,
  };

  for (const plan of processos) {
    counts[plan.config.scenario] += 1;
  }

  return counts;
}
