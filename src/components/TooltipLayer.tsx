import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipState {
  text: string;
  shortcut?: string;
  x: number;
  y: number;
  placement: 'bottom' | 'top';
}

const SHOW_DELAY_MS = 150;
const WARM_WINDOW_MS = 450;

const SHORTCUT_SUFFIX_RE =
  /^(.*?)\s*\(((?:(?:⌘|⌃|⌥|⇧|Ctrl\+|Alt\+|Shift\+|Cmd\+|Meta\+|Option\+|Win\+)+[^\s()]+|F[1-9]|F1[0-2]|Esc))\)$/;

/**
 * Splits a tooltip string like "Save (⌘S)" into `{ text: "Save", shortcut: "⌘S" }`
 * when no explicit `data-tooltip-shortcut` attribute is provided.
 */
export function splitTooltipAndShortcut(
  rawText: string,
  explicitShortcut?: string | null
): { text: string; shortcut?: string } {
  const trimmed = rawText.trim();
  const explicit = explicitShortcut?.trim();
  if (explicit) {
    return { text: trimmed, shortcut: explicit };
  }
  const m = trimmed.match(SHORTCUT_SUFFIX_RE);
  if (m && m[1].trim()) {
    return { text: m[1].trim(), shortcut: m[2].trim() };
  }
  return { text: trimmed };
}

/**
 * Global instant custom tooltip layer.
 * Handles both explicit `[data-tooltip]` elements and automatically upgrades native `[title]`
 * attributes across the entire app (Sidebar, TabBar, StatusBar, Inspector, Modals) into
 * instant 0.15s theme-aware tooltips with `<kbd>` shortcut badges—without double tooltips.
 * When `enabled` is false, native browser tooltips are left untouched.
 */
export const TooltipLayer: React.FC<{ enabled?: boolean }> = ({ enabled = true }) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipElRef = useRef<HTMLDivElement | null>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const stashedTitleElRef = useRef<HTMLElement | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const lastHiddenAtRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setTooltip(null);
      return;
    }

    const restoreStashedTitle = () => {
      const el = stashedTitleElRef.current;
      if (el) {
        const orig = el.getAttribute('data-onigiri-orig-title');
        if (orig !== null) {
          el.setAttribute('title', orig);
          el.removeAttribute('data-onigiri-orig-title');
        }
        stashedTitleElRef.current = null;
      }
    };

    const clearTimer = () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };

    const hide = (recordWarm = true) => {
      clearTimer();
      restoreStashedTitle();
      activeTargetRef.current = null;
      setTooltip((prev) => {
        if (prev && recordWarm) {
          lastHiddenAtRef.current = Date.now();
        }
        return null;
      });
    };

    const resolveTooltipPayload = (target: HTMLElement): { text: string; shortcut?: string } | null => {
      const dataTip = target.getAttribute('data-tooltip')?.trim();
      if (dataTip) {
        return splitTooltipAndShortcut(dataTip, target.getAttribute('data-tooltip-shortcut'));
      }
      const stashed = target.getAttribute('data-onigiri-orig-title')?.trim();
      if (stashed) {
        return splitTooltipAndShortcut(stashed);
      }
      const nativeTitle = target.getAttribute('title')?.trim();
      if (nativeTitle) {
        return splitTooltipAndShortcut(nativeTitle);
      }
      return null;
    };

    const computeAndShow = (target: HTMLElement) => {
      const payload = resolveTooltipPayload(target);
      if (!payload || !payload.text) return;
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const centerX = rect.left + rect.width / 2;
      const preferTop = rect.bottom + 36 > window.innerHeight;
      const y = preferTop ? rect.top - 7 : rect.bottom + 7;

      setTooltip({
        text: payload.text,
        shortcut: payload.shortcut,
        x: centerX,
        y,
        placement: preferTop ? 'top' : 'bottom',
      });
    };

    const scheduleShow = (target: HTMLElement) => {
      if (activeTargetRef.current === target) return;
      clearTimer();
      restoreStashedTitle();
      activeTargetRef.current = target;

      // Temporarily stash native `title` so the OS tooltip never doubles up
      const nativeTitle = target.getAttribute('title');
      if (nativeTitle && !target.hasAttribute('data-tooltip')) {
        target.setAttribute('data-onigiri-orig-title', nativeTitle);
        target.removeAttribute('title');
        stashedTitleElRef.current = target;
      }

      const isWarm =
        tooltipElRef.current !== null || Date.now() - lastHiddenAtRef.current < WARM_WINDOW_MS;

      if (isWarm) {
        computeAndShow(target);
      } else {
        showTimerRef.current = window.setTimeout(() => {
          showTimerRef.current = null;
          if (activeTargetRef.current === target && document.contains(target)) {
            computeAndShow(target);
          }
        }, SHOW_DELAY_MS);
      }
    };

    const findTooltipHost = (node: EventTarget | null): HTMLElement | null => {
      const el = node as HTMLElement | null;
      if (!el?.closest) return null;
      return el.closest('[data-tooltip], [title], [data-onigiri-orig-title]') as HTMLElement | null;
    };

    const onMouseOver = (e: MouseEvent) => {
      const el = findTooltipHost(e.target);
      if (el) {
        scheduleShow(el);
      } else if (activeTargetRef.current) {
        hide(true);
      }
    };

    const onMouseOut = (e: MouseEvent) => {
      if (!activeTargetRef.current) return;
      const related = findTooltipHost(e.relatedTarget);
      if (!related) {
        hide(true);
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.matches?.(':focus-visible[data-tooltip], :focus-visible[title]')
      ) {
        scheduleShow(target);
      }
    };

    const onFocusOut = () => hide(false);
    const onDismiss = () => hide(false);

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('mousedown', onDismiss, true);
    document.addEventListener('keydown', onDismiss, true);
    window.addEventListener('scroll', onDismiss, true);
    window.addEventListener('resize', onDismiss);
    window.addEventListener('blur', onDismiss);

    return () => {
      clearTimer();
      restoreStashedTitle();
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('mousedown', onDismiss, true);
      document.removeEventListener('keydown', onDismiss, true);
      window.removeEventListener('scroll', onDismiss, true);
      window.removeEventListener('resize', onDismiss);
      window.removeEventListener('blur', onDismiss);
    };
  }, [enabled]);

  // Clamp horizontal position within viewport after render
  useEffect(() => {
    const el = tooltipElRef.current;
    if (!el || !tooltip) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let clampedX = tooltip.x;
    const halfW = rect.width / 2;
    if (clampedX - halfW < margin) {
      clampedX = margin + halfW;
    } else if (clampedX + halfW > window.innerWidth - margin) {
      clampedX = window.innerWidth - margin - halfW;
    }
    if (Math.abs(clampedX - tooltip.x) > 0.5) {
      el.style.left = `${clampedX}px`;
    }
  }, [tooltip]);

  if (!enabled || !tooltip || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={tooltipElRef}
      role="tooltip"
      className={`app-tooltip is-${tooltip.placement}`}
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      <span className="app-tooltip-text">{tooltip.text}</span>
      {tooltip.shortcut && <kbd className="app-tooltip-kbd">{tooltip.shortcut}</kbd>}
    </div>,
    document.body
  );
};
