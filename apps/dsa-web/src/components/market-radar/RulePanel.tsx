import type React from 'react';
import { useEffect, useState } from 'react';
import apiClient from '../../api/index';
import { toCamelCase } from '../../api/utils';

type RuleItem = {
  id: string;
  text: string;
  computable?: boolean;
};

type Props = {
  selectedRuleId: string | null;
  onSelect: (id: string | null) => void;
};

export const RulePanel: React.FC<Props> = ({ selectedRuleId, onSelect }) => {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiClient
      .get('/api/v1/trading-signals/rules')
      .then((response) => {
        if (!active) return;
        const payload = toCamelCase(response.data) as { rules?: RuleItem[] };
        setRules(payload.rules || []);
        setError(null);
      })
      .catch(() => {
        if (active) setError('规则库加载失败');
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = rules.find((rule) => rule.id === selectedRuleId) || null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 p-3 text-sm font-medium">纪律规则 R1–R77</div>
      {error ? <div className="p-3 text-sm text-danger">{error}</div> : null}
      <div className="flex-1 overflow-auto p-3">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {rules.map((rule) => (
            <button
              key={rule.id}
              type="button"
              title={rule.text}
              onClick={() => onSelect(rule.id === selectedRuleId ? null : rule.id)}
              className={
                rule.id === selectedRuleId
                  ? 'rounded border border-accent bg-accent/10 px-2 py-0.5 text-xs text-accent'
                  : 'rounded border border-border/50 px-2 py-0.5 text-xs text-secondary-text hover:border-accent/50'
              }
            >
              {rule.id}
            </button>
          ))}
        </div>
        {selected ? (
          <div className="rounded-xl border border-border/60 bg-panel/50 p-3 text-sm leading-relaxed">
            <div className="mb-1 font-medium">规则 {selected.id}</div>
            <div className="text-secondary-text">{selected.text}</div>
            {selected.computable ? (
              <div className="mt-2 text-xs text-muted-text">此规则可被盯盘引擎自动引用</div>
            ) : (
              <div className="mt-2 text-xs text-muted-text">纪律文案，通常由人工/分析引用</div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-text">点击规则编号查看详情</div>
        )}
      </div>
    </div>
  );
};
