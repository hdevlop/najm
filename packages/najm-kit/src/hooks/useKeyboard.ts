import { useEffect, useCallback, type RefObject } from 'react';

interface KeyboardOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  /**
   * When `true` (default), ignore key events that originate inside editable
   * text fields: `<input type="text|search|email|password|tel|url|number|...">`,
   * `<textarea>`, `<select>`, `[contenteditable]`, and `[role="combobox"]`.
   * Non-text inputs (checkbox, radio, button, submit) still pass through so
   * shortcuts like Ctrl+A keep working from a focused row checkbox.
   */
  ignoreInputs?: boolean;
  /**
   * When provided, only fire when the keydown's `e.target` is contained by
   * this element. Useful for scoping shortcuts to one mounted component
   * instance (e.g., one NTable on a page that contains several).
   */
  scopeRef?: RefObject<HTMLElement | null>;
}

const EDITABLE_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'password',
  'tel',
  'url',
  'number',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'color',
]);

function isEditableTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('[contenteditable="true"]')) return true;
  if (target.getAttribute('role') === 'combobox') return true;
  if (target.closest('[role="combobox"]')) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const rawType = (target as HTMLInputElement).type;
    const type = (rawType || 'text').toLowerCase();
    return EDITABLE_INPUT_TYPES.has(type);
  }
  return false;
}

function parseShortcut(shortcut: string) {
  const parts = shortcut.toLowerCase().split('+').map((s) => s.trim());
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('cmd') || parts.includes('meta'),
    key: parts.find((p) => !['ctrl', 'shift', 'alt', 'cmd', 'meta'].includes(p)) || '',
  };
}

export function useKeyboard(
  shortcut: string,
  handler: (e: KeyboardEvent) => void,
  options: KeyboardOptions = {}
) {
  const { enabled = true, preventDefault = false, ignoreInputs = true, scopeRef } = options;

  const callback = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const scope = scopeRef?.current;
      if (scope && !(e.target instanceof Node)) return;
      if (scope && e.target instanceof Node && !scope.contains(e.target)) return;

      if (ignoreInputs && isEditableTextField(e.target)) return;

      const parsed = parseShortcut(shortcut);

      const ctrlMatch = parsed.ctrl ? (e.ctrlKey || e.metaKey) : true;
      const shiftMatch = parsed.shift ? e.shiftKey : true;
      const altMatch = parsed.alt ? e.altKey : true;
      const metaMatch = parsed.meta ? e.metaKey : true;

      const keyMatch = parsed.key
        ? e.key.toLowerCase() === parsed.key
        : true;

      if (ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch) {
        if (preventDefault) e.preventDefault();
        handler(e);
      }
    },
    [shortcut, handler, enabled, preventDefault, ignoreInputs, scopeRef]
  );

  useEffect(() => {
    document.addEventListener('keydown', callback);
    return () => document.removeEventListener('keydown', callback);
  }, [callback]);
}

export { isEditableTextField };
