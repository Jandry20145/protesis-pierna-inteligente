import { WS_STATUS } from '../hooks/useWebSocket';

/** Traduce el estado del socket a etiqueta + color clínico. */
export function statusMeta(status, retryCount = 0) {
  switch (status) {
    case 'demo':
      return { label: 'Simulación', dot: 'bg-violet-400', ring: 'border-violet-500/40 text-violet-200', pulse: true };
    case WS_STATUS.OPEN:
      return { label: 'Conectado', dot: 'bg-emerald-400', ring: 'border-emerald-500/40 text-emerald-200', pulse: true };
    case WS_STATUS.CONNECTING:
      return { label: 'Conectando…', dot: 'bg-amber-400', ring: 'border-amber-500/40 text-amber-200', pulse: true };
    case WS_STATUS.RECONNECTING:
      return {
        label: `Reconectando${retryCount ? ` (intento ${retryCount})` : '…'}`,
        dot: 'bg-amber-400',
        ring: 'border-amber-500/40 text-amber-200',
        pulse: true,
      };
    default:
      return { label: 'Desconectado', dot: 'bg-rose-500', ring: 'border-rose-500/30 text-rose-200', pulse: false };
  }
}

export default function StatusBadge({ status, retryCount }) {
  const m = statusMeta(status, retryCount);
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full border bg-slate-950/60 px-3 py-1 text-xs font-medium ${m.ring}`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {m.pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${m.dot}`} />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${m.dot}`} />
      </span>
      {m.label}
    </span>
  );
}
