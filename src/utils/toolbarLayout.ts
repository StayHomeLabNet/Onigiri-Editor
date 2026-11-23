export type TopBarCollapseLevel = 0 | 1 | 2 | 3 | 4;
export type FormatToolbarCollapseLevel = 0 | 1 | 2;

export const TOPBAR_HYSTERESIS_PX = 18;
export const FORMAT_TOOLBAR_HYSTERESIS_PX = 24;

export interface TopBarMetrics {
  availableWidth: number;
  leftWidth: number;
  centerWidth: number;
  rightWidth: number;
}

export interface TopBarSavedWidths {
  /** Width saved when moving from level 1 -> 2 (hiding theme & locale labels) */
  2: number;
  /** Width saved when moving from level 2 -> 3 (hiding layout switch labels) */
  3: number;
  /** Width saved when moving from level 3 -> 4 (hiding version pill) */
  4: number;
}

export const DEFAULT_TOPBAR_SAVED_WIDTHS: TopBarSavedWidths = {
  2: 112,
  3: 150,
  4: 54,
};

/**
 * Compute the next TopBar collapse level based on actual measured widths and hysteresis.
 *
 * Levels:
 * - 0: Centered layout (`flex: 1` on left & right), all labels visible
 * - 1: Relaxed center (`flex: 0 1 auto`), all labels still visible
 * - 2: Theme & locale labels hidden (icon-only)
 * - 3: Layout switch labels hidden (icon-only)
 * - 4: Version pill hidden
 */
export function computeNextTopBarLevel(
  current: TopBarCollapseLevel,
  metrics: TopBarMetrics,
  savedWidths: TopBarSavedWidths,
  hasLayoutSwitch: boolean
): TopBarCollapseLevel {
  const { availableWidth, leftWidth, centerWidth, rightWidth } = metrics;
  if (availableWidth <= 0) return current;

  const centeredNeeded = Math.max(leftWidth, rightWidth) * 2 + centerWidth;
  const relaxedNeeded = leftWidth + centerWidth + rightWidth;

  // Step up (collapse more) when overflowing
  if (current === 0) {
    if (centeredNeeded > availableWidth) {
      return 1;
    }
    return 0;
  }

  if (relaxedNeeded > availableWidth) {
    if (current === 1) return 2;
    if (current === 2) return hasLayoutSwitch ? 3 : 4;
    if (current === 3) return 4;
    return 4;
  }

  // Step down (restore labels) when there is enough spare width + hysteresis
  if (current === 4) {
    if (relaxedNeeded + savedWidths[4] + TOPBAR_HYSTERESIS_PX <= availableWidth) {
      return hasLayoutSwitch ? 3 : 2;
    }
    return 4;
  }

  if (current === 3) {
    if (relaxedNeeded + savedWidths[3] + TOPBAR_HYSTERESIS_PX <= availableWidth) {
      return 2;
    }
    return 3;
  }

  if (current === 2) {
    if (relaxedNeeded + savedWidths[2] + TOPBAR_HYSTERESIS_PX <= availableWidth) {
      return 1;
    }
    return 2;
  }

  if (current === 1) {
    if (centeredNeeded + TOPBAR_HYSTERESIS_PX <= availableWidth) {
      return 0;
    }
    return 1;
  }

  return current;
}

export interface FormatToolbarSavedWidths {
  /** Width saved when moving from level 0 -> 1 (hiding Copy Rich Text label) */
  1: number;
  /** Width saved when moving from level 1 -> 2 (hiding AI Clean label) */
  2: number;
}

export const DEFAULT_FORMAT_TOOLBAR_SAVED_WIDTHS: FormatToolbarSavedWidths = {
  1: 145,
  2: 96,
};

/**
 * Compute the next FormatToolbar collapse level based on actual scroll overflow & spacer width.
 *
 * Levels:
 * - 0: Both "AI Clean" and "Copy Rich Text" show labels
 * - 1: "Copy Rich Text" is icon-only; "AI Clean" still shows label
 * - 2: Both are icon-only
 */
export function computeNextFormatToolbarLevel(
  current: FormatToolbarCollapseLevel,
  isOverflowing: boolean,
  spacerWidth: number,
  savedWidths: FormatToolbarSavedWidths
): FormatToolbarCollapseLevel {
  if (isOverflowing || spacerWidth < 8) {
    if (current < 2) {
      return (current + 1) as FormatToolbarCollapseLevel;
    }
    return 2;
  }

  if (current === 2) {
    if (spacerWidth >= savedWidths[2] + FORMAT_TOOLBAR_HYSTERESIS_PX) {
      return 1;
    }
    return 2;
  }

  if (current === 1) {
    if (spacerWidth >= savedWidths[1] + FORMAT_TOOLBAR_HYSTERESIS_PX) {
      return 0;
    }
    return 1;
  }

  return 0;
}

/**
 * Measure the intrinsic horizontal width of a flex container's visible direct children,
 * independent of `flex: 1` stretching on the container itself.
 */
export function measureFlexChildrenNaturalWidth(container: HTMLElement | null): number {
  if (!container) return 0;
  const style = window.getComputedStyle(container);
  const gap = parseFloat(style.columnGap || style.gap || '0') || 0;
  let total = 0;
  let visibleCount = 0;

  for (let i = 0; i < container.children.length; i++) {
    const child = container.children[i] as HTMLElement;
    const childStyle = window.getComputedStyle(child);
    if (childStyle.display === 'none') continue;
    const rect = child.getBoundingClientRect();
    total += rect.width;
    visibleCount += 1;
  }

  if (visibleCount > 1) {
    total += gap * (visibleCount - 1);
  }

  return Math.ceil(total);
}
