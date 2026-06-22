export interface SanitizeUserPromptResult {
  clean: string;
  flagged: boolean;
  reasons: string[];
}

const MAX_PROMPT_LENGTH = 5000;

const NEUTRALIZED_PLACEHOLDER = '[conteúdo removido]';

/** Caracteres de controle (preserva \t, \n, \r). */
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Zero-width e formatadores invisíveis comuns em bypass. */
const ZERO_WIDTH_REGEX =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD\u180E\u061C\u2066-\u2069]/g;

interface InjectionPattern {
  id: string;
  pattern: RegExp;
}

const INJECTION_PATTERNS: InjectionPattern[] = [
  {
    id: 'ignore_previous_instructions_en',
    pattern:
      /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|earlier|preceding)\s+instructions?/gi,
  },
  {
    id: 'ignore_previous_instructions_pt',
    pattern:
      /ignor[ae]\s+(?:(?:todas?\s+)?(?:as\s+)?)?(?:instru[çc][õo]es?|regras?)\s+(?:anteriores?|pr[ée]vias?|acima)/gi,
  },
  {
    id: 'disregard_instructions',
    pattern:
      /(?:disregard|forget|override|bypass)\s+(?:all\s+|any\s+)?(?:previous|prior|your|the)\s+(?:instructions?|rules?|guidelines?)/gi,
  },
  {
    id: 'role_hijack_pt',
    pattern: /voc[êe]\s+[eé]\s+agora/gi,
  },
  {
    id: 'role_hijack_en',
    pattern: /you\s+are\s+now/gi,
  },
  {
    id: 'system_role_marker',
    pattern: /\bsystem\s*:/gi,
  },
  {
    id: 'assistant_role_marker',
    pattern: /\bassistant\s*:/gi,
  },
  {
    id: 'user_role_marker',
    pattern: /\buser\s*:/gi,
  },
  {
    id: 'role_delimiter_angle',
    pattern: /<\s*\|?\s*(?:system|assistant|user|human|ai)\s*\|?\s*>/gi,
  },
  {
    id: 'role_delimiter_bracket',
    pattern: /\[(?:INST|\/INST|SYS|SYSTEM)\]/gi,
  },
  {
    id: 'markdown_system_block',
    pattern: /```\s*system\b/gi,
  },
  {
    id: 'markdown_system_header',
    pattern: /#{1,6}\s*system\b/gi,
  },
  {
    id: 'new_system_prompt',
    pattern: /(?:new|novo)\s+(?:system\s+)?prompt/gi,
  },
];

function removeInvisibleCharacters(input: string): string {
  return input.replace(ZERO_WIDTH_REGEX, '').replace(CONTROL_CHAR_REGEX, '');
}

function neutralizeInjectionPatterns(
  input: string,
  reasons: Set<string>,
): string {
  let output = input;

  for (const { id, pattern } of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(output)) {
      reasons.add(id);
      pattern.lastIndex = 0;
      output = output.replace(pattern, NEUTRALIZED_PLACEHOLDER);
    }
  }

  return output;
}

function truncatePrompt(input: string): string {
  if (input.length <= MAX_PROMPT_LENGTH) {
    return input;
  }

  return input.slice(0, MAX_PROMPT_LENGTH);
}

export function sanitizeUserPrompt(input: string): SanitizeUserPromptResult {
  const reasons = new Set<string>();

  let normalized = input.normalize('NFKC');
  const withoutInvisible = removeInvisibleCharacters(normalized);

  if (withoutInvisible.length !== normalized.length) {
    reasons.add('invisible_characters_removed');
  }

  normalized = withoutInvisible;

  const neutralized = neutralizeInjectionPatterns(normalized, reasons);
  const clean = truncatePrompt(neutralized.trim());

  if (clean.length !== neutralized.trim().length) {
    reasons.add('truncated_to_max_length');
  }

  return {
    clean,
    flagged: reasons.size > 0,
    reasons: [...reasons],
  };
}
