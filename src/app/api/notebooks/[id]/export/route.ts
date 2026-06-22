import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { logAuditSafe } from '@/lib/governance/audit-log';
import { assertNotebookAccess } from '@/lib/notebook/access';
import {
  buildExportTraceability,
  loadNotebookExportData,
  sha256Content,
} from '@/lib/notebook/export-builder';
import { renderNotebookMarkdown } from '@/lib/notebook/export-markdown';
import { renderNotebookPdf } from '@/lib/notebook/export-pdf';
import {
  scanNotebookSigilo,
  validateSigiloExportConfirmation,
} from '@/lib/notebook/sigilo-notebook';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  formato: z.enum(['markdown', 'pdf']).optional().default('markdown'),
  sigilo_confirmacao: z.string().min(15).max(500).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

function safeFilename(nome: string, ext: string): string {
  const base = nome.replace(/[^\w.-]+/g, '_').slice(0, 80);
  return `notebook-${base}.${ext}`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const { id: notebookId } = await context.params;
    const parsed = QuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const access = await assertNotebookAccess({
      supabase: auth.supabase,
      notebookId,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      userRole: auth.role,
      require: 'export',
    });

    if (!access) {
      return forbiddenResponse('Sem permissão para exportar este notebook');
    }

    const sigilo = await scanNotebookSigilo(auth.supabase, notebookId, auth.orgaoId);
    const sigiloValidation = validateSigiloExportConfirmation(
      sigilo,
      auth.role,
      parsed.sigilo_confirmacao,
    );

    if (!sigiloValidation.allowed) {
      return NextResponse.json({ error: sigiloValidation.message }, { status: 403 });
    }

    const { data: perfil } = await auth.supabase
      .from('perfil')
      .select('nome_completo')
      .eq('user_id', auth.user.id)
      .eq('orgao_id', auth.orgaoId)
      .maybeSingle();

    const exportData = await loadNotebookExportData(
      auth.supabase,
      notebookId,
      auth.orgaoId,
      {
        id: auth.user.id,
        nome: perfil?.nome_completo ?? auth.user.email ?? auth.user.id,
      },
      sigilo.contem_sigiloso,
    );

    const preliminaryTrace = buildExportTraceability(
      exportData,
      parsed.formato,
      'pending',
    );

    if (parsed.formato === 'pdf') {
      const markdownForHash = renderNotebookMarkdown(exportData, {
        ...preliminaryTrace,
        formato: 'markdown',
        checksum_sha256: 'pending',
      });
      const checksum = sha256Content(markdownForHash.replace(/checksum_sha256: "pending"/, ''));

      const traceability = buildExportTraceability(exportData, 'pdf', checksum);
      const pdfBuffer = await renderNotebookPdf(exportData, traceability);

      await logAuditSafe({
        supabase: auth.supabase,
        orgaoId: auth.orgaoId,
        usuarioId: auth.user.id,
        acao: 'exportacao',
        entidadeTipo: 'notebook',
        entidadeId: notebookId,
        detalhes: {
          nome: exportData.notebook.nome,
          formato: 'pdf',
          checksum_sha256: checksum,
          contem_sigiloso: sigilo.contem_sigiloso,
          fontes_total: traceability.fontes_total,
          conversas_total: traceability.conversas_total,
        },
        request,
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeFilename(exportData.notebook.nome, 'pdf')}"`,
          'X-Export-Checksum': checksum,
          'X-IA-Declaration': traceability.ia_declaration,
        },
      });
    }

    const markdownDraft = renderNotebookMarkdown(exportData, {
      ...preliminaryTrace,
      checksum_sha256: 'pending',
    });
    const checksum = sha256Content(
      markdownDraft.replace('checksum_sha256: "pending"', 'checksum_sha256: ""'),
    );
    const markdown = markdownDraft.replace(
      'checksum_sha256: "pending"',
      `checksum_sha256: "${checksum}"`,
    );

    await logAuditSafe({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      usuarioId: auth.user.id,
      acao: 'exportacao',
      entidadeTipo: 'notebook',
      entidadeId: notebookId,
      detalhes: {
        nome: exportData.notebook.nome,
        formato: 'markdown',
        checksum_sha256: checksum,
        contem_sigiloso: sigilo.contem_sigiloso,
        fontes_total: preliminaryTrace.fontes_total,
        conversas_total: preliminaryTrace.conversas_total,
      },
      request,
    });

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename(exportData.notebook.nome, 'md')}"`,
        'X-Export-Checksum': checksum,
        'X-IA-Declaration': preliminaryTrace.ia_declaration,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('GET /api/notebooks/[id]/export error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
