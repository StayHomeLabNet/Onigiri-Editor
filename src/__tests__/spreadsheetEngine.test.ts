import { describe, expect, it } from 'vitest';
import {
  adjustFormulasForRowColEdit,
  buildOdsBytes,
  buildXlsxBytes,
  colIndexToLetters,
  computeAutoFillValue,
  evaluateSpreadsheetGrid,
  generateAutoFillSeries,
  parseCellRef,
  shiftFormulaReferences,
} from '../utils/spreadsheetEngine';

describe('spreadsheetEngine', () => {
  it('converts column indices and parses cell references', () => {
    expect(colIndexToLetters(0)).toBe('A');
    expect(colIndexToLetters(25)).toBe('Z');
    expect(colIndexToLetters(26)).toBe('AA');
    expect(parseCellRef('B3')).toEqual({ col: 1, row: 2 });
    expect(parseCellRef('$C$10')).toEqual({ col: 2, row: 9 });
  });

  it('evaluates arithmetic, SUM/AVERAGE/IF, and detects circular references', () => {
    const grid = evaluateSpreadsheetGrid([
      ['Item', 'Price', 'Qty', 'Total'],
      ['Apple', '100', '3', '=B2*C2'],
      ['Orange', '200', '2', '=B3*C3'],
      ['Sum', '', '', '=SUM(D2:D3)'],
      ['Avg', '', '', '=AVERAGE(D2:D3)'],
      ['Status', '', '', '=IF(D4>=500,"OK","LOW")'],
      ['CycleA', '=B7', '', ''],
    ]);

    expect(grid.hasFormulas).toBe(true);
    expect(grid.formulaCount).toBe(6);
    expect(grid.rows[1][3].display).toBe('300');
    expect(grid.rows[2][3].display).toBe('400');
    expect(grid.rows[3][3].display).toBe('700');
    expect(grid.rows[4][3].display).toBe('350');
    expect(grid.rows[5][3].display).toBe('OK');

    const cycleGrid = evaluateSpreadsheetGrid([
      ['A', 'B'],
      ['=B2', '=A2'],
    ]);
    expect(cycleGrid.rows[1][0].error).toBe('#CYCLE!');
  });

  it('builds valid ZIP-backed XLSX and ODS binary archives', () => {
    const grid = evaluateSpreadsheetGrid([
      ['Name', 'Value', 'Double'],
      ['x', '10', '=B2*2'],
    ]);
    const xlsx = buildXlsxBytes(grid);
    const ods = buildOdsBytes(grid);

    // ZIP magic bytes: PK\x03\x04
    expect(xlsx[0]).toBe(0x50);
    expect(xlsx[1]).toBe(0x4b);
    expect(ods[0]).toBe(0x50);
    expect(ods[1]).toBe(0x4b);
    expect(xlsx.length).toBeGreaterThan(200);
    expect(ods.length).toBeGreaterThan(200);
  });

  it('shifts relative formula references while preserving $ anchors and autofills labels', () => {
    expect(shiftFormulaReferences('=B2*C2+$A$1', 2, 0)).toBe('=B4*C4+$A$1');
    expect(shiftFormulaReferences('=SUM(A2:A5)', 0, 1)).toBe('=SUM(B2:B5)');
    expect(computeAutoFillValue('=B2*C2', 1, 0)).toBe('=B3*C3');
    expect(computeAutoFillValue('Item 1', 2, 0)).toBe('Item 3');
    expect(computeAutoFillValue('42', 1, 0)).toBe('42');
  });

  it('supports Excel 2003 AutoFill series, Ctrl-toggle increment/decrement, dates, times, days/months, and quarters', () => {
    // Single number: default copy, Ctrl/Option toggles to +1 down/right and -1 up/left
    expect(generateAutoFillSeries(['10'], 3, 'down', 'auto', false)).toEqual(['10', '10', '10']);
    expect(generateAutoFillSeries(['10'], 3, 'down', 'auto', true)).toEqual(['11', '12', '13']);
    expect(generateAutoFillSeries(['10'], 3, 'up', 'auto', true)).toEqual(['7', '8', '9']);
    expect(generateAutoFillSeries(['10'], 3, 'left', 'auto', true)).toEqual(['7', '8', '9']);

    // Two+ numbers: default linear series, Ctrl/Option toggles to copy
    expect(generateAutoFillSeries(['2', '5'], 3, 'down', 'auto', false)).toEqual(['8', '11', '14']);
    expect(generateAutoFillSeries(['2', '5'], 3, 'up', 'auto', false)).toEqual(['-7', '-4', '-1']);
    expect(generateAutoFillSeries(['2', '5'], 3, 'down', 'auto', true)).toEqual(['2', '5', '2']);

    // Days of week & months (EN + JA)
    expect(generateAutoFillSeries(['Mon'], 3, 'right', 'auto', false)).toEqual(['Tue', 'Wed', 'Thu']);
    expect(generateAutoFillSeries(['MON'], 2, 'down', 'auto', false)).toEqual(['TUE', 'WED']);
    expect(generateAutoFillSeries(['月'], 3, 'down', 'auto', false)).toEqual(['火', '水', '木']);
    expect(generateAutoFillSeries(['11月'], 3, 'right', 'auto', false)).toEqual(['12月', '1月', '2月']);
    expect(generateAutoFillSeries(['Nov'], 3, 'down', 'auto', false)).toEqual(['Dec', 'Jan', 'Feb']);

    // Quarters & ordinals & zero-padded labels
    expect(generateAutoFillSeries(['Q3'], 3, 'right', 'auto', false)).toEqual(['Q4', 'Q1', 'Q2']);
    expect(generateAutoFillSeries(['1st'], 3, 'down', 'auto', false)).toEqual(['2nd', '3rd', '4th']);
    expect(generateAutoFillSeries(['A008'], 3, 'down', 'auto', false)).toEqual(['A009', 'A010', 'A011']);

    // Dates (days, weekdays, months, years) and times
    expect(generateAutoFillSeries(['2026-01-30'], 3, 'down', 'auto', false)).toEqual([
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
    // 2026-01-30 is Friday -> weekdays skips Sat/Sun -> Mon 2026-02-02, Tue 2026-02-03
    expect(generateAutoFillSeries(['2026-01-30'], 2, 'down', 'weekdays', false)).toEqual([
      '2026-02-02',
      '2026-02-03',
    ]);
    expect(generateAutoFillSeries(['2026-01-31'], 2, 'down', 'months', false)).toEqual([
      '2026-02-28',
      '2026-03-31',
    ]);
    expect(generateAutoFillSeries(['09:00'], 3, 'down', 'auto', false)).toEqual([
      '10:00',
      '11:00',
      '12:00',
    ]);
  });

  it('handles Excel-compatible percent, range text ignoring, short-circuit IF/IFERROR, syntax errors, and row/col ref adjustment', () => {
    const grid = evaluateSpreadsheetGrid([
      ['Label', 'Amount', 'Formula'],
      ['Tax', '10%', '=B2*1000'],
      ['Formatted', '1,200', '=SUM(B1:B3)'],
      ['Zero', '0', '=IF(B4=0, 0, 100/B4)'],
      ['ErrGuard', '=1/0', '=IFERROR(B5, "SAFE")'],
      ['BadParen', '', '=SUM(B2:B3'],
      ['TrailingTok', '', '=1+2 3'],
      ['CondSum', '50%', '=SUMIF(B2:B4, ">0")'],
      ['CondCnt', '', '=COUNTIF(A2:A4, "Tax")'],
      ['TextFn', '', '=MID("abcdef", 2, 3)'],
    ]);

    // Non-formula cells preserve original formatted text
    expect(grid.rows[1][1].display).toBe('10%');
    expect(grid.rows[2][1].display).toBe('1,200');
    // Percent arithmetic & range ignoring header text
    expect(grid.rows[1][2].display).toBe('100');
    expect(grid.rows[2][2].display).toBe('1200.1');
    // Short-circuit IF / IFERROR
    expect(grid.rows[3][2].display).toBe('0');
    expect(grid.rows[4][2].display).toBe('SAFE');
    // Strict syntax validation
    expect(grid.rows[5][2].error).toBe('#ERROR!');
    expect(grid.rows[6][2].error).toBe('#ERROR!');
    // SUMIF / COUNTIF / MID
    expect(grid.rows[7][2].display).toBe('1200.1');
    expect(grid.rows[8][2].display).toBe('1');
    expect(grid.rows[9][2].display).toBe('bcd');

    // Row/column insertion and deletion updates formula references
    const adjustedInsert = adjustFormulasForRowColEdit(
      [
        ['A', 'B', 'C'],
        ['10', '20', '=SUM(A2:B2)'],
      ],
      'insert-row',
      1
    );
    expect(adjustedInsert[1][2]).toBe('=SUM(A3:B3)');

    const adjustedDelete = adjustFormulasForRowColEdit(
      [
        ['A', 'B', 'C'],
        ['10', '20', '=A2+B2'],
      ],
      'delete-col',
      0
    );
    expect(adjustedDelete[1][2]).toBe('=#REF!+A2');
  });
});
