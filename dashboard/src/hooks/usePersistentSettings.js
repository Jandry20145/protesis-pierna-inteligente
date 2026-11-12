import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '../lib/constants';

const KEY = 'protesis-dashboard:settings:v1';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return saved && typeof saved === 'object' ? { ...DEFAULT_SETTINGS, ...saved } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS }; // modo privado / almacenamiento bloqueado
  }
}

/** Ajustes del usuario recordados en este navegador (IP, umbrales, ejes…). */
export function usePersistentSettings() {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* sin persistencia: la app sigue funcionando */
    }
  }, [settings]);

  const update = useCallback(
    (patch) => setSettings((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })),
    [],
  );
  // Restablece todo salvo la IP del ESP32.
  const reset = useCallback(() => setSettings((s) => ({ ...DEFAULT_SETTINGS, wsUrl: s.wsUrl })), []);

  return [settings, update, reset];
}
