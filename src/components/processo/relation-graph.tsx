'use client';

import { memo, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  RelacaoEdge,
  RelacaoEdgeFilter,
  RelacaoEdgeTipo,
  RelacaoNode,
  RelacoesGraphData,
} from '@/types/relacoes';

import 'reactflow/dist/style.css';

interface ProcessoNodeData {
  node: RelacaoNode;
  selected: boolean;
}

const EDGE_COLORS: Record<RelacaoEdgeTipo, string> = {
  anexacao: 'var(--chart-4)',
  referencia: 'var(--chart-1)',
  mesmo_interessado: 'var(--chart-2)',
  mesmo_tipo: 'var(--chart-3)',
};

const NODE_BORDER: Record<RelacaoNode['tipo'], string> = {
  central: 'border-primary ring-2 ring-primary/30',
  pai: 'border-chart-4',
  filho: 'border-chart-3',
  referenciado: 'border-chart-1',
  relacionado: 'border-chart-2',
};

function ProcessoFlowNode({ data, selected }: NodeProps<ProcessoNodeData>) {
  const { node } = data;

  return (
    <div
      className={cn(
        'min-w-[160px] max-w-[200px] rounded-lg border-2 bg-card px-3 py-2 shadow-sm',
        NODE_BORDER[node.tipo],
        selected && 'shadow-md',
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <p className="truncate font-mono text-[10px] text-muted-foreground">{node.nup}</p>
      <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug">
        {node.label}
      </p>
      <Badge variant="outline" className="mt-2 text-[10px]">
        {node.tipo}
      </Badge>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = {
  processo: memo(ProcessoFlowNode),
};

function layoutNodes(
  graphNodes: RelacaoNode[],
  centralId: string,
  selectedId: string,
): Node<ProcessoNodeData>[] {
  const center = { x: 360, y: 260 };
  const buckets = new Map<RelacaoNode['tipo'], RelacaoNode[]>();

  for (const node of graphNodes) {
    const list = buckets.get(node.tipo) ?? [];
    list.push(node);
    buckets.set(node.tipo, list);
  }

  const positions = new Map<string, { x: number; y: number }>();

  const central = graphNodes.find((node) => node.id === centralId);
  if (central) {
    positions.set(central.id, center);
  }

  const placeRing = (
    nodes: RelacaoNode[],
    baseX: number,
    baseY: number,
    spreadX: number,
    spreadY: number,
  ) => {
    nodes.forEach((node, index) => {
      const offset = index - (nodes.length - 1) / 2;
      positions.set(node.id, {
        x: baseX + offset * spreadX,
        y: baseY + (index % 2) * spreadY,
      });
    });
  };

  placeRing(buckets.get('pai') ?? [], center.x, 40, 180, 0);
  placeRing(buckets.get('filho') ?? [], center.x, 470, 180, 0);
  placeRing(buckets.get('referenciado') ?? [], 40, center.y, 0, 90);
  placeRing(buckets.get('relacionado') ?? [], 680, center.y, 0, 70);

  return graphNodes.map((node) => ({
    id: node.id,
    type: 'processo',
    position: positions.get(node.id) ?? {
      x: center.x + Math.random() * 80,
      y: center.y + Math.random() * 80,
    },
    data: {
      node,
      selected: node.id === selectedId,
    },
    selected: node.id === selectedId,
  }));
}

function toFlowEdges(
  edges: RelacaoEdge[],
  filter: RelacaoEdgeFilter,
): Edge[] {
  const filtered =
    filter === 'todos' ? edges : edges.filter((edge) => edge.tipo === filter);

  return filtered.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
    animated: edge.tipo === 'referencia',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: {
      stroke: EDGE_COLORS[edge.tipo],
      strokeWidth: 2,
    },
    labelStyle: { fontSize: 10, fill: 'var(--foreground)' },
  }));
}

interface RelationGraphProps {
  graph: RelacoesGraphData;
  selectedNodeId: string;
  edgeFilter: RelacaoEdgeFilter;
  onNodeSelect: (node: RelacaoNode) => void;
  className?: string;
}

export function RelationGraph({
  graph,
  selectedNodeId,
  edgeFilter,
  onNodeSelect,
  className,
}: RelationGraphProps) {
  const nodes = useMemo(
    () => layoutNodes(graph.nodes, graph.processo_central_id, selectedNodeId),
    [graph.nodes, graph.processo_central_id, selectedNodeId],
  );

  const edges = useMemo(
    () => toFlowEdges(graph.edges, edgeFilter),
    [graph.edges, edgeFilter],
  );

  return (
    <div className={cn('h-[520px] w-full rounded-xl border border-border', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        onNodeClick={(_, node) => {
          const payload = node.data as ProcessoNodeData;
          onNodeSelect(payload.node);
        }}
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
        <Background gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}

export function RelacaoLegend() {
  const items: { tipo: RelacaoEdgeTipo; label: string }[] = [
    { tipo: 'anexacao', label: 'Anexação' },
    { tipo: 'referencia', label: 'Referência' },
    { tipo: 'mesmo_interessado', label: 'Mesmo interessado' },
    { tipo: 'mesmo_tipo', label: 'Mesmo tipo' },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.tipo} className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ background: EDGE_COLORS[item.tipo] }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
