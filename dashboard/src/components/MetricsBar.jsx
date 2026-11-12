import { METRICS_INFO, refStatus } from '../content/clinical';

const DOT = { ok: 'bg-emerald-400', near: 'bg-amber-400', far: 'bg-rose-500', none: 'bg-slate-700' };
const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(d));

/**
 * Indicadores clave (KPI) del análisis de marcha. Cada tarjeta muestra el valor actual,
 * la referencia orientativa y un punto de color (verde = dentro, ámbar = cerca, rojo = fuera).
 * Al pasar el cursor se explica qué mide.
 */
export default function MetricsBar({ latest, metrics, rom, peakGyro }) {
  const items = [
    { key: 'angle', value: latest?.angle, shown: fmt(latest?.angle), accent: 'text-cyan-300' },
    { key: 'rom', value: rom, shown: fmt(rom), accent: 'text-cyan-200' },
    { key: 'gyro', value: peakGyro, shown: fmt(peakGyro, 0), accent: 'text-cyan-200', sub: 'pico en ventana' },
    { key: 'cadence', value: metrics.cadence, shown: fmt(metrics.cadence), accent: 'text-emerald-300' },
    { key: 'strideTime', value: metrics.strideTime, shown: fmt(metrics.strideTime, 2), accent: 'text-emerald-200' },
    { key: 'strideCv', value: metrics.strideCv, shown: fmt(metrics.strideCv), accent: 'text-emerald-200' },
    {
      key: 'stancePct',
      value: metrics.stancePct,
      shown: metrics.stancePct === null ? '—' : `${metrics.stancePct.toFixed(0)}/${metrics.swingPct.toFixed(0)}`,
      accent: 'text-slate-100',
    },
    {
      key: 'heelFirst',
      value: metrics.heelFirstPct,
      shown: fmt(metrics.heelFirstPct, 0),
      accent: 'text-slate-100',
      sub: metrics.steps ? `${metrics.steps} pasos` : 'sin pasos',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => {
        const info = METRICS_INFO[it.key];
        const status = refStatus(it.value, info.ref);
        const refShort = info.ref ? `ref. ${info.ref[0]}–${info.ref[1]}` : it.sub ?? '';
        return (
          <div
            key={it.key}
            className="group relative rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3"
            title={`${info.what}\nReferencia: ${info.refText}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{info.label}</p>
              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${DOT[status]}`} aria-hidden="true" />
            </div>
            <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${it.accent}`}>
              {it.shown}
              <span className="ml-1 text-xs font-normal text-slate-500">{info.unit}</span>
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500">
              {info.ref && it.sub ? `${refShort} · ${it.sub}` : refShort}
            </p>
          </div>
        );
      })}
    </div>
  );
}
