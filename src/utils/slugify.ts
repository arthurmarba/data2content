export default function slugify(input: string): string {
  return input
    .normalize('NFD')
    // Remove accents and diacritics
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
