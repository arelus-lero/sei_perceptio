import { notFound, redirect } from 'next/navigation';

import { TimelineView } from '@/components/processo/timeline-view';
import { getServerAuthContext } from '@/lib/auth/server-context';
import { nupFromRouteParam } from '@/lib/utils/processo-url';
import { validarNup } from '@/lib/utils/nup';

interface TimelinePageProps {
  params: Promise<{ nup: string }>;
}

export default async function ProcessoTimelinePage({ params }: TimelinePageProps) {
  const auth = await getServerAuthContext();
  if (!auth) {
    redirect('/login');
  }

  const routeNup = (await params).nup;
  const nup = nupFromRouteParam(routeNup);

  if (!validarNup(nup)) {
    notFound();
  }

  return <TimelineView nup={nup} />;
}
