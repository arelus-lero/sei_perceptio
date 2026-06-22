import * as cheerio from 'cheerio';

import type { DocumentTextExtractionResult } from '@/types/ocr';

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'head']);
const TABLE_SECTION_TAGS = new Set(['tbody', 'thead', 'tfoot']);

interface ParsedHtmlNode {
  type?: string;
  tagName?: string;
  name?: string;
  data?: string | null;
  children?: ParsedHtmlNode[];
}

function getTagName(node: ParsedHtmlNode): string {
  return (node.tagName ?? node.name ?? '').toLowerCase();
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function looksLikeBrokenUtf8(text: string): boolean {
  if (text.includes('\uFFFD')) {
    return true;
  }

  return /Ã[§£¡ªº´]|â€|ï¿½/.test(text);
}

function decodeHtmlBuffer(buffer: Buffer): { html: string; encoding: string } {
  const head = buffer.subarray(0, 8192).toString('latin1');
  const metaMatch = head.match(/<meta[^>]+charset=["']?\s*([^"'\s/>]+)/i);
  const xmlMatch = head.match(/<\?xml[^>]+encoding=["']([^"']+)"/i);
  const declared = (metaMatch?.[1] ?? xmlMatch?.[1] ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');

  if (declared.includes('utf-8') || declared === 'utf8') {
    return { html: buffer.toString('utf-8'), encoding: 'utf-8' };
  }

  if (
    declared.includes('1252')
    || declared.includes('latin1')
    || declared.includes('iso-8859-1')
    || declared.includes('latin-1')
  ) {
    return { html: buffer.toString('latin1'), encoding: 'latin1' };
  }

  const utf8 = buffer.toString('utf-8');
  if (looksLikeBrokenUtf8(utf8)) {
    return { html: buffer.toString('latin1'), encoding: 'latin1' };
  }

  return { html: utf8, encoding: 'utf-8' };
}

function getNodeText(node: ParsedHtmlNode): string {
  if (node.type === 'text') {
    return collapseWhitespace(String(node.data ?? ''));
  }

  if (node.type !== 'tag') {
    return '';
  }

  const pieces = (node.children ?? [])
    .map((child) => getNodeText(child))
    .filter((piece) => piece.length > 0);

  return collapseWhitespace(pieces.join(' '));
}

function extractTableLines(table: ParsedHtmlNode): string[] {
  const lines: string[] = [];

  function walkTable(node: ParsedHtmlNode): void {
    const tag = getTagName(node);

    if (tag === 'tr') {
      const cells = (node.children ?? [])
        .filter((child) => {
          const childTag = getTagName(child);
          return childTag === 'td' || childTag === 'th';
        })
        .map((cell) => getNodeText(cell))
        .filter((cell) => cell.length > 0);

      if (cells.length > 0) {
        lines.push(cells.join(' | '));
      }
      return;
    }

    if (tag === 'table' || TABLE_SECTION_TAGS.has(tag)) {
      for (const child of node.children ?? []) {
        walkTable(child);
      }
    }
  }

  walkTable(table);
  return lines;
}

function extractNodeLines(node: ParsedHtmlNode): string[] {
  if (node.type === 'text') {
    const text = collapseWhitespace(String(node.data ?? ''));
    return text ? [text] : [];
  }

  if (node.type !== 'tag') {
    return [];
  }

  const tag = getTagName(node);

  if (SKIP_TAGS.has(tag)) {
    return [];
  }

  if (tag === 'table') {
    return extractTableLines(node);
  }

  if (tag === 'br') {
    return [''];
  }

  const lines: string[] = [];
  const children = node.children ?? [];

  for (const child of children) {
    lines.push(...extractNodeLines(child));
  }

  const blockTags = new Set(['p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']);
  if (blockTags.has(tag) && lines.length > 0) {
    lines.push('');
  }

  return lines;
}

function normalizeExtractedLines(lines: string[]): string {
  const normalized: string[] = [];

  for (const line of lines) {
    const collapsed = collapseWhitespace(line);
    if (collapsed.length === 0) {
      if (normalized.length > 0 && normalized[normalized.length - 1] !== '') {
        normalized.push('');
      }
      continue;
    }
    normalized.push(collapsed);
  }

  while (normalized[0] === '') {
    normalized.shift();
  }
  while (normalized[normalized.length - 1] === '') {
    normalized.pop();
  }

  return normalized.join('\n');
}

export function extractHtmlText(buffer: Buffer): DocumentTextExtractionResult {
  const { html, encoding } = decodeHtmlBuffer(buffer);
  const $ = cheerio.load(html);

  $('script, style, noscript').remove();

  const root = $('body').get(0) as ParsedHtmlNode | undefined;
  const fallbackRoot = $.root().get(0) as ParsedHtmlNode | undefined;
  const lines = root
    ? extractNodeLines(root)
    : fallbackRoot
      ? extractNodeLines(fallbackRoot)
      : [];
  const text = normalizeExtractedLines(lines);

  return {
    text: text.length > 0 ? text : null,
    method: 'html',
    ocr_applied: false,
    requires_ocr: false,
    page_count: null,
    ocr_confidence: null,
    encoding,
  };
}
