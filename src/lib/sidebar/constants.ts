export const SIDEBAR_COOKIE_NAME = 'sidebar_state';
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function readSidebarOpenFromCookie(cookieValue: string | undefined): boolean {
  if (cookieValue === 'false') {
    return false;
  }

  if (cookieValue === 'true') {
    return true;
  }

  return true;
}

export function writeSidebarOpenCookie(open: boolean): void {
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`;
}
