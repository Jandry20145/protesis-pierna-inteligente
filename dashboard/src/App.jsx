/**
 * Monitor biomecánico en tiempo real — Prótesis de pierna instrumentada.
 *
 * Flujo de datos:
 *   ESP32 (20 Hz, JSON) ──WebSocket──▶ useWebSocket ──onMessage──▶ telemetry store (ref)
 *                                       (o useSimulator en modo demo)        │
 *   React re-renderiza a 10 Hz mediante un "tick" ◀──────────────────────────┘
 *   y los gráficos/indicadores leen del store. El canvas de la pierna usa su propio rAF.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket, WS_STATUS } from './hooks/useWebSocket';
import { useSimulator } from './hooks/useSimulator';
import { usePersistentSettings } from './hooks/usePersistentSettings';
import { createTelemetryStore } from './lib/telemetry';
import { parseFrame } from './lib/frame';
import { WINDOW_OPTIONS } from './lib/constants';
import ConnectionPanel from './components/ConnectionPanel';
import StatusBadge from './components/StatusBadge';
import MetricsBar from './components/MetricsBar';
import Panel from './components/Panel';
import LiveChart from './components/LiveChart';
import LegCanvas from './components/LegCanvas';
import GaitIndicator from './components/GaitIndicator';
import SettingsPanel from './components/SettingsPanel';
import AboutPanel from './components/AboutPanel';
import InfoCenter from './components/InfoCenter';

const UI_REFRESH_MS = 100; // 10 Hz de refresco visual (los datos llegan a 20 Hz)

export default function App() {
  const [settings, updateSettings, resetSettings] = usePersistentSettings();
  const [demo, setDemo] = useState(false);
  const [paused, setPaused] = useState(false);
  const [, setTick] = useState(0);

  // Ajustes accesibles desde callbacks de alta frecuencia sin recrearlos.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Almacén de telemetría (vive fuera del estado de React).
  const storeRef = useRef(null);
  if (!storeRef.current) storeRef.current = createTelemetryStore();
  const store = storeRef.current;

  const handleFrame = useCallback((frame, tMs) => store.ingest(frame, tMs, settingsRef.current), [store]);
  const getLatest = useCallback(() => store.latest, [store]);

  // --- Fuentes de datos ---
  const ws = useWebSocket({ onMessage: handleFrame, parse: parseFrame });
  useSimulator({ enabled: demo, onFrame: handleFrame, settings });

  // --- Refresco de la interfaz ---
  useEffect(() => {
    const id = setInterval(() => setTick((n) => (n + 1) % 1e9), UI_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // Reiniciar el filtro si cambia el montaje de la IMU (evita transitorios).
  useEffect(() => {
    store.resetFilter();
  }, [store, settings.verticalAxis, settings.apAxis, settings.gyroUnits, settings.invertAngle]);

  // Nueva sesión de datos al conectar.
  const { connect: wsConnect, disconnect: wsDisconnect, status: wsStatus } = ws;
  const connect = useCallback(
    (url) => {
      store.reset();
      setPaused(false);
      wsConnect(url);
    },
    [store, wsConnect],
  );

  const toggleDemo = useCallback(
    (on) => {
      if (on && wsStatus !== WS_STATUS.IDLE && wsStatus !== WS_STATUS.CLOSED) wsDisconnect();
      store.reset();
      setPaused(false);
      setDemo(on);
    },
    [store, wsDisconnect, wsStatus],
  );

  const tare = () => {
    if (store.latest) updateSettings({ angleOffset: store.latest.rawAngle });
  };

  const latest = store.latest;
  const metrics = store.metrics();
  const s = settings;
  const { rom, peakGyro } = windowStats(store.series, latest?.x, s.windowSeconds);
  const effectiveStatus = demo ? 'demo' : ws.status;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-200">
      {/* ── Cabecera ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-500/40">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12h4l2-5 4 10 2-5h6" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-slate-50 sm:text-lg">Monitor Biomecánico de Marcha</h1>
              <p className="text-xs text-slate-400">Prótesis de pierna instrumentada · FSR + IMU MPU6050 · ESP32</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={effectiveStatus} retryCount={ws.retryCount} />
            <span className="hidden font-mono text-xs text-slate-500 sm:inline">{demo ? 'demo' : (ws.url ?? '')}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-12">
        {/* ── Columna lateral ─────────────────────────────────── */}
        <aside className="space-y-4 lg:col-span-4 xl:col-span-3">
          <ConnectionPanel
            ws={{ ...ws, connect }}
            url={s.wsUrl}
            onUrlChange={(v) => updateSettings({ wsUrl: v })}
            demo={demo}
            onToggleDemo={toggleDemo}
          />
          <SettingsPanel settings={s} update={updateSettings} onReset={resetSettings} onTare={tare} canTare={!!latest} getLatestFrame={() => store.latest?.frame} />
          <AboutPanel />
        </aside>

        {/* ── Área principal ──────────────────────────────────── */}
        <div className="min-w-0 space-y-4 lg:col-span-8 xl:col-span-9">
          <MetricsBar latest={latest} metrics={metrics} rom={rom} peakGyro={peakGyro} />

          {!latest && (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-400">
              Esperando datos… Conéctate a la red Wi-Fi del ESP32 y pulsa <b className="text-cyan-300">Conectar</b>, o activa el{' '}
              <button type="button" className="font-semibold text-violet-300 underline underline-offset-2" onClick={() => toggleDemo(true)}>
                modo demostración
              </button>
              .
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-12">
            <Panel
              className="min-w-0 2xl:col-span-8"
              title="Cinemática sagital"
              subtitle="Ángulo del pilón: filtro complementario vs. acelerómetro"
              actions={
                <>
                  <WindowSelector value={s.windowSeconds} onChange={(v) => updateSettings({ windowSeconds: v })} />
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    aria-pressed={paused}
                    className={`rounded-md px-3 py-1 text-xs font-semibold ring-1 transition ${
                      paused ? 'bg-amber-400/20 text-amber-200 ring-amber-400/50' : 'text-slate-300 ring-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {paused ? '▶ Reanudar' : '❚❚ Pausar'}
                  </button>
                </>
              }
            >
              <LiveChart
                ariaLabel="Evolución del ángulo sagital en el tiempo"
                series={[
                  { label: 'Ángulo (fusión)', color: '#22d3ee', data: store.series.angle, width: 2.5 },
                  { label: 'Acelerómetro', color: 'rgba(148,163,184,0.55)', data: store.series.accAngle, width: 1, dash: [4, 3] },
                ]}
                paused={paused}
                windowSeconds={s.windowSeconds}
                latestX={latest?.x ?? 0}
                ySuggested={[-30, 45]}
                yTitle="Ángulo (°)"
                unit="°"
                hLines={[{ value: 0, color: 'rgba(148,163,184,0.5)', label: '0°' }]}
                bands={{ data: store.series.stance, color: 'rgba(52,211,153,0.07)' }}
                height={280}
              />
              <p className="mt-2 text-[11px] text-slate-500">
                Sombreado verde = fase de apoyo. Pasa el cursor para inspeccionar valores; pausa para congelar la ventana.
              </p>
            </Panel>

            <Panel className="2xl:col-span-4" title="Vista sagital" subtitle="Representación en Canvas" bodyClassName="p-2">
              <LegCanvas getLatest={getLatest} height={312} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-12">
            <div className="2xl:col-span-5">
              <GaitIndicator latest={latest} settings={s} />
            </div>
            <Panel className="min-w-0 2xl:col-span-7" title="Presión plantar (FSR)" subtitle="Cuentas ADC 12 bits · umbrales de contacto">
              <LiveChart
                ariaLabel="Evolución de la presión de talón y punta"
                series={[
                  { label: 'Talón', color: '#34d399', data: store.series.heel, fill: 'rgba(52,211,153,0.10)' },
                  { label: 'Punta', color: '#22d3ee', data: store.series.toe, fill: 'rgba(34,211,238,0.10)' },
                ]}
                paused={paused}
                windowSeconds={s.windowSeconds}
                latestX={latest?.x ?? 0}
                yMin={0}
                yMax={4095}
                yTitle="ADC"
                decimals={0}
                hLines={[
                  { value: s.heelThreshold, color: 'rgba(52,211,153,0.8)', label: `Umbral talón ${s.heelThreshold}` },
                  { value: s.toeThreshold, color: 'rgba(34,211,238,0.8)', label: `Umbral punta ${s.toeThreshold}`, dash: [2, 4], align: 'left' },
                ]}
                bands={{ data: store.series.stance, color: 'rgba(52,211,153,0.06)' }}
                height={300}
              />
            </Panel>
          </div>

          <InfoCenter latest={latest} metrics={metrics} rom={rom} peakGyro={peakGyro} settings={s} />

          <RawFrame frame={latest?.frame} />
        </div>
      </main>

      <footer className="mx-auto max-w-[1600px] px-4 pb-6 text-center text-[11px] text-slate-600">
        App estática (sin servidor) · los datos no salen de este navegador · Chart.js + React + Tailwind CSS
      </footer>
    </div>
  );
}

/** Rango de movimiento (máx − mín del ángulo) y pico de |velocidad angular| en la ventana visible. */
function windowStats(series, latestX, windowSeconds) {
  if (latestX === undefined || latestX === null) return { rom: null, peakGyro: null };
  const x0 = latestX - windowSeconds;
  let lo = Infinity;
  let hi = -Infinity;
  let peak = 0;
  for (let i = series.angle.length - 1; i >= 0 && series.angle[i].x >= x0; i--) {
    const a = series.angle[i].y;
    if (a < lo) lo = a;
    if (a > hi) hi = a;
    const g = Math.abs(series.gyro[i]?.y ?? 0);
    if (g > peak) peak = g;
  }
  return hi >= lo ? { rom: hi - lo, peakGyro: peak } : { rom: null, peakGyro: null };
}

function WindowSelector({ value, onChange }) {
  return (
    <div className="flex overflow-hidden rounded-md ring-1 ring-slate-700" role="group" aria-label="Ventana temporal">
      {WINDOW_OPTIONS.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(w)}
          aria-pressed={value === w}
          className={`px-2.5 py-1 font-mono text-xs transition ${value === w ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          {w}s
        </button>
      ))}
    </div>
  );
}

/** Última trama recibida (útil para depurar el firmware). */
function RawFrame({ frame }) {
  return (
    <details className="group rounded-xl border border-slate-800 bg-slate-900/50">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200">
        Trama cruda (última recibida)
      </summary>
      <pre className="overflow-x-auto border-t border-slate-800 px-4 py-3 font-mono text-xs text-emerald-200/90">
        {frame ? JSON.stringify(frame) : '—'}
      </pre>
    </details>
  );
}
