'use client';

import { useEffect, useRef } from 'react';
import {
  DEFAULT_WEDGE_CONFIG,
  INITIAL_WEDGE_STATE,
  nextWedgeState,
  type WedgeConfig,
} from './keyboard-wedge';

/**
 * Zero-config support for external USB/Bluetooth barcode scanners on the
 * counter screens. Such scanners behave as keyboards, so no pairing UI or
 * driver is needed — this just has to tell their rapid-fire typing apart
 * from a person.
 *
 * Mount on any page a scan should be accepted on. `enabled` lets a page turn
 * it off while a dialog with its own text inputs is open, so a fast typist
 * in, say, a remarks field is never at risk of being read as a scan.
 */
export function useKeyboardWedge(onCode: (code: string) => void, enabled = true) {
  const stateRef = useRef(INITIAL_WEDGE_STATE);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const result = nextWedgeState(
        stateRef.current,
        { key: e.key, now: Date.now() },
        DEFAULT_WEDGE_CONFIG as WedgeConfig,
      );
      stateRef.current = result.state;
      if (result.emit) {
        // The scanner's own Enter must not submit whatever form happens to
        // have focus.
        e.preventDefault();
        onCodeRef.current(result.value);
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [enabled]);
}
