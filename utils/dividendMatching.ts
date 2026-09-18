// 將 MoneyDJ／Yahoo 取得的歷史配息與既有交易記錄做對照，避免「待確認實績配息」清單把已記錄過的配息再次列出。
import { Account, CashFlow, Market, Transaction, TransactionType } from '../types';
import { getPortfolioStateAtDate } from './calculations';

const QTY_EPS = 0.000001;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetweenIso(a: string, b: string): number {
  const ta = new Date(`${a}T12:00:00`).getTime();
  const tb = new Date(`${b}T12:00:00`).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(ta - tb) / MS_PER_DAY;
}

/** 取 'YYYY-MM-DD' 的 'YYYY-MM' 部分；無效輸入回空字串。 */
function ymOf(ymd: string): string {
  const s = (ymd || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : '';
}

/** 比對配息／待補登用：忽略 TPE: 前綴、大小寫 */
export function normalizeDividendTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^TPE:/i, '');
}

/**
 * 判斷某個 ticker + 除息日，使用者是否已經有對應的 CASH_DIVIDEND 交易紀錄。
 * 因使用者可能用「除息日」或「發放日」記錄，兩者通常相差 1–2 週，預設容忍 ±14 天。
 * （目前畫面以月份為基準的判定見 findExistingCashDividendInSameMonth；此函式保留供其他模組沿用。）
 */
export function findExistingCashDividendTx(
  transactions: Transaction[],
  ticker: string,
  exDateYmd: string,
  toleranceDays = 14
): Transaction | null {
  const upperTicker = normalizeDividendTicker(ticker);
  for (const tx of transactions) {
    if (tx.type !== TransactionType.CASH_DIVIDEND) continue;
    if (normalizeDividendTicker(tx.ticker) !== upperTicker) continue;
    const txDate = (tx.date || '').slice(0, 10);
    if (!txDate) continue;
    if (daysBetweenIso(txDate, exDateYmd) <= toleranceDays) return tx;
  }
  return null;
}

/**
 * 與熱力圖月份顯示對齊的「已記錄」判定：只要該 ticker 在「給定日期的同年同月」
 * 已存在任一筆 CASH_DIVIDEND 交易，就視為已記錄。
 *
 * 之所以採月份（而非 ±N 天）為基準，是要呼應使用者的直覺：
 * 「熱力圖上那個月已經顯示了實績琥珀色 → 不需再列入待確認」。
 *
 * 可選 accountId：傳入時只匹配該帳戶下的交易。多帳戶持有同 ticker 時，
 * 才能讓「甲證券已記錄、乙證券尚未記錄」分別判定。
 */
export function findExistingCashDividendInSameMonth(
  transactions: Transaction[],
  ticker: string,
  payOrExDateYmd: string,
  accountId?: string,
  market?: Market
): Transaction | null {
  const targetYm = ymOf(payOrExDateYmd);
  if (!targetYm) return null;
  const upperTicker = normalizeDividendTicker(ticker);
  for (const tx of transactions) {
    if (tx.type !== TransactionType.CASH_DIVIDEND) continue;
    if (normalizeDividendTicker(tx.ticker) !== upperTicker) continue;
    if (market && tx.market !== market) continue;
    if (ymOf(tx.date) !== targetYm) continue;
    if (accountId && tx.accountId !== accountId) continue;
    return tx;
  }
  return null;
}

export function tickerHasRecordedCashDividendInExMonth(
  transactions: Transaction[],
  recordedTickersInMonth: Record<string, number> | undefined,
  ticker: string,
  exDateYmd: string,
  market: Market,
  accountId?: string,
  /** 發放日；待確認實績入帳多用 payDate，台股常跨月，需一併比對 */
  payDateYmd?: string
): boolean {
  const datesToCheck = [exDateYmd];
  if (payDateYmd && payDateYmd !== exDateYmd) datesToCheck.push(payDateYmd);

  for (const dateYmd of datesToCheck) {
    if (findExistingCashDividendInSameMonth(transactions, ticker, dateYmd, accountId, market)) {
      return true;
    }
  }

  // 熱力圖月份彙總無法區分帳戶；僅在未指定帳戶時作為後備判定。
  if (accountId) return false;
  if (!recordedTickersInMonth) return false;
  const norm = normalizeDividendTicker(ticker);
  return Object.entries(recordedTickersInMonth).some(
    ([t, amt]) => normalizeDividendTicker(t) === norm && amt > 0
  );
}

/**
 * 除息日前一日結束時，各帳戶對該 ticker 的持股股數（> 0 才列入）。
 * 美股／ETF 等：須在除息日「之前」持有才有配息資格；除息日當天買進不計入。
 * 用於待補登配息提示與試算股數。
 */
export function listAccountTickerQuantitiesAtExDate(
  transactions: Transaction[],
  cashFlows: CashFlow[],
  accounts: Account[],
  market: Market,
  ticker: string,
  exDateYmd: string
): Array<{ accountId: string; quantity: number }> {
  const cumDateYmd = ymdAddCalendarDays(exDateYmd, -1);
  if (!cumDateYmd) return [];
  const d = new Date(`${cumDateYmd}T23:59:59`);
  if (Number.isNaN(d.getTime())) return [];
  const { accountHoldings } = getPortfolioStateAtDate(d, transactions, cashFlows, accounts);
  const upper = normalizeDividendTicker(ticker);
  return accountHoldings
    .filter(
      h =>
        h.market === market &&
        normalizeDividendTicker(h.ticker) === upper &&
        h.quantity > QTY_EPS
    )
    .map(h => ({ accountId: h.accountId, quantity: h.quantity }))
    .sort((a, b) => b.quantity - a.quantity);
}

/** YYYY-MM-DD 加減日（以 UTC 日曆避免時區偏移） */
function ymdAddCalendarDays(ymd: string, deltaDays: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd || '').slice(0, 10));
  if (!m) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}
