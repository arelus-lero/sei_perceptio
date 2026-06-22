'use client';

import {
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';

import { SeiGlossaryNavLink } from '@/components/glossary/sei-glossary-page';
import { Button } from '@/components/ui/button';
import { restartOnboardingTour } from '@/components/onboarding/onboarding-provider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { createBrowserClient } from '@/lib/supabase/client';

const SIDEBAR_COLLAPSED_KEY = 'sei-perceptio:sidebar-collapsed';

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  tourId?: string;
}

const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Notebooks', href: '/notebooks', icon: BookOpen, tourId: 'nav-notebooks' },
  { label: 'Relações', href: '/relacoes', icon: Network },
  { label: 'Relatoria', href: '/analytics/relatoria', icon: BarChart3 },
  { label: 'Monitoramento', href: '/monitoramento', icon: Bell },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Auditoria', href: '/admin/auditoria', icon: ScrollText },
  { label: 'Retenção', href: '/admin/retencao', icon: Archive },
  { label: 'Usuários', href: '/admin/usuarios', icon: Users },
];

interface DashboardNavProps {
  isAdmin: boolean;
}

function isNavActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function CollapsibleTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactNode;
}) {
  if (!collapsed) {
    return children;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isNavActive(pathname, item.href, item.exact);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      data-tour={item.tourId}
      className={cn(
        'flex items-center rounded-lg py-2 text-sm font-medium transition-colors',
        collapsed ? 'justify-center px-2' : 'gap-2 px-3',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
      )}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed ? item.label : null}
    </Link>
  );

  return (
    <CollapsibleTooltip collapsed={collapsed} label={item.label}>
      {link}
    </CollapsibleTooltip>
  );
}

export function DashboardNav({ isAdmin }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === 'true') {
      setCollapsed(true);
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        aria-label="Navegação principal"
        className={cn(
          'flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-14' : 'w-60',
        )}
      >
        <div
          className={cn(
            'border-b border-sidebar-border py-5',
            collapsed ? 'px-2' : 'px-4',
          )}
        >
          {collapsed ? (
            <Link
              href="/dashboard"
              className="flex justify-center"
              aria-label="SEI-Perceptio — Dashboard"
            >
              <span className="text-sm font-semibold tracking-tight text-sidebar-primary">
                SP
              </span>
            </Link>
          ) : (
            <Link href="/dashboard" className="block space-y-0.5">
              <span className="text-base font-semibold tracking-tight text-sidebar-primary">
                SEI-Perceptio
              </span>
              <span className="block text-xs text-muted-foreground">
                Inteligência sobre processos SEI
              </span>
            </Link>
          )}
        </div>

        <nav
          aria-label="Menu principal"
          className={cn(
            'flex flex-1 flex-col gap-6 overflow-y-auto py-4',
            collapsed ? 'px-2' : 'px-3',
          )}
        >
          <div className="space-y-1">
            {!collapsed ? (
              <p
                id="nav-principal-heading"
                className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Principal
              </p>
            ) : null}
            <div
              role="group"
              aria-label={collapsed ? 'Principal' : undefined}
              aria-labelledby={collapsed ? undefined : 'nav-principal-heading'}
            >
              {MAIN_NAV.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>

          {isAdmin ? (
            <div className="space-y-1">
              {!collapsed ? (
                <p
                  id="nav-admin-heading"
                  className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Administração
                </p>
              ) : null}
              <div
                role="group"
                aria-label={collapsed ? 'Administração' : undefined}
                aria-labelledby={collapsed ? undefined : 'nav-admin-heading'}
              >
                {ADMIN_NAV.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </nav>

        <div className={cn('border-t border-sidebar-border space-y-1', collapsed ? 'p-2' : 'p-3')}>
          <CollapsibleTooltip collapsed={collapsed} label="Glossário SEI">
            <SeiGlossaryNavLink collapsed={collapsed} />
          </CollapsibleTooltip>

          <CollapsibleTooltip collapsed={collapsed} label="Tour guiado">
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed ? 'justify-center px-2' : 'justify-start gap-2',
              )}
              onClick={() => restartOnboardingTour()}
              aria-label={collapsed ? 'Tour guiado' : undefined}
            >
              <HelpCircle className="size-4 shrink-0" aria-hidden />
              {!collapsed ? 'Tour guiado' : null}
            </Button>
          </CollapsibleTooltip>

          <CollapsibleTooltip collapsed={collapsed} label={loggingOut ? 'Saindo…' : 'Sair'}>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed ? 'justify-center px-2' : 'justify-start gap-2',
              )}
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              aria-busy={loggingOut}
              aria-label={collapsed ? (loggingOut ? 'Saindo…' : 'Sair') : undefined}
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              {!collapsed ? (loggingOut ? 'Saindo…' : 'Sair') : null}
            </Button>
          </CollapsibleTooltip>

          <CollapsibleTooltip
            collapsed={collapsed}
            label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'w-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed ? 'justify-center px-2' : 'justify-start gap-2',
              )}
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
              ) : (
                <PanelLeftClose className="size-4 shrink-0" aria-hidden />
              )}
              {!collapsed ? 'Recolher menu' : null}
            </Button>
          </CollapsibleTooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
