import { useState } from 'react';
import Panel from './Panel';
import { FSR_TO_PHASES, GAIT_CYCLE, GLOSSARY, LIMITATIONS, METRICS_INFO, PROTOCOL, refStatus } from '../content/clinical';
import { resolveAxes } from '../lib/orientation';

const TABS = [
  { key: 'cycle', label: 'Ciclo de marcha' },
  { key: 'metrics', label: 'Interpretación' },
  { key: 'sensors', label: 'Sensores y señal' },
  { key: 'protocol', label: 'Protocolo' },
  { key: 'limits', label: 'Limitaciones y glosario' },
];

/**
 * Centro de información clínica: explica el ciclo de marcha (con la fase detectada en vivo),
 * cómo interpretar cada métrica frente a valores de referencia, las especificaciones de los
 * sensores, un protocolo de evaluación y las limitaciones del sistema.
 */
export default function InfoCenter({ latest, metrics, rom, peakGyro, settings }) {
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('protesis-dashboard:info-tab') || 'cycle';
    } catch {
      return 'cycle';
    }
  });
  const select = (k) => {
    setTab(k);
    try {
      localStorage.setItem('protesis-dashboard:info-tab', k);
    } catch {
      /* sin persistencia */
    }
  };

  return (
    <Panel title="Centro de información clínica" subtitle="Cómo leer los datos y qué hay detrás de cada medida">
      <div role="tablist" aria-label="Secciones de información" className="-mx-1 mb-4 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => select(t.key)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === t.key ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'cycle' && <CycleTab phase={latest?.gait.phase} />}
        {tab === 'metrics' && <MetricsTab latest={latest} metrics={metrics} rom={rom} peakGyro={peakGyro} />}
        {tab === 'sensors' && <SensorsTab settings={settings} />}
        {tab === 'protocol' && <ProtocolTab />}
        {tab === 'limits' && <LimitsTab />}
      </div>
    </Panel>
  );
}

/* ───────────────────────── Ciclo de marcha ───────────────────────── */

function CycleTab({ phase }) {
  const active = new Set(phase ? FSR_TO_PHASES[phase] : []);
  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-slate-300">
        Un <b>ciclo de marcha</b> (zancada) va desde un contacto inicial hasta el siguiente del mismo pie. Se divide en{' '}
        <b className="text-emerald-300">apoyo (≈ 60 %)</b> y <b className="text-cyan-300">balanceo (≈ 40 %)</b>. Con dos FSR el sistema
        reconoce cuatro estados que corresponden a grupos de sub-fases; el grupo resaltado es el que se detecta <b>en este momento</b>.
      </p>

      {/* Barra del ciclo 0–100 % */}
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="mb-1 flex text-[10px] font-semibold uppercase tracking-wider">
            <span className="text-emerald-300" style={{ width: '60%' }}>
              Apoyo · 0–60 %
            </span>
            <span className="text-cyan-300" style={{ width: '40%' }}>
              Balanceo · 60–100 %
            </span>
          </div>
          <div className="flex h-12 overflow-hidden rounded-lg ring-1 ring-slate-700">
            {GAIT_CYCLE.map((p) => {
              const on = active.has(p.key);
              // Clases literales (Tailwind no detecta clases construidas por concatenación)
              const tone = p.stance
                ? on
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-emerald-500/15 text-slate-300'
                : on
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-cyan-500/15 text-slate-300';
              return (
                <div
                  key={p.key}
                  title={`${p.name} (${p.start}–${p.end} %)`}
                  style={{ width: `${p.end - p.start}%` }}
                  className={`flex items-center justify-center border-r border-slate-950/60 text-[10px] font-semibold transition-colors duration-100 last:border-r-0 ${tone}`}
                >
                  {p.key}
                </div>
              );
            })}
          </div>
          <div className="relative mt-1 h-3 text-[9px] text-slate-500">
            {[0, 10, 30, 50, 60, 73, 87, 100].map((v) => (
              <span
                key={v}
                className={`absolute ${v === 0 ? '' : v === 100 ? '-translate-x-full' : '-translate-x-1/2'}`}
                style={{ left: `${v}%` }}
              >
                {v}%
              </span>
            ))}
          </div>
          {/* Correspondencia con los FSR */}
          <div className="mt-3 flex text-[10px]">
            <FsrSpan width={10} label="Talón" color="emerald" on={phase === 'heel'} />
            <FsrSpan width={20} label="Talón + punta" color="emerald" on={phase === 'flat'} />
            <FsrSpan width={30} label="Punta" color="emerald" on={phase === 'toe'} />
            <FsrSpan width={40} label="Sin contacto" color="cyan" on={phase === 'swing'} />
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {GAIT_CYCLE.map((p) => (
          <div
            key={p.key}
            className={`rounded-lg border p-3 text-xs transition-colors ${
              active.has(p.key) ? (p.stance ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-cyan-500/50 bg-cyan-500/10') : 'border-slate-800 bg-slate-950/40'
            }`}
          >
            <p className="mb-1 flex items-baseline justify-between gap-2">
              <span className="font-semibold text-slate-100">
                <span className={p.stance ? 'text-emerald-300' : 'text-cyan-300'}>{p.key}</span> · {p.name}
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {p.start}–{p.end} %
              </span>
            </p>
            <p className="leading-relaxed text-slate-300">{p.goal}</p>
            <p className="mt-1.5 leading-relaxed text-slate-400">
              <span className="font-semibold text-amber-300/90">En prótesis: </span>
              {p.prosthesis}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FsrSpan({ width, label, color, on }) {
  const c = color === 'emerald' ? 'border-emerald-400/60 text-emerald-200' : 'border-cyan-400/60 text-cyan-200';
  return (
    <div style={{ width: `${width}%` }} className="px-0.5">
      <div className={`rounded border-t-2 pt-0.5 text-center ${c} ${on ? 'font-bold' : 'opacity-60'}`}>
        FSR: {label}
        {on && ' ◀'}
      </div>
    </div>
  );
}

/* ───────────────────────── Interpretación ───────────────────────── */

const STATUS_STYLE = {
  ok: { dot: 'bg-emerald-400', text: 'Dentro de referencia' },
  near: { dot: 'bg-amber-400', text: 'Cerca del límite' },
  far: { dot: 'bg-rose-500', text: 'Fuera de referencia' },
  none: { dot: 'bg-slate-600', text: 'Sin referencia / sin datos' },
};

function MetricsTab({ latest, metrics, rom, peakGyro }) {
  const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(d));
  const rows = [
    ['cadence', metrics.cadence, fmt(metrics.cadence)],
    ['strideTime', metrics.strideTime, fmt(metrics.strideTime, 2)],
    ['strideCv', metrics.strideCv, fmt(metrics.strideCv)],
    ['stancePct', metrics.stancePct, metrics.stancePct === null ? '—' : `${fmt(metrics.stancePct, 0)} / ${fmt(metrics.swingPct, 0)}`],
    ['heelFirst', metrics.heelFirstPct, fmt(metrics.heelFirstPct, 0)],
    ['rom', rom, fmt(rom)],
    ['gyro', peakGyro, fmt(peakGyro, 0) + (peakGyro !== null ? ' (pico)' : '')],
    ['angle', latest?.angle, fmt(latest?.angle)],
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-300">
        Valores en vivo comparados con rangos <b>orientativos</b> de adultos sanos caminando en llano. En usuarios de prótesis es
        esperable cierta desviación: lo más útil es la <b>evolución entre sesiones</b> y la <b>simetría</b> con el lado sano.
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-slate-950/60 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Métrica</th>
              <th className="px-3 py-2 font-medium">Actual</th>
              <th className="px-3 py-2 font-medium">Referencia</th>
              <th className="px-3 py-2 font-medium">Qué indica / posibles hallazgos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(([key, value, shown]) => {
              const info = METRICS_INFO[key];
              const st = STATUS_STYLE[refStatus(value, info.ref)];
              return (
                <tr key={key} className="align-top">
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-slate-100">{info.label}</p>
                    <p className="text-[10px] text-slate-500">{info.unit}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-slate-100" title={st.text}>
                      <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                      {shown}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">{info.refText}</td>
                  <td className="px-3 py-2.5 leading-relaxed text-slate-400">
                    <span className="text-slate-300">{info.what}</span> {info.findings}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
        {Object.values(STATUS_STYLE).map((s) => (
          <span key={s.text} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.text}
          </span>
        ))}
      </p>
    </div>
  );
}

/* ───────────────────────── Sensores ───────────────────────── */

function SensorsTab({ settings }) {
  const { gyroAxis, sign } = resolveAxes(settings.verticalAxis, settings.apAxis);
  const dt = 0.05;
  const tau = (settings.alpha * dt) / (1 - settings.alpha);
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <SpecCard
        color="emerald"
        title="FSR · Sensores de fuerza resistivos"
        intro="Su resistencia disminuye al aumentar la fuerza. En un divisor de tensión, el ADC del ESP32 obtiene un valor mayor cuanto más se carga el sensor."
        rows={[
          ['Ubicación', 'Talón y antepié (cabezas metatarsianas)'],
          ['Pines', 'GPIO 34 (talón) · GPIO 35 (punta), ADC1'],
          ['Conversión', '12 bits (0–4095), atenuación 11 dB (≈ 0–3,1 V)'],
          ['Pre-proceso', 'Promedio de 4 lecturas por muestra'],
          ['Detección', `Umbral talón ${settings.heelThreshold} · punta ${settings.toeThreshold} · histéresis ${settings.hysteresis}`],
          ['Mide', 'Instante de contacto y reparto talón/punta'],
          ['No mide', 'Fuerza total en N ni fuerzas horizontales'],
        ]}
      />
      <SpecCard
        color="cyan"
        title="IMU MPU6050 · Cinemática"
        intro="Acelerómetro y giroscopio MEMS de 3 ejes. Se fusionan para estimar la inclinación del pilón en el plano sagital."
        rows={[
          ['Bus', 'I²C a 400 kHz · SDA 33 · SCL 32'],
          ['Acelerómetro', '±4 g · unidades m/s²'],
          ['Giroscopio', '±500 °/s · unidades rad/s'],
          ['Filtro interno', 'Pasa-bajas digital 21 Hz'],
          ['Montaje actual', `Vertical ${settings.verticalAxis} · anterior ${settings.apAxis} · giro ${sign < 0 ? '−' : '+'}gyr_${gyroAxis}`],
          ['Fusión', `Complementario α = ${settings.alpha.toFixed(3)} → τ ≈ ${tau.toFixed(1)} s`],
          ['Tara', `${settings.angleOffset.toFixed(1)}° restados al ángulo`],
        ]}
      />
      <SpecCard
        color="violet"
        title="ESP32 · Adquisición y enlace"
        intro="Muestrea a periodo fijo y envía cada trama JSON por WebSocket. El dashboard procesa todo en el navegador; ningún dato sale a Internet."
        rows={[
          ['Frecuencia', '20 Hz (periodo 50 ms, sin deriva)'],
          ['Ancho de banda', 'Nyquist 10 Hz: suficiente para marcha'],
          ['Transporte', 'WebSocket ws://<IP>:81 · JSON por trama'],
          ['Web', 'Dashboard servido desde LittleFS en el puerto 80'],
          ['Robustez', 'Descarta tramas si el cliente va lento; reconexión automática'],
          ['Diagnóstico', 'http://<IP>/status'],
        ]}
      />
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs leading-relaxed text-slate-300 lg:col-span-3">
        <p className="mb-1 font-semibold text-slate-100">¿Cómo se calcula el ángulo?</p>
        <p>
          El acelerómetro da la inclinación respecto a la gravedad, <span className="font-mono text-cyan-200">θ_acc = atan2(a_anterior, a_vertical)</span>,
          exacta en reposo pero ruidosa al caminar por los impactos. El giroscopio da la velocidad angular, suave pero con deriva al integrarla.
          El filtro complementario combina ambos en cada muestra:{' '}
          <span className="font-mono text-cyan-200">θ = α·(θ + ω·Δt) + (1 − α)·θ_acc</span>. Con α = {settings.alpha.toFixed(3)} el giroscopio domina en
          intervalos menores a ≈ {tau.toFixed(1)} s y el acelerómetro corrige la deriva a más largo plazo. En el gráfico de cinemática la línea
          discontinua gris es θ_acc: la diferencia con la curva cian muestra cuánto ruido de impacto elimina la fusión.
        </p>
      </div>
    </div>
  );
}

function SpecCard({ color, title, intro, rows }) {
  const ring = { emerald: 'border-emerald-500/25 bg-emerald-500/5', cyan: 'border-cyan-500/25 bg-cyan-500/5', violet: 'border-violet-500/25 bg-violet-500/5' }[color];
  const head = { emerald: 'text-emerald-300', cyan: 'text-cyan-300', violet: 'text-violet-300' }[color];
  return (
    <div className={`rounded-lg border p-3 ${ring}`}>
      <h3 className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${head}`}>{title}</h3>
      <p className="mb-2 text-xs leading-relaxed text-slate-300">{intro}</p>
      <dl className="divide-y divide-slate-800/80 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2 py-1.5">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-slate-200">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ───────────────────────── Protocolo ───────────────────────── */

function ProtocolTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {PROTOCOL.map((step, i) => (
        <div key={step.title} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-100">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-500/20 text-[10px] text-cyan-200">{i + 1}</span>
            {step.title}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-300 marker:text-slate-600">
            {step.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100 md:col-span-2">
        <b>Seguridad:</b> realiza las pruebas con supervisión, en superficie seca y despejada, con apoyo disponible (barras paralelas o
        acompañante) en usuarios nóveles. Detén la prueba ante dolor en el muñón, fatiga o inestabilidad.
      </p>
    </div>
  );
}

/* ───────────────────────── Limitaciones y glosario ───────────────────────── */

function LimitsTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-300">Limitaciones a tener en cuenta</h3>
        <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
          {LIMITATIONS.map((l) => (
            <li key={l} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" />
              {l}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Glosario</h3>
        <dl className="divide-y divide-slate-800 rounded-lg border border-slate-800 text-xs">
          {GLOSSARY.map(([term, def]) => (
            <div key={term} className="grid grid-cols-[8.5rem_1fr] gap-2 px-3 py-2">
              <dt className="font-semibold text-slate-200">{term}</dt>
              <dd className="leading-relaxed text-slate-400">{def}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
