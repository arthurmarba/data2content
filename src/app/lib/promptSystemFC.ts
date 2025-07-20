// @/app/lib/promptSystemFC.ts – v2.35.0
// Template moved to external markdown for easier editing.

import fs from 'fs';
import path from 'path';

/**
 * Carrega o prompt base do Tuca a partir de systemPromptTemplate.md e
 * substitui o placeholder de nome do usuário.
 */
export function getSystemPrompt(userName: string = 'usuário'): string {
  const templatePath = path.join(__dirname, 'systemPromptTemplate.md');
  let template = fs.readFileSync(templatePath, 'utf8');
  return template.replace(/{{USER_NAME}}/g, userName);
}
