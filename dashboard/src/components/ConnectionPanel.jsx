import { useState } from 'react';
import Panel from './Panel';
import StatusBadge from './StatusBadge';
import { WS_STATUS, isMixedContent, normalizeWsUrl } from '../hooks/useWebSocket';

/**
 * Panel de conexión: IP del ESP32, botones conectar/desconectar, modo demo y diagnóstico.
 */
export default function ConnectionPanel({ ws, url, onUrlChange, demo, onToggleDemo }) {
  const [showHelp, setShowHelp] = useState(false);
  const busy = ws.status === WS_STATUS.OPEN || ws.status === WS_STATUS.CONNECTING || ws.status === WS_STATUS.RECONNECTING;

  let preview = '';
  try {
    preview = normalizeWsUrl(url);
  } catch {
    preview = '';
  }
  const mixed = preview && isMixedContent(preview);

  const submit = (e) => {
    e.preventDefault();
    if (busy) ws.disconnect();
    else ws.connect(url);
  };

  const lastMsgAge = ws.stats.lastMessageAt ? (performance.now() - ws.stats.lastMessageAt) / 1000 : null;

  return (
    <Panel title="Conexión ESP32" subtitle="WebSocket · Access Point local" actions={<StatusBadge status={demo ? 'demo' : ws.status} retryCount={ws.retryCount} />}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium text-slate-400" htmlFor="ws-url">
          IP o URL del ESP32
        </label>
        <div className="flex gap-2">
          <input
            id="ws-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={busy || demo}
            placeholder="192.168.4.1"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={demo}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${
              busy
                ? 'bg-rose-500/15 text-rose-200 ring-rose-500/40 hover:bg-rose-500/25'
                : 'bg-cyan-500 text-slate-950 ring-cyan-300 hover:bg-cyan-400'
            }`}
          >
            {busy ? 'Desconectar' : 'Conectar'}
          </button>
        </div>
        {preview && preview !== url.trim() && <p className="font-mono text-[11px] text-slate-500">→ {preview}</p>}
      </form>

      {/* Métricas del enlace */}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <LinkStat label="Frecuencia" value={demo ? '20' : ws.stats.rateHz} unit="Hz" ok={demo || ws.stats.rateHz >= 15} />
        <LinkStat label="Tramas" value={demo ? '—' : ws.stats.received} />
        <LinkStat label="Inválidas" value={demo ? '—' : ws.stats.parseErrors} ok={!ws.stats.parseErrors} />
      </dl>
      {!demo && ws.status === WS_STATUS.OPEN && lastMsgAge !== null && lastMsgAge > 1.5 && (
        <p className="mt-2 text-xs text-amber-300">Última trama hace {lastMsgAge.toFixed(1)} s</p>
      )}

      {ws.error && !demo && (
        <div role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200">
          {ws.error}
        </div>
      )}

      {mixed && !demo && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
          <strong className="font-semibold">Aviso HTTPS → ws://</strong> Esta página se sirve por HTTPS (GitHub Pages) y el
          ESP32 transmite sin cifrar; el navegador puede bloquearlo.{' '}
          <button type="button" className="underline decoration-dotted underline-offset-2 hover:text-white" onClick={() => setShowHelp((v) => !v)}>
            {showHelp ? 'Ocultar soluciones' : 'Ver soluciones'}
          </button>
          {showHelp && (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-amber-50/90">
              <li>
                <b>Recomendado:</b> abrir el panel servido por el propio ESP32: <span className="font-mono">http://192.168.4.1/</span>
              </li>
              <li>
                Chrome/Edge (escritorio): candado de la barra de direcciones → <i>Configuración del sitio</i> →{' '}
                <i>Contenido no seguro</i> → <b>Permitir</b>, y recargar. Acepta también el permiso de “dispositivos de la red
                local” si aparece.
              </li>
              <li>
                Ejecutarlo localmente por HTTP: <span className="font-mono">npm run preview</span>.
              </li>
            </ol>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
        <div>
          <p className="text-xs font-medium text-slate-200">Modo demostración</p>
          <p className="text-[11px] text-slate-500">Marcha sintética a 20 Hz, sin hardware</p>
        </div>
        <Toggle checked={demo} onChange={onToggleDemo} label="Activar modo demostración" />
      </div>
    </Panel>
  );
}

function LinkStat({ label, value, unit, ok }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`font-mono text-base tabular-nums ${ok === false ? 'text-amber-300' : 'text-slate-100'}`}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] text-slate-500">{unit}</span>}
      </dd>
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${
        checked ? 'bg-cyan-500' : 'bg-slate-700'
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}
