import { notFound, redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth/server-context';
import { nupFromRouteParam, processoTimelineHref } from '@/lib/utils/processo-url';
import { validarNup } from '@/lib/utils/nup';

interface ProcessoPageProps {
  params: Promise<{ nup: string }>;
}

export default async function ProcessoPage({ params }: ProcessoPageProps) {
  const auth = await getServerAuthContext();
  if (!auth) {
    redirect('/login');
  }

  const routeNup = (await params).nup;
  const nup = nupFromRouteParam(routeNup);

  if (!validarNup(nup)) {
    notFound();
  }

  redirect(processoTimelineHref(nup));
}
