/**
 * Generador de marcha sintética (modo demostración, sin hardware).
 * Produce tramas con el MISMO formato que el ESP32, coherentes con la configuración
 * de ejes y unidades, para validar la interfaz desde GitHub Pages sin Mixed Content.
 */
import { ADC_MAX } from './constants';
import { resolveAxes } from './orientation';

const G = 9.81;
const STRIDE_S = 1.1; // ≈ 55 zancadas/min
const noise = (a) => (Math.random() * 2 - 1) * a;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Ángulo sagital simulado del pilón (°) en función de la fase del ciclo p∈[0,1). */
function shankAngle(p) {
  const w = 2 * Math.PI * p;
  return 4 + 22 * Math.sin(w - 0.9) + 7 * Math.sin(2 * w + 0.4);
}
/** Derivada analítica del ángulo anterior (°/s). */
function shankRate(p) {
  const w = 2 * Math.PI * p;
  const dw = (2 * Math.PI) / STRIDE_S;
  return (22 * Math.cos(w - 0.9) + 14 * Math.cos(2 * w + 0.4)) * dw;
}
/** Pulso suave entre `start` y `end` (fracciones del ciclo). */
function pulse(p, start, end, peak, shape = 0.6) {
  if (p < start || p > end) return 0;
  return peak * Math.sin((Math.PI * (p - start)) / (end - start)) ** shape;
}

export function generateFrame(tSec, s) {
  const p = (tSec % STRIDE_S) / STRIDE_S;
  const inv = s.invertAngle ? -1 : 1;
  const theta = (shankAngle(p) * inv * Math.PI) / 180;
  const rate = shankRate(p) * inv;
  const { gyroAxis, sign, v, ap } = resolveAxes(s.verticalAxis, s.apAxis);

  const impact = 5 * Math.exp(-((p / 0.025) ** 2)); // pico de impacto en el contacto inicial
  const acc = { x: noise(0.25), y: noise(0.25), z: noise(0.25) };
  acc[ap.letter] += ap.sign * (G * Math.sin(theta) + noise(0.6));
  acc[v.letter] += v.sign * (G * Math.cos(theta) + impact);

  const gyr = { x: noise(2), y: noise(2), z: noise(2) };
  gyr[gyroAxis] = rate * sign + noise(3);
  if (s.gyroUnits === 'rad') for (const k in gyr) gyr[k] = (gyr[k] * Math.PI) / 180;

  const heel = 80 + pulse(p, 0.0, 0.34, 3500, 0.5) + noise(40);
  const toe = 60 + pulse(p, 0.12, 0.62, 3300, 0.7) + noise(40);
  const r2 = (v) => Math.round(v * 100) / 100;

  return {
    fsr_talon: Math.round(clamp(heel, 0, ADC_MAX)),
    fsr_punta: Math.round(clamp(toe, 0, ADC_MAX)),
    acc_x: r2(acc.x),
    acc_y: r2(acc.y),
    acc_z: r2(acc.z),
    gyr_x: r2(gyr.x),
    gyr_y: r2(gyr.y),
    gyr_z: r2(gyr.z),
  };
}
