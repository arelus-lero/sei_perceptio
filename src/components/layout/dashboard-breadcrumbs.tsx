'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  buildDashboardBreadcrumbs,
  extractNotebookIdFromPath,
} from '@/lib/navigation/dashboard-breadcrumbs';
import { cn } from '@/lib/utils';

interface DashboardBreadcrumbsProps {
  className?: string;
}

export function DashboardBreadcrumbs({ className }: DashboardBreadcrumbsProps) {
  const pathname = usePathname();
  const [resolvedLabels, setResolvedLabels] = useState<Record<string, string>>({});

  const notebookId = extractNotebookIdFromPath(pathname);

  useEffect(() => {
    if (!notebookId) {
      setResolvedLabels({});
      return;
    }

    let active = true;

    void fetch(`/api/notebooks/${notebookId}`)
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as { notebook?: { nome?: string } };
      })
      .then((payload) => {
        if (!active || !payload?.notebook?.nome) {
          return;
        }

        setResolvedLabels({ [notebookId]: payload.notebook.nome });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [notebookId]);

  const crumbs = useMemo(
    () => buildDashboardBreadcrumbs(pathname, resolvedLabels),
    [pathname, resolvedLabels],
  );

  return (
    <Breadcrumb className={cn('min-w-0', className)}>
      <BreadcrumbList className="min-w-0">
        {crumbs.flatMap((crumb, index) => {
          const item = (
            <BreadcrumbItem
              key={`breadcrumb-${index}-${crumb.label}`}
              className="min-w-0"
            >
              {crumb.isCurrent ? (
                <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href ?? '/dashboard'} className="truncate">
                    {crumb.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );

          if (index >= crumbs.length - 1) {
            return [item];
          }

          return [
            item,
            <BreadcrumbSeparator key={`breadcrumb-sep-${index}`} />,
          ];
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
