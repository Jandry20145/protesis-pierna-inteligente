/** Constantes y configuración por defecto del monitor. */

/** Resolución del ADC del ESP32 (12 bits). */
export const ADC_MAX = 4095;

/** Campos obligatorios de cada trama JSON enviada por el ESP32. */
export const FRAME_KEYS = ['fsr_talon', 'fsr_punta', 'acc_x', 'acc_y', 'acc_z', 'gyr_x', 'gyr_y', 'gyr_z'];

/** Segundos de historial que se conservan en memoria (máximo de la ventana del gráfico). */
export const MAX_HISTORY_S = 30;

/** Opciones de ventana temporal del gráfico (s). */
export const WINDOW_OPTIONS = [5, 10, 20, 30];

/**
 * Dirección WebSocket por defecto. Si la página la sirve el propio ESP32
 * (http://<ip>/), se usa esa misma IP; si no (GitHub Pages, localhost), la IP del AP.
 */
function defaultWsUrl() {
  if (typeof window === 'undefined') return 'ws://192.168.4.1:81';
  const { protocol, hostname } = window.location;
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
  return protocol === 'http:' && !local ? `ws://${hostname}:81` : 'ws://192.168.4.1:81';
}

export const DEFAULT_SETTINGS = Object.freeze({
  wsUrl: defaultWsUrl(),
  windowSeconds: 10,

  // --- Detección de fases (FSR, cuentas ADC 0–4095) ---
  heelThreshold: 1200, // umbral de contacto del talón
  toeThreshold: 1200, // umbral de contacto de la punta
  hysteresis: 150, // banda de histéresis para evitar rebotes

  // --- Cinemática (IMU) ---
  // Montaje del MPU6050 en el pilón/socket: eje alineado con la vertical (gravedad)
  // y eje antero-posterior. El eje del giroscopio sagital se deduce (el tercero).
  verticalAxis: 'y',
  apAxis: 'x',
  gyroUnits: 'rad', // la librería Adafruit_MPU6050 entrega rad/s
  invertAngle: false,
  alpha: 0.98, // peso del giroscopio en el filtro complementario
  angleOffset: 0, // tara (°) aplicada con "Calibrar 0°"
});

/** Fases/sub-fases de la marcha detectadas con los dos FSR. */
export const PHASES = Object.freeze({
  heel: { key: 'heel', short: 'Contacto inicial', detail: 'Solo talón cargado', stance: true },
  flat: { key: 'flat', short: 'Apoyo medio', detail: 'Talón + punta (pie plano)', stance: true },
  toe: { key: 'toe', short: 'Despegue', detail: 'Solo punta cargada (push-off)', stance: true },
  swing: { key: 'swing', short: 'Balanceo', detail: 'Sin contacto con el suelo', stance: false },
});
export const PHASE_ORDER = ['heel', 'flat', 'toe', 'swing'];
