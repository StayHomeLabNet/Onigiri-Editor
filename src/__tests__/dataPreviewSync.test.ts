import { describe, expect, it } from 'vitest';
import { parseCsvTsvTableWithSpans } from '../utils/structuredData';

describe('parseCsvTsvTableWithSpans', () => {
  it('tracks exact character offsets and line numbers for CSV cells', () => {
    const csv = 'name,price,note\nApple,120,"Fresh, crisp"\nBanana,80,Sweet';
    const parsed = parseCsvTsvTableWithSpans(csv);

    expect(parsed.headers.map((h) => h.value)).toEqual(['name', 'price', 'note']);
    expect(parsed.headers[0]).toMatchObject({ value: 'name', from: 0, to: 4, valueFrom: 0, valueTo: 4, line: 1 });

    const row1 = parsed.rows[0];
    expect(row1[0]).toMatchObject({ value: 'Apple', from: 16, to: 21, valueFrom: 16, valueTo: 21, line: 2 });
    expect(row1[1]).toMatchObject({ value: '120', from: 22, to: 25, valueFrom: 22, valueTo: 25, line: 2 });
    expect(row1[2]).toMatchObject({ value: 'Fresh, crisp', from: 26, to: 40, valueFrom: 27, valueTo: 39, line: 2 });
    expect(csv.slice(row1[2].valueFrom!, row1[2].valueTo!)).toBe('Fresh, crisp');

    const row2 = parsed.rows[1];
    expect(row2[0]).toMatchObject({ value: 'Banana', line: 3 });
    expect(csv.slice(row2[2].valueFrom!, row2[2].valueTo!)).toBe('Sweet');
  });

  it('handles quoted multiline cells and escaped quotes safely', () => {
    const csv = 'col1,col2\n"line1\nline2","say ""hi"""\nafter,ok';
    const parsed = parseCsvTsvTableWithSpans(csv);

    expect(parsed.rows[0][0].value).toBe('line1\nline2');
    expect(parsed.rows[0][0].line).toBe(2);
    expect(parsed.rows[0][1].value).toBe('say "hi"');
    expect(parsed.rows[0][1].valueFrom).toBeNull();
    expect(parsed.rows[1][0].line).toBe(4);
  });
});
