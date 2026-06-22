/** Token substituindo a barra do NUP (única ocorrência no formato SEI). */
const NUP_SLASH_TOKEN = '_';

/**
 * Converte NUP para segmento de URL seguro (sem `/`).
 * Ex.: `48500.035430/2025-02` → `48500.035430_2025-02`
 */
export function nupToSlug(nup: string): string {
  return nup.replace('/', NUP_SLASH_TOKEN);
}

/**
 * Restaura o NUP a partir do slug de rota.
 * Ex.: `48500.035430_2025-02` → `48500.035430/2025-02`
 */
export function slugToNup(slug: string): string {
  return slug.replace(NUP_SLASH_TOKEN, '/');
}

export function processoHref(nup: string): string {
  return `/processos/${nupToSlug(nup)}`;
}

export function nupFromRouteParam(routeNup: string): string {
  const decoded = decodeURIComponent(routeNup);
  return slugToNup(decoded);
}

export function processoTimelineHref(nup: string): string {
  return `${processoHref(nup)}/timeline`;
}

export function processoApiPath(nup: string, suffix = ''): string {
  const base = `/api/processos/${nupToSlug(nup)}`;
  return suffix ? `${base}/${suffix}` : base;
}
