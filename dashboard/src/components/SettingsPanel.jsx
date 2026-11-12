import Panel from './Panel';
import { Toggle } from './ConnectionPanel';
import { ADC_MAX } from '../lib/constants';
import { useState } from 'react';
import { AXES, SIGNED_AXES, detectVerticalAxis, parseAxis, resolveAxes } from '../lib/orientation';

const axisLabel = (a) => (a.startsWith('-') ? `−${a.slice(1)}` : `+${a}`);
const axisOptions = (list) => list.map((a) => ({ value: a, label: axisLabel(a) }));

/** Ajustes de calibración: umbrales FSR, montaje de la IMU y filtro. */
export default function SettingsPanel({ settings, update, onReset, onTare, canTare, getLatestFrame }) {
  const { gyroAxis, sign } = resolveAxes(settings.verticalAxis, settings.apAxis);
  const vLetter = parseAxis(settings.verticalAxis).letter;
  const [detectMsg, setDetectMsg] = useState(null);

  // Al cambiar el vertical, si el AP comparte la misma letra se elige otra.
  const setVertical = (v) =>
    update((s) => {
      const letter = parseAxis(v).letter;
      return { verticalAxis: v, apAxis: parseAxis(s.apAxis).letter === letter ? AXES.find((a) => a !== letter) : s.apAxis };
    });

  // Con la prótesis en reposo y vertical: el eje que más gravedad mide es el vertical.
  const autoDetect = () => {
    const frame = getLatestFrame?.();
    if (!frame) return;
    const r = detectVerticalAxis(frame, settings.apAxis);
    update({ verticalAxis: r.verticalAxis, apAxis: r.apAxis, angleOffset: 0 });
    const warnG = Math.abs(r.gNorm - 9.81) > 1.5 ? ' · |a| ≠ 1 g: ¿la pierna estaba quieta?' : '';
    setDetectMsg({
      ok: r.tiltDeg < 30 && !warnG,
      text: `Vertical = ${axisLabel(r.verticalAxis)} (inclinación ${r.tiltDeg.toFixed(0)}°)${warnG}. Ahora pulsa “Calibrar 0°”.`,
    });
  };

  return (
    <Panel title="Calibración" subtitle="Umbrales FSR y montaje IMU">
      <div className="space-y-5 text-sm">
        <fieldset className="space-y-3">
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Umbrales de contacto (ADC)</legend>
          <Range label="Talón" value={settings.heelThreshold} min={50} max={ADC_MAX} step={25} onChange={(v) => update({ heelThreshold: v })} />
          <Range label="Punta" value={settings.toeThreshold} min={50} max={ADC_MAX} step={25} onChange={(v) => update({ toeThreshold: v })} />
          <Range label="Histéresis" value={settings.hysteresis} min={0} max={800} step={10} onChange={(v) => update({ hysteresis: v })} />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Montaje MPU6050</legend>
          <div className="grid grid-cols-3 gap-2">
            <Select label="Vertical (↑)" value={settings.verticalAxis} options={axisOptions(SIGNED_AXES)} onChange={setVertical} />
            <Select
              label="Anterior (→)"
              value={settings.apAxis}
              options={axisOptions(SIGNED_AXES.filter((a) => parseAxis(a).letter !== vLetter))}
              onChange={(v) => update({ apAxis: v })}
            />
            <div>
              <span className="block text-[11px] text-slate-400">Giro sagital</span>
              <span
                className="mt-1 block rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5 text-center font-mono text-slate-300"
                title="Eje del giroscopio usado (deducido) y su signo"
              >
                {sign < 0 ? '−' : '+'}gyr_{gyroAxis}
              </span>
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={autoDetect}
              disabled={!canTare}
              className="w-full rounded-lg bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-500/40 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              title="Con la prótesis quieta y en posición vertical, detecta qué eje del sensor apunta hacia arriba"
            >
              Auto-detectar eje vertical (prótesis quieta)
            </button>
            {detectMsg && (
              <p className={`mt-1.5 text-[11px] leading-snug ${detectMsg.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{detectMsg.text}</p>
            )}
          </div>
          <Select
            label="Unidades del giroscopio"
            value={settings.gyroUnits}
            options={[
              { value: 'rad', label: 'rad/s (Adafruit_MPU6050)' },
              { value: 'deg', label: '°/s' },
            ]}
            onChange={(v) => update({ gyroUnits: v })}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">Invertir signo del ángulo</span>
            <Toggle checked={settings.invertAngle} onChange={(v) => update({ invertAngle: v })} label="Invertir signo del ángulo" />
          </div>
          <Range
            label="α filtro complementario"
            value={settings.alpha}
            min={0.8}
            max={0.995}
            step={0.005}
            decimals={3}
            onChange={(v) => update({ alpha: v })}
          />
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canTare}
            onClick={onTare}
            className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/40 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            title="Con el paciente en bipedestación estática, define la posición actual como 0°"
          >
            Calibrar 0° (tara)
          </button>
          {settings.angleOffset !== 0 && (
            <button
              type="button"
              onClick={() => update({ angleOffset: 0 })}
              className="rounded-lg px-3 py-2 text-xs text-slate-300 ring-1 ring-slate-700 hover:bg-slate-800"
            >
              Quitar tara ({settings.angleOffset.toFixed(1)}°)
            </button>
          )}
          <button type="button" onClick={onReset} className="rounded-lg px-3 py-2 text-xs text-slate-400 ring-1 ring-slate-700 hover:bg-slate-800">
            Restablecer
          </button>
        </div>
      </div>
    </Panel>
  );
}

function Range({ label, value, min, max, step, decimals = 0, onChange }) {
  const id = `rng-${label.replace(/\W+/g, '-')}`;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs text-slate-300">
          {label}
        </label>
        <span className="font-mono text-xs tabular-nums text-cyan-300">{Number(value).toFixed(decimals)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function Select({ label, value, options, onChange }) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <label className="block">
      <span className="block text-[11px] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
