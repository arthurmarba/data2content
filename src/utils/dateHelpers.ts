// src/utils/dateHelpers.ts

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const expectedMonth = (d.getMonth() + months) % 12;
  d.setMonth(d.getMonth() + months);
  // Adjust if month rollover changed the month unexpectedly (e.g. Jan 31 + 1 month should be Feb 28/29)
  if (d.getMonth() !== (expectedMonth < 0 ? expectedMonth + 12 : expectedMonth) ) {
    d.setDate(0); // Go to the last day of the previous month
  }
  return d;
}

export function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDateYYYYMM(date: Date): string {
  return date.toISOString().substring(0, 7); // YYYY-MM
}

export function getStartDateFromTimePeriod(endDate: Date, timePeriod: string): Date {
  const startDate = new Date(endDate); // Create a new instance to avoid modifying the original endDate
  startDate.setHours(0, 0, 0, 0); // Set to start of the day

  // Adjust endDate to be end of its day for consistent period length calculation
  const adjustedEndDate = new Date(endDate);
  adjustedEndDate.setHours(23,59,59,999);


  switch (timePeriod) {
    case "all_time":
      return new Date(0); // Epoch
    case "last_7_days":
       startDate.setDate(adjustedEndDate.getDate() - 7 + 1); // Include today
      break;
    case "last_30_days":
      startDate.setDate(adjustedEndDate.getDate() - 30 + 1);
      break;
    case "last_90_days":
      startDate.setDate(adjustedEndDate.getDate() - 90 + 1);
      break;
    case "last_6_months":
      startDate.setMonth(adjustedEndDate.getMonth() - 6 + 1); // +1 because we setDate(1) later
      startDate.setDate(1); // Start from the first day of that month
      break;
    case "last_12_months":
      startDate.setFullYear(adjustedEndDate.getFullYear() - 1 + 0); // +1 because we setDate(1) later
      startDate.setMonth(adjustedEndDate.getMonth() +1); // ajuste de mes
      startDate.setDate(1);
      break;
    default:
      if (timePeriod.startsWith("last_") && timePeriod.endsWith("_days")) {
        const days = parseInt(timePeriod.split("_")[1]);
        if (!isNaN(days) && days > 0) {
          startDate.setDate(adjustedEndDate.getDate() - days + 1);
        } else {
          startDate.setDate(adjustedEndDate.getDate() - 90 + 1); // Default (ex: 90 days)
        }
      } else if (timePeriod.startsWith("last_") && timePeriod.endsWith("_months")) {
        const months = parseInt(timePeriod.split("_")[1]);
        if (!isNaN(months) && months > 0) {
          startDate.setMonth(adjustedEndDate.getMonth() - months +1);
          startDate.setDate(1);
        } else {
          startDate.setMonth(adjustedEndDate.getMonth() - 6 +1); // Default (ex: 6 months)
          startDate.setDate(1);
        }
      } else {
        startDate.setDate(adjustedEndDate.getDate() - 90 + 1); // Default overall
      }
      break;
  }
  // Ensure startDate is set to the beginning of its day
  startDate.setHours(0,0,0,0);
  return startDate;
}


// Specifically for monthly aggregation where we want the start of the first month.
export function getStartDateFromTimePeriodMonthly(endDate: Date, timePeriod: string): Date {
  const startDate = new Date(endDate); // Start with a copy of endDate
  startDate.setDate(1); // Set to the first day of the endDate's month initially
  startDate.setHours(0, 0, 0, 0);

  switch (timePeriod) {
    case "last_3_months":
      startDate.setMonth(startDate.getMonth() - 2); // endDate month is one, so -2 for 3 months total
      break;
    case "last_6_months":
      startDate.setMonth(startDate.getMonth() - 5);
      break;
    case "last_12_months":
      startDate.setMonth(startDate.getMonth() - 11);
      break;
    default:
      if (timePeriod.startsWith("last_") && timePeriod.endsWith("_months")) {
        const months = parseInt(timePeriod.split("_")[1]);
        if (!isNaN(months) && months > 0) {
          startDate.setMonth(startDate.getMonth() - (months - 1));
        } else {
          startDate.setMonth(startDate.getMonth() - 5); // Default (ex: 6 months)
        }
      } else {
        startDate.setMonth(startDate.getMonth() - 5); // Default overall (ex: 6 months)
      }
      break;
  }
  return startDate;
}

export function getYearWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Sunday = 0, Monday = 1, etc. Day 0 needs to be 7 for this logic.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-' + String(weekNo).padStart(2, '0');
}
```
