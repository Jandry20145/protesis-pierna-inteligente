import { useEffect, useRef } from 'react';
import { ADC_MAX } from '../lib/constants';

/**
 * Representación cinemática en HTML5 Canvas: el pilón de la prótesis rota en el plano
 * sagital según el ángulo estimado. Se redibuja con requestAnimationFrame leyendo
 * directamente el último dato (getLatest) para no depender del ciclo de render de React.
 */
export default function LegCanvas({ getLatest, height = 260 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let w = 0;
    let h = 0;
    let shown = 0; // ángulo mostrado (suavizado para animación fluida)

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = () => {
      const latest = getLatest();
      const target = latest ? latest.angle : 0;
      shown += (target - shown) * 0.35;
      const th = (shown * Math.PI) / 180;

      ctx.clearRect(0, 0, w, h);

      const L = Math.min(h * 0.62, w * 0.75);
      const knee = { x: w / 2, y: Math.max(28, (h - L) / 2 - 6) };
      const ankle = { x: knee.x + L * Math.sin(th), y: knee.y + L * Math.cos(th) };
      const groundY = knee.y + L + L * 0.1;

      // Rejilla y suelo
      ctx.strokeStyle = 'rgba(148,163,184,0.07)';
      ctx.lineWidth = 1;
      for (let gx = (w / 2) % 24; gx < w; gx += 24) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      ctx.strokeStyle = '#334155';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(8, groundY);
      ctx.lineTo(w - 8, groundY);
      ctx.stroke();

      // Referencia vertical (0°)
      ctx.strokeStyle = 'rgba(148,163,184,0.45)';
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(knee.x, knee.y);
      ctx.lineTo(knee.x, knee.y + L);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arco del ángulo
      const r = L * 0.32;
      ctx.strokeStyle = shown >= 0 ? '#22d3ee' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // canvas: ángulo 90° (π/2) apunta hacia abajo; el segmento está en π/2 − th
      ctx.arc(knee.x, knee.y, r, Math.PI / 2, Math.PI / 2 - th, th > 0);
      ctx.stroke();

      // Pilón
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineCap = 'round';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(knee.x, knee.y);
      ctx.lineTo(ankle.x, ankle.y);
      ctx.stroke();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(knee.x, knee.y);
      ctx.lineTo(ankle.x, ankle.y);
      ctx.stroke();

      // Pie (perpendicular al pilón, hacia anterior = derecha)
      const fd = { x: Math.cos(th), y: -Math.sin(th) };
      const heelPt = { x: ankle.x - fd.x * L * 0.12, y: ankle.y - fd.y * L * 0.12 };
      const toePt = { x: ankle.x + fd.x * L * 0.38, y: ankle.y + fd.y * L * 0.38 };
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(heelPt.x, heelPt.y);
      ctx.lineTo(toePt.x, toePt.y);
      ctx.stroke();

      // Sensores FSR con brillo según presión
      const heelP = latest ? Math.min(1, latest.frame.fsr_talon / ADC_MAX) : 0;
      const toeP = latest ? Math.min(1, latest.frame.fsr_punta / ADC_MAX) : 0;
      glow(ctx, heelPt, heelP, '52,211,153');
      glow(ctx, toePt, toeP, '34,211,238');

      // Articulación
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(knee.x, knee.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Lectura numérica
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 22px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${latest ? shown.toFixed(1) : '--.-'}°`, 12, 30);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Ángulo sagital del pilón', 12, 46);
      ctx.textAlign = 'right';
      ctx.fillText('Anterior →', w - 10, groundY - 8);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [getLatest]);

  return <canvas ref={canvasRef} style={{ height }} className="block w-full" role="img" aria-label="Animación del ángulo sagital de la prótesis" />;
}

function glow(ctx, p, k, rgb) {
  const rad = 6 + 14 * k;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 1.8);
  g.addColorStop(0, `rgba(${rgb},${0.25 + 0.75 * k})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, rad * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgb(${rgb})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.fill();
}
