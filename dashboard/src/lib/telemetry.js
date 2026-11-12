/**
 * Almacén de telemetría fuera del estado de React.
 * Recibe tramas a 20 Hz, calcula ángulo y fase de marcha, y mantiene series temporales
 * (búfer de MAX_HISTORY_S segundos) que los gráficos leen a su propio ritmo.
 */
import { MAX_HISTORY_S } from './constants';
import { ComplementaryFilter, computeImu } from './orientation';
import { GaitDetector } from './gait';

const emptySeries = () => ({ angle: [], accAngle: [], gyro: [], heel: [], toe: [], stance: [] });

export function createTelemetryStore() {
  const filter = new ComplementaryFilter();
  const gait = new GaitDetector();

  const store = {
    t0: null,
    frames: 0,
    latest: null,
    series: emptySeries(),

    /** Procesa una trama validada. `tMs` = performance.now() de llegada. */
    ingest(frame, tMs, s) {
      if (store.t0 === null) store.t0 = tMs;
      const x = (tMs - store.t0) / 1000;

      const { accAngle, gyroRate } = computeImu(frame, s);
      const fused = filter.update(accAngle, gyroRate, tMs, s.alpha);
      const angle = fused - s.angleOffset;
      const g = gait.update(frame, tMs, s);

      const ser = store.series;
      ser.angle.push({ x, y: angle });
      ser.accAngle.push({ x, y: accAngle - s.angleOffset });
      ser.gyro.push({ x, y: gyroRate });
      ser.heel.push({ x, y: frame.fsr_talon });
      ser.toe.push({ x, y: frame.fsr_punta });
      ser.stance.push({ x, y: g.stance ? 1 : 0 });

      // Recorte del historial (in-place para conservar las referencias de los arrays).
      const cutoff = x - MAX_HISTORY_S;
      let drop = 0;
      while (drop < ser.angle.length && ser.angle[drop].x < cutoff) drop++;
      if (drop) for (const k in ser) ser[k].splice(0, drop);

      store.frames++;
      store.latest = { x, frame, angle, rawAngle: fused, accAngle: accAngle - s.angleOffset, gyroRate, gait: g };
    },

    metrics: () => gait.getMetrics(),

    /** Reinicia el filtro (p. ej. al cambiar los ejes de montaje). */
    resetFilter() {
      filter.reset();
    },

    /** Borra todo el historial (nueva sesión). */
    reset() {
      filter.reset();
      gait.reset();
      store.t0 = null;
      store.frames = 0;
      store.latest = null;
      const ser = store.series;
      for (const k in ser) ser[k].length = 0;
    },
  };
  return store;
}
