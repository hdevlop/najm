import { useEffect, useMemo, useRef } from "react";
import type React from "react";

/** Where a long press or double tap happened. Read it during the callback. */
export interface PressGestureEvent<E extends Element = Element> {
  /** `touch`, `pen` or `mouse`. A desktop double-click reports `mouse`. */
  pointerType: string;
  clientX: number;
  clientY: number;
  target: EventTarget | null;
  /** The element the gestures are attached to. */
  currentTarget: E;
}

export interface PressGestureOptions<E extends Element = Element> {
  /** A finger (or pen) held still for `longPressMs`. */
  onLongPress?: (event: PressGestureEvent<E>) => void;
  /** Two quick taps on a phone, or a mouse double-click on a desktop. */
  onDoubleTap?: (event: PressGestureEvent<E>) => void;
  /** How long a press must be held. Defaults to 500 ms. */
  longPressMs?: number;
  /** The longest gap between the two taps of a double tap. Defaults to 300 ms. */
  doubleTapMs?: number;
  /** How far a finger may move before the press counts as a scroll. Defaults to 10 px. */
  moveTolerance?: number;
  /** A short vibration when a long press is recognised, where the device allows it. Defaults to true. */
  haptics?: boolean;
  /** Also recognise a long press made with the mouse button. Defaults to false. */
  mouseLongPress?: boolean;
  /**
   * Presses that start inside a match keep their own behaviour: typing in a
   * field, pressing a button or a link. Defaults to {@link PRESS_GESTURE_IGNORE}.
   */
  ignore?: string;
  disabled?: boolean;
}

/** The controls inside a card that keep their own press behaviour. */
export const PRESS_GESTURE_IGNORE =
  'input, textarea, select, button, a[href], [contenteditable=""], [contenteditable="true"], [data-press-ignore]';

/** Spread onto the element. Every handler is stable across renders. */
export interface PressGestureHandlers<E extends Element = Element> {
  onPointerDown?: (event: React.PointerEvent<E>) => void;
  onPointerMove?: (event: React.PointerEvent<E>) => void;
  onPointerUp?: (event: React.PointerEvent<E>) => void;
  onPointerCancel?: (event: React.PointerEvent<E>) => void;
  onClickCapture?: (event: React.MouseEvent<E>) => void;
  onContextMenu?: (event: React.MouseEvent<E>) => void;
  onDoubleClick?: (event: React.MouseEvent<E>) => void;
  /**
   * What the gestures need from the page: no iOS callout or text selection
   * under a long press, and no double-tap zoom where a double tap is used.
   */
  style?: React.CSSProperties;
}

const DOUBLE_TAP_DISTANCE = 25;
/** A browser that also fires its own dblclick after our double tap must not report it twice. */
const NATIVE_DBLCLICK_GRACE_MS = 500;

type Press = { id: number; type: string; x: number; y: number; target: EventTarget | null; element: Element };

/**
 * Long press and double tap for any element, on phones and desktops alike.
 *
 * Browsers have no long-press event: Android fires `contextmenu` and iOS shows
 * its callout instead. Phones do not reliably fire `dblclick` either. So both
 * are read from pointer events: a press held still is a long press, two quick
 * taps in one place a double tap. The click that ends a long press, and the
 * second tap's click, are swallowed so they do not also act as a tap. A mouse
 * double-click on a desktop is reported as a double tap too.
 */
export function usePressGestures<E extends Element = Element>(options: PressGestureOptions<E>): PressGestureHandlers<E> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const state = useRef({
    timer: null as ReturnType<typeof setTimeout> | null,
    press: null as Press | null,
    longPressed: false,
    swallowClick: false,
    lastTap: null as { time: number; x: number; y: number } | null,
    nativeDblclickUntil: 0,
  });

  useEffect(() => () => {
    if (state.current.timer) clearTimeout(state.current.timer);
  }, []);

  const wantsLongPress = !options.disabled && !!options.onLongPress;
  const wantsDoubleTap = !options.disabled && !!options.onDoubleTap;

  const handlers = useMemo(() => {
    const s = state.current;
    const clearTimer = () => {
      if (s.timer) clearTimeout(s.timer);
      s.timer = null;
    };
    const ignored = (target: EventTarget | null, root: Element) => {
      const selector = optionsRef.current.ignore ?? PRESS_GESTURE_IGNORE;
      if (!selector || !(target instanceof Element)) return false;
      const match = target.closest(selector);
      return !!match && match !== root && root.contains(match);
    };
    const report = (press: Press): PressGestureEvent<E> => ({
      pointerType: press.type, clientX: press.x, clientY: press.y, target: press.target, currentTarget: press.element as E,
    });

    const onPointerDown = (event: React.PointerEvent<E>) => {
      const o = optionsRef.current;
      s.swallowClick = false;
      s.longPressed = false;
      clearTimer();
      if (o.disabled || (event.pointerType === "mouse" && event.button !== 0)) { s.press = null; return; }
      if (ignored(event.target, event.currentTarget)) { s.press = null; return; }
      const press: Press = {
        id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY,
        target: event.target, element: event.currentTarget,
      };
      s.press = press;
      if (o.onLongPress && (event.pointerType !== "mouse" || o.mouseLongPress)) {
        s.timer = setTimeout(() => {
          s.timer = null;
          if (s.press !== press) return;
          s.longPressed = true;
          s.swallowClick = true;
          s.lastTap = null;
          if (optionsRef.current.haptics !== false) {
            try { navigator.vibrate?.(10); } catch { /* not allowed here */ }
          }
          optionsRef.current.onLongPress?.(report(press));
        }, o.longPressMs ?? 500);
      }
    };

    const onPointerMove = (event: React.PointerEvent<E>) => {
      const press = s.press;
      if (!press || press.id !== event.pointerId) return;
      const tolerance = optionsRef.current.moveTolerance ?? 10;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > tolerance) {
        clearTimer();
        s.press = null;
        s.lastTap = null;
      }
    };

    const onPointerUp = (event: React.PointerEvent<E>) => {
      const press = s.press;
      clearTimer();
      s.press = null;
      if (!press || press.id !== event.pointerId || s.longPressed) return;
      const o = optionsRef.current;
      // A mouse double-click arrives as dblclick; only fingers and pens are counted here.
      if (!o.onDoubleTap || press.type === "mouse") return;
      const now = Date.now();
      const last = s.lastTap;
      if (last && now - last.time <= (o.doubleTapMs ?? 300)
        && Math.hypot(press.x - last.x, press.y - last.y) <= DOUBLE_TAP_DISTANCE) {
        s.lastTap = null;
        s.swallowClick = true;
        s.nativeDblclickUntil = now + NATIVE_DBLCLICK_GRACE_MS;
        o.onDoubleTap(report(press));
        return;
      }
      s.lastTap = { time: now, x: press.x, y: press.y };
    };

    const onPointerCancel = () => {
      // The browser took the touch over, usually to scroll.
      clearTimer();
      s.press = null;
      s.lastTap = null;
    };

    const onClickCapture = (event: React.MouseEvent<E>) => {
      if (!s.swallowClick) return;
      s.swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    const onContextMenu = (event: React.MouseEvent<E>) => {
      // Android's own long-press menu, under a press this hook already reads as a long press.
      if (!optionsRef.current.onLongPress || optionsRef.current.disabled) return;
      if (!s.longPressed && !(s.press && s.press.type !== "mouse")) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const onDoubleClick = (event: React.MouseEvent<E>) => {
      const o = optionsRef.current;
      if (!o.onDoubleTap || o.disabled || Date.now() < s.nativeDblclickUntil) return;
      if (ignored(event.target, event.currentTarget)) return;
      o.onDoubleTap({
        pointerType: "mouse", clientX: event.clientX, clientY: event.clientY,
        target: event.target, currentTarget: event.currentTarget,
      });
    };

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture, onContextMenu, onDoubleClick };
  }, []);

  return useMemo<PressGestureHandlers<E>>(() => {
    if (!wantsLongPress && !wantsDoubleTap) return {};
    const style: React.CSSProperties = {};
    if (wantsLongPress) Object.assign(style, { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" });
    if (wantsDoubleTap) style.touchAction = "manipulation";
    return { ...handlers, style };
  }, [handlers, wantsLongPress, wantsDoubleTap]);
}
