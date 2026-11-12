/** Contenedor estándar de tarjeta del panel clínico. */
export default function Panel({ title, subtitle, actions, className = '', bodyClassName = '', children }) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-black/20 ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
