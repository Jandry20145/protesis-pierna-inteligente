import Panel from './Panel';
import { ADC_MAX, PHASES, PHASE_ORDER } from '../lib/constants';

/**
 * Indicadores de marcha: estado Apoyo/Balanceo, sensores con brillo proporcional a la
 * presión, barras de presión con umbral y secuencia de sub-fases del ciclo.
 */
export default function GaitIndicator({ latest, settings }) {
  const heel = latest?.frame.fsr_talon ?? 0;
  const toe = latest?.frame.fsr_punta ?? 0;
  const gait = latest?.gait;
  const phase = gait?.phase ?? 'swing';
  const stance = gait?.stance ?? false;
  const hasData = !!latest;

  return (
    <Panel title="Indicadores de marcha" subtitle="Fuerza de reacción (FSR) · fase del ciclo">
      {/* Estado principal */}
      <div
        className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors duration-150 ${
          !hasData
            ? 'border-slate-800 bg-slate-950/50'
            : stance
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-cyan-500/40 bg-cyan-500/10'
        }`}
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Fase actual</p>
          <p className={`text-2xl font-bold tracking-wide ${!hasData ? 'text-slate-600' : stance ? 'text-emerald-300' : 'text-cyan-300'}`}>
            {!hasData ? '—' : stance ? 'APOYO' : 'BALANCEO'}
            <span className="ml-2 text-sm font-medium text-slate-400">{hasData && (stance ? 'Stance' : 'Swing')}</span>
          </p>
        </div>
        <p className="text-right text-xs text-slate-400">
          <span className="block font-medium text-slate-200">{hasData ? PHASES[phase].short : 'Sin datos'}</span>
          {hasData && PHASES[phase].detail}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        {/* Pie con sensores luminosos */}
        <FootDiagram heel={heel} toe={toe} heelOn={gait?.heelOn} toeOn={gait?.toeOn} />

        {/* Barras de presión */}
        <div className="flex h-40 gap-4">
          <PressureBar label="Talón" value={heel} threshold={settings.heelThreshold} on={gait?.heelOn} />
          <PressureBar label="Punta" value={toe} threshold={settings.toeThreshold} on={gait?.toeOn} />
        </div>
      </div>

      {/* Secuencia del ciclo */}
      <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Sub-fases del ciclo de marcha">
        {PHASE_ORDER.map((k) => {
          const active = hasData && phase === k;
          const isStance = PHASES[k].stance;
          return (
            <li
              key={k}
              aria-current={active ? 'step' : undefined}
              className={`rounded-md border px-1.5 py-2 text-center text-[11px] leading-tight transition-colors duration-100 ${
                active
                  ? isStance
                    ? 'border-emerald-400/60 bg-emerald-400/20 font-semibold text-emerald-100'
                    : 'border-cyan-400/60 bg-cyan-400/20 font-semibold text-cyan-100'
                  : 'border-slate-800 bg-slate-950/40 text-slate-500'
              }`}
            >
              {PHASES[k].short}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/** Silueta lateral del pie protésico con dos "LEDs" (talón y punta). */
function FootDiagram({ heel, toe, heelOn, toeOn }) {
  const h = Math.min(1, heel / ADC_MAX);
  const t = Math.min(1, toe / ADC_MAX);
  return (
    <svg viewBox="0 0 220 120" className="h-auto w-full max-w-[260px]" role="img" aria-label={`Talón ${heel}, punta ${toe}`}>
      <defs>
        <radialGradient id="glowHeel">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glowToe">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* pilón */}
      <rect x="52" y="4" width="14" height="50" rx="3" fill="#334155" />
      {/* pie */}
      <path d="M40 58 Q40 50 54 50 L70 50 Q120 56 176 78 Q200 86 200 98 L200 102 L30 102 Q22 102 24 90 Z" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
      <line x1="10" y1="108" x2="214" y2="108" stroke="#334155" strokeWidth="2" strokeDasharray="4 4" />
      {/* halos proporcionales a la presión */}
      <circle cx="45" cy="96" r={14 + 22 * h} fill="url(#glowHeel)" opacity={0.15 + 0.85 * h} />
      <circle cx="178" cy="96" r={14 + 22 * t} fill="url(#glowToe)" opacity={0.15 + 0.85 * t} />
      {/* sensores */}
      <circle cx="45" cy="96" r="8" fill={heelOn ? '#34d399' : '#0f172a'} stroke="#34d399" strokeWidth="2" />
      <circle cx="178" cy="96" r="8" fill={toeOn ? '#22d3ee' : '#0f172a'} stroke="#22d3ee" strokeWidth="2" />
      <text x="45" y="76" textAnchor="middle" fontSize="10" fill="#94a3b8">
        Talón
      </text>
      <text x="178" y="72" textAnchor="middle" fontSize="10" fill="#94a3b8">
        Punta
      </text>
    </svg>
  );
}

/** Barra vertical de presión (cuentas ADC) con marca del umbral. */
function PressureBar({ label, value, threshold, on }) {
  const pct = Math.min(100, (value / ADC_MAX) * 100);
  const thr = Math.min(100, (threshold / ADC_MAX) * 100);
  return (
    <div className="flex w-12 flex-col items-center gap-1">
      <div
        className="relative w-full flex-1 overflow-hidden rounded-md border border-slate-700 bg-slate-950"
        role="meter"
        aria-label={`Presión ${label}`}
        aria-valuemin={0}
        aria-valuemax={ADC_MAX}
        aria-valuenow={value}
      >
        <div
          className={`absolute inset-x-0 bottom-0 transition-[height] duration-75 ${
            on ? 'bg-gradient-to-t from-emerald-600 to-emerald-300' : 'bg-gradient-to-t from-slate-600 to-slate-400'
          }`}
          style={{ height: `${pct}%` }}
        />
        <div className="absolute inset-x-0 border-t border-dashed border-amber-300/80" style={{ bottom: `${thr}%` }} title={`Umbral ${threshold}`} />
      </div>
      <span className="font-mono text-xs tabular-nums text-slate-200">{Math.round(value)}</span>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  );
}
