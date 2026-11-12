/**
 * Contenido clínico y técnico del monitor.
 * Se mantiene separado de los componentes para poder revisarlo/editarlo sin tocar la UI.
 *
 * Los valores de referencia son ORIENTATIVOS (adultos sanos, marcha en llano a velocidad
 * libre) y sirven para contextualizar, no para diagnosticar. La marcha protésica difiere
 * de forma esperable de estos valores.
 */

/** Sub-fases del ciclo de marcha (clasificación Rancho Los Amigos), en % del ciclo. */
export const GAIT_CYCLE = [
  {
    key: 'IC', name: 'Contacto inicial', start: 0, end: 2, stance: true, fsr: 'heel',
    goal: 'El talón toca el suelo; inicia el apoyo.',
    prosthesis: 'Un contacto con la punta o con todo el pie puede indicar talón protésico muy rígido, longitud excesiva o miedo a cargar.',
  },
  {
    key: 'LR', name: 'Respuesta a la carga', start: 2, end: 10, stance: true, fsr: 'heel',
    goal: 'Absorción del impacto y transferencia del peso al miembro. Doble apoyo.',
    prosthesis: 'El talón del pie protésico debe comprimirse progresivamente; un pico brusco sugiere talón duro.',
  },
  {
    key: 'MSt', name: 'Apoyo medio', start: 10, end: 30, stance: true, fsr: 'flat',
    goal: 'Apoyo monopodal; el cuerpo avanza sobre el pie fijo (pie plano).',
    prosthesis: 'Fase más exigente para la estabilidad; un apoyo medio corto es frecuente en el lado protésico.',
  },
  {
    key: 'TSt', name: 'Apoyo terminal', start: 30, end: 50, stance: true, fsr: 'toe',
    goal: 'Despegue del talón; la carga se desplaza al antepié.',
    prosthesis: 'La quilla del pie protésico devuelve energía aquí; poca carga en punta indica un despegue pobre.',
  },
  {
    key: 'PSw', name: 'Pre-balanceo', start: 50, end: 60, stance: true, fsr: 'toe',
    goal: 'Despegue de los dedos (toe-off). Segundo doble apoyo.',
    prosthesis: 'Un toe-off prematuro acorta el apoyo protésico (asimetría temporal).',
  },
  {
    key: 'ISw', name: 'Balanceo inicial', start: 60, end: 73, stance: false, fsr: 'none',
    goal: 'El pie se separa del suelo; flexión de rodilla.',
    prosthesis: 'Velocidad angular baja del pilón puede deberse a rodilla protésica muy frenada o socket mal suspendido.',
  },
  {
    key: 'MSw', name: 'Balanceo medio', start: 73, end: 87, stance: false, fsr: 'none',
    goal: 'El segmento avanza por delante del cuerpo; se requiere despeje del pie.',
    prosthesis: 'Compensaciones típicas: circunducción, elevación de cadera o salto del lado sano.',
  },
  {
    key: 'TSw', name: 'Balanceo terminal', start: 87, end: 100, stance: false, fsr: 'none',
    goal: 'Desaceleración del segmento y preparación del siguiente contacto.',
    prosthesis: 'Un frenado insuficiente produce impacto terminal (látigo) antes del contacto.',
  },
];

/** Cómo se relaciona cada estado de los FSR con las sub-fases anteriores. */
export const FSR_TO_PHASES = {
  heel: ['IC', 'LR'],
  flat: ['MSt'],
  toe: ['TSt', 'PSw'],
  swing: ['ISw', 'MSw', 'TSw'],
};

/**
 * Métricas mostradas y su interpretación.
 * ref: rango orientativo [min, max] para comparar (null = sin referencia numérica fiable).
 */
export const METRICS_INFO = {
  angle: {
    label: 'Ángulo sagital',
    unit: '°',
    what: 'Inclinación del pilón respecto a la vertical en el plano sagital (+ = distal hacia delante, tras la tara).',
    ref: null,
    refText: 'Depende del montaje y de la tara; ≈ 0° en bipedestación tras calibrar.',
    findings: 'Una asimetría entre pasos o una deriva lenta tras calibrar sugieren montaje flojo o necesidad de nueva tara.',
  },
  gyro: {
    label: 'Velocidad angular',
    unit: '°/s',
    what: 'Velocidad de rotación del pilón en el plano sagital (giroscopio).',
    ref: null,
    refText: 'Picos de varios cientos de °/s en el balanceo medio de una marcha normal.',
    findings: 'Picos bajos en balanceo → marcha lenta o rodilla protésica muy frenada; picos muy irregulares → marcha inestable.',
  },
  rom: {
    label: 'Rango de movimiento',
    unit: '°',
    what: 'Excursión total (máx − mín) del ángulo sagital del pilón dentro de la ventana mostrada.',
    ref: null,
    refText: 'Aumenta con la velocidad de marcha; compárese entre sesiones del mismo paciente.',
    findings: 'Un rango reducido sugiere marcha cautelosa, rigidez de la rodilla protésica o paso corto.',
  },
  cadence: {
    label: 'Cadencia',
    unit: 'zanc/min',
    what: 'Zancadas por minuto del miembro instrumentado (1 zancada = 2 pasos).',
    ref: [48, 62],
    refText: '≈ 50–60 zancadas/min (≈ 100–120 pasos/min) en adultos a velocidad libre.',
    findings: 'Cadencia baja es habitual en usuarios nóveles de prótesis o con baja confianza.',
  },
  strideTime: {
    label: 'Tiempo de zancada',
    unit: 's',
    what: 'Tiempo entre dos contactos iniciales consecutivos del mismo pie.',
    ref: [0.95, 1.25],
    refText: '≈ 1,0–1,2 s en adultos a velocidad libre.',
    findings: 'Variabilidad alta entre zancadas (no sólo el promedio) es un marcador de inestabilidad o riesgo de caída.',
  },
  strideCv: {
    label: 'Variabilidad de zancada',
    unit: '% CV',
    what: 'Coeficiente de variación del tiempo de zancada (desviación estándar / media) en las últimas zancadas.',
    ref: [0, 3],
    refText: '< 3 % en adultos sanos en marcha estable (requiere ≥ 3 zancadas).',
    findings: 'Un CV elevado (> 4–5 %) se asocia a marcha inestable y mayor riesgo de caída.',
  },
  stancePct: {
    label: 'Apoyo / Balanceo',
    unit: '%',
    what: 'Porcentaje del ciclo en contacto con el suelo frente a en el aire.',
    ref: [57, 64],
    refText: '≈ 60 / 40 % en marcha normal.',
    findings: 'En el lado protésico el apoyo suele ser MÁS CORTO que en el sano (descarga por inseguridad o dolor en el muñón).',
  },
  heelFirst: {
    label: 'Contacto con talón',
    unit: '%',
    what: 'Porcentaje de pasos cuyo primer contacto fue con el talón (patrón talón → punta).',
    ref: [80, 100],
    refText: 'En marcha normal prácticamente todos los pasos inician con el talón.',
    findings: 'Contactos con punta o pie plano frecuentes: prótesis larga, flexo de rodilla, talón rígido o marcha cautelosa.',
  },
  steps: {
    label: 'Contactos',
    unit: 'pasos',
    what: 'Número de contactos iniciales detectados desde que se conectó.',
    ref: null,
    refText: 'Para promedios estables registra al menos 10 zancadas en marcha constante.',
    findings: '',
  },
};

/** Estado de un valor frente a su rango de referencia. */
export function refStatus(value, ref) {
  if (value === null || value === undefined || Number.isNaN(value) || !ref) return 'none';
  const [lo, hi] = ref;
  if (value >= lo && value <= hi) return 'ok';
  const span = hi - lo;
  return value < lo - span * 0.5 || value > hi + span * 0.5 ? 'far' : 'near';
}

/** Protocolo sugerido para una sesión de evaluación. */
export const PROTOCOL = [
  {
    title: 'Preparación',
    items: [
      'Verifica el ajuste del socket y la suspensión antes de instrumentar.',
      'Fija el ESP32 y el MPU6050 al pilón con firmeza (sin holguras: vibraciones = ruido).',
      'Comprueba que los FSR queden bajo el talón y la cabeza de los metatarsianos de la plantilla.',
    ],
  },
  {
    title: 'Calibración (paciente quieto, en bipedestación)',
    items: [
      'Conecta y confirma ≈ 20 Hz y 0 tramas inválidas en el panel de conexión.',
      'Pulsa “Auto-detectar eje vertical” y después “Calibrar 0°”.',
      'Pide al paciente cargar talón y punta por separado; ajusta cada umbral a ≈ 30–40 % del valor máximo observado.',
      'Mueve la pierna hacia delante: el ángulo debe aumentar (si no, invierte el signo).',
    ],
  },
  {
    title: 'Registro',
    items: [
      'Recorrido recto de ≥ 10 m; descarta la aceleración inicial y la frenada final.',
      'Registra al menos 10 zancadas en marcha estable; usa la pausa para inspeccionar.',
      'Repite 3 ensayos y anota condiciones: calzado, ayudas técnicas, velocidad, fatiga.',
    ],
  },
  {
    title: 'Análisis',
    items: [
      'Compara % apoyo/balanceo con el lado sano (registro contralateral) para evaluar simetría.',
      'Revisa el porcentaje de contactos con talón y la forma de las curvas de presión.',
      'Contrasta los hallazgos con la observación clínica antes de modificar la alineación.',
    ],
  },
];

/** Limitaciones técnicas que deben conocerse al interpretar los datos. */
export const LIMITATIONS = [
  'Los FSR miden presión LOCAL en dos puntos: estiman eventos y distribución talón/punta, no la fuerza de reacción total en newtons.',
  'La respuesta de los FSR es no lineal, varía entre unidades y presenta deriva (creep) con carga sostenida: compara tendencias, no valores absolutos.',
  'Una sola IMU da la orientación de UN segmento (pilón). El ángulo articular de rodilla requeriría una segunda IMU en el muslo.',
  'A 20 Hz (Nyquist 10 Hz) se captura bien la cinemática de la marcha, pero no los picos de impacto, que son de mayor frecuencia.',
  'El ángulo del acelerómetro se contamina con aceleraciones lineales; el filtro complementario lo atenúa, pero en giros bruscos puede haber error transitorio.',
  'La detección de fases por umbral depende de la calibración: umbrales mal ajustados dan falsos contactos o pasos perdidos.',
  'Herramienta de apoyo para investigación y docencia: no es un dispositivo médico certificado ni sustituye la valoración profesional.',
];

/** Glosario breve. */
export const GLOSSARY = [
  ['Zancada', 'Ciclo completo: de un contacto inicial al siguiente del MISMO pie (2 pasos).'],
  ['Paso', 'Del contacto inicial de un pie al contacto inicial del pie contrario.'],
  ['Apoyo (stance)', 'Parte del ciclo en que el pie está en contacto con el suelo (≈ 60 %).'],
  ['Balanceo (swing)', 'Parte del ciclo en que el pie está en el aire (≈ 40 %).'],
  ['Doble apoyo', 'Ambos pies en el suelo; ocurre dos veces por ciclo (≈ 10 % cada una).'],
  ['GRF', 'Ground Reaction Force: fuerza que el suelo ejerce sobre el pie.'],
  ['Plano sagital', 'Plano vertical antero-posterior: donde ocurren flexión y extensión.'],
  ['Pilón', 'Tubo estructural de la prótesis que une el socket o la rodilla con el pie.'],
  ['Filtro complementario', 'Fusión de giroscopio (corto plazo) y acelerómetro (largo plazo) para estimar el ángulo.'],
];
