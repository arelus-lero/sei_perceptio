import { redirect } from 'next/navigation';

import { RelatoriaView } from '@/components/analytics/relatoria-view';
import { getServerAuthContext } from '@/lib/auth/server-context';

export default async function RelatoriaAnalyticsPage() {
  const auth = await getServerAuthContext();
  if (!auth) {
    redirect('/login');
  }

  return <RelatoriaView />;
}
