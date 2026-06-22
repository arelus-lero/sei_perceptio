import type { SupabaseClient } from '@supabase/supabase-js';

export async function upsertInBatches<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string,
  batchSize = 100,
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  let inserted = 0;

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const { error } = await supabase
      .from(table)
      // cast pontual: o overload genérico do supabase-js não aceita T[] aqui;
      // seguro porque `batch` já é validado pelo schema de seed antes de chamar.
      .upsert(batch as never, { onConflict });

    if (error) {
      throw new Error(`Upsert em ${table} falhou: ${error.message}`);
    }

    inserted += batch.length;
  }

  return inserted;
}
