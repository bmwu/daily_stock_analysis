import { describe, expect, it } from 'vitest';
import {
  formatTriggerDataSource,
  formatTriggerLimitation,
  formatTriggerQualityLevel,
  formatTriggerReason,
  formatTriggerStatus,
} from '../alertTriggerDisplay';

describe('alertTriggerDisplay', () => {
  it('localizes status, quality, limitations, and data sources', () => {
    expect(formatTriggerStatus('triggered', 'zh')).toBe('已触发');
    expect(formatTriggerQualityLevel('usable', 'zh')).toBe('可用');
    expect(formatTriggerLimitation('quote: fallback', 'zh')).toBe('行情：降级');
    expect(formatTriggerLimitation('technical: partial', 'zh')).toBe('技术：部分可用');
    expect(formatTriggerDataSource('realtime_quote', 'zh')).toBe('实时行情');
  });

  it('localizes common trigger reasons for zh UI', () => {
    expect(formatTriggerReason('600519 price above 1800', 'zh')).toBe('600519 价格上破 1800');
    expect(formatTriggerReason('600519 price above 1800: current = 1801', 'zh')).toBe(
      '600519 价格上破 1800：当前 1801',
    );
    expect(formatTriggerReason('No realtime quote available', 'zh')).toBe('暂无实时行情');
    expect(formatTriggerReason('Market Light status red matched [\'red\', \'yellow\']', 'zh')).toBe(
      '大盘红绿灯状态为红灯，命中 红灯、黄灯',
    );
  });

  it('keeps english reasons unchanged for en UI', () => {
    expect(formatTriggerReason('600519 price above 1800', 'en')).toBe('600519 price above 1800');
    expect(formatTriggerDataSource('realtime_quote', 'en')).toBe('Realtime quote');
  });
});
