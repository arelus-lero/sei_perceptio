#!/usr/bin/env node

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';

const DEFAULT_USER_EMAIL = process.env.DEFAULT_USER_EMAIL ?? 'admin@local.dev';
const DEFAULT_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD ?? 'admin123456';
const DEFAULT_USER_NAME = process.env.DEFAULT_USER_NAME ?? 'Administrador Local';
const DEFAULT_ORG_NOME = process.env.DEFAULT_ORG_NOME ?? 'Órgão de Desenvolvimento';
const DEFAULT_ORG_SIGLA = process.env.DEFAULT_ORG_SIGLA ?? 'DEV';
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function createAdminSupabaseClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isExistingEmailError(error: { status?: number; message?: string; code?: string }): boolean {
  return (
    error.status === 422
    || error.code === 'email_exists'
    || (error.message?.toLowerCase().includes('already') ?? false)
    || (error.message?.toLowerCase().includes('exists') ?? false)
  );
}

async function findAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Falha ao listar usuários auth: ${error.message}`);
    }

    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found?.id) {
      return found.id;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function ensureOrgao(
  supabase: SupabaseClient,
  nome: string,
  sigla: string,
): Promise<string> {
  const { error: upsertError } = await supabase.from('orgao').upsert(
    { nome, sigla },
    { onConflict: 'sigla' },
  );

  if (upsertError) {
    throw new Error(`Falha ao upsert orgao (sigla=${sigla}): ${upsertError.message}`);
  }

  const { data, error: selectError } = await supabase
    .from('orgao')
    .select('id')
    .eq('sigla', sigla)
    .single();

  if (selectError || !data?.id) {
    throw new Error(`Órgão não encontrado após upsert (sigla=${sigla}).`);
  }

  return data.id;
}

async function ensureAuthUser(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const { data, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!createError && data.user?.id) {
    return data.user.id;
  }

  if (createError && isExistingEmailError(createError)) {
    const userId = await findAuthUserIdByEmail(supabase, email);

    if (!userId) {
      throw new Error(
        `Usuário ${email} já existe no Auth, mas não foi encontrado via listUsers.`,
      );
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });

    if (updateError) {
      throw new Error(`Falha ao atualizar usuário existente ${email}: ${updateError.message}`);
    }

    return userId;
  }

  throw new Error(
    createError
      ? `Falha ao criar usuário ${email}: ${createError.message}`
      : `createUser não retornou id para ${email}`,
  );
}

/**
 * INSERT via postgres direto: policies de INSERT em `perfil` exigem jwt_role()='admin',
 * o que impede o bootstrap do primeiro admin via PostgREST mesmo com service role em alguns
 * fluxos. Conexão postgres ignora RLS e dispara sync_auth_user_app_metadata_from_perfil.
 */
async function ensurePerfilViaPg(
  pgClient: PgClient,
  userId: string,
  orgaoId: string,
  nomeCompleto: string,
  siglaUnidade: string,
): Promise<void> {
  await pgClient.query(
    `
      INSERT INTO public.perfil (user_id, orgao_id, role, nome_completo, sigla_unidade)
      VALUES ($1, $2, 'admin', $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        orgao_id = EXCLUDED.orgao_id,
        role = EXCLUDED.role,
        nome_completo = EXCLUDED.nome_completo,
        sigla_unidade = EXCLUDED.sigla_unidade,
        updated_at = NOW()
    `,
    [userId, orgaoId, nomeCompleto, siglaUnidade],
  );
}

interface AuthMetadataRow {
  role: string | null;
  orgao_id: string | null;
  nome_completo: string | null;
}

async function readAuthAppMetadata(
  pgClient: PgClient,
  userId: string,
): Promise<AuthMetadataRow> {
  const result = await pgClient.query<{ raw_app_meta_data: Record<string, unknown> | null }>(
    `SELECT raw_app_meta_data FROM auth.users WHERE id = $1`,
    [userId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Usuário ${userId} não encontrado em auth.users após upsert de perfil.`);
  }

  const meta = row.raw_app_meta_data ?? {};

  return {
    role: typeof meta.role === 'string' ? meta.role : null,
    orgao_id: typeof meta.orgao_id === 'string' ? meta.orgao_id : null,
    nome_completo: typeof meta.nome_completo === 'string' ? meta.nome_completo : null,
  };
}

async function main(): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const pgClient = new PgClient({ connectionString: DATABASE_URL });

  let orgaoId: string | undefined;
  let userId: string | undefined;

  try {
    await pgClient.connect();

    try {
      console.log('→ Garantindo órgão de desenvolvimento…');
      orgaoId = await ensureOrgao(supabase, DEFAULT_ORG_NOME, DEFAULT_ORG_SIGLA);
      console.log(`  orgao_id=${orgaoId} (sigla=${DEFAULT_ORG_SIGLA})`);
    } catch (error) {
      throw new Error(
        `Etapa orgao falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      console.log('→ Garantindo usuário no Auth…');
      userId = await ensureAuthUser(supabase, DEFAULT_USER_EMAIL, DEFAULT_USER_PASSWORD);
      console.log(`  user_id=${userId}`);
    } catch (error) {
      throw new Error(
        `Etapa auth falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      console.log('→ Garantindo perfil admin (SQL direto, bypass RLS)…');
      await ensurePerfilViaPg(
        pgClient,
        userId,
        orgaoId,
        DEFAULT_USER_NAME,
        DEFAULT_ORG_SIGLA,
      );
    } catch (error) {
      throw new Error(
        `Etapa perfil falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      const pgMetadata = await readAuthAppMetadata(pgClient, userId);
      const { data: authUserData, error: getUserError } = await supabase.auth.admin.getUserById(
        userId,
      );

      if (getUserError) {
        throw new Error(`Falha ao verificar app_metadata via Admin API: ${getUserError.message}`);
      }

      const apiMetadata = authUserData.user?.app_metadata ?? {};

      console.log('→ Metadados sincronizados (auth.users / Admin API):');
      console.log(`  pg.role=${pgMetadata.role} | api.role=${String(apiMetadata.role ?? '—')}`);
      console.log(
        `  pg.orgao_id=${pgMetadata.orgao_id} | api.orgao_id=${String(apiMetadata.orgao_id ?? '—')}`,
      );

      if (pgMetadata.role !== 'admin' || pgMetadata.orgao_id !== orgaoId) {
        throw new Error(
          'Trigger de sync não propagou role/orgao_id para auth.users.raw_app_meta_data.',
        );
      }
    } catch (error) {
      throw new Error(
        `Etapa verificação de metadados falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(' Usuário padrão de desenvolvimento provisionado');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Email:    ${DEFAULT_USER_EMAIL}`);
    console.log(`  Senha:    ${DEFAULT_USER_PASSWORD}`);
    console.log(`  Role:     admin`);
    console.log(`  Órgão:    ${DEFAULT_ORG_SIGLA} (${DEFAULT_ORG_NOME})`);
    console.log(`  orgao_id: ${orgaoId}`);
    console.log(`  user_id:  ${userId}`);
    console.log('');
    console.log(' Faça logout/login no app para o JWT carregar os novos metadados.');
    console.log('═══════════════════════════════════════════════════════');
  } finally {
    await pgClient.end().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('');
  console.error('✗ seed-default-user falhou:', message);
  process.exitCode = 1;
});
