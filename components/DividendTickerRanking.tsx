import React, { useState } from 'react';
import { Market } from '../types';
import type { Translations } from '../utils/i18n';

export type DividendTickerStat = {
  key: string;
  ticker: string;
  market: Market;
  /** 累積現金股利（基準幣別） */
  total: number;
  /** 今年現金股利（基準幣別） */
  thisYear: number;
  lastDate: string;
  isHeld: boolean;
};

const DEFAULT_VISIBLE_COUNT = 10;

interface DividendTickerRankingProps {
  rows: DividendTickerStat[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  baseCurrency: string;
  marketLabelMap: Record<Market, string>;
  fmt: (v: number) => string;
  labels: Translations['dividendHeatmap'];
}

const DividendTickerRanking: React.FC<DividendTickerRankingProps> = ({
  rows,
  selectedKey,
  onSelect,
  baseCurrency,
  marketLabelMap,
  fmt,
  labels,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) return null;

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const maxTotal = rows[0]?.total ?? 0;
  const visibleRows = expanded ? rows : rows.slice(0, DEFAULT_VISIBLE_COUNT);

  return (
    <div className="mt-6 border-t border-slate-100 pt-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium text-slate-800">{labels.rankingTitle}</h4>
        <span className="text-xs text-slate-400">
          {labels.rankingTotal} ({baseCurrency})
        </span>
      </div>
      <ul className="space-y-1">
        {visibleRows.map((row, index) => {
          const isSelected = row.key === selectedKey;
          const share = grandTotal > 0 ? (row.total / grandTotal) * 100 : 0;
          const barWidth = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
          return (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => onSelect(isSelected ? null : row.key)}
                aria-pressed={isSelected}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">{index + 1}</span>
                    <span className="font-mono text-sm font-semibold text-slate-800 truncate">{row.ticker}</span>
                    <span className="shrink-0 text-xs text-slate-400">{marketLabelMap[row.market] ?? row.market}</span>
                    {!row.isHeld && (
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        {labels.soldOut}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-amber-600">
                    {fmt(row.total)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3 pl-7">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-500" title={labels.rankingShare}>
                    {share.toFixed(1)}%
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-500">
                    {labels.rankingThisYear} {row.thisYear > 0 ? fmt(row.thisYear) : '—'}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length > DEFAULT_VISIBLE_COUNT && (
        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="rounded border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            {expanded ? labels.showLess : `${labels.showAll} (${rows.length})`}
          </button>
        </div>
      )}
    </div>
  );
};

export default DividendTickerRanking;
