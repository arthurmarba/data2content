// ---------- src/utils/dateHelpers.ts ----------

import { Types } from "mongoose";

/**
 * Calcula a média móvel de engajamento.
 * (Implementação existente neste módulo)
 */
export async function calculateMovingAverageEngagement(
  userId: string | Types.ObjectId,
  dataWindowInDays: number,
  movingAverageWindowInDays: number
): Promise<any> {
  // ... implementação existente ...
}

/**
 * Retorna a data de início com base no período informado.
 */
export function getStartDateFromTimePeriod(
  refDate: Date,
  period: string
): Date {
  const d = new Date(refDate);
  switch (period) {
    case 'last_7_days':
      d.setDate(d.getDate() - 6);
      break;
    case 'last_14_days':
      d.setDate(d.getDate() - 13);
      break;
    case 'last_30_days':
      d.setDate(d.getDate() - 29);
      break;
    case 'last_60_days':
      d.setDate(d.getDate() - 59);
      break;
    case 'last_3_months':
    case 'last_90_days':
      d.setDate(d.getDate() - 89);
      break;
    case 'last_120_days':
      d.setDate(d.getDate() - 119);
      break;
    case 'last_180_days':
      d.setDate(d.getDate() - 179);
      break;
    case 'last_6_months':
      d.setMonth(d.getMonth() - 5);
      break;
    case 'last_12_months':
      d.setFullYear(d.getFullYear() - 1);
      break;
    default:
      return new Date(0);
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Adiciona dias a uma data.
 */
export function addDays(date: Date, count: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}

/**
 * Adiciona meses a uma data.
 */
export function addMonths(date: Date, count: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + count);
  return d;
}

/**
 * Formata data no padrão YYYY-MM.
 */
export function formatDateYYYYMM(date: Date): string {
  const mm = date.getMonth() + 1;
  return `${date.getFullYear()}-${mm < 10 ? '0' + mm : mm}`;
}

/**
 * Formata data no padrão YYYY-MM-DD.
 */
export function formatDateYYYYMMDD(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const mmStr = mm < 10 ? '0' + mm : '' + mm;
  const ddStr = dd < 10 ? '0' + dd : '' + dd;
  return `${yyyy}-${mmStr}-${ddStr}`;
}

/**
 * Retorna a chave de ano-semana no formato YYYY-WW (ISO week).
 */
export function getYearWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO week date algorithm
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekStr = weekNo < 10 ? '0' + weekNo : '' + weekNo;
  return `${d.getUTCFullYear()}-${weekStr}`;
}

/**
 * Exporta todos os helpers em objeto padrão
 */
const dateHelpers = {
  calculateMovingAverageEngagement,
  getStartDateFromTimePeriod,
  addDays,
  addMonths,
  formatDateYYYYMM,
  formatDateYYYYMMDD,
  getYearWeek,
};

export default dateHelpers;
