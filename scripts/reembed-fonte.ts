/**
 * Reprocessa embeddings de uma fonte (CLI).
 * Uso: pnpm exec tsx scripts/reembed-fonte.ts <fonte_id>
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const fonteId = process.argv[2];

  if (!fonteId) {
    console.error('Uso: pnpm exec tsx scripts/reembed-fonte.ts <fonte_id>');
    process.exit(1);
  }

  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const { runEmbeddingReprocess } = await import(
    '../src/lib/ingestion/run-ingestion-pipeline'
  );

  const supabase = createAdminClient();

  const { data: fonte, error } = await supabase
    .from('fonte')
    .select('id, orgao_id, titulo, metadados_json')
    .eq('id', fonteId)
    .maybeSingle();

  if (error || !fonte) {
    console.error('Fonte não encontrada:', error?.message ?? fonteId);
    process.exit(1);
  }

  console.info(`Re-embed fonte=${fonteId} titulo=${fonte.titulo} orgao=${fonte.orgao_id}`);

  const result = await runEmbeddingReprocess({
    supabase,
    fonteId,
    orgaoId: fonte.orgao_id,
  });

  console.info('Resultado:', result);

  const { count } = await supabase
    .from('chunk')
    .select('id', { count: 'exact', head: true })
    .eq('fonte_id', fonteId)
    .not('embedding', 'is', null);

  console.info(`Chunks com embedding: ${count ?? 0}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
