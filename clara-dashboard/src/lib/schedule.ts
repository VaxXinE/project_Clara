/** Pilihan jadwal follow-up cepat. Jam mengikuti perangkat Sales. */
export function atLocalTime(daysAhead: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export type QuickSchedule = {
  key: string;
  label: string;
  /** Versi pendek untuk baris daftar yang sempit. */
  shortLabel: string;
  date: () => Date;
};

export const QUICK_SCHEDULES: QuickSchedule[] = [
  { key: "tomorrow-morning", label: "Besok pagi (09.00)", shortLabel: "Besok pagi", date: () => atLocalTime(1, 9) },
  { key: "tomorrow-noon", label: "Besok siang (13.00)", shortLabel: "Besok siang", date: () => atLocalTime(1, 13) },
  { key: "day-after", label: "Lusa (09.00)", shortLabel: "Lusa", date: () => atLocalTime(2, 9) },
  { key: "next-week", label: "Minggu depan (09.00)", shortLabel: "Minggu depan", date: () => atLocalTime(7, 9) },
];
