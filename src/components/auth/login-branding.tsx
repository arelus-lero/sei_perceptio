import Image from 'next/image';

import { cn } from '@/lib/utils';

interface LoginBrandingProps {
  className?: string;
}

export function LoginBranding({ className }: LoginBrandingProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', className)}>
      <Image
        src="/images/aneel-mark.svg"
        alt=""
        width={64}
        height={64}
        className="size-16 rounded-2xl shadow-sm ring-1 ring-border"
        role="img"
        aria-label="Logotipo institucional ANEEL (placeholder)"
        priority
      />
      <div className="space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          ANEEL
        </p>
        <p className="text-xs text-muted-foreground">
          Agência Nacional de Energia Elétrica
        </p>
      </div>
    </div>
  );
}
