import * as crypto from 'crypto';

export function generateSlug(title: string): string {
  const normalized = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const base = normalized || 'article';
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}
