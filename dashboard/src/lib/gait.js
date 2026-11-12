/**
 * Detector de fases de la marcha con dos FSR (talón y punta).
 *
 *   talón  punta   fase
 *   ─────  ─────   ───────────────────────────────
 *     1      0     Contacto inicial / respuesta a la carga
 *     1      1     Apoyo medio (pie plano)
 *     0      1     Despegue (push-off / pre-balanceo)
 *     0      0     Balanceo (swing)
 *
 * Usa histéresis para evitar rebotes y calcula parámetros temporales por zancada:
 * tiempo de zancada, cadencia (zancadas/min) y % de apoyo/balanceo.
 */
const MIN_STRIDE_S = 0.4; // contactos más seguidos se consideran rebotes
const MAX_STRIDE_S = 4.0; // más largas → el paciente se detuvo; no se promedian
const STRIDE_HISTORY = 8;

export class GaitDetector {
  constructor() {
    this.reset();
  }

  reset() {
    this.heelOn = false;
    this.toeOn = false;
    this.inStance = false;
    this.phase = 'swing';
    this.stanceStart = null;
    this.lastIC = null; // último contacto inicial (ms)
    this.lastStanceDuration = null; // s
    this.strides = []; // [{ stride, stancePct }]
    this.steps = 0;
  }

  /** Comparador con histéresis: se activa sobre `thr` y se desactiva bajo `thr − h`. */
  static hyst(value, isOn, thr, h) {
    return isOn ? value > thr - h : value > thr;
  }

  update(frame, tMs, s) {
    this.heelOn = GaitDetector.hyst(frame.fsr_talon, this.heelOn, s.heelThreshold, s.hysteresis);
    this.toeOn = GaitDetector.hyst(frame.fsr_punta, this.toeOn, s.toeThreshold, s.hysteresis);
    const stance = this.heelOn || this.toeOn;
    const phase = !stance ? 'swing' : this.heelOn && this.toeOn ? 'flat' : this.heelOn ? 'heel' : 'toe';

    let event = null;
    if (stance && !this.inStance) {
      // ---- Contacto inicial ----
      const sinceLast = this.lastIC === null ? Infinity : (tMs - this.lastIC) / 1000;
      if (sinceLast >= MIN_STRIDE_S) {
        if (sinceLast <= MAX_STRIDE_S && this.lastStanceDuration !== null) {
          this.strides.push({ stride: sinceLast, stancePct: (this.lastStanceDuration / sinceLast) * 100 });
          if (this.strides.length > STRIDE_HISTORY) this.strides.shift();
        }
        this.lastIC = tMs;
        this.stanceStart = tMs;
        this.steps++;
        event = 'initial-contact';
      }
    } else if (!stance && this.inStance && this.stanceStart !== null) {
      // ---- Despegue de la punta (toe-off) ----
      this.lastStanceDuration = (tMs - this.stanceStart) / 1000;
      event = 'toe-off';
    }

    this.inStance = stance;
    this.phase = phase;
    return { phase, stance, heelOn: this.heelOn, toeOn: this.toeOn, event };
  }

  /** Promedios de las últimas zancadas válidas. */
  getMetrics() {
    const n = this.strides.length;
    if (!n) return { steps: this.steps, strideTime: null, cadence: null, stancePct: null, swingPct: null };
    const strideTime = this.strides.reduce((a, b) => a + b.stride, 0) / n;
    const stancePct = this.strides.reduce((a, b) => a + b.stancePct, 0) / n;
    return { steps: this.steps, strideTime, cadence: 60 / strideTime, stancePct, swingPct: 100 - stancePct };
  }
}
