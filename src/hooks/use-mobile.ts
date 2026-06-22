import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
const LG_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}

export function useBelowLg() {
  const [belowLg, setBelowLg] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${LG_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setBelowLg(window.innerWidth < LG_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setBelowLg(window.innerWidth < LG_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!belowLg;
}

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState<
    boolean | undefined
  >(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      setPrefersReducedMotion(mql.matches);
    };
    mql.addEventListener('change', onChange);
    setPrefersReducedMotion(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!prefersReducedMotion;
}
