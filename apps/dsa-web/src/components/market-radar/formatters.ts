export type SortKey = 'name' | 'price' | 'changePercent' | 'value' | 'performance' | 'trend' | 'signals';
export type SortDirection = 'asc' | 'desc';

export const money = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
export const number2 = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function signed(value: number, suffix = "") {
  return (value > 0 ? "+" : "") + number2.format(value) + suffix;
}

export function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e12) return number2.format(value / 1e12) + "万亿";
  if (Math.abs(value) >= 1e8) return number2.format(value / 1e8) + "亿";
  if (Math.abs(value) >= 1e4) return number2.format(value / 1e4) + "万";
  return money.format(value);
}

export function formatNetFlow(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "暂无数据";
  if (value === 0) return "净额 0";
  return (value > 0 ? "净流入 " : "净流出 ") + formatAmount(Math.abs(value));
}

export function levelLabel(level: "green" | "orange" | "blue" | "red") {
  return level === "green" ? "强风险" : level === "orange" ? "风险预警" : level === "blue" ? "中性观察" : "正向确认";
}

export function tradingMinuteOfDay(time: string) {
  const digits = time.replace(/\D/g, "");
  if (digits.length < 4) return 0;
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2, 4));
  const total = hour * 60 + minute;
  const morningStart = 9 * 60 + 30;
  const morningEnd = 11 * 60 + 30;
  const afternoonStart = 13 * 60;
  const afternoonEnd = 15 * 60;
  if (total <= morningStart) return 0;
  if (total <= morningEnd) return total - morningStart;
  if (total < afternoonStart) return 120;
  return Math.min(240, 120 + Math.min(total, afternoonEnd) - afternoonStart);
}
