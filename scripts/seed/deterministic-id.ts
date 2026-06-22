import { createHash } from 'node:crypto';

const SEED_NAMESPACE = 'a3f2c8e1-4b5d-6e7f-8091-a2b3c4d5e6f7';

export function seedUuid(scope: string, key: string): string {
  const hash = createHash('sha1')
    .update(`${SEED_NAMESPACE}:${scope}:${key}`)
    .digest();

  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;

  const hex = hash.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
