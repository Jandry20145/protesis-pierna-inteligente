/**
 * useWebSocket — conexión robusta con el ESP32 (Access Point, ws://192.168.4.1:81).
 *
 * Características:
 *  - Normaliza la dirección ingresada ("192.168.4.1" → "ws://192.168.4.1:81").
 *  - Reconexión automática con back-off exponencial + jitter.
 *  - Watchdog: si el socket está "abierto" pero no llegan tramas en `staleTimeoutMs`
 *    (típico cuando el teléfono/PC pierde la Wi-Fi del AP sin cerrar el TCP),
 *    se fuerza la reconexión.
 *  - Parseo tolerante: cada mensaje puede traer una o varias líneas JSON; las tramas
 *    inválidas se cuentan pero no rompen el flujo.
 *  - Estadísticas: frecuencia real de recepción (Hz), tramas recibidas y errores.
 *  - Detección de "Mixed Content" (página HTTPS intentando abrir ws:// inseguro).
 *
 * IMPORTANTE: los datos NO se guardan en estado de React (20 Hz × re-render sería
 * costoso). Se entregan por callback `onMessage(data, timestampMs)` y el consumidor
 * decide cómo almacenarlos (ver src/lib/telemetry.js).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const WS_STATUS = Object.freeze({
  IDLE: 'idle', // nunca se intentó conectar
  CONNECTING: 'connecting', // primer intento en curso
  OPEN: 'open', // conectado y recibiendo
  RECONNECTING: 'reconnecting', // conexión perdida, reintentando
  CLOSED: 'closed', // desconectado (manual o tras agotar intentos)
});

const DEFAULT_PORT = '81';

/** Convierte la entrada del usuario en una URL WebSocket válida. Lanza Error si no es válida. */
export function normalizeWsUrl(input) {
  let s = String(input ?? '').trim();
  if (!s) throw new Error('Ingresa la IP o URL del ESP32 (p. ej. 192.168.4.1).');
  if (/^https?:\/\//i.test(s)) s = s.replace(/^http/i, 'ws'); // http→ws, https→wss
  if (!/^wss?:\/\//i.test(s)) s = `ws://${s}`;
  let url;
  try {
    url = new URL(s);
  } catch {
    throw new Error(`Dirección inválida: "${input}"`);
  }
  if (!url.port && url.protocol === 'ws:') url.port = DEFAULT_PORT;
  return url.toString().replace(/\/$/, '');
}

/** ¿El navegador bloqueará esta URL por Mixed Content? (página HTTPS → ws:// inseguro) */
export function isMixedContent(url) {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' && /^ws:\/\//i.test(url);
}

export function useWebSocket({
  onMessage,
  parse = JSON.parse,
  autoReconnect = true,
  maxRetries = Infinity,
  baseDelayMs = 500,
  maxDelayMs = 8000,
  staleTimeoutMs = 3000,
  connectTimeoutMs = 5000,
} = {}) {
  const [status, setStatusState] = useState(WS_STATUS.IDLE);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [url, setUrl] = useState(null);
  const [stats, setStats] = useState({ rateHz: 0, received: 0, parseErrors: 0, lastMessageAt: null });

  // --- Refs: estado mutable que no debe provocar re-render ni cierres obsoletos ---
  const wsRef = useRef(null);
  const urlRef = useRef(null);
  const statusRef = useRef(WS_STATUS.IDLE);
  const manualCloseRef = useRef(false);
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const countersRef = useRef({ received: 0, parseErrors: 0, windowCount: 0, lastMessageAt: 0 });
  const handlersRef = useRef({ onMessage, parse });
  const optsRef = useRef({ autoReconnect, maxRetries, baseDelayMs, maxDelayMs, staleTimeoutMs, connectTimeoutMs });
  const connectTimerRef = useRef(null);

  // Mantener callbacks/opciones actualizados sin reabrir el socket.
  useEffect(() => {
    handlersRef.current = { onMessage, parse };
    optsRef.current = { autoReconnect, maxRetries, baseDelayMs, maxDelayMs, staleTimeoutMs, connectTimeoutMs };
  });

  const setStatus = useCallback((s) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const clearConnectTimer = () => {
    if (connectTimerRef.current) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
  };

  /** Cierra el socket actual desvinculando sus handlers (para que su onclose no dispare reconexiones). */
  const teardownSocket = (code = 1000, reason = 'cliente') => {
    clearConnectTimer();
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
    try {
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) ws.close(code, reason);
    } catch {
      /* ignorar */
    }
  };

  // openSocket y scheduleReconnect se referencian mutuamente → se guardan en refs.
  const openSocketRef = useRef(null);

  const scheduleReconnect = useCallback(() => {
    const o = optsRef.current;
    if (manualCloseRef.current || !o.autoReconnect) {
      setStatus(WS_STATUS.CLOSED);
      return;
    }
    if (retryRef.current >= o.maxRetries) {
      setStatus(WS_STATUS.CLOSED);
      setError(`No se pudo reconectar tras ${retryRef.current} intentos.`);
      return;
    }
    const attempt = ++retryRef.current;
    const delay = Math.min(o.maxDelayMs, o.baseDelayMs * 2 ** (attempt - 1)) + Math.random() * 250;
    setRetryCount(attempt);
    setStatus(WS_STATUS.RECONNECTING);
    clearReconnectTimer();
    reconnectTimerRef.current = setTimeout(() => openSocketRef.current?.(urlRef.current), delay);
  }, [setStatus]);

  const openSocket = useCallback(
    (target) => {
      teardownSocket();
      let ws;
      try {
        ws = new WebSocket(target);
      } catch (e) {
        // Chrome/Firefox lanzan SecurityError de forma síncrona ante Mixed Content.
        const mixed = e?.name === 'SecurityError' || isMixedContent(target);
        setError(
          mixed
            ? 'Bloqueado por "Mixed Content": esta página se sirve por HTTPS y el ESP32 usa ws:// (sin cifrar). Consulta la sección de ayuda para habilitarlo.'
            : `No se pudo crear el WebSocket: ${e?.message ?? e}`,
        );
        setStatus(WS_STATUS.CLOSED);
        return;
      }
      wsRef.current = ws;

      // Tiempo límite de apertura: si la IP no existe en la red (p. ej. el punto de acceso del
      // teléfono cambió de rango), el navegador puede quedarse "conectando" mucho tiempo sin error.
      clearConnectTimer();
      connectTimerRef.current = setTimeout(() => {
        if (wsRef.current !== ws || ws.readyState !== WebSocket.CONNECTING) return;
        let host = target;
        try {
          host = new URL(target).hostname;
        } catch {
          /* usar la URL completa */
        }
        setError(
          `${host} no responde (${optsRef.current.connectTimeoutMs / 1000} s). Comprueba que el ESP32 esté encendido y en la misma red; ` +
            'si reiniciaste el punto de acceso del teléfono, su IP pudo cambiar: revisa el Monitor Serie.',
        );
        teardownSocket(4001, 'timeout');
        scheduleReconnect();
      }, optsRef.current.connectTimeoutMs);

      ws.onopen = () => {
        clearConnectTimer();
        retryRef.current = 0;
        setRetryCount(0);
        setError(null);
        countersRef.current.lastMessageAt = performance.now(); // arranca el watchdog
        setStatus(WS_STATUS.OPEN);
      };

      ws.onmessage = (ev) => {
        const now = performance.now();
        const c = countersRef.current;
        c.lastMessageAt = now;
        if (typeof ev.data !== 'string') return; // se esperan tramas de texto JSON
        // El firmware puede enviar varias tramas separadas por '\n' en un mismo mensaje.
        const lines = ev.data.indexOf('\n') === -1 ? [ev.data] : ev.data.split('\n');
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          let data;
          try {
            data = handlersRef.current.parse(line);
          } catch {
            c.parseErrors++;
            continue;
          }
          c.received++;
          c.windowCount++;
          try {
            handlersRef.current.onMessage?.(data, now);
          } catch (err) {
            console.error('[useWebSocket] Error en onMessage:', err);
          }
        }
      };

      // onerror no expone detalles por seguridad; el cierre posterior gestiona la reconexión.
      ws.onerror = () => {
        setError('Error de conexión. Verifica que el dispositivo esté conectado a la red Wi-Fi del ESP32 y que la IP/puerto sean correctos.');
      };

      ws.onclose = (ev) => {
        if (wsRef.current !== ws) return; // socket ya reemplazado
        clearConnectTimer();
        wsRef.current = null;
        if (manualCloseRef.current) {
          setStatus(WS_STATUS.CLOSED);
          return;
        }
        if (ev.code !== 1000 && ev.code !== 1005) {
          setError((prev) => prev ?? `Conexión cerrada (código ${ev.code}${ev.reason ? `: ${ev.reason}` : ''}).`);
        }
        scheduleReconnect();
      };
    },
    [scheduleReconnect, setStatus],
  );
  openSocketRef.current = openSocket;

  /** Inicia la conexión con la dirección indicada. */
  const connect = useCallback(
    (rawUrl) => {
      let target;
      try {
        target = normalizeWsUrl(rawUrl);
      } catch (e) {
        setError(e.message);
        return;
      }
      clearReconnectTimer();
      manualCloseRef.current = false;
      retryRef.current = 0;
      countersRef.current = { received: 0, parseErrors: 0, windowCount: 0, lastMessageAt: 0 };
      urlRef.current = target;
      setUrl(target);
      setRetryCount(0);
      setError(null);
      setStatus(WS_STATUS.CONNECTING);
      openSocket(target);
    },
    [openSocket, setStatus],
  );

  /** Cierre manual: no se reintenta. */
  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    clearReconnectTimer();
    teardownSocket(1000, 'desconexión manual');
    setStatus(WS_STATUS.CLOSED);
  }, [setStatus]);

  /** Envía datos al ESP32 (p. ej. comandos de calibración). Devuelve true si se envió. */
  const send = useCallback((data) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    return true;
  }, []);

  // Temporizador de 1 s: estadísticas + watchdog de inactividad.
  useEffect(() => {
    const id = setInterval(() => {
      const c = countersRef.current;
      setStats({
        rateHz: c.windowCount,
        received: c.received,
        parseErrors: c.parseErrors,
        lastMessageAt: c.lastMessageAt || null,
      });
      c.windowCount = 0;

      if (statusRef.current === WS_STATUS.OPEN && performance.now() - c.lastMessageAt > optsRef.current.staleTimeoutMs) {
        setError('Sin datos del ESP32 durante más de ' + optsRef.current.staleTimeoutMs / 1000 + ' s. Reconectando…');
        teardownSocket(4000, 'watchdog');
        scheduleReconnect();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [scheduleReconnect]);

  // Limpieza al desmontar.
  useEffect(
    () => () => {
      manualCloseRef.current = true;
      clearReconnectTimer();
      teardownSocket(1000, 'desmontado');
    },
    [],
  );

  return { status, error, retryCount, stats, url, connect, disconnect, send };
}
