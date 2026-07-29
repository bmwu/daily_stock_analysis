export const SCHEDULE_STOCK_MARKETS = ['cn', 'hk', 'us', 'jp', 'kr', 'tw'] as const;

export type ScheduleStockMarket = (typeof SCHEDULE_STOCK_MARKETS)[number];

export type ScheduleSlotDraft = {
  time: string;
  markets: readonly ScheduleStockMarket[];
};

const SCHEDULE_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MARKET_SET = new Set<string>(SCHEDULE_STOCK_MARKETS);

export function normalizeScheduleMarkets(markets: readonly string[]): ScheduleStockMarket[] {
  const selected = new Set(
    markets
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item): item is ScheduleStockMarket => MARKET_SET.has(item)),
  );
  return SCHEDULE_STOCK_MARKETS.filter((market) => selected.has(market));
}

export function serializeScheduleSlots(slots: readonly ScheduleSlotDraft[]): string {
  return slots
    .map((slot) => {
      const time = String(slot.time || '').trim();
      const markets = normalizeScheduleMarkets(slot.markets);
      const marketPart = markets.length > 0 ? markets.join(',') : SCHEDULE_STOCK_MARKETS.join(',');
      return `${time}|${marketPart}`;
    })
    .filter((part) => SCHEDULE_TIME_PATTERN.test(part.split('|', 1)[0] || ''))
    .join(';');
}

export function parseScheduleSlots(
  slotsValue?: string,
  timesValue?: string,
  fallbackTime = '18:00',
): ScheduleSlotDraft[] {
  const rawSlots = String(slotsValue ?? '').trim();
  if (rawSlots) {
    const parsed: ScheduleSlotDraft[] = [];
    const seen = new Set<string>();
    for (const part of rawSlots.split(';')) {
      const token = part.trim();
      if (!token) continue;
      const [timeRaw, marketsRaw = ''] = token.split('|', 2);
      const time = String(timeRaw || '').trim();
      if (!SCHEDULE_TIME_PATTERN.test(time) || seen.has(time)) continue;
      const markets = marketsRaw.trim()
        ? normalizeScheduleMarkets(marketsRaw.split(','))
        : [...SCHEDULE_STOCK_MARKETS];
      if (marketsRaw.trim() && markets.length === 0) continue;
      seen.add(time);
      parsed.push({
        time,
        markets: markets.length > 0 ? markets : [...SCHEDULE_STOCK_MARKETS],
      });
    }
    if (parsed.length > 0) {
      return parsed.sort((a, b) => a.time.localeCompare(b.time));
    }
  }

  const times = String(timesValue ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => SCHEDULE_TIME_PATTERN.test(item));
  const uniqueTimes = [...new Set(times.length > 0 ? times : [fallbackTime || '18:00'])];
  return uniqueTimes.map((time) => ({
    time,
    markets: [...SCHEDULE_STOCK_MARKETS],
  }));
}

export function serializeScheduleTimesFromSlots(slots: readonly ScheduleSlotDraft[]): string {
  return [...new Set(slots.map((slot) => slot.time.trim()).filter(Boolean))].sort().join(',');
}

/** Pick an unused HH:MM for a new schedule row (times must stay unique). */
export function nextAvailableScheduleTime(
  usedTimes: readonly string[],
  preferred = '18:00',
): string {
  const used = new Set(
    usedTimes
      .map((item) => String(item || '').trim())
      .filter((item) => SCHEDULE_TIME_PATTERN.test(item)),
  );
  const preferredTime = String(preferred || '').trim();
  if (SCHEDULE_TIME_PATTERN.test(preferredTime) && !used.has(preferredTime)) {
    return preferredTime;
  }

  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      const candidate = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      if (!used.has(candidate)) {
        return candidate;
      }
    }
  }

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 1) {
      const candidate = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      if (!used.has(candidate)) {
        return candidate;
      }
    }
  }

  return preferredTime || '18:00';
}
