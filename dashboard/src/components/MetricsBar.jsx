/** Fila de indicadores clave (KPI) del análisis de marcha. */
export default function MetricsBar({ latest, metrics }) {
  const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(d));
  const items = [
    { label: 'Ángulo sagital', value: fmt(latest?.angle), unit: '°', accent: 'text-cyan-300' },
    { label: 'Vel. angular', value: fmt(latest?.gyroRate, 0), unit: '°/s', accent: 'text-cyan-200' },
    { label: 'Cadencia', value: fmt(metrics.cadence), unit: 'zanc/min', accent: 'text-emerald-300' },
    { label: 'Tiempo de zancada', value: fmt(metrics.strideTime, 2), unit: 's', accent: 'text-emerald-200' },
    {
      label: 'Apoyo / Balanceo',
      value: metrics.stancePct === null ? '—' : `${metrics.stancePct.toFixed(0)} / ${metrics.swingPct.toFixed(0)}`,
      unit: '%',
      accent: 'text-slate-100',
      hint: 'Referencia en marcha normal ≈ 60 / 40',
    },
    { label: 'Contactos', value: String(metrics.steps ?? 0), unit: 'pasos', accent: 'text-slate-100' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3" title={it.hint}>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">{it.label}</p>
          <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${it.accent}`}>
            {it.value}
            <span className="ml-1 text-xs font-normal text-slate-500">{it.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
