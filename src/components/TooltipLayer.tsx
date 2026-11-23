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

/**
 * Lightweight global instant tooltip layer driven by `data-tooltip` (and optional `data-tooltip-shortcut`) attributes.
 * Renders via React Portal into `document.body` so tooltips are never clipped by `overflow: hidden/auto` containers.
 */
export const TooltipLayer: React.FC = () => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipElRef = useRef<HTMLDivElement | null>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const lastHiddenAtRef = useRef<number>(0);

  useEffect(() => {
    const clearTimer = () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };

    const hide = (recordWarm = true) => {
      clearTimer();
      activeTargetRef.current = null;
      setTooltip((prev) => {
        if (prev && recordWarm) {
          lastHiddenAtRef.current = Date.now();
        }
        return null;
      });
    };

    const computeAndShow = (target: HTMLElement) => {
      const text = target.getAttribute('data-tooltip')?.trim();
      if (!text) return;
      const shortcut = target.getAttribute('data-tooltip-shortcut')?.trim() || undefined;
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const centerX = rect.left + rect.width / 2;
      const preferTop = rect.bottom + 36 > window.innerHeight;
      const y = preferTop ? rect.top - 7 : rect.bottom + 7;

      setTooltip({
        text,
        shortcut,
        x: centerX,
        y,
        placement: preferTop ? 'top' : 'bottom',
      });
    };

    const scheduleShow = (target: HTMLElement) => {
      if (activeTargetRef.current === target) return;
      clearTimer();
      activeTargetRef.current = target;

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

    const onMouseOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-tooltip]') as HTMLElement | null;
      if (el) {
        scheduleShow(el);
      } else if (activeTargetRef.current) {
        hide(true);
      }
    };

    const onMouseOut = (e: MouseEvent) => {
      if (!activeTargetRef.current) return;
      const related = (e.relatedTarget as HTMLElement | null)?.closest?.(
        '[data-tooltip]'
      ) as HTMLElement | null;
      if (!related) {
        hide(true);
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.matches?.(':focus-visible[data-tooltip]')) {
        scheduleShow(target);
      }
    };

    const onFocusOut = () => {
      hide(false);
    };

    const onDismiss = () => {
      hide(false);
    };

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
  }, []);

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

  if (!tooltip || typeof document === 'undefined') return null;

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
