'use client';

import {
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
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
import { DashboardBreadcrumbs } from '@/components/layout/dashboard-breadcrumbs';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { restartOnboardingTour } from '@/components/onboarding/onboarding-provider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { writeSidebarOpenCookie } from '@/lib/sidebar/constants';
import { cn } from '@/lib/utils';
import { createBrowserClient } from '@/lib/supabase/client';

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
  { label: 'Processos', href: '/processos', icon: FolderOpen },
  { label: 'Relações', href: '/relacoes', icon: Network },
  { label: 'Relatoria', href: '/analytics/relatoria', icon: BarChart3 },
  { label: 'Monitoramento', href: '/monitoramento', icon: Bell },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Auditoria', href: '/admin/auditoria', icon: ScrollText },
  { label: 'Retenção', href: '/admin/retencao', icon: Archive },
  { label: 'Usuários', href: '/admin/usuarios', icon: Users },
];

interface DashboardShellProps {
  isAdmin: boolean;
  defaultSidebarOpen?: boolean;
  children: ReactNode;
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
  mobile,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const active = isNavActive(pathname, item.href, item.exact);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      data-tour={item.tourId}
      onClick={onNavigate}
      className={cn(
        'flex items-center rounded-lg text-sm font-medium transition-colors',
        mobile ? 'min-h-11 gap-3 px-3' : 'py-2',
        !mobile && collapsed ? 'justify-center px-2' : !mobile ? 'gap-2 px-3' : '',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed && !mobile ? item.label : undefined}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed || mobile ? item.label : null}
    </Link>
  );

  return (
    <CollapsibleTooltip collapsed={collapsed && !mobile} label={item.label}>
      {link}
    </CollapsibleTooltip>
  );
}

interface DashboardNavPanelProps {
  isAdmin: boolean;
  collapsed: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
  onToggleCollapsed?: () => void;
  loggingOut: boolean;
  onLogout: () => void;
}

function DashboardNavPanel({
  isAdmin,
  collapsed,
  mobile = false,
  onNavigate,
  onToggleCollapsed,
  loggingOut,
  onLogout,
}: DashboardNavPanelProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          'shrink-0 border-b border-sidebar-border py-5',
          collapsed && !mobile ? 'px-2' : 'px-4',
        )}
      >
        {collapsed && !mobile ? (
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center justify-center"
            aria-label="SEI-Perceptio — Dashboard"
            onClick={onNavigate}
          >
            <span className="text-sm font-semibold tracking-tight text-sidebar-primary">
              SP
            </span>
          </Link>
        ) : (
          <Link href="/dashboard" className="block space-y-0.5" onClick={onNavigate}>
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
          collapsed && !mobile ? 'px-2' : 'px-3',
        )}
      >
        <div className="space-y-1">
          {!collapsed || mobile ? (
            <p
              id="nav-principal-heading"
              className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Principal
            </p>
          ) : null}
          <div
            role="group"
            aria-label={collapsed && !mobile ? 'Principal' : undefined}
            aria-labelledby={collapsed && !mobile ? undefined : 'nav-principal-heading'}
          >
            {MAIN_NAV.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                mobile={mobile}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>

        {isAdmin ? (
          <div className="space-y-1">
            {!collapsed || mobile ? (
              <p
                id="nav-admin-heading"
                className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Administração
              </p>
            ) : null}
            <div
              role="group"
              aria-label={collapsed && !mobile ? 'Administração' : undefined}
              aria-labelledby={collapsed && !mobile ? undefined : 'nav-admin-heading'}
            >
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  mobile={mobile}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ) : null}
      </nav>

      <div
        className={cn(
          'shrink-0 space-y-1 border-t border-sidebar-border',
          collapsed && !mobile ? 'p-2' : 'p-3',
        )}
      >
        <CollapsibleTooltip collapsed={collapsed && !mobile} label="Glossário SEI">
          <SeiGlossaryNavLink collapsed={collapsed && !mobile} mobile={mobile} onNavigate={onNavigate} />
        </CollapsibleTooltip>

        <CollapsibleTooltip collapsed={collapsed && !mobile} label="Tour guiado">
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              mobile ? 'min-h-11 justify-start gap-3 px-3' : '',
              collapsed && !mobile ? 'justify-center px-2' : !mobile ? 'justify-start gap-2' : '',
            )}
            onClick={() => {
              restartOnboardingTour();
              onNavigate?.();
            }}
            aria-label={collapsed && !mobile ? 'Tour guiado' : undefined}
          >
            <HelpCircle className="size-4 shrink-0" aria-hidden />
            {!collapsed || mobile ? 'Tour guiado' : null}
          </Button>
        </CollapsibleTooltip>

        <CollapsibleTooltip collapsed={collapsed && !mobile} label={loggingOut ? 'Saindo…' : 'Sair'}>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              mobile ? 'min-h-11 justify-start gap-3 px-3' : '',
              collapsed && !mobile ? 'justify-center px-2' : !mobile ? 'justify-start gap-2' : '',
            )}
            onClick={onLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            aria-label={collapsed && !mobile ? (loggingOut ? 'Saindo…' : 'Sair') : undefined}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            {!collapsed || mobile ? (loggingOut ? 'Saindo…' : 'Sair') : null}
          </Button>
        </CollapsibleTooltip>

        {!mobile && onToggleCollapsed ? (
          <CollapsibleTooltip
            collapsed={collapsed}
            label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed ? 'justify-center px-2' : 'justify-start gap-2',
              )}
              onClick={onToggleCollapsed}
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
        ) : null}
      </div>
    </div>
  );
}

export function DashboardShell({
  isAdmin,
  defaultSidebarOpen = true,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const collapsed = !sidebarOpen;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setSidebarOpen((previous) => {
      const next = !previous;
      writeSidebarOpenCookie(next);
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
      <div className="flex min-h-full flex-1">
        <aside
          aria-label="Navegação principal"
          className={cn(
            'sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-sidebar-border transition-[width] duration-200 ease-in-out md:flex',
            collapsed ? 'w-16' : 'w-60',
          )}
        >
          <DashboardNavPanel
            isAdmin={isAdmin}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            loggingOut={loggingOut}
            onLogout={() => void handleLogout()}
          />
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-full max-w-none border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-xs"
            aria-label="Navegação principal"
          >
            <DashboardNavPanel
              isAdmin={isAdmin}
              collapsed={false}
              mobile
              onNavigate={() => setMobileOpen(false)}
              loggingOut={loggingOut}
              onLogout={() => void handleLogout()}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-h-full min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 md:hidden"
              aria-label="Abrir menu de navegação"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" aria-hidden />
            </Button>
            <DashboardBreadcrumbs className="min-w-0 flex-1" />
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="flex min-h-full min-w-0 flex-1 flex-col bg-background outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
