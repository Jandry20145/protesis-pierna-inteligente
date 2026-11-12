import { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { bandsPlugin, hLinesPlugin } from '../lib/chartPlugins';

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend, Filler);

const AXIS_COLOR = '#94a3b8'; // slate-400
const GRID_COLOR = 'rgba(148,163,184,0.08)';

/**
 * Gráfico de series temporales en tiempo real (Chart.js directo sobre <canvas>).
 *
 * El chart se crea una sola vez; en cada render (≈10 Hz, disparado por el "tick" del padre)
 * se copian las series y se llama a update('none') sin animaciones → bajo coste de CPU.
 * Mientras `paused` es true no se actualiza, de modo que el usuario puede inspeccionar
 * los datos con el tooltip (interactivo) sin que se desplacen.
 *
 * @param {Array<{label:string,color:string,data:Array<{x:number,y:number}>,width?:number,dash?:number[],fill?:string}>} series
 */
export default function LiveChart({
  series,
  paused = false,
  windowSeconds = 10,
  latestX = 0,
  yMin,
  yMax,
  ySuggested,
  yTitle,
  unit = '',
  decimals = 1,
  hLines,
  bands,
  height = 260,
  ariaLabel,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  // Creación / destrucción del gráfico.
  useEffect(() => {
    const chart = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        datasets: series.map((s) => ({
          label: s.label,
          data: [],
          borderColor: s.color,
          backgroundColor: s.fill ?? s.color,
          fill: s.fill ? 'origin' : false,
          borderWidth: s.width ?? 2,
          borderDash: s.dash ?? [],
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0.25,
        })),
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        normalized: true,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: {
          legend: {
            labels: { color: AXIS_COLOR, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'line', font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: 'rgba(2,6,23,0.95)',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#cbd5e1',
            padding: 8,
            callbacks: {
              title: (items) => (items.length ? `t = ${items[0].parsed.x.toFixed(2)} s` : ''),
              label: (it) => ` ${it.dataset.label}: ${it.parsed.y.toFixed(decimals)} ${unit}`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Tiempo (s)', color: AXIS_COLOR, font: { size: 11 } },
            ticks: { color: AXIS_COLOR, maxTicksLimit: 8, callback: (v) => Number(v).toFixed(0) },
            grid: { color: GRID_COLOR },
          },
          y: {
            title: { display: !!yTitle, text: yTitle, color: AXIS_COLOR, font: { size: 11 } },
            ticks: { color: AXIS_COLOR },
            grid: { color: GRID_COLOR },
          },
        },
      },
      plugins: [bandsPlugin, hLinesPlugin],
    });
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
    // Las series se fijan al montar; sus datos se actualizan en el efecto siguiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actualización imperativa en cada render del padre.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || paused) return;
    const xMax = Math.max(latestX, windowSeconds);
    chart.data.datasets.forEach((d, i) => {
      d.data = series[i]?.data.slice() ?? [];
    });
    const { x, y } = chart.options.scales;
    x.min = xMax - windowSeconds;
    x.max = xMax;
    y.min = yMin;
    y.max = yMax;
    y.suggestedMin = ySuggested?.[0];
    y.suggestedMax = ySuggested?.[1];
    chart.$hLines = hLines;
    chart.$bands = bands ? { color: bands.color, data: bands.data.slice() } : null;
    chart.update('none');
  });

  return (
    <div style={{ height }} className="relative w-full">
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  );
}
