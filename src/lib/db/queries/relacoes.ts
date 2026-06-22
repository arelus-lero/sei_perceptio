import type { ProcessoStatus } from '@/lib/db/schema';
import { buildFluxoTramitacao } from '@/lib/processo/fluxo-tramitacao';
import {
  extractInteressadoKeys,
} from '@/lib/processo/interessados';
import type {
  RelacaoEdge,
  RelacaoEdgeTipo,
  RelacaoNode,
  RelacaoNodeKind,
  RelacoesGraphData,
} from '@/types/relacoes';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ProcessoResumo {
  id: string;
  nup: string;
  status: ProcessoStatus;
  tipo_processo_codigo: string;
  tipo_processo_desc: string;
  interessados: Record<string, unknown>[];
  sigiloso: boolean;
}

const MAX_MESMO_TIPO = 12;
const MAX_MESMO_INTERESSADO = 12;

function interessadosOverlap(left: Set<string>, right: Set<string>): boolean {
  for (const key of left) {
    if (right.has(key)) {
      return true;
    }
  }
  return false;
}

function makeNode(
  processo: ProcessoResumo,
  tipo: RelacaoNodeKind,
): RelacaoNode {
  return {
    id: processo.id,
    nup: processo.nup,
    label: processo.tipo_processo_desc,
    tipo,
    status: processo.status,
    tipo_processo_desc: processo.tipo_processo_desc,
  };
}

function edgeId(source: string, target: string, tipo: RelacaoEdgeTipo): string {
  return `${source}-${target}-${tipo}`;
}

export async function getProcessoRelacoesGraph(
  supabase: SupabaseClient,
  orgaoId: string,
  nup: string,
): Promise<RelacoesGraphData | null> {
  const { data: central, error: centralError } = await supabase
    .from('processo')
    .select(
      'id, nup, status, tipo_processo_codigo, tipo_processo_desc, interessados, sigiloso',
    )
    .eq('nup', nup)
    .eq('orgao_id', orgaoId)
    .maybeSingle();

  if (centralError) {
    throw new Error(centralError.message);
  }

  if (!central) {
    return null;
  }

  if (central.sigiloso || central.tipo_processo_codigo === '100001101') {
    throw new Error('Processo sigiloso não disponível para visualização');
  }

  const centralProcesso = central as ProcessoResumo;
  const nodesMap = new Map<string, RelacaoNode>();
  const edgesMap = new Map<string, RelacaoEdge>();

  nodesMap.set(
    centralProcesso.id,
    makeNode(centralProcesso, 'central'),
  );

  const addEdge = (
    source: string,
    target: string,
    tipo: RelacaoEdgeTipo,
    data: string | null,
    label: string,
  ) => {
    if (source === target) {
      return;
    }

    const id = edgeId(source, target, tipo);
    if (!edgesMap.has(id)) {
      edgesMap.set(id, { id, source, target, tipo, data, label });
    }
  };

  const addProcessoNode = (processo: ProcessoResumo, tipo: RelacaoNodeKind) => {
    if (!nodesMap.has(processo.id)) {
      nodesMap.set(processo.id, makeNode(processo, tipo));
    }
  };

  const { data: anexacoes, error: anexacoesError } = await supabase
    .from('anexacao')
    .select('processo_pai_id, processo_filho_id, data_anexacao')
    .eq('orgao_id', orgaoId)
    .or(
      `processo_pai_id.eq.${centralProcesso.id},processo_filho_id.eq.${centralProcesso.id}`,
    );

  if (anexacoesError) {
    throw new Error(anexacoesError.message);
  }

  const { data: referencias, error: referenciasError } = await supabase
    .from('andamento')
    .select('processo_id, processo_referenciado_id, data_hora, descricao')
    .eq('orgao_id', orgaoId)
    .or(
      `processo_id.eq.${centralProcesso.id},processo_referenciado_id.eq.${centralProcesso.id}`,
    )
    .not('processo_referenciado_id', 'is', null);

  if (referenciasError) {
    throw new Error(referenciasError.message);
  }

  const { data: allProcessos, error: allProcessosError } = await supabase
    .from('processo')
    .select(
      'id, nup, status, tipo_processo_codigo, tipo_processo_desc, interessados, sigiloso',
    )
    .eq('orgao_id', orgaoId)
    .eq('sigiloso', false)
    .neq('tipo_processo_codigo', '100001101');

  if (allProcessosError) {
    throw new Error(allProcessosError.message);
  }

  const processosById = new Map<string, ProcessoResumo>();
  for (const processo of (allProcessos ?? []) as ProcessoResumo[]) {
    processosById.set(processo.id, processo);
  }

  for (const anexacao of anexacoes ?? []) {
    const pai = processosById.get(anexacao.processo_pai_id);
    const filho = processosById.get(anexacao.processo_filho_id);
    if (!pai || !filho) {
      continue;
    }

    addProcessoNode(
      pai,
      pai.id === centralProcesso.id ? 'central' : 'pai',
    );
    addProcessoNode(
      filho,
      filho.id === centralProcesso.id ? 'central' : 'filho',
    );

    addEdge(
      pai.id,
      filho.id,
      'anexacao',
      anexacao.data_anexacao,
      'Anexação',
    );
  }

  for (const referencia of referencias ?? []) {
    const referenciadoId = referencia.processo_referenciado_id;
    if (!referenciadoId) {
      continue;
    }

    const origemId = referencia.processo_id;
    const referenciado = processosById.get(referenciadoId);
    const origem = processosById.get(origemId);
    if (!referenciado || !origem) {
      continue;
    }

    const envolveCentral =
      origemId === centralProcesso.id ||
      referenciadoId === centralProcesso.id;

    if (!envolveCentral) {
      continue;
    }

    const outroId =
      origemId === centralProcesso.id ? referenciadoId : origemId;
    const outro = processosById.get(outroId);
    if (!outro) {
      continue;
    }

    addProcessoNode(
      outro,
      outro.id === centralProcesso.id ? 'central' : 'referenciado',
    );

    addEdge(
      origemId,
      referenciadoId,
      'referencia',
      referencia.data_hora,
      'Referência em andamento',
    );
  }

  const centralInteressados = extractInteressadoKeys(
    centralProcesso.interessados ?? [],
  );

  const mesmoInteressadoCandidates = (allProcessos ?? [])
    .filter((processo) => {
      if (processo.id === centralProcesso.id) {
        return false;
      }
      const keys = extractInteressadoKeys(
        (processo as ProcessoResumo).interessados ?? [],
      );
      return interessadosOverlap(centralInteressados, keys);
    })
    .slice(0, MAX_MESMO_INTERESSADO) as ProcessoResumo[];

  for (const processo of mesmoInteressadoCandidates) {
    addProcessoNode(processo, 'relacionado');
    addEdge(
      centralProcesso.id,
      processo.id,
      'mesmo_interessado',
      null,
      'Mesmo interessado',
    );
  }

  const mesmoTipoCandidates = (allProcessos ?? [])
    .filter(
      (processo) =>
        processo.id !== centralProcesso.id &&
        processo.tipo_processo_codigo === centralProcesso.tipo_processo_codigo,
    )
    .slice(0, MAX_MESMO_TIPO) as ProcessoResumo[];

  for (const processo of mesmoTipoCandidates) {
    addProcessoNode(processo, 'relacionado');
    addEdge(
      centralProcesso.id,
      processo.id,
      'mesmo_tipo',
      null,
      'Mesmo tipo processual',
    );
  }

  return {
    nup_central: centralProcesso.nup,
    processo_central_id: centralProcesso.id,
    nodes: [...nodesMap.values()],
    edges: [...edgesMap.values()],
  };
}

export async function getProcessoFluxoTramitacao(
  supabase: SupabaseClient,
  orgaoId: string,
  nup: string,
) {
  const { data: processo, error: processoError } = await supabase
    .from('processo')
    .select('id, nup, sigiloso, tipo_processo_codigo')
    .eq('nup', nup)
    .eq('orgao_id', orgaoId)
    .maybeSingle();

  if (processoError) {
    throw new Error(processoError.message);
  }

  if (!processo) {
    return null;
  }

  if (processo.sigiloso || processo.tipo_processo_codigo === '100001101') {
    throw new Error('Processo sigiloso não disponível para visualização');
  }

  const { data: andamentos, error: andamentosError } = await supabase
    .from('andamento')
    .select('data_hora, unidade, tipo')
    .eq('processo_id', processo.id)
    .eq('orgao_id', orgaoId)
    .order('data_hora', { ascending: true });

  if (andamentosError) {
    throw new Error(andamentosError.message);
  }

  return buildFluxoTramitacao(processo.nup, processo.id, andamentos ?? []);
}
