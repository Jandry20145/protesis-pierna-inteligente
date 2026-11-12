/**
 * Estimación del ángulo sagital del segmento (pilón/tibia protésica) a partir del MPU6050.
 *
 *  - Acelerómetro: inclinación absoluta respecto a la gravedad, atan2(a_ap, a_vertical).
 *    Es exacta en reposo pero se contamina con las aceleraciones lineales e impactos de la marcha.
 *  - Giroscopio: velocidad angular en el plano sagital; integrada es suave pero deriva.
 *  - Filtro complementario: θ = α·(θ + ω·dt) + (1−α)·θ_acc  → lo mejor de ambos.
 */
export const AXES = ['x', 'y', 'z'];
/** Ejes con signo admitidos para el montaje: '-y' = la gravedad apunta hacia −y del sensor. */
export const SIGNED_AXES = ['x', '-x', 'y', '-y', 'z', '-z'];
const RAD2DEG = 180 / Math.PI;

/** '-y' → { letter: 'y', sign: -1 } · 'x' → { letter: 'x', sign: 1 } */
export function parseAxis(axis) {
  const s = String(axis ?? '');
  const letter = s.replace('-', '');
  return { letter: AXES.includes(letter) ? letter : 'y', sign: s.startsWith('-') ? -1 : 1 };
}

/**
 * Deduce el eje del giroscopio perpendicular al plano sagital y el signo necesario
 * para que su integración coincida con atan2(a_ap, a_vertical).
 * El eje de giro es n = û_ap × û_vertical: si las letras (ap, vertical) siguen el orden
 * cíclico x→y→z, n = +ê_k; si no, −ê_k. Los signos de los ejes multiplican el resultado.
 */
export function resolveAxes(verticalAxis, apAxis) {
  const v = parseAxis(verticalAxis);
  const ap = parseAxis(apAxis);
  const gyroAxis = AXES.find((a) => a !== v.letter && a !== ap.letter) ?? 'z';
  const i = AXES.indexOf(ap.letter);
  const j = AXES.indexOf(v.letter);
  const cyclic = (j - i + 3) % 3 === 1 ? 1 : -1;
  return { gyroAxis, sign: cyclic * v.sign * ap.sign, v, ap };
}

/** Calcula el ángulo del acelerómetro (°) y la velocidad angular sagital (°/s) de una trama. */
export function computeImu(frame, s) {
  const { gyroAxis, sign, v, ap } = resolveAxes(s.verticalAxis, s.apAxis);
  const inv = s.invertAngle ? -1 : 1;
  const aAp = ap.sign * frame[`acc_${ap.letter}`];
  const aV = v.sign * frame[`acc_${v.letter}`];
  const accAngle = Math.atan2(aAp, aV) * RAD2DEG * inv;
  const raw = frame[`gyr_${gyroAxis}`];
  const gyroRate = (s.gyroUnits === 'rad' ? raw * RAD2DEG : raw) * sign * inv;
  return { accAngle, gyroRate, gyroAxis };
}

/**
 * Detecta el eje vertical (con signo) a partir de una trama en reposo: el eje con mayor
 * |aceleración| es el que se alinea con la gravedad. Devuelve también un eje AP válido
 * (conserva el actual si no coincide con el nuevo vertical) y la confianza de la detección.
 */
export function detectVerticalAxis(frame, currentAp = 'x') {
  const mags = AXES.map((a) => ({ a, val: frame[`acc_${a}`] }));
  mags.sort((p, q) => Math.abs(q.val) - Math.abs(p.val));
  const best = mags[0];
  const verticalAxis = (best.val < 0 ? '-' : '') + best.a;
  const apCur = parseAxis(currentAp);
  const apAxis = apCur.letter !== best.a ? currentAp : AXES.find((a) => a !== best.a);
  const norm = Math.hypot(...mags.map((m) => m.val)) || 1;
  // Ángulo entre la gravedad y el eje elegido (0° = perfectamente alineado)
  const tiltDeg = Math.acos(Math.min(1, Math.abs(best.val) / norm)) * RAD2DEG;
  return { verticalAxis, apAxis, tiltDeg, gNorm: norm };
}

export class ComplementaryFilter {
  constructor() {
    this.reset();
  }

  reset() {
    this.angle = null;
    this.lastT = null;
  }

  /**
   * @param {number} accAngle  ángulo del acelerómetro (°)
   * @param {number} gyroRate  velocidad angular (°/s)
   * @param {number} tMs       marca temporal de llegada (ms, performance.now())
   * @param {number} alpha     0..1, peso del giroscopio
   */
  update(accAngle, gyroRate, tMs, alpha) {
    if (this.angle === null) {
      this.angle = accAngle;
      this.lastT = tMs;
      return this.angle;
    }
    const dt = (tMs - this.lastT) / 1000;
    this.lastT = tMs;
    // Hueco grande (reconexión, pestaña en segundo plano): re-inicializar con el acelerómetro.
    if (!(dt > 0) || dt > 0.5) {
      this.angle = accAngle;
      return this.angle;
    }
    this.angle = alpha * (this.angle + gyroRate * dt) + (1 - alpha) * accAngle;
    return this.angle;
  }
}
