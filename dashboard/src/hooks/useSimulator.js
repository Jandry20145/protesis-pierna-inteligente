import { useEffect, useRef } from 'react';
import { generateFrame } from '../lib/simulator';

/** Emite tramas simuladas a `hz` mientras `enabled` sea true (modo demostración). */
export function useSimulator({ enabled, onFrame, settings, hz = 20 }) {
  const settingsRef = useRef(settings);
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    settingsRef.current = settings;
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const start = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      onFrameRef.current(generateFrame((now - start) / 1000, settingsRef.current), now);
    }, 1000 / hz);
    return () => clearInterval(id);
  }, [enabled, hz]);
}
