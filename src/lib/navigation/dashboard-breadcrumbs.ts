const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  notebooks: 'Notebooks',
  processos: 'Processos',
  relacoes: 'Relações',
  analytics: 'Analytics',
  relatoria: 'Relatoria',
  monitoramento: 'Monitoramento',
  admin: 'Administração',
  auditoria: 'Auditoria',
  retencao: 'Retenção',
  usuarios: 'Usuários',
  settings: 'Configurações',
  timeline: 'Linha do tempo',
  glossario: 'Glossário',
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

import { slugToNup } from '@/lib/utils/processo-url';

const NUP_PATTERN = /^\d{5}\.\d{6}\/\d{4}-\d{2}$/;

export interface DashboardBreadcrumbItem {
  href?: string;
  label: string;
  isCurrent: boolean;
}

export function isUuidSegment(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isNupSegment(value: string): boolean {
  return NUP_PATTERN.test(value);
}

function nupLabelFromSegment(segment: string): string | null {
  const decoded = decodeURIComponent(segment);
  if (isNupSegment(decoded)) {
    return decoded;
  }
  const fromSlug = slugToNup(decoded);
  if (isNupSegment(fromSlug)) {
    return fromSlug;
  }
  return null;
}

export function getSegmentLabel(segment: string): string | null {
  return SEGMENT_LABELS[segment] ?? null;
}

export function buildDashboardBreadcrumbs(
  pathname: string,
  resolvedLabels: Record<string, string> = {},
): DashboardBreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [{ label: 'Dashboard', isCurrent: true }];
  }

  const crumbs: DashboardBreadcrumbItem[] = [
    { href: '/dashboard', label: 'Início', isCurrent: false },
  ];

  let path = '';

  segments.forEach((segment, index) => {
    path += `/${segment}`;
    const isLast = index === segments.length - 1;
    const decodedSegment = decodeURIComponent(segment);
    const nupLabel = nupLabelFromSegment(segment);
    const resolved = resolvedLabels[segment] ?? resolvedLabels[decodedSegment];
    const staticLabel = getSegmentLabel(segment) ?? getSegmentLabel(decodedSegment);

    let label: string;
    if (resolved) {
      label = resolved;
    } else if (staticLabel) {
      label = staticLabel;
    } else if (nupLabel) {
      label = nupLabel;
    } else if (isUuidSegment(segment)) {
      label = 'Detalhe';
    } else {
      label = decodedSegment.replace(/-/g, ' ');
    }

    crumbs.push({
      href: isLast ? undefined : path,
      label,
      isCurrent: isLast,
    });
  });

  return crumbs;
}

export function extractNotebookIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/notebooks\/([^/]+)/);
  if (!match?.[1] || !isUuidSegment(match[1])) {
    return null;
  }
  return match[1];
}
