// USB keypad for judges (a numeric keypad or a clicker that types digits, plugged into the tablet's
// USB-C port, directly or through a hub). Works without a native module, so it also runs in Expo Go:
// a hidden text field keeps focus and turns each typed character into a scoring action.
//
// Layout follows a standard numeric keypad. The left column scores the athlete on the LEFT of this
// screen and the right column the athlete on the RIGHT, so it follows the PK side swap.
//
//   7  −0.3 left      9  −0.3 right
//   4  −0.1 left      6  −0.1 right
//   1  undo left      3  undo right   (removes the last deduction of that athlete)
//   Enter  send, or OK in the number grid
//   0 / .  cancel (Close in the number grid)
//
// Cut-off and Freestyle have one athlete, so both columns score that athlete.
import { useEffect, useRef, type ComponentRef } from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';
import { useDeviceSettings } from './settings';

export type KeypadAction =
  | { kind: 'major' | 'minor' | 'undo'; pos: 'left' | 'right' }
  | { kind: 'send' }
  | { kind: 'cancel' };

export const KEYPAD_MAP: { keys: string; action: string }[] = [
  { keys: '7 / 9', action: '−0.3 major deduction (left / right athlete)' },
  { keys: '4 / 6', action: '−0.1 minor deduction (left / right athlete)' },
  { keys: '1 / 3', action: 'Undo last deduction (left / right athlete)' },
  { keys: 'Enter', action: 'Send score (OK in the number grid)' },
  { keys: '0  or  .', action: 'Close the number grid' },
];

export function keyToAction(key: string): KeypadAction | null {
  switch (key) {
    case '7': return { kind: 'major', pos: 'left' };
    case '9': return { kind: 'major', pos: 'right' };
    case '4': return { kind: 'minor', pos: 'left' };
    case '6': return { kind: 'minor', pos: 'right' };
    case '1': return { kind: 'undo', pos: 'left' };
    case '3': return { kind: 'undo', pos: 'right' };
    case 'Enter': case '\n': case '\r': case '+': return { kind: 'send' };
    case '0': case '.': case ',': case 'Backspace': case 'Escape': return { kind: 'cancel' };
    default: return null;
  }
}

/**
 * Turns successive values of an uncontrolled text field into key presses. Only the difference from
 * the previous value counts, so fast typing never repeats a key (a controlled field that is reset
 * after every key races with the next key and double-counts).
 */
export function diffKeys(prev: string, next: string): string[] {
  if (next.startsWith(prev)) return [...next.slice(prev.length)].map((ch) => (ch === '\n' ? 'Enter' : ch));
  if (prev.startsWith(next)) return Array(prev.length - next.length).fill('Backspace');
  const last = next.slice(-1);
  return last ? [last] : [];
}

/**
 * Invisible key listener. Mount one per screen while it should receive keys (unmount it while a
 * modal is open and mount another inside the modal). Does nothing unless the keypad is turned on in
 * Device connection, so tablets without a keypad never get a keyboard on screen.
 */
export function KeypadCapture({ onKey, onAction, active = true }: { onKey?: (key: string) => void; onAction?: (a: KeypadAction) => void; active?: boolean }) {
  const { keypad } = useDeviceSettings();
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const text = useRef('');
  const handlers = useRef({ onKey, onAction });
  handlers.current = { onKey, onAction };
  const on = keypad && active;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Web: listen on the document instead (hardware keyboards report every key there).
  useEffect(() => {
    if (!on || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.dataset.keypad !== '1') return;
      fire(e.key);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [on]);

  function fire(key: string) {
    handlers.current.onKey?.(key);
    const a = keyToAction(key);
    if (a) handlers.current.onAction?.(a);
  }

  if (!on || Platform.OS === 'web') return null;

  return (
    <TextInput
      ref={ref}
      autoFocus
      showSoftInputOnFocus={false}
      caretHidden
      contextMenuHidden
      autoCorrect={false}
      autoCapitalize="none"
      spellCheck={false}
      importantForAutofill="no"
      submitBehavior="submit"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onChangeText={(t) => {
        const keys = diffKeys(text.current, t);
        text.current = t;
        // Empty the field now and then; keys are only ever read as differences.
        if (t.length > 32) { ref.current?.clear(); text.current = ''; }
        keys.forEach(fire);
      }}
      onSubmitEditing={() => fire('Enter')}
      onBlur={() => {
        // Keep listening: take focus back after taps on buttons elsewhere on the screen.
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => ref.current?.focus(), 120);
      }}
      style={styles.hidden}
    />
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
});
