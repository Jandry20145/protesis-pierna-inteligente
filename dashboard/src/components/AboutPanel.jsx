import Panel from './Panel';

/** Sección fija informativa: propósito de los sensores y objetivo biomecánico. */
export default function AboutPanel() {
  return (
    <Panel title="Acerca de la prótesis" subtitle="Instrumentación y objetivo clínico">
      <div className="space-y-4 text-xs leading-relaxed text-slate-300">
        <p>
          Prótesis de miembro inferior instrumentada con un <b className="text-slate-100">ESP32</b> que transmite a{' '}
          <b className="text-slate-100">20 Hz</b> por Wi-Fi (WebSocket) la cinética y la cinemática del segmento protésico.
        </p>

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <h3 className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> FSR · Fuerzas de reacción del suelo
          </h3>
          <p>
            Dos resistencias sensibles a la fuerza, en <b>talón</b> y <b>antepié (punta)</b>, estiman la carga vertical
            de la Fuerza de Reacción del Suelo (GRF). Su secuencia de activación identifica el contacto inicial, el apoyo
            medio, el despegue y el balanceo, y permite medir tiempos de apoyo/balanceo y cadencia.
          </p>
        </div>

        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
          <h3 className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> IMU MPU6050 · Cinemática sagital
          </h3>
          <p>
            Acelerómetro y giroscopio de 3 ejes fijados al pilón. Un <b>filtro complementario</b> fusiona la inclinación
            respecto a la gravedad (acelerómetro) con la velocidad angular integrada (giroscopio) para obtener el{' '}
            <b>ángulo de flexo-extensión en el plano sagital</b> con baja deriva y bajo ruido de impacto.
          </p>
        </div>

        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Objetivo biomecánico</h3>
          <p>
            Evaluar de forma objetiva y en tiempo real la <b>simetría temporal</b> y la <b>calidad del patrón de marcha</b>{' '}
            del usuario de la prótesis —distribución de carga talón-punta, proporción apoyo/balanceo (≈ 60/40 en marcha
            normal) y rango de movimiento sagital— para apoyar la alineación protésica, el ajuste del socket y el
            seguimiento de la rehabilitación.
          </p>
        </div>

        <p className="border-t border-slate-800 pt-3 text-[11px] text-slate-500">
          Herramienta de apoyo para investigación y docencia; no es un dispositivo médico certificado ni sustituye la
          valoración clínica profesional.
        </p>
      </div>
    </Panel>
  );
}
