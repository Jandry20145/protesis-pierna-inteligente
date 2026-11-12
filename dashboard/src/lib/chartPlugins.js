/**
 * Plugins de Chart.js propios. Leen sus datos de propiedades del chart (chart.$hLines,
 * chart.$bands) en lugar de `options`, para evitar el resolvedor de opciones en cada frame.
 */

/** Líneas horizontales de referencia (umbrales FSR, 0°…). */
export const hLinesPlugin = {
  id: 'hLines',
  afterDatasetsDraw(chart) {
    const lines = chart.$hLines;
    if (!lines?.length) return;
    const { ctx, chartArea, scales } = chart;
    const y = scales.y;
    ctx.save();
    for (const l of lines) {
      const py = y.getPixelForValue(l.value);
      if (py < chartArea.top || py > chartArea.bottom) continue;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 1;
      ctx.setLineDash(l.dash ?? [5, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, py);
      ctx.lineTo(chartArea.right, py);
      ctx.stroke();
      if (l.label) {
        ctx.setLineDash([]);
        ctx.fillStyle = l.color;
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        // align: 'left' permite separar etiquetas de umbrales con el mismo valor.
        const left = l.align === 'left';
        ctx.textAlign = left ? 'left' : 'right';
        ctx.fillText(l.label, left ? chartArea.left + 4 : chartArea.right - 4, py - 4);
      }
    }
    ctx.restore();
  },
};

/** Bandas verticales sombreadas donde la serie binaria vale 1 (fase de apoyo). */
export const bandsPlugin = {
  id: 'bands',
  beforeDatasetsDraw(chart) {
    const bands = chart.$bands;
    const data = bands?.data;
    if (!data?.length) return;
    const { ctx, chartArea, scales } = chart;
    const x = scales.x;
    ctx.save();
    ctx.fillStyle = bands.color;
    let start = null;
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      if (p.y && start === null) start = p.x;
      const ends = start !== null && (!p.y || i === data.length - 1);
      if (ends) {
        const x0 = Math.max(x.getPixelForValue(start), chartArea.left);
        const x1 = Math.min(x.getPixelForValue(p.x), chartArea.right);
        if (x1 > x0) ctx.fillRect(x0, chartArea.top, x1 - x0, chartArea.bottom - chartArea.top);
        start = null;
      }
    }
    ctx.restore();
  },
};
