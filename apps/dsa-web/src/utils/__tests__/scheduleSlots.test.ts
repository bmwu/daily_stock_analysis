import { describe, expect, it } from 'vitest';
import {
  parseScheduleSlots,
  serializeScheduleSlots,
  serializeScheduleTimesFromSlots,
  nextAvailableScheduleTime,
  SCHEDULE_STOCK_MARKETS,
  type ScheduleSlotDraft,
} from '../scheduleSlots';

describe('scheduleSlots', () => {
  it('parses SCHEDULE_SLOTS string', () => {
    expect(parseScheduleSlots('09:00|us;15:30|cn,hk,jp')).toEqual([
      { time: '09:00', markets: ['us'] },
      { time: '15:30', markets: ['cn', 'hk', 'jp'] },
    ]);
  });

  it('falls back to SCHEDULE_TIMES with all markets', () => {
    expect(parseScheduleSlots('', '09:00,18:00')).toEqual([
      { time: '09:00', markets: [...SCHEDULE_STOCK_MARKETS] },
      { time: '18:00', markets: [...SCHEDULE_STOCK_MARKETS] },
    ]);
  });

  it('serializes slots and times', () => {
    const slots: ScheduleSlotDraft[] = [
      { time: '09:00', markets: ['us'] },
      { time: '15:30', markets: ['cn', 'hk', 'jp'] },
    ];
    expect(serializeScheduleSlots(slots)).toBe('09:00|us;15:30|cn,hk,jp');
    expect(serializeScheduleTimesFromSlots(slots)).toBe('09:00,15:30');
  });
});

  it('picks an unused time when preferred is taken', () => {
    expect(nextAvailableScheduleTime(['18:00'], '18:00')).toBe('00:00');
    expect(nextAvailableScheduleTime(['00:00', '00:30'], '18:00')).toBe('18:00');
  });
