export interface EvaluatedCell {
  raw: string;
  display: string;
  numericValue: number | null;
  isFormula: boolean;
  error: string | null;
}

export interface EvaluatedGrid {
  rows: EvaluatedCell[][];
  hasFormulas: boolean;
  formulaCount: number;
}

export function colIndexToLetters(colIndex: number): string {
  let n = colIndex + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function lettersToColIndex(letters: string): number {
  const upper = letters.toUpperCase();
  let col = 0;
  for (let i = 0; i < upper.length; i++) {
    col = col * 26 + (upper.charCodeAt(i) - 64);
  }
  return col - 1;
}

export function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = ref.trim().match(/^\$?([A-Za-z]{1,3})\$?(\d+)$/);
  if (!m) return null;
  const col = lettersToColIndex(m[1]);
  const row = Number(m[2]) - 1;
  if (col < 0 || row < 0) return null;
  return { col, row };
}

/**
 * Shift relative A1 cell references in a formula by (rowDelta, colDelta),
 * preserving $-anchored column or row components (e.g. $A$1, $A1, A$1).
 */
export function shiftFormulaReferences(
  formula: string,
  rowDelta: number,
  colDelta: number
): string {
  if (!formula.trim().startsWith('=')) return formula;
  if (rowDelta === 0 && colDelta === 0) return formula;

  // Avoid modifying inside double-quoted string literals
  let out = '';
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (ch === '"') {
      out += ch;
      i++;
      while (i < formula.length) {
        out += formula[i];
        if (formula[i] === '"' && formula[i + 1] === '"') {
          out += formula[i + 1];
          i += 2;
        } else if (formula[i] === '"') {
          i++;
          break;
        } else {
          i++;
        }
      }
      continue;
    }

    const rest = formula.slice(i);
    const refMatch = rest.match(/^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/);
    if (refMatch && (i === 0 || !/[A-Za-z0-9_]/.test(formula[i - 1]))) {
      const [full, colDollar, colLetters, rowDollar, rowDigits] = refMatch;
      const origCol = lettersToColIndex(colLetters);
      const origRow = Number(rowDigits) - 1;
      const nextCol = colDollar ? origCol : Math.max(0, origCol + colDelta);
      const nextRow = rowDollar ? origRow : Math.max(0, origRow + rowDelta);
      out += `${colDollar}${colIndexToLetters(nextCol)}${rowDollar}${nextRow + 1}`;
      i += full.length;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

/**
 * Adjust cell references across all formulas in a matrix when a row or column is inserted/deleted.
 */
export function adjustFormulasForRowColEdit(
  matrix: string[][],
  action: 'insert-row' | 'delete-row' | 'insert-col' | 'delete-col',
  index: number
): string[][] {
  const adjustFormula = (formula: string): string => {
    if (!formula.trim().startsWith('=')) return formula;
    let out = '';
    let i = 0;
    while (i < formula.length) {
      const ch = formula[i];
      if (ch === '"') {
        out += ch;
        i++;
        while (i < formula.length) {
          out += formula[i];
          if (formula[i] === '"' && formula[i + 1] === '"') {
            out += formula[i + 1];
            i += 2;
          } else if (formula[i] === '"') {
            i++;
            break;
          } else {
            i++;
          }
        }
        continue;
      }

      const rest = formula.slice(i);
      const refMatch = rest.match(/^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/);
      if (refMatch && (i === 0 || !/[A-Za-z0-9_]/.test(formula[i - 1]))) {
        const [full, colDollar, colLetters, rowDollar, rowDigits] = refMatch;
        let col = lettersToColIndex(colLetters);
        let row = Number(rowDigits) - 1;
        let deleted = false;

        if (action === 'insert-row') {
          if (row >= index) row += 1;
        } else if (action === 'delete-row') {
          if (row === index) deleted = true;
          else if (row > index) row -= 1;
        } else if (action === 'insert-col') {
          if (col >= index) col += 1;
        } else if (action === 'delete-col') {
          if (col === index) deleted = true;
          else if (col > index) col -= 1;
        }

        out += deleted
          ? '#REF!'
          : `${colDollar}${colIndexToLetters(Math.max(0, col))}${rowDollar}${Math.max(0, row) + 1}`;
        i += full.length;
        continue;
      }

      out += ch;
      i++;
    }
    return out;
  };

  return matrix.map((row) => row.map((cell) => adjustFormula(cell)));
}

export type AutoFillMode = 'auto' | 'copy' | 'series' | 'weekdays' | 'months' | 'years';
export type AutoFillDirection = 'down' | 'up' | 'right' | 'left';

const EN_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EN_DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const JA_DAYS_SHORT = ['日', '月', '火', '水', '木', '金', '土'];
const JA_DAYS_MED = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
const JA_DAYS_LONG = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
const JA_MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const BUILTIN_CYCLIC_LISTS: string[][] = [
  EN_DAYS_SHORT,
  EN_DAYS_LONG,
  EN_MONTHS_SHORT,
  EN_MONTHS_LONG,
  JA_DAYS_SHORT,
  JA_DAYS_MED,
  JA_DAYS_LONG,
  JA_MONTHS,
];

function applyCaseTemplate(template: string, target: string): string {
  if (template === template.toUpperCase() && template !== template.toLowerCase()) {
    return target.toUpperCase();
  }
  if (template === template.toLowerCase() && template !== template.toUpperCase()) {
    return target.toLowerCase();
  }
  return target;
}

function matchCyclicList(val: string): { listIdx: number; itemIdx: number; template: string } | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (let listIdx = 0; listIdx < BUILTIN_CYCLIC_LISTS.length; listIdx++) {
    const list = BUILTIN_CYCLIC_LISTS[listIdx];
    const itemIdx = list.findIndex((item) => item.toLowerCase() === lower);
    if (itemIdx !== -1) {
      return { listIdx, itemIdx, template: trimmed };
    }
  }
  return null;
}

interface ParsedDateValue {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  sep: string;
  padMonth: boolean;
  padDay: boolean;
  isJapanese: boolean;
}

function parseAutoFillDate(val: string): ParsedDateValue | null {
  const trimmed = val.trim();
  const ymd = trimmed.match(/^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[3]);
    const day = Number(ymd[4]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
      return {
        year,
        month,
        day,
        sep: ymd[2],
        padMonth: ymd[3].length === 2,
        padDay: ymd[4].length === 2,
        isJapanese: false,
      };
    }
  }
  const jp = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (jp) {
    const year = Number(jp[1]);
    const month = Number(jp[2]);
    const day = Number(jp[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
      return {
        year,
        month,
        day,
        sep: '',
        padMonth: jp[2].length === 2,
        padDay: jp[3].length === 2,
        isJapanese: true,
      };
    }
  }
  return null;
}

function formatAutoFillDate(d: Date, fmt: ParsedDateValue): string {
  const y = String(d.getFullYear()).padStart(4, '0');
  const mRaw = String(d.getMonth() + 1);
  const dRaw = String(d.getDate());
  const m = fmt.padMonth ? mRaw.padStart(2, '0') : mRaw;
  const day = fmt.padDay ? dRaw.padStart(2, '0') : dRaw;
  if (fmt.isJapanese) return `${y}年${m}月${day}日`;
  return `${y}${fmt.sep}${m}${fmt.sep}${day}`;
}

function addMonthsClamped(base: Date, months: number): Date {
  const targetMonthIndex = base.getMonth() + months;
  const d = new Date(base.getFullYear(), targetMonthIndex, 1);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(base.getDate(), maxDay));
  return d;
}

function addWeekdays(base: Date, weekdayDelta: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dir = weekdayDelta >= 0 ? 1 : -1;
  let remaining = Math.abs(weekdayDelta);
  while (remaining > 0) {
    d.setDate(d.getDate() + dir);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      remaining--;
    }
  }
  return d;
}

interface ParsedTimeValue {
  hours: number;
  minutes: number;
  seconds: number;
  hasSeconds: boolean;
  padHour: boolean;
}

function parseAutoFillTime(val: string): ParsedTimeValue | null {
  const m = val.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = m[3] !== undefined ? Number(m[3]) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return {
    hours,
    minutes,
    seconds,
    hasSeconds: m[3] !== undefined,
    padHour: m[1].length === 2,
  };
}

function formatAutoFillTime(totalSeconds: number, fmt: ParsedTimeValue): string {
  const daySecs = 86400;
  const norm = ((totalSeconds % daySecs) + daySecs) % daySecs;
  const h = Math.floor(norm / 3600);
  const m = Math.floor((norm % 3600) / 60);
  const s = norm % 60;
  const hStr = fmt.padHour ? String(h).padStart(2, '0') : String(h);
  const mStr = String(m).padStart(2, '0');
  if (fmt.hasSeconds) {
    return `${hStr}:${mStr}:${String(s).padStart(2, '0')}`;
  }
  return `${hStr}:${mStr}`;
}

function parseStrictNumber(val: string): number | null {
  const trimmed = val.trim();
  if (!trimmed || !/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function formatSeriesNumber(n: number): string {
  const rounded = Number(n.toFixed(10));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function matchQuarter(val: string): { prefix: string; num: number; suffix: string } | null {
  const trimmed = val.trim();
  const m1 = trimmed.match(/^(Q|Qtr\s*|Quarter\s*)([1-4])$/i);
  if (m1) return { prefix: m1[1], num: Number(m1[2]), suffix: '' };
  const m2 = trimmed.match(/^(第)([1-4])(四半期)$/);
  if (m2) return { prefix: m2[1], num: Number(m2[2]), suffix: m2[3] };
  return null;
}

function matchOrdinal(val: string): { num: number; upper: boolean } | null {
  const m = val.trim().match(/^(\d+)(st|nd|rd|th)$/i);
  if (!m) return null;
  return { num: Number(m[1]), upper: m[2] === m[2].toUpperCase() };
}

function formatOrdinal(num: number, upper: boolean): string {
  const abs = Math.abs(num);
  const mod100 = abs % 100;
  let suffix = 'th';
  if (mod100 < 11 || mod100 > 13) {
    if (abs % 10 === 1) suffix = 'st';
    else if (abs % 10 === 2) suffix = 'nd';
    else if (abs % 10 === 3) suffix = 'rd';
  }
  return `${num}${upper ? suffix.toUpperCase() : suffix}`;
}

function matchLabelWithTrailingNumber(
  val: string
): { prefix: string; num: number; width: number; hasLeadingZero: boolean; suffix: string } | null {
  // Match trailing number (e.g. "Item 1", "A001") or Japanese counter (e.g. "第1回", "1番")
  const trailing = val.match(/^(.*?)(\d+)$/);
  if (trailing && trailing[1].trim().length > 0) {
    const digits = trailing[2];
    return {
      prefix: trailing[1],
      num: Number(digits),
      width: digits.length,
      hasLeadingZero: digits.length > 1 && digits.startsWith('0'),
      suffix: '',
    };
  }
  const embedded = val.match(/^([^\d]+)(\d+)([^\d]+)$/);
  if (embedded) {
    const digits = embedded[2];
    return {
      prefix: embedded[1],
      num: Number(digits),
      width: digits.length,
      hasLeadingZero: digits.length > 1 && digits.startsWith('0'),
      suffix: embedded[3],
    };
  }
  return null;
}

/**
 * Determine whether `auto` mode defaults to `'copy'` or `'series'` for a given source slice,
 * matching Excel 2003 behavior (and flipping when Ctrl/Option is held).
 */
export function resolveAutoFillEffectiveMode(
  sourceValues: string[],
  mode: AutoFillMode = 'auto',
  toggleModifier = false
): Exclude<AutoFillMode, 'auto'> {
  if (mode !== 'auto') return mode;

  const nonEmpty = sourceValues.filter((v) => v.trim() !== '');
  let defaultMode: 'copy' | 'series' = 'copy';

  if (nonEmpty.length > 0) {
    const nums = sourceValues.map(parseStrictNumber);
    if (nums.every((n) => n !== null)) {
      // Single number -> Copy by default; 2+ numbers -> Series (linear trend) by default
      defaultMode = sourceValues.length >= 2 ? 'series' : 'copy';
    } else if (
      sourceValues.every((v) => parseAutoFillDate(v) !== null) ||
      sourceValues.every((v) => parseAutoFillTime(v) !== null) ||
      sourceValues.every((v) => matchCyclicList(v) !== null) ||
      sourceValues.every((v) => matchQuarter(v) !== null) ||
      sourceValues.every((v) => matchOrdinal(v) !== null) ||
      sourceValues.every((v) => matchLabelWithTrailingNumber(v) !== null)
    ) {
      defaultMode = 'series';
    }
  }

  if (toggleModifier) {
    return defaultMode === 'series' ? 'copy' : 'series';
  }
  return defaultMode;
}

/**
 * Generate Excel 2003-compatible AutoFill values along a 1D slice.
 * `sourceValues` is ordered top-to-bottom (vertical) or left-to-right (horizontal).
 * Returned array has length `targetCount` ordered from the cell closest to the source outward?
 * Wait: returned array is ordered in grid order:
 * - for `down` / `right`: index 0 is immediately after sourceValues[len-1], ..., index targetCount-1 is farthest.
 * - for `up` / `left`: index 0 is farthest (topmost/leftmost), ..., index targetCount-1 is immediately before sourceValues[0].
 */
export function generateAutoFillSeries(
  sourceValues: string[],
  targetCount: number,
  direction: AutoFillDirection,
  mode: AutoFillMode = 'auto',
  toggleModifier = false
): string[] {
  if (targetCount <= 0 || sourceValues.length === 0) return [];
  const len = sourceValues.length;
  const effectiveMode = resolveAutoFillEffectiveMode(sourceValues, mode, toggleModifier);
  const isReverse = direction === 'up' || direction === 'left';
  const isVertical = direction === 'down' || direction === 'up';

  // Build target logical indices relative to sourceValues[0..len-1]
  // Forward: len, len+1, ..., len+targetCount-1
  // Reverse (in grid order): -targetCount, ..., -2, -1
  const targetIndices: number[] = [];
  if (isReverse) {
    for (let i = -targetCount; i <= -1; i++) targetIndices.push(i);
  } else {
    for (let i = len; i < len + targetCount; i++) targetIndices.push(i);
  }

  // Formulas always shift relative references regardless of copy/series
  if (sourceValues.some((v) => v.trim().startsWith('='))) {
    return targetIndices.map((idx) => {
      const srcIdx = ((idx % len) + len) % len;
      const srcVal = sourceValues[srcIdx];
      if (srcVal.trim().startsWith('=')) {
        const delta = idx - srcIdx;
        return shiftFormulaReferences(srcVal.trim(), isVertical ? delta : 0, isVertical ? 0 : delta);
      }
      return srcVal;
    });
  }

  if (effectiveMode === 'copy') {
    return targetIndices.map((idx) => {
      const srcIdx = ((idx % len) + len) % len;
      return sourceValues[srcIdx];
    });
  }

  // 1. Numeric series (linear regression for 2+ numbers, +/-1 for 1 number)
  const nums = sourceValues.map(parseStrictNumber);
  if (nums.every((n): n is number => n !== null)) {
    let slope = 1;
    let intercept = nums[0];
    if (len >= 2) {
      const meanX = (len - 1) / 2;
      const meanY = nums.reduce((a, b) => a + b, 0) / len;
      let num = 0;
      let den = 0;
      for (let x = 0; x < len; x++) {
        num += (x - meanX) * (nums[x] - meanY);
        den += (x - meanX) * (x - meanX);
      }
      slope = den === 0 ? 0 : num / den;
      intercept = meanY - slope * meanX;
    }
    return targetIndices.map((idx) => formatSeriesNumber(intercept + slope * idx));
  }

  // 2. Date series
  const dates = sourceValues.map(parseAutoFillDate);
  if (dates.every((d): d is ParsedDateValue => d !== null)) {
    const fmt = dates[0];
    const baseDate = new Date(dates[0].year, dates[0].month - 1, dates[0].day);
    if (effectiveMode === 'weekdays') {
      return targetIndices.map((idx) => {
        const step = isReverse ? idx : idx - (len - 1);
        const anchor = isReverse
          ? baseDate
          : new Date(dates[len - 1].year, dates[len - 1].month - 1, dates[len - 1].day);
        return formatAutoFillDate(addWeekdays(anchor, step), fmt);
      });
    }
    if (effectiveMode === 'months') {
      return targetIndices.map((idx) => formatAutoFillDate(addMonthsClamped(baseDate, idx), fmt));
    }
    if (effectiveMode === 'years') {
      return targetIndices.map((idx) => formatAutoFillDate(addMonthsClamped(baseDate, idx * 12), fmt));
    }
    let dayStep = 1;
    if (len >= 2) {
      const d1 = new Date(dates[1].year, dates[1].month - 1, dates[1].day);
      dayStep = Math.round((d1.getTime() - baseDate.getTime()) / 86400000);
    }
    return targetIndices.map((idx) => {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + idx * dayStep);
      return formatAutoFillDate(d, fmt);
    });
  }

  // 3. Time series
  const times = sourceValues.map(parseAutoFillTime);
  if (times.every((t): t is ParsedTimeValue => t !== null)) {
    const fmt = times[0];
    const toSecs = (t: ParsedTimeValue) => t.hours * 3600 + t.minutes * 60 + t.seconds;
    const baseSecs = toSecs(times[0]);
    let stepSecs = 3600; // Excel 2003 default: +1 hour
    if (len >= 2) {
      stepSecs = toSecs(times[1]) - baseSecs;
    }
    return targetIndices.map((idx) => formatAutoFillTime(baseSecs + idx * stepSecs, fmt));
  }

  // 4. Built-in cyclic lists (days of week, months in EN & JA)
  const cyclic = sourceValues.map(matchCyclicList);
  if (
    cyclic.every((c): c is NonNullable<typeof c> => c !== null) &&
    cyclic.every((c) => c.listIdx === cyclic[0].listIdx)
  ) {
    const list = BUILTIN_CYCLIC_LISTS[cyclic[0].listIdx];
    const listLen = list.length;
    let step = 1;
    if (len >= 2) {
      const diff = (cyclic[1].itemIdx - cyclic[0].itemIdx + listLen) % listLen;
      step = diff === 0 ? listLen : diff;
    }
    return targetIndices.map((idx) => {
      const itemIdx = (((cyclic[0].itemIdx + idx * step) % listLen) + listLen) % listLen;
      return applyCaseTemplate(cyclic[0].template, list[itemIdx]);
    });
  }

  // 5. Quarters (Q1..Q4, 第1四半期..第4四半期)
  const quarters = sourceValues.map(matchQuarter);
  if (quarters.every((q): q is NonNullable<typeof q> => q !== null)) {
    const q0 = quarters[0];
    const step = len >= 2 ? quarters[1].num - q0.num : 1;
    return targetIndices.map((idx) => {
      const n = ((((q0.num - 1 + idx * step) % 4) + 4) % 4) + 1;
      return `${q0.prefix}${n}${q0.suffix}`;
    });
  }

  // 6. Ordinals (1st, 2nd, 3rd...)
  const ordinals = sourceValues.map(matchOrdinal);
  if (ordinals.every((o): o is NonNullable<typeof o> => o !== null)) {
    const o0 = ordinals[0];
    const step = len >= 2 ? ordinals[1].num - o0.num : 1;
    return targetIndices.map((idx) => {
      const n = Math.max(0, o0.num + idx * step);
      return formatOrdinal(n, o0.upper);
    });
  }

  // 7. Text with trailing/embedded number ("Item 1", "A001", "第1回")
  const labels = sourceValues.map(matchLabelWithTrailingNumber);
  if (
    labels.every((l): l is NonNullable<typeof l> => l !== null) &&
    labels.every((l) => l.prefix === labels[0].prefix && l.suffix === labels[0].suffix)
  ) {
    const l0 = labels[0];
    const step = len >= 2 ? labels[1].num - l0.num : 1;
    return targetIndices.map((idx) => {
      const nextNum = Math.max(0, l0.num + idx * step);
      const numStr = l0.hasLeadingZero
        ? String(nextNum).padStart(l0.width, '0')
        : String(nextNum);
      return `${l0.prefix}${numStr}${l0.suffix}`;
    });
  }

  // Fallback: copy pattern
  return targetIndices.map((idx) => {
    const srcIdx = ((idx % len) + len) % len;
    return sourceValues[srcIdx];
  });
}

/** Compute autofill value at (rowDelta, colDelta) from a source cell value. */
export function computeAutoFillValue(
  sourceValue: string,
  rowDelta: number,
  colDelta: number
): string {
  const trimmed = sourceValue.trim();
  if (trimmed.startsWith('=')) {
    return shiftFormulaReferences(trimmed, rowDelta, colDelta);
  }
  const step = rowDelta !== 0 ? rowDelta : colDelta;
  if (step === 0) return sourceValue;
  const dir: AutoFillDirection =
    rowDelta > 0 ? 'down' : rowDelta < 0 ? 'up' : colDelta > 0 ? 'right' : 'left';
  const count = Math.abs(step);
  const series = generateAutoFillSeries([sourceValue], count, dir, 'auto', false);
  return dir === 'up' || dir === 'left' ? series[0] : series[count - 1];
}

type Scalar = number | string | boolean;

class FormulaEvalError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

type Token =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }
  | { type: 'colon' };

function tokenizeFormula(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"') {
      let s = '';
      i++;
      while (i < expr.length) {
        if (expr[i] === '"' && expr[i + 1] === '"') {
          s += '"';
          i += 2;
        } else if (expr[i] === '"') {
          i++;
          break;
        } else {
          s += expr[i++];
        }
      }
      tokens.push({ type: 'str', value: s });
      continue;
    }
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(expr[i + 1] || ''))) {
      let numStr = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) {
        numStr += expr[i++];
      }
      const n = Number(numStr);
      if (!Number.isFinite(n)) throw new FormulaEvalError('#VALUE!');
      tokens.push({ type: 'num', value: n });
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let id = '';
      while (i < expr.length && /[A-Za-z0-9_$]/.test(expr[i])) {
        id += expr[i++];
      }
      tokens.push({ type: 'ident', value: id });
      continue;
    }
    const twoChar = expr.slice(i, i + 2);
    if (twoChar === '<=' || twoChar === '>=' || twoChar === '<>' || twoChar === '!=') {
      tokens.push({ type: 'op', value: twoChar });
      i += 2;
      continue;
    }
    if ('+-*/^%=<>!&'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon' });
      i++;
      continue;
    }
    throw new FormulaEvalError('#ERROR!');
  }
  return tokens;
}

function toNum(v: Scalar): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const trimmed = String(v).trim();
  if (!trimmed) return 0;
  if (trimmed.endsWith('%')) {
    const base = Number(trimmed.slice(0, -1).replace(/,/g, ''));
    if (Number.isFinite(base)) return base / 100;
  }
  const n = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(n)) throw new FormulaEvalError('#VALUE!');
  return n;
}

function toBool(v: Scalar): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false' || s === '') return false;
  const n = Number(s);
  if (Number.isNaN(n)) throw new FormulaEvalError('#VALUE!');
  return n !== 0;
}

function formatNumberDisplay(n: number): string {
  if (!Number.isFinite(n)) return '#NUM!';
  const rounded = Number(n.toFixed(10));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function splitTopLevelArgTokens(tokens: Token[]): Token[][] {
  if (tokens.length === 0) return [];
  const groups: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;
  for (const tok of tokens) {
    if (tok.type === 'lparen') {
      depth++;
      current.push(tok);
    } else if (tok.type === 'rparen') {
      depth = Math.max(0, depth - 1);
      current.push(tok);
    } else if (tok.type === 'comma' && depth === 0) {
      groups.push(current);
      current = [];
    } else {
      current.push(tok);
    }
  }
  groups.push(current);
  return groups;
}

function matchCriteria(val: Scalar, criteria: Scalar): boolean {
  const critStr = String(criteria).trim();
  const opMatch = critStr.match(/^(<=|>=|<>|!=|=|<|>)(.*)$/);
  if (opMatch) {
    const [, op, rhsRaw] = opMatch;
    const rhsTrim = rhsRaw.trim();
    const rhsNum = Number(rhsTrim.replace(/,/g, ''));
    const valNum =
      typeof val === 'number'
        ? val
        : typeof val === 'string' && val.trim() !== ''
          ? Number(val.replace(/,/g, ''))
          : Number.NaN;
    const bothNumeric = rhsTrim !== '' && Number.isFinite(rhsNum) && Number.isFinite(valNum);
    if (op === '=' || op === '') {
      return bothNumeric
        ? valNum === rhsNum
        : String(val).trim().toLowerCase() === rhsTrim.toLowerCase();
    }
    if (op === '<>' || op === '!=') {
      return bothNumeric
        ? valNum !== rhsNum
        : String(val).trim().toLowerCase() !== rhsTrim.toLowerCase();
    }
    if (!bothNumeric) return false;
    if (op === '<') return valNum < rhsNum;
    if (op === '<=') return valNum <= rhsNum;
    if (op === '>') return valNum > rhsNum;
    if (op === '>=') return valNum >= rhsNum;
  }
  if (typeof val === 'number' && typeof criteria === 'number') {
    return val === criteria;
  }
  return String(val).trim().toLowerCase() === critStr.toLowerCase();
}

export function evaluateSpreadsheetGrid(rawRows: string[][]): EvaluatedGrid {
  const rowCount = rawRows.length;
  const colCount = rawRows.reduce((m, r) => Math.max(m, r.length), 0);
  const cache = new Map<string, Scalar>();
  const visiting = new Set<string>();
  const errorMap = new Map<string, string>();
  let formulaCount = 0;

  const getCellKey = (r: number, c: number) => `${r}:${c}`;

  const evalCellScalar = (r: number, c: number): Scalar => {
    if (r < 0 || r >= rowCount || c < 0 || c >= colCount) {
      throw new FormulaEvalError('#REF!');
    }
    const key = getCellKey(r, c);
    if (errorMap.has(key)) throw new FormulaEvalError(errorMap.get(key)!);
    if (cache.has(key)) return cache.get(key)!;
    if (visiting.has(key)) throw new FormulaEvalError('#CYCLE!');

    const raw = (rawRows[r]?.[c] ?? '').trim();
    if (!raw.startsWith('=')) {
      if (raw !== '') {
        const cleaned = raw.replace(/,/g, '');
        if (/^-?\d+(?:\.\d+)?$/.test(cleaned)) {
          const n = Number(cleaned);
          if (Number.isFinite(n)) {
            cache.set(key, n);
            return n;
          }
        }
        if (/^-?\d+(?:\.\d+)?%$/.test(cleaned)) {
          const n = Number(cleaned.slice(0, -1)) / 100;
          if (Number.isFinite(n)) {
            cache.set(key, n);
            return n;
          }
        }
      }
      cache.set(key, raw);
      return raw;
    }

    visiting.add(key);
    try {
      const tokens = tokenizeFormula(raw.slice(1));
      const val = evaluateTokens(tokens);
      cache.set(key, val);
      return val;
    } catch (err) {
      const code = err instanceof FormulaEvalError ? err.code : '#ERROR!';
      errorMap.set(key, code);
      throw new FormulaEvalError(code);
    } finally {
      visiting.delete(key);
    }
  };

  const expandRange = (startRef: string, endRef: string): Scalar[] => {
    const s = parseCellRef(startRef);
    const e = parseCellRef(endRef);
    if (!s || !e) throw new FormulaEvalError('#REF!');
    const rMin = Math.min(s.row, e.row);
    const rMax = Math.max(s.row, e.row);
    const cMin = Math.min(s.col, e.col);
    const cMax = Math.max(s.col, e.col);
    const out: Scalar[] = [];
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        out.push(evalCellScalar(r, c));
      }
    }
    return out;
  };

  type ArgGroup = { values: Scalar[]; isRange: boolean };

  const evaluateTokens = (tokens: Token[]): Scalar => {
    let pos = 0;
    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    const compareEqual = (a: Scalar, b: Scalar): boolean => {
      if (typeof a === 'number' && typeof b === 'number') return a === b;
      if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
      if (typeof a === 'string' && typeof b === 'string') {
        return a.toLowerCase() === b.toLowerCase();
      }
      return String(a).toLowerCase() === String(b).toLowerCase();
    };

    const parseComparison = (): Scalar => {
      let left = parseConcat();
      while (
        peek()?.type === 'op' &&
        ['=', '<>', '!=', '<', '<=', '>', '>='].includes((peek() as { value: string }).value)
      ) {
        const op = (consume() as { value: string }).value;
        const right = parseConcat();
        if (op === '=') left = compareEqual(left, right);
        else if (op === '<>' || op === '!=') left = !compareEqual(left, right);
        else if (op === '<') left = toNum(left) < toNum(right);
        else if (op === '<=') left = toNum(left) <= toNum(right);
        else if (op === '>') left = toNum(left) > toNum(right);
        else if (op === '>=') left = toNum(left) >= toNum(right);
      }
      return left;
    };

    const parseConcat = (): Scalar => {
      let left = parseAddSub();
      while (peek()?.type === 'op' && (peek() as { value: string }).value === '&') {
        consume();
        const right = parseAddSub();
        left = `${left}${right}`;
      }
      return left;
    };

    const parseAddSub = (): Scalar => {
      let left = parseMulDiv();
      while (
        peek()?.type === 'op' &&
        ((peek() as { value: string }).value === '+' || (peek() as { value: string }).value === '-')
      ) {
        const op = (consume() as { value: string }).value;
        const right = parseMulDiv();
        left = op === '+' ? toNum(left) + toNum(right) : toNum(left) - toNum(right);
      }
      return left;
    };

    const parseMulDiv = (): Scalar => {
      let left = parsePower();
      while (
        peek()?.type === 'op' &&
        ['*', '/'].includes((peek() as { value: string }).value)
      ) {
        const op = (consume() as { value: string }).value;
        const right = parsePower();
        if (op === '*') left = toNum(left) * toNum(right);
        else {
          const denom = toNum(right);
          if (denom === 0) throw new FormulaEvalError('#DIV/0!');
          left = toNum(left) / denom;
        }
      }
      return left;
    };

    const parsePower = (): Scalar => {
      let left = parseUnary();
      if (peek()?.type === 'op' && (peek() as { value: string }).value === '^') {
        consume();
        const right = parsePower();
        left = Math.pow(toNum(left), toNum(right));
      }
      return left;
    };

    const parseUnary = (): Scalar => {
      if (peek()?.type === 'op' && (peek() as { value: string }).value === '-') {
        consume();
        return -toNum(parseUnary());
      }
      if (peek()?.type === 'op' && (peek() as { value: string }).value === '+') {
        consume();
        return toNum(parseUnary());
      }
      return parsePostfix();
    };

    const parsePostfix = (): Scalar => {
      let val = parsePrimary();
      while (peek()?.type === 'op' && (peek() as { value: string }).value === '%') {
        consume();
        val = toNum(val) / 100;
      }
      return val;
    };

    const collectFunctionTokenSlice = (): Token[] => {
      const inner: Token[] = [];
      let depth = 1;
      while (pos < tokens.length) {
        const tok = consume();
        if (tok.type === 'lparen') depth++;
        else if (tok.type === 'rparen') {
          depth--;
          if (depth === 0) return inner;
        }
        inner.push(tok);
      }
      throw new FormulaEvalError('#ERROR!');
    };

    const parseFunctionArgs = (): ArgGroup[] => {
      const argGroups: ArgGroup[] = [];
      if (peek()?.type === 'rparen') return argGroups;
      while (pos < tokens.length) {
        // Check for range A1:B5
        if (
          tokens[pos]?.type === 'ident' &&
          tokens[pos + 1]?.type === 'colon' &&
          tokens[pos + 2]?.type === 'ident' &&
          (tokens[pos + 3]?.type === 'comma' || tokens[pos + 3]?.type === 'rparen' || pos + 3 >= tokens.length)
        ) {
          const start = (consume() as { value: string }).value;
          consume(); // colon
          const end = (consume() as { value: string }).value;
          argGroups.push({ values: expandRange(start, end), isRange: true });
        } else {
          argGroups.push({ values: [parseComparison()], isRange: false });
        }
        if (peek()?.type === 'comma') {
          consume();
          continue;
        }
        break;
      }
      return argGroups;
    };

    const callBuiltin = (fnName: string, groups: ArgGroup[]): Scalar => {
      const flat = groups.flatMap((g) => g.values);
      // In Excel, numeric aggregate functions ignore text/empty/boolean inside cell ranges,
      // while direct scalar arguments like =SUM("abc") throw #VALUE!.
      const extractNums = (): number[] => {
        const out: number[] = [];
        for (const g of groups) {
          if (g.isRange) {
            for (const v of g.values) {
              if (typeof v === 'number' && Number.isFinite(v)) {
                out.push(v);
              }
            }
          } else {
            for (const v of g.values) {
              if (v === '' || typeof v === 'boolean') continue;
              out.push(toNum(v));
            }
          }
        }
        return out;
      };

      switch (fnName.toUpperCase()) {
        case 'SUM':
          return extractNums().reduce((a, b) => a + b, 0);
        case 'AVERAGE':
        case 'AVG': {
          const n = extractNums();
          if (n.length === 0) throw new FormulaEvalError('#DIV/0!');
          return n.reduce((a, b) => a + b, 0) / n.length;
        }
        case 'MIN': {
          const n = extractNums();
          return n.length ? Math.min(...n) : 0;
        }
        case 'MAX': {
          const n = extractNums();
          return n.length ? Math.max(...n) : 0;
        }
        case 'COUNT':
          return groups.reduce((acc, g) => {
            if (g.isRange) {
              return acc + g.values.filter((v) => typeof v === 'number' && Number.isFinite(v)).length;
            }
            return (
              acc +
              g.values.filter(
                (v) =>
                  typeof v === 'number' ||
                  (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v.replace(/,/g, ''))))
              ).length
            );
          }, 0);
        case 'COUNTA':
          return flat.filter((v) => String(v).trim() !== '').length;
        case 'COUNTIF': {
          const rangeVals = groups[0]?.values ?? [];
          const criteria = groups[1]?.values[0] ?? '';
          return rangeVals.filter((v) => matchCriteria(v, criteria)).length;
        }
        case 'SUMIF': {
          const rangeVals = groups[0]?.values ?? [];
          const criteria = groups[1]?.values[0] ?? '';
          const sumVals = groups[2]?.values ?? rangeVals;
          let sum = 0;
          for (let i = 0; i < rangeVals.length; i++) {
            if (matchCriteria(rangeVals[i], criteria)) {
              const sv = sumVals[i];
              if (typeof sv === 'number' && Number.isFinite(sv)) sum += sv;
            }
          }
          return sum;
        }
        case 'ROUND': {
          const val = toNum(flat[0] ?? 0);
          const digits = toNum(flat[1] ?? 0);
          const f = Math.pow(10, digits);
          return Math.round(val * f) / f;
        }
        case 'ROUNDUP': {
          const val = toNum(flat[0] ?? 0);
          const digits = toNum(flat[1] ?? 0);
          const f = Math.pow(10, digits);
          return (val >= 0 ? Math.ceil(val * f) : Math.floor(val * f)) / f;
        }
        case 'ROUNDDOWN': {
          const val = toNum(flat[0] ?? 0);
          const digits = toNum(flat[1] ?? 0);
          const f = Math.pow(10, digits);
          return Math.trunc(val * f) / f;
        }
        case 'ABS':
          return Math.abs(toNum(flat[0] ?? 0));
        case 'SQRT': {
          const v = toNum(flat[0] ?? 0);
          if (v < 0) throw new FormulaEvalError('#NUM!');
          return Math.sqrt(v);
        }
        case 'POWER':
          return Math.pow(toNum(flat[0] ?? 0), toNum(flat[1] ?? 1));
        case 'MOD': {
          const d = toNum(flat[1] ?? 1);
          if (d === 0) throw new FormulaEvalError('#DIV/0!');
          return toNum(flat[0] ?? 0) % d;
        }
        case 'INT':
          return Math.floor(toNum(flat[0] ?? 0));
        case 'FLOOR':
          return Math.floor(toNum(flat[0] ?? 0));
        case 'CEILING':
          return Math.ceil(toNum(flat[0] ?? 0));
        case 'AND':
          return flat.every(toBool);
        case 'OR':
          return flat.some(toBool);
        case 'NOT':
          return !toBool(flat[0] ?? false);
        case 'ISBLANK':
          return String(flat[0] ?? '') === '';
        case 'ISNUMBER':
          return typeof flat[0] === 'number' && Number.isFinite(flat[0]);
        case 'ISERROR':
          return false;
        case 'CONCAT':
        case 'CONCATENATE':
          return flat.map((v) => String(v)).join('');
        case 'LEN':
          return String(flat[0] ?? '').length;
        case 'UPPER':
          return String(flat[0] ?? '').toUpperCase();
        case 'LOWER':
          return String(flat[0] ?? '').toLowerCase();
        case 'TRIM':
          return String(flat[0] ?? '').trim();
        case 'LEFT':
          return String(flat[0] ?? '').slice(0, Math.max(0, toNum(flat[1] ?? 1)));
        case 'RIGHT': {
          const s = String(flat[0] ?? '');
          const n = Math.max(0, toNum(flat[1] ?? 1));
          return n === 0 ? '' : s.slice(-n);
        }
        case 'MID': {
          const s = String(flat[0] ?? '');
          const start = Math.max(1, toNum(flat[1] ?? 1));
          const len = Math.max(0, toNum(flat[2] ?? 0));
          return s.slice(start - 1, start - 1 + len);
        }
        case 'SUBSTITUTE': {
          const text = String(flat[0] ?? '');
          const oldText = String(flat[1] ?? '');
          const newText = String(flat[2] ?? '');
          return oldText ? text.split(oldText).join(newText) : text;
        }
        case 'TODAY':
          return new Date().toISOString().slice(0, 10);
        case 'NOW':
          return new Date().toISOString().slice(0, 19).replace('T', ' ');
        default:
          throw new FormulaEvalError('#NAME?');
      }
    };

    const parsePrimary = (): Scalar => {
      const tok = peek();
      if (!tok) throw new FormulaEvalError('#ERROR!');
      if (tok.type === 'num') {
        consume();
        return tok.value;
      }
      if (tok.type === 'str') {
        consume();
        return tok.value;
      }
      if (tok.type === 'lparen') {
        consume();
        const inner = parseComparison();
        if (peek()?.type !== 'rparen') throw new FormulaEvalError('#ERROR!');
        consume();
        return inner;
      }
      if (tok.type === 'ident') {
        consume();
        const name = tok.value;
        const upper = name.toUpperCase();
        if (peek()?.type === 'lparen') {
          consume();
          // Short-circuit special forms for IF / IFERROR / ISERROR
          if (upper === 'IF') {
            const rawArgTokens = splitTopLevelArgTokens(collectFunctionTokenSlice());
            const condVal = rawArgTokens[0]?.length ? evaluateTokens(rawArgTokens[0]) : false;
            if (toBool(condVal)) {
              return rawArgTokens[1]?.length ? evaluateTokens(rawArgTokens[1]) : '';
            }
            return rawArgTokens[2]?.length ? evaluateTokens(rawArgTokens[2]) : '';
          }
          if (upper === 'IFERROR') {
            const rawArgTokens = splitTopLevelArgTokens(collectFunctionTokenSlice());
            try {
              return rawArgTokens[0]?.length ? evaluateTokens(rawArgTokens[0]) : '';
            } catch {
              return rawArgTokens[1]?.length ? evaluateTokens(rawArgTokens[1]) : '';
            }
          }
          if (upper === 'ISERROR') {
            const rawArgTokens = splitTopLevelArgTokens(collectFunctionTokenSlice());
            try {
              if (rawArgTokens[0]?.length) evaluateTokens(rawArgTokens[0]);
              return false;
            } catch {
              return true;
            }
          }
          const args = parseFunctionArgs();
          if (peek()?.type !== 'rparen') throw new FormulaEvalError('#ERROR!');
          consume();
          return callBuiltin(name, args);
        }
        if (upper === 'TRUE') return true;
        if (upper === 'FALSE') return false;
        const ref = parseCellRef(name);
        if (ref) return evalCellScalar(ref.row, ref.col);
        throw new FormulaEvalError('#NAME?');
      }
      throw new FormulaEvalError('#ERROR!');
    };

    if (tokens.length === 0) return '';
    const result = parseComparison();
    if (pos < tokens.length) {
      throw new FormulaEvalError('#ERROR!');
    }
    return result;
  };

  const rows: EvaluatedCell[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const rowOut: EvaluatedCell[] = [];
    for (let c = 0; c < colCount; c++) {
      const raw = rawRows[r]?.[c] ?? '';
      const trimmed = raw.trim();
      const isFormula = trimmed.startsWith('=');
      if (isFormula) formulaCount++;
      try {
        const val = evalCellScalar(r, c);
        const display = isFormula
          ? typeof val === 'number'
            ? formatNumberDisplay(val)
            : typeof val === 'boolean'
              ? val
                ? 'TRUE'
                : 'FALSE'
              : String(val)
          : raw;
        const numericValue =
          typeof val === 'number'
            ? val
            : typeof val === 'string' && val.trim() !== '' && Number.isFinite(Number(val.replace(/,/g, '')))
              ? Number(val.replace(/,/g, ''))
              : null;
        rowOut.push({
          raw,
          display,
          numericValue,
          isFormula,
          error: null,
        });
      } catch (err) {
        const code = err instanceof FormulaEvalError ? err.code : '#ERROR!';
        rowOut.push({
          raw,
          display: code,
          numericValue: null,
          isFormula,
          error: code,
        });
      }
    }
    rows.push(rowOut);
  }

  return {
    rows,
    hasFormulas: formulaCount > 0,
    formulaCount,
  };
}

// ─── Minimal Spec-Compliant ZIP + XLSX + ODS Builders ───────────────────────

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipArchive(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const p of [...localParts, ...centralParts, eocd]) {
    out.set(p, cursor);
    cursor += p.length;
  }
  return out;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildXlsxBytes(grid: EvaluatedGrid): Uint8Array {
  const enc = new TextEncoder();
  const rowsXml = grid.rows
    .map((row, rIdx) => {
      const cellsXml = row
        .map((cell, cIdx) => {
          const ref = `${colIndexToLetters(cIdx)}${rIdx + 1}`;
          if (cell.isFormula) {
            const formula = escapeXml(cell.raw.trim().slice(1));
            if (cell.numericValue !== null && !cell.error) {
              return `<c r="${ref}"><f>${formula}</f><v>${cell.numericValue}</v></c>`;
            }
            return `<c r="${ref}" t="str"><f>${formula}</f><v>${escapeXml(cell.display)}</v></c>`;
          }
          if (cell.numericValue !== null && cell.raw.trim() !== '') {
            return `<c r="${ref}"><v>${cell.numericValue}</v></c>`;
          }
          if (!cell.raw) return '';
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell.raw)}</t></is></c>`;
        })
        .filter(Boolean)
        .join('');
      return `<row r="${rIdx + 1}">${cellsXml}</row>`;
    })
    .join('');

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rowsXml}</sheetData></worksheet>`;

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `</Relationships>`;

  const rootRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>`;

  return buildZipArchive([
    { name: '[Content_Types].xml', data: enc.encode(contentTypesXml) },
    { name: '_rels/.rels', data: enc.encode(rootRelsXml) },
    { name: 'xl/workbook.xml', data: enc.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRelsXml) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheetXml) },
  ]);
}

function toOdfFormula(rawFormula: string): string {
  // Convert A1 / B2:C5 cell references into ODF [.A1] / [.B2:.C5] syntax
  const body = rawFormula.trim().slice(1);
  const converted = body.replace(
    /(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?/g,
    (_, start, end) => (end ? `[.${start}:.${end}]` : `[.${start}]`)
  );
  return `of:=${converted}`;
}

export function buildOdsBytes(grid: EvaluatedGrid): Uint8Array {
  const enc = new TextEncoder();
  const rowsXml = grid.rows
    .map((row) => {
      const cellsXml = row
        .map((cell) => {
          if (cell.isFormula) {
            const odfFormula = escapeXml(toOdfFormula(cell.raw));
            if (cell.numericValue !== null && !cell.error) {
              return `<table:table-cell office:value-type="float" office:value="${cell.numericValue}" table:formula="${odfFormula}"><text:p>${escapeXml(cell.display)}</text:p></table:table-cell>`;
            }
            return `<table:table-cell office:value-type="string" table:formula="${odfFormula}"><text:p>${escapeXml(cell.display)}</text:p></table:table-cell>`;
          }
          if (cell.numericValue !== null && cell.raw.trim() !== '') {
            return `<table:table-cell office:value-type="float" office:value="${cell.numericValue}"><text:p>${escapeXml(cell.display)}</text:p></table:table-cell>`;
          }
          return `<table:table-cell office:value-type="string"><text:p>${escapeXml(cell.raw)}</text:p></table:table-cell>`;
        })
        .join('');
      return `<table:table-row>${cellsXml}</table:table-row>`;
    })
    .join('');

  const contentXml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<office:document-content ` +
    `xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ` +
    `xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ` +
    `xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ` +
    `office:version="1.2">` +
    `<office:body><office:spreadsheet>` +
    `<table:table table:name="Sheet1">${rowsXml}</table:table>` +
    `</office:spreadsheet></office:body></office:document-content>`;

  const manifestXml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">` +
    `<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>` +
    `<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>` +
    `</manifest:manifest>`;

  return buildZipArchive([
    { name: 'mimetype', data: enc.encode('application/vnd.oasis.opendocument.spreadsheet') },
    { name: 'META-INF/manifest.xml', data: enc.encode(manifestXml) },
    { name: 'content.xml', data: enc.encode(contentXml) },
  ]);
}
