const DEMO_NOTEBOOK_NAME = 'Notebook de demonstração';
const DEMO_NOTEBOOK_DESC =
  'Criado automaticamente para o tour guiado do SEI-Perceptio.';

export async function fetchFirstNotebookId(): Promise<string | null> {
  try {
    const response = await fetch('/api/notebooks');
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      notebooks?: Array<{ id: string }>;
    };

    return payload.notebooks?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function createDemoNotebook(): Promise<string | null> {
  try {
    const response = await fetch('/api/notebooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: DEMO_NOTEBOOK_NAME,
        descricao: DEMO_NOTEBOOK_DESC,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { id?: string };
    return payload.id ?? null;
  } catch {
    return null;
  }
}

export async function openOrCreateDemoNotebook(): Promise<{
  notebookId: string | null;
  created: boolean;
}> {
  const existingId = await fetchFirstNotebookId();
  if (existingId) {
    return { notebookId: existingId, created: false };
  }

  const createdId = await createDemoNotebook();
  return { notebookId: createdId, created: createdId !== null };
}
