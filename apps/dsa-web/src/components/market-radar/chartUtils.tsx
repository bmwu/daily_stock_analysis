import { ruleText, splitRuleIds } from './ruleText';
import type { SortDirection, SortKey } from './formatters';

export function SortHeader({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
}) {
  const active = current.key === sortKey;
  const directionText = active ? (current.direction === "asc" ? "升序" : "降序") : "未排序";
  return (
    <span role="columnheader" aria-sort={active ? (current.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={"sort-button " + (active ? "active" : "")}
        onClick={() => onSort(sortKey)}
        aria-label={`${label}，当前${directionText}，点击${active && current.direction === "desc" ? "切换为升序" : "切换为降序"}`}
        title={`${label}：${directionText}，点击切换`}
      >
        {label}<i aria-hidden="true">{active ? (current.direction === "asc" ? "↑" : "↓") : "↕"}</i>
      </button>
    </span>
  );
}

export function RuleBadges({ value, compact = false, onSelect }: { value: string; compact?: boolean; onSelect?: (id: string) => void }) {
  return (
    <span className={"rule-badges " + (compact ? "compact" : "")}>
      {splitRuleIds(value).map((id) => (
        <button
          type="button"
          className="rule-tooltip"
          data-tooltip={ruleText[id] ?? "规则内容待补充"}
          title={ruleText[id] ?? "规则内容待补充"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect?.(id);
          }}
          key={id}
        >
          {compact ? id : "规则 " + id}
        </button>
      ))}
    </span>
  );
}
