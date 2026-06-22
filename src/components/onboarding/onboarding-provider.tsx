'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { OnboardingTour } from '@/components/onboarding/onboarding-tour';
import {
  ONBOARDING_AUTO_START_IDLE_MS,
  ONBOARDING_AUTO_START_MAX_WAIT_MS,
} from '@/lib/onboarding/config';
import { useOnboardingStore } from '@/stores/onboarding-store';

interface OnboardingProviderProps {
  onboardingConcluido: boolean;
  children: ReactNode;
}

export function OnboardingProvider({
  onboardingConcluido,
  children,
}: OnboardingProviderProps) {
  const startTour = useOnboardingStore((state) => state.startTour);
  const isActive = useOnboardingStore((state) => state.isActive);
  const hasUserInteracted = useOnboardingStore((state) => state.hasUserInteracted);
  const autoStartSuppressed = useOnboardingStore((state) => state.autoStartSuppressed);
  const recordUserInteraction = useOnboardingStore((state) => state.recordUserInteraction);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (onboardingConcluido) {
      return;
    }

    function onUserInteract() {
      recordUserInteraction();
    }

    window.addEventListener('pointerdown', onUserInteract, { passive: true });
    window.addEventListener('keydown', onUserInteract);

    return () => {
      window.removeEventListener('pointerdown', onUserInteract);
      window.removeEventListener('keydown', onUserInteract);
    };
  }, [onboardingConcluido, recordUserInteraction]);

  useEffect(() => {
    if (
      onboardingConcluido
      || autoStartedRef.current
      || isActive
      || hasUserInteracted
      || autoStartSuppressed
    ) {
      return;
    }

    autoStartedRef.current = true;

    let cancelled = false;
    let idleCallbackId: number | undefined;
    let timeoutId: number | undefined;

    const scheduleStart = () => {
      if (cancelled) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        if (!cancelled && !useOnboardingStore.getState().hasUserInteracted) {
          startTour();
        }
      }, ONBOARDING_AUTO_START_IDLE_MS);
    };

    if ('requestIdleCallback' in window) {
      idleCallbackId = window.requestIdleCallback(
        () => scheduleStart(),
        { timeout: ONBOARDING_AUTO_START_MAX_WAIT_MS },
      );
    } else {
      scheduleStart();
    }

    return () => {
      cancelled = true;
      if (idleCallbackId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    onboardingConcluido,
    isActive,
    hasUserInteracted,
    autoStartSuppressed,
    startTour,
  ]);

  return (
    <>
      {children}
      <OnboardingTour />
    </>
  );
}

export function restartOnboardingTour(): void {
  useOnboardingStore.getState().startTour();
}
