/** Marca de StylerNow: dos barras inclinadas azules + «Styler» en navy y «Now» en azul (referencia de diseño). */
export function LogoStylerNow({ tamano = 26 }: { tamano?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: tamano * 0.3, lineHeight: 1 }} aria-label="StylerNow">
      <svg width={tamano * 1.15} height={tamano} viewBox="0 0 30 26" aria-hidden>
        <path d="M9 2h8.2L9.4 24H1.2z" fill="#0b63f6" />
        <path d="M20.2 2h8.2L20.6 24h-8.2z" fill="#0b63f6" />
      </svg>
      <span style={{ fontWeight: 800, fontSize: tamano * 0.92, letterSpacing: "-0.03em", color: "var(--text)" }}>
        Styler<span style={{ color: "var(--accent-text)" }}>Now</span>
      </span>
    </span>
  );
}
