import { TimePeriod } from '@/app/lib/constants/timePeriods';

export function timePeriodToDays(timePeriod: TimePeriod): number {
  switch (timePeriod) {
    case 'last_7_days':
      return 7;
    case 'last_30_days':
      return 30;
    case 'last_90_days':
      return 90;
    case 'last_180_days':
      return 180;
    case 'last_6_months':
      return 180;
    case 'last_12_months':
      return 365;
    case 'all_time':
      return 365 * 5;
    default:
      return 90;
  }
}
