export const TIMELINE_PROCESS_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

export function getTimelineProcessColor(index: number): string {
  return TIMELINE_PROCESS_COLORS[index % TIMELINE_PROCESS_COLORS.length] ?? 'var(--chart-1)';
}

export function truncateNupLabel(nup: string, max = 22): string {
  if (nup.length <= max) {
    return nup;
  }
  return `${nup.slice(0, max - 1)}…`;
}
