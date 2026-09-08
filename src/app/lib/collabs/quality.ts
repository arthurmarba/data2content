import type { ContentIdeaScriptBlueprint } from '@/app/dashboard/boards/videoUpload/contentIdeaBlueprint';
export const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const words = (value: string) => new Set(normalize(value).split(' ').filter(word => word.length > 3));
export function overlap(a: string, b: string) {
  const aa = words(a), bb = words(b);
  return aa.size && bb.size ? [...aa].filter(word => bb.has(word)).length / Math.min(aa.size, bb.size) : 0;
}
export interface EditorialIdea { title: string; angle: string; hook: string; territory: string; scriptBlueprint?: ContentIdeaScriptBlueprint | null; }
/** Filtro de erros objetivos; não substitui a revisão humana da qualidade editorial. */
export function editorialIssues(idea: EditorialIdea, territories: string[], narrative: string) {
  const issues: string[] = [];
  if (!narrative.trim() || !territories.some(territory => normalize(territory) === normalize(idea.territory))) issues.push('map_mismatch');
  if (/^(fale|conte|compartilhe|aborde) sobre [^.?!]{0,40}$/i.test(idea.angle.trim())) issues.push('generic_direction');
  const scenes = idea.scriptBlueprint?.scenes || [];
  if (scenes.length < 3 || scenes.some(scene => !scene.visual.trim() || !scene.spokenIntent.trim())) issues.push('unfilmable');
  if (!scenes.some(scene => scene.beat === 'fechamento')) issues.push('missing_delivery');
  if (scenes.length && overlap(idea.hook, `${idea.angle} ${scenes.map(scene => scene.spokenIntent).join(' ')}`) === 0) issues.push('unsupported_hook');
  if (/garantid[oa]|vai viralizar|sucesso certo|comprovadamente/i.test(`${idea.hook} ${idea.angle}`)) issues.push('unsupported_promise');
  return issues;
}
export function distinctStories<T extends EditorialIdea>(candidates: T[], history: EditorialIdea[]) {
  const accepted: T[] = [];
  for (const idea of candidates) {
    if ([...history, ...accepted].some(previous => normalize(previous.territory) === normalize(idea.territory) && overlap(idea.angle, previous.angle) >= 0.78 && overlap(idea.hook, previous.hook) >= 0.55)) continue;
    accepted.push(idea);
  }
  return accepted;
}
