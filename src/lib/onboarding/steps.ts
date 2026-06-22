export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  /** CSS selector; omit for centered modal */
  target?: string;
  /** Route template; `:notebookId` replaced when navigating */
  route?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Render citation demo card inside tooltip */
  showCitationDemo?: boolean;
  /** Step requires a notebook to exist */
  requiresNotebook?: boolean;
  /** Human-readable hint shown before programmatic navigation */
  navigationMessage?: string;
  /** Show shortcut to open/create demo notebook */
  allowsNotebookShortcut?: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao SEI-Perceptio',
    description:
      'Este tour rápido mostra como organizar fontes, consultar documentos com IA e interpretar citações rastreáveis. Use o menu lateral para navegar entre módulos.',
    target: '[data-tour="nav-notebooks"]',
    route: '/notebooks',
    placement: 'right',
    navigationMessage: 'Vamos para a página de Notebooks…',
  },
  {
    id: 'create-notebook',
    title: 'Criar um notebook',
    description:
      'Notebooks agrupam fontes e conversas por tema. Crie um novo (analistas/admin) ou abra um existente/compartilhado para continuar o tour.',
    target: '[data-tour="notebooks-page"]',
    route: '/notebooks',
    placement: 'bottom',
    allowsNotebookShortcut: true,
  },
  {
    id: 'add-sources',
    title: 'Adicionar fontes',
    description:
      'Envie arquivos (PDF, HTML, DOCX…) ou importe URLs públicas. As fontes passam por ingestão assíncrona antes de entrarem no contexto do chat.',
    target: '[data-tour="source-upload"]',
    route: '/notebooks/:notebookId',
    placement: 'right',
    requiresNotebook: true,
    allowsNotebookShortcut: true,
    navigationMessage: 'Vamos abrir um notebook para mostrar o upload de fontes…',
  },
  {
    id: 'chat-query',
    title: 'Fazer uma consulta',
    description:
      'Selecione as fontes ativas à esquerda, digite sua pergunta e envie. A resposta é gerada apenas com base nas fontes do notebook, com streaming em tempo real.',
    target: '[data-tour="chat-input"]',
    route: '/notebooks/:notebookId',
    placement: 'top',
    requiresNotebook: true,
    allowsNotebookShortcut: true,
    navigationMessage: 'Vamos ao chat do notebook…',
  },
  {
    id: 'citations',
    title: 'Interpretar citações',
    description:
      'Cada resposta cita trechos das fontes com número SEI, tipo, unidade e score de relevância. Clique em uma citação para localizar a fonte correspondente.',
    route: '/notebooks/:notebookId',
    placement: 'center',
    showCitationDemo: true,
    requiresNotebook: true,
    allowsNotebookShortcut: true,
    navigationMessage: 'Vamos ao notebook para ver as citações no contexto…',
  },
];

export function resolveOnboardingRoute(
  template: string | undefined,
  notebookId: string | null,
): string | null {
  if (!template) {
    return null;
  }

  if (template.includes(':notebookId')) {
    if (!notebookId) {
      return '/notebooks';
    }
    return template.replace(':notebookId', notebookId);
  }

  return template;
}
