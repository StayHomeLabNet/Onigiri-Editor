import { describe, expect, it } from 'vitest';
import {
  computeNextFormatToolbarLevel,
  computeNextTopBarLevel,
  DEFAULT_FORMAT_TOOLBAR_SAVED_WIDTHS,
  DEFAULT_TOPBAR_SAVED_WIDTHS,
  FORMAT_TOOLBAR_HYSTERESIS_PX,
  TOPBAR_HYSTERESIS_PX,
} from '../utils/toolbarLayout';

describe('toolbarLayout - TopBar progressive collapse', () => {
  it('keeps level 0 when centered layout fits', () => {
    const next = computeNextTopBarLevel(
      0,
      { availableWidth: 1400, leftWidth: 300, centerWidth: 380, rightWidth: 460 },
      DEFAULT_TOPBAR_SAVED_WIDTHS,
      true
    );
    // max(300, 460)*2 + 380 = 1300 <= 1400
    expect(next).toBe(0);
  });

  it('relaxes center (0 -> 1) before hiding any labels when left has spare room', () => {
    const next = computeNextTopBarLevel(
      0,
      { availableWidth: 1200, leftWidth: 300, centerWidth: 380, rightWidth: 460 },
      DEFAULT_TOPBAR_SAVED_WIDTHS,
      true
    );
    // centeredNeeded = 1300 > 1200, so relax center first
    expect(next).toBe(1);

    // At level 1, relaxedNeeded = 300 + 380 + 460 = 1140 <= 1200, so labels remain visible!
    const stayAt1 = computeNextTopBarLevel(
      1,
      { availableWidth: 1200, leftWidth: 300, centerWidth: 380, rightWidth: 460 },
      DEFAULT_TOPBAR_SAVED_WIDTHS,
      true
    );
    expect(stayAt1).toBe(1);
  });

  it('collapses theme/locale -> layout labels -> version pill progressively', () => {
    // 1 -> 2 when relaxed layout overflows
    expect(
      computeNextTopBarLevel(
        1,
        { availableWidth: 1100, leftWidth: 300, centerWidth: 380, rightWidth: 460 },
        DEFAULT_TOPBAR_SAVED_WIDTHS,
        true
      )
    ).toBe(2);

    // 2 -> 3 when still overflowing with layout switch present
    expect(
      computeNextTopBarLevel(
        2,
        { availableWidth: 1000, leftWidth: 300, centerWidth: 380, rightWidth: 350 },
        DEFAULT_TOPBAR_SAVED_WIDTHS,
        true
      )
    ).toBe(3);

    // 2 -> 4 directly when layout switch is absent (simple mode)
    expect(
      computeNextTopBarLevel(
        2,
        { availableWidth: 700, leftWidth: 300, centerWidth: 200, rightWidth: 250 },
        DEFAULT_TOPBAR_SAVED_WIDTHS,
        false
      )
    ).toBe(4);

    // 3 -> 4 when still overflowing
    expect(
      computeNextTopBarLevel(
        3,
        { availableWidth: 850, leftWidth: 300, centerWidth: 230, rightWidth: 350 },
        DEFAULT_TOPBAR_SAVED_WIDTHS,
        true
      )
    ).toBe(4);
  });

  it('restores levels only when hysteresis margin is met (prevents flicker)', () => {
    const saved = { 2: 110, 3: 150, 4: 54 };
    // At level 2: relaxedNeeded = 1030, need 1030 + 110 + HYSTERESIS to restore to 1
    expect(
      computeNextTopBarLevel(
        2,
        { availableWidth: 1030 + 110 + TOPBAR_HYSTERESIS_PX - 1, leftWidth: 300, centerWidth: 380, rightWidth: 350 },
        saved,
        true
      )
    ).toBe(2);

    expect(
      computeNextTopBarLevel(
        2,
        { availableWidth: 1030 + 110 + TOPBAR_HYSTERESIS_PX, leftWidth: 300, centerWidth: 380, rightWidth: 350 },
        saved,
        true
      )
    ).toBe(1);
  });
});

describe('toolbarLayout - FormatToolbar 2-step collapse', () => {
  it('collapses Copy Rich Text first (0 -> 1), then AI Clean (1 -> 2)', () => {
    expect(
      computeNextFormatToolbarLevel(0, true, 0, DEFAULT_FORMAT_TOOLBAR_SAVED_WIDTHS)
    ).toBe(1);
    expect(
      computeNextFormatToolbarLevel(1, true, 0, DEFAULT_FORMAT_TOOLBAR_SAVED_WIDTHS)
    ).toBe(2);
    expect(
      computeNextFormatToolbarLevel(2, true, 0, DEFAULT_FORMAT_TOOLBAR_SAVED_WIDTHS)
    ).toBe(2);
  });

  it('restores AI Clean (2 -> 1) and Copy Rich Text (1 -> 0) only with hysteresis', () => {
    const saved = { 1: 145, 2: 96 };

    // Not enough spacer yet -> stays at 2
    expect(
      computeNextFormatToolbarLevel(2, false, 96 + FORMAT_TOOLBAR_HYSTERESIS_PX - 1, saved)
    ).toBe(2);

    // Enough spacer -> restores 2 -> 1
    expect(
      computeNextFormatToolbarLevel(2, false, 96 + FORMAT_TOOLBAR_HYSTERESIS_PX, saved)
    ).toBe(1);

    // Not enough spacer for Copy Rich Text -> stays at 1
    expect(
      computeNextFormatToolbarLevel(1, false, 145 + FORMAT_TOOLBAR_HYSTERESIS_PX - 1, saved)
    ).toBe(1);

    // Enough spacer -> restores 1 -> 0
    expect(
      computeNextFormatToolbarLevel(1, false, 145 + FORMAT_TOOLBAR_HYSTERESIS_PX, saved)
    ).toBe(0);
  });
});
