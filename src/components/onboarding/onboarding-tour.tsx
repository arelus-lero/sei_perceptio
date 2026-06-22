'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingCitationDemo } from '@/components/onboarding/onboarding-citation-demo';
import { SectionTitle } from '@/components/layout/headings';
import { Button } from '@/components/ui/button';
import { usePrefersReducedMotion } from '@/hooks/use-mobile';
import { getOnboardingOverlayAlpha } from '@/lib/onboarding/config';
import {
  fetchFirstNotebookId,
  openOrCreateDemoNotebook,
} from '@/lib/onboarding/notebook-shortcut';
import { ONBOARDING_STEPS, resolveOnboardingRoute } from '@/lib/onboarding/steps';
import { cn } from '@/lib/utils';
import {
  markOnboardingComplete,
  skipOnboarding,
  useOnboardingStore,
} from '@/stores/onboarding-store';
import type { OnboardingStep } from '@/lib/onboarding/steps';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

function measureTarget(selector: string | undefined): TargetRect | null {
  if (!selector) {
    return null;
  }

  const element = document.querySelector(selector);
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function NavigationTransition({
  message,
  reducedMotion,
}: {
  message: string;
  reducedMotion: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[10003] flex items-center justify-center px-6"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-sm rounded-xl border border-border bg-popover px-5 py-4 text-center shadow-xl">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2
            className={cn('size-4', !reducedMotion && 'animate-spin')}
            aria-hidden
          />
          Aguarde um momento…
        </div>
      </div>
    </div>
  );
}

function TooltipPanel({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  isWaitingNotebook,
  showNotebookShortcut,
  isNotebookShortcutLoading,
  onNotebookShortcut,
  onPrev,
  onNext,
  onSkip,
  isCompleting,
}: {
  step: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: TargetRect | null;
  isWaitingNotebook: boolean;
  showNotebookShortcut: boolean;
  isNotebookShortcutLoading: boolean;
  onNotebookShortcut: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  isCompleting: boolean;
}) {
  const isLast = stepIndex >= totalSteps - 1;
  const isCenter = !step.target || step.placement === 'center' || !targetRect;

  const style: CSSProperties = isCenter
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '28rem',
        width: 'calc(100% - 2rem)',
        zIndex: 10002,
      }
    : computeTooltipPosition(step, targetRect);

  return (
    <div
      role="dialog"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-desc"
      className="rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl"
      style={style}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Passo {stepIndex + 1} de {totalSteps}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Fechar tour"
          onClick={onSkip}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <SectionTitle id="onboarding-title">{step.title}</SectionTitle>
      <p id="onboarding-desc" className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </p>

      {step.showCitationDemo ? <OnboardingCitationDemo /> : null}

      {showNotebookShortcut ? (
        <div className="mt-3 space-y-2">
          {isWaitingNotebook ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Crie ou abra um notebook para continuar o tour.
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={isNotebookShortcutLoading || isCompleting}
            onClick={onNotebookShortcut}
          >
            {isNotebookShortcutLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <BookOpen className="size-4" aria-hidden />
            )}
            Abrir ou criar notebook de exemplo
          </Button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onSkip} disabled={isCompleting}>
          Pular tour
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={stepIndex === 0 || isCompleting}
          >
            Anterior
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onNext}
            disabled={isWaitingNotebook || isCompleting}
          >
            {isCompleting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : isLast ? (
              'Concluir'
            ) : (
              'Próximo'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function computeTooltipPosition(
  step: OnboardingStep,
  rect: TargetRect | null,
): CSSProperties {
  if (!rect) {
    return {
      position: 'fixed',
      bottom: '1.5rem',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '24rem',
      width: 'calc(100% - 2rem)',
      zIndex: 10002,
    };
  }

  const base: CSSProperties = {
    position: 'fixed',
    maxWidth: '22rem',
    width: 'calc(100% - 2rem)',
    zIndex: 10002,
  };

  switch (step.placement) {
    case 'top':
      return {
        ...base,
        left: rect.left + rect.width / 2,
        top: rect.top - 12,
        transform: 'translate(-50%, -100%)',
      };
    case 'left':
      return {
        ...base,
        right: window.innerWidth - rect.left + 12,
        top: rect.top + rect.height / 2,
        transform: 'translateY(-50%)',
        left: 'auto',
      };
    case 'right':
      return {
        ...base,
        left: rect.left + rect.width + 12,
        top: rect.top + rect.height / 2,
        transform: 'translateY(-50%)',
      };
    case 'bottom':
    default:
      return {
        ...base,
        left: rect.left + rect.width / 2,
        top: rect.top + rect.height + 12,
        transform: 'translateX(-50%)',
      };
  }
}

export function OnboardingTour() {
  const router = useRouter();
  const pathname = usePathname();
  const prefersReducedMotion = usePrefersReducedMotion();
  const overlayAlpha = getOnboardingOverlayAlpha(prefersReducedMotion);

  const isActive = useOnboardingStore((state) => state.isActive);
  const stepIndex = useOnboardingStore((state) => state.stepIndex);
  const notebookId = useOnboardingStore((state) => state.notebookId);
  const nextStep = useOnboardingStore((state) => state.nextStep);
  const prevStep = useOnboardingStore((state) => state.prevStep);
  const stopTour = useOnboardingStore((state) => state.stopTour);
  const setNotebookId = useOnboardingStore((state) => state.setNotebookId);

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationMessage, setNavigationMessage] = useState<string | null>(null);
  const [isNotebookShortcutLoading, setIsNotebookShortcutLoading] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex];
  const totalSteps = ONBOARDING_STEPS.length;

  const refreshTarget = useCallback(() => {
    if (!step?.target) {
      setTargetRect(null);
      return;
    }

    setTargetRect(measureTarget(step.target));
  }, [step?.target]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    refreshTarget();

    const handleUpdate = () => refreshTarget();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    const intervalMs = prefersReducedMotion ? 800 : 400;
    const intervalId = window.setInterval(handleUpdate, intervalMs);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      window.clearInterval(intervalId);
    };
  }, [isActive, stepIndex, refreshTarget, prefersReducedMotion]);

  useEffect(() => {
    if (!isActive || !step) {
      return;
    }

    const activeStep = step;
    let cancelled = false;

    async function ensureContext() {
      let resolvedNotebookId = notebookId;

      if (!resolvedNotebookId) {
        resolvedNotebookId = await fetchFirstNotebookId();
        if (resolvedNotebookId && !cancelled) {
          setNotebookId(resolvedNotebookId);
        }
      }

      const targetRoute = resolveOnboardingRoute(activeStep.route, resolvedNotebookId);

      if (targetRoute && pathname !== targetRoute) {
        setNavigationMessage(
          activeStep.navigationMessage ?? 'Preparando o próximo passo do tour…',
        );
        setIsNavigating(true);
        router.push(targetRoute);
      } else {
        setIsNavigating(false);
        setNavigationMessage(null);
      }
    }

    void ensureContext();

    return () => {
      cancelled = true;
    };
  }, [isActive, step, stepIndex, notebookId, pathname, router, setNotebookId]);

  useEffect(() => {
    if (!isNavigating) {
      return;
    }

    const activeStep = step;
    if (!activeStep) {
      return;
    }

    const targetRoute = resolveOnboardingRoute(activeStep.route, notebookId);
    if (targetRoute && pathname === targetRoute) {
      setIsNavigating(false);
      setNavigationMessage(null);
    }
  }, [isNavigating, pathname, notebookId, step]);

  useEffect(() => {
    const match = pathname.match(/^\/notebooks\/([0-9a-f-]{36})$/i);
    if (match?.[1] && match[1] !== notebookId) {
      setNotebookId(match[1]);
    }
  }, [pathname, notebookId, setNotebookId]);

  if (!isActive || !step) {
    return null;
  }

  const isWaitingNotebook = step.requiresNotebook === true && !notebookId;
  const showNotebookShortcut =
    step.allowsNotebookShortcut === true
    && (step.id === 'create-notebook' || isWaitingNotebook);

  async function handleNotebookShortcut() {
    setIsNotebookShortcutLoading(true);
    try {
      const result = await openOrCreateDemoNotebook();
      if (!result.notebookId) {
        toast.error(
          'Não foi possível abrir ou criar um notebook. Verifique suas permissões ou crie um manualmente.',
        );
        return;
      }

      setNotebookId(result.notebookId);
      toast.success(
        result.created
          ? 'Notebook de demonstração criado.'
          : 'Notebook aberto para continuar o tour.',
      );
      router.push(`/notebooks/${result.notebookId}`);
    } finally {
      setIsNotebookShortcutLoading(false);
    }
  }

  async function handleComplete() {
    setIsCompleting(true);
    try {
      await markOnboardingComplete();
    } catch {
      stopTour();
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleSkip() {
    setIsCompleting(true);
    try {
      await skipOnboarding();
    } catch {
      stopTour();
    } finally {
      setIsCompleting(false);
    }
  }

  function handleNext() {
    if (stepIndex >= totalSteps - 1) {
      void handleComplete();
      return;
    }
    nextStep(totalSteps - 1);
  }

  const spotlight = targetRect
    ? {
        top: targetRect.top - PADDING,
        left: targetRect.left - PADDING,
        width: targetRect.width + PADDING * 2,
        height: targetRect.height + PADDING * 2,
      }
    : null;

  const spotlightTransition = prefersReducedMotion ? '' : 'transition-all duration-300';
  const overlayColor = `rgba(0,0,0,${overlayAlpha})`;

  return (
    <div className="fixed inset-0 z-[10000]" aria-live="polite">
      <div
        className={cn(
          'absolute inset-0 motion-reduce:transition-none',
          !prefersReducedMotion && 'transition-opacity duration-200',
        )}
        style={{ backgroundColor: overlayColor }}
        aria-hidden
        onClick={(event) => event.stopPropagation()}
      />

      {spotlight ? (
        <div
          className={cn(
            'pointer-events-none absolute rounded-lg ring-4 ring-primary/80 ring-offset-2 ring-offset-background',
            spotlightTransition,
          )}
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: `0 0 0 9999px ${overlayColor}`,
            zIndex: 10001,
          }}
        />
      ) : null}

      {isNavigating && navigationMessage ? (
        <NavigationTransition
          message={navigationMessage}
          reducedMotion={prefersReducedMotion}
        />
      ) : (
        <TooltipPanel
          step={step}
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          targetRect={targetRect}
          isWaitingNotebook={isWaitingNotebook}
          showNotebookShortcut={showNotebookShortcut}
          isNotebookShortcutLoading={isNotebookShortcutLoading}
          onNotebookShortcut={() => void handleNotebookShortcut()}
          onPrev={prevStep}
          onNext={handleNext}
          onSkip={() => void handleSkip()}
          isCompleting={isCompleting}
        />
      )}
    </div>
  );
}
