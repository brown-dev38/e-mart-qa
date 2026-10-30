export function qualityToday(now = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isQualityCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1000-01-01") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function effectiveDateError(value: unknown): string | null {
  if (value === "" || value == null) return "กรุณาระบุวันที่มีผลใช้บังคับ";
  if (!isQualityCalendarDate(value)) return "วันที่มีผลใช้บังคับไม่ถูกต้อง";
  return null;
}
