#!/usr/bin/env node
import { calcularDvNup, validarNup } from '../../src/lib/utils/nup';
import {
  RELATORES_SEED,
  SEED_ORGAO_SIGLA,
  SEED_PROCESSO_TOTAL,
} from './constants';
import { seedUuid } from './deterministic-id';
import { countByScenario, generateSeedData } from './generators';
import { createSeedSupabaseClient } from './supabase-client';
import { upsertInBatches } from './upsert-batch';

const ANEEL_ORGAO_ID = seedUuid('orgao', SEED_ORGAO_SIGLA);

async function assertNupAlgorithm(): Promise<void> {
  const dv = calcularDvNup('230370014622021');
  if (dv !== '65') {
    throw new Error(`Algoritmo NUP inválido: esperado 65, obtido ${dv}`);
  }

  if (!validarNup('23037.001462/2021-65')) {
    throw new Error('Validação NUP falhou para exemplo oficial.');
  }
}

async function ensureOrgao(
  supabase: ReturnType<typeof createSeedSupabaseClient>,
): Promise<string> {
  const { error } = await supabase.from('orgao').upsert(
    {
      id: ANEEL_ORGAO_ID,
      nome: 'Agência Nacional de Energia Elétrica',
      sigla: SEED_ORGAO_SIGLA,
      municipio: 'Brasília',
      uf: 'DF',
    },
    { onConflict: 'sigla' },
  );

  if (error) {
    throw new Error(`Falha ao upsert orgao: ${error.message}`);
  }

  const { data, error: selectError } = await supabase
    .from('orgao')
    .select('id')
    .eq('sigla', SEED_ORGAO_SIGLA)
    .single();

  if (selectError || !data) {
    throw new Error('Órgão ANEEL não encontrado após upsert.');
  }

  return data.id;
}

async function findAuthUserIdByEmail(
  supabase: ReturnType<typeof createSeedSupabaseClient>,
  email: string,
): Promise<string | null> {
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      const detalhe = JSON.stringify(error, Object.getOwnPropertyNames(error));
      throw new Error(`Falha ao listar usuários auth para ${email}: ${detalhe}`);
    }

    const found = data.users.find((user) => user.email === email);
    if (found?.id) {
      return found.id;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function ensureRelatores(
  supabase: ReturnType<typeof createSeedSupabaseClient>,
  orgaoId: string,
): Promise<Map<string, string>> {
  const relatorIds = new Map<string, string>();

  for (const relator of RELATORES_SEED) {
    const email = `seed+${relator.key}@aneel-perceptio.invalid`;

    const { data, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        nome_completo: relator.nome,
      },
      app_metadata: {
        orgao_id: orgaoId,
        role: 'consultor',
      },
    });

    let userId: string | null = data.user?.id ?? null;

    if (createError) {
      if (createError.status === 422) {
        userId = await findAuthUserIdByEmail(supabase, email);
        if (!userId) {
          const detalhe = JSON.stringify(createError, Object.getOwnPropertyNames(createError));
          throw new Error(
            `Usuário seed ${relator.key} já existe (422) mas não foi encontrado por e-mail: ${detalhe}`,
          );
        }
      } else {
        const detalhe = JSON.stringify(createError, Object.getOwnPropertyNames(createError));
        throw new Error(`Falha ao criar usuário seed ${relator.key}: ${detalhe}`);
      }
    }

    if (!userId) {
      throw new Error(`createUser não retornou id para relator seed ${relator.key}`);
    }

    relatorIds.set(relator.key, userId);

    const { error: perfilError } = await supabase.from('perfil').upsert(
      {
        user_id: userId,
        orgao_id: orgaoId,
        role: 'consultor',
        nome_completo: relator.nome,
        sigla_unidade: relator.sigla,
      },
      { onConflict: 'user_id' },
    );

    if (perfilError) {
      throw new Error(`Falha ao upsert perfil ${relator.key}: ${perfilError.message}`);
    }
  }

  return relatorIds;
}

async function registerSeedJob(
  supabase: ReturnType<typeof createSeedSupabaseClient>,
  status: 'em_execucao' | 'concluido' | 'erro',
  registrosInseridos: number,
  erroMsg?: string,
  jobId?: string,
): Promise<string> {
  if (!jobId) {
    const { data, error } = await supabase
      .from('seed_job')
      .insert({
        tipo: 'processos',
        status: 'em_execucao',
        data_inicio: new Date().toISOString(),
        filtros_json: { orgao: SEED_ORGAO_SIGLA, total: SEED_PROCESSO_TOTAL },
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Falha ao registrar seed_job: ${error?.message ?? 'unknown'}`);
    }

    return data.id;
  }

  const { error } = await supabase
    .from('seed_job')
    .update({
      status,
      data_fim: new Date().toISOString(),
      registros_inseridos: registrosInseridos,
      erro_msg: erroMsg ?? null,
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Falha ao atualizar seed_job: ${error.message}`);
  }

  return jobId;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  await assertNupAlgorithm();

  const supabase = createSeedSupabaseClient();
  const orgaoId = await ensureOrgao(supabase);
  const relatorIds = await ensureRelatores(supabase, orgaoId);

  const seedData = generateSeedData(SEED_PROCESSO_TOTAL, relatorIds);

  for (const plan of seedData.processos) {
    if (!validarNup(plan.nup)) {
      throw new Error(`NUP inválido no plano ${plan.index}: ${plan.nup}`);
    }
    if (plan.dataGeracao > plan.dataInclusao) {
      throw new Error(`Datas inválidas no processo ${plan.nup}`);
    }
  }

  for (const consulta of seedData.consultasPublicas) {
    const prorrogacaoDates = consulta.prorrogacoes.map((item) => item.dataEncerramentoNova);
    const maxEncerramento = [consulta.dataEncerramentoOriginal, ...prorrogacaoDates].sort().at(-1);
    if (maxEncerramento !== consulta.dataEncerramentoEfetiva) {
      throw new Error(
        `data_encerramento_efetiva inconsistente em ${consulta.nup}: ${consulta.dataEncerramentoEfetiva} != ${maxEncerramento}`,
      );
    }
  }

  const jobId = await registerSeedJob(supabase, 'em_execucao', 0);

  try {
    const processoRows = seedData.processos.map((plan) => ({
      id: plan.id,
      nup: plan.nup,
      tipo_processo_codigo: plan.tipoProcesso.codigo,
      tipo_processo_desc: plan.tipoProcesso.descricao,
      interessados: [
        {
          nome: 'Concessionária Energia Modelo S.A.',
          documento: '00.000.000/0001-00',
        },
      ],
      data_geracao: plan.dataGeracao,
      data_inclusao: plan.dataInclusao,
      status: plan.config.status,
      unidade_atual: plan.unidadeGeradora,
      unidade_geradora: plan.unidadeGeradora,
      classificacao: {
        area: 'Regulação Econômica',
        categoria: 'Fiscalização',
        subcategoria: plan.tipoProcesso.descricao,
      },
      sigiloso: false,
      orgao_id: orgaoId,
    }));

    const documentoRows = seedData.documentos.map((doc) => ({
      id: doc.id,
      numero_sei: doc.numeroSei,
      processo_id: doc.processoId,
      tipo_documento_codigo: doc.tipoDocumentoCodigo,
      tipo_documento_desc: doc.tipoDocumentoDesc,
      unidade_geradora: doc.unidadeGeradora,
      data_documento: doc.dataDocumento,
      data_inclusao: doc.dataInclusao,
      conteudo_texto: doc.conteudoTexto,
      orgao_id: orgaoId,
    }));

    const andamentoRows = seedData.andamentos.map((andamento) => ({
      id: andamento.id,
      processo_id: andamento.processoId,
      data_hora: andamento.dataHora,
      unidade: andamento.unidade,
      tipo: andamento.tipo,
      descricao: andamento.descricao,
      processo_referenciado_id: andamento.processoReferenciadoId ?? null,
      relator_id: andamento.relatorId ?? null,
      sessao_distribuicao: andamento.sessaoDistribuicao ?? null,
      resultado_deliberativo: andamento.resultadoDeliberativo ?? null,
      orgao_id: orgaoId,
    }));

    const consultaRows = seedData.consultasPublicas.map((consulta) => ({
      id: consulta.id,
      processo_id: consulta.processoId,
      data_abertura: consulta.dataAbertura,
      data_encerramento_original: consulta.dataEncerramentoOriginal,
      data_encerramento_efetiva: consulta.dataEncerramentoEfetiva,
      status_inferido: consulta.statusInferido,
      orgao_id: orgaoId,
    }));

    const prorrogacaoRows = seedData.consultasPublicas.flatMap((consulta) =>
      consulta.prorrogacoes.map((prorrogacao) => ({
        id: prorrogacao.id,
        consulta_publica_id: consulta.id,
        documento_sei_id: prorrogacao.documentoSeiId,
        data_encerramento_nova: prorrogacao.dataEncerramentoNova,
        data_extracao: prorrogacao.dataEncerramentoNova,
        orgao_id: orgaoId,
      })),
    );

    const anexacaoRows = seedData.anexacoes.map((anexacao) => ({
      id: anexacao.id,
      processo_pai_id: anexacao.processoPaiId,
      processo_filho_id: anexacao.processoFilhoId,
      data_anexacao: anexacao.dataAnexacao,
      orgao_id: orgaoId,
    }));

    let total = 0;
    total += await upsertInBatches(supabase, 'processo', processoRows, 'nup,orgao_id');
    total += await upsertInBatches(supabase, 'documento', documentoRows, 'numero_sei,orgao_id');
    total += await upsertInBatches(supabase, 'andamento', andamentoRows, 'id');
    total += await upsertInBatches(supabase, 'consulta_publica', consultaRows, 'id');
    total += await upsertInBatches(supabase, 'prorrogacao_cp', prorrogacaoRows, 'id');
    total += await upsertInBatches(supabase, 'anexacao', anexacaoRows, 'id');

    await registerSeedJob(supabase, 'concluido', total, undefined, jobId);

    const scenarioCounts = countByScenario(seedData.processos);
    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log('Seed concluído com sucesso.');
    console.log(`- Órgão: ${SEED_ORGAO_SIGLA} (${orgaoId})`);
    console.log(`- Processos: ${seedData.processos.length}`);
    console.log(`- Documentos: ${seedData.documentos.length}`);
    console.log(`- Andamentos: ${seedData.andamentos.length}`);
    console.log(`- Consultas públicas: ${seedData.consultasPublicas.length}`);
    console.log(`- Prorrogações CP: ${prorrogacaoRows.length}`);
    console.log(`- Anexações: ${seedData.anexacoes.length}`);
    console.log(`- Registros upserted (aprox.): ${total}`);
    console.log(`- Cenários: ${JSON.stringify(scenarioCounts)}`);
    console.log(`- Tempo: ${elapsedSeconds}s`);
    console.log(`- seed_job: ${jobId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    await registerSeedJob(supabase, 'erro', 0, message, jobId);
    throw error;
  }
}

main().catch((error) => {
  console.error('Seed falhou:', error);
  process.exitCode = 1;
});
