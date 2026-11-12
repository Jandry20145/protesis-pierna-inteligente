import Panel from './Panel';

/** Sección fija informativa: propósito de los sensores y objetivo biomecánico. */
export default function AboutPanel() {
  return (
    <Panel title="Acerca de la prótesis" subtitle="Instrumentación y objetivo clínico">
      <div className="space-y-4 text-xs leading-relaxed text-slate-300">
        <p>
          Prótesis de miembro inferior instrumentada con un <b className="text-slate-100">ESP32</b> que mide y transmite a{' '}
          <b className="text-slate-100">20 Hz</b> por Wi-Fi (WebSocket) la <b>cinética</b> (cargas plantares) y la{' '}
          <b>cinemática</b> (orientación) del segmento protésico durante la marcha.
        </p>

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <h3 className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> FSR · Fuerzas de reacción del suelo
          </h3>
          <p>
            Dos sensores de fuerza resistivos, en el <b>talón</b> y el <b>antepié</b>, registran cuándo y dónde se carga el pie.
            Indican la componente vertical de la <b>Fuerza de Reacción del Suelo (GRF)</b> en esos puntos y, por su secuencia,
            identifican el contacto inicial, el apoyo medio, el despegue y el balanceo.
          </p>
          <ul className="mt-2 space-y-0.5 text-slate-400">
            <li>→ Tiempos de apoyo y balanceo, cadencia</li>
            <li>→ Patrón de contacto talón → punta</li>
            <li>→ Reparto de carga entre retropié y antepié</li>
          </ul>
        </div>

        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
          <h3 className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> IMU MPU6050 · Cinemática sagital
          </h3>
          <p>
            Acelerómetro (±4 g) y giroscopio (±500 °/s) de 3 ejes fijados al pilón. Un <b>filtro complementario</b> fusiona la
            inclinación respecto a la gravedad con la velocidad angular para obtener el <b>ángulo del segmento en el plano sagital</b>{' '}
            (flexo-extensión) con poca deriva y poco ruido de impacto.
          </p>
          <ul className="mt-2 space-y-0.5 text-slate-400">
            <li>→ Ángulo y rango de movimiento del pilón</li>
            <li>→ Velocidad angular en el balanceo</li>
          </ul>
        </div>

        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Objetivo biomecánico</h3>
          <p>
            Cuantificar de forma objetiva y en tiempo real la <b>calidad del patrón de marcha</b> del usuario de prótesis para apoyar
            decisiones clínicas:
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-slate-400 marker:text-slate-600">
            <li>
              <b className="text-slate-300">Simetría temporal:</b> el lado protésico tiende a un apoyo más corto (≈ 60/40 es lo normal).
            </li>
            <li>
              <b className="text-slate-300">Transferencia de carga:</b> progresión talón → punta y despegue eficaz.
            </li>
            <li>
              <b className="text-slate-300">Cinemática:</b> rango y regularidad del movimiento del segmento.
            </li>
            <li>
              <b className="text-slate-300">Seguimiento:</b> alineación protésica, ajuste del socket y evolución de la rehabilitación.
            </li>
          </ul>
        </div>

        <p className="rounded-md bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400">
          📖 Ciclo de marcha, valores de referencia, protocolo de evaluación y limitaciones en el{' '}
          <b className="text-slate-300">Centro de información clínica</b> (al final del panel principal).
        </p>

        <p className="border-t border-slate-800 pt-3 text-[11px] text-slate-500">
          Herramienta de apoyo para investigación y docencia; no es un dispositivo médico certificado ni sustituye la valoración
          clínica profesional.
        </p>
      </div>
    </Panel>
  );
}
