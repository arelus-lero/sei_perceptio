'use client';

import { BookMarked } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SeiTerm } from '@/components/glossary/sei-term';
import { PageTitle, SectionTitle } from '@/components/layout/headings';
import { cn } from '@/lib/utils';
import { getSeiGlossaryByCategory } from '@/lib/glossary/sei-terms';

interface SeiGlossaryNavLinkProps {
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}

export function SeiGlossaryNavLink({
  collapsed = false,
  mobile = false,
  onNavigate,
}: SeiGlossaryNavLinkProps) {
  const pathname = usePathname();
  const active = pathname === '/glossario' || pathname.startsWith('/glossario/');

  return (
    <Link
      href="/glossario"
      onClick={onNavigate}
      className={cn(
        'flex w-full items-center rounded-lg text-sm font-medium transition-colors',
        mobile ? 'min-h-11 gap-3 px-3' : 'py-2',
        collapsed && !mobile ? 'justify-center px-2' : !mobile ? 'gap-2 px-3' : '',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
      )}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed && !mobile ? 'Glossário SEI' : undefined}
    >
      <BookMarked className="size-4 shrink-0" aria-hidden />
      {!collapsed || mobile ? 'Glossário SEI' : null}
    </Link>
  );
}

export function SeiGlossaryPage() {
  const sections = getSeiGlossaryByCategory();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <BookMarked className="size-5 text-primary" aria-hidden />
          <PageTitle>Glossário SEI</PageTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Definições dos termos usados na plataforma e no contexto do{' '}
          <SeiTerm term="sei">SEI</SeiTerm>. Passe o cursor sobre os termos
          sublinhados em qualquer tela para ver o mesmo conteúdo.
        </p>
      </header>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.category} className="space-y-4">
            <SectionTitle>{section.label}</SectionTitle>
            <dl className="divide-y divide-border rounded-xl border border-border bg-card">
              {section.entries.map(({ key, entry }) => (
                <div
                  key={key}
                  className="grid gap-1 px-4 py-4 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4"
                >
                  <dt className="text-sm font-medium">
                    <SeiTerm term={key}>{entry.term}</SeiTerm>
                  </dt>
                  <dd className="text-sm leading-relaxed text-muted-foreground">
                    {entry.definition}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </main>
  );
}
