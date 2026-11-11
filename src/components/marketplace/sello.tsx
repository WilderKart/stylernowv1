/** Sello giratorio de marca (patrón .sn-seal del prototipo). */
export function Sello({ className }: { className?: string }) {
  return (
    <div className={`sn-seal sn-seal--signal sn-seal--sm ${className ?? ""}`} role="img" aria-label="StylerNow">
      <svg className="sn-seal__ring" viewBox="0 0 112 112" aria-hidden="true">
        <defs>
          <path id="sello-home" d="M56,56 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0" />
        </defs>
        <text>
          <textPath href="#sello-home">STYLERNOW · BARBER CULTURE · </textPath>
        </text>
      </svg>
      <span className="sn-seal__s">
        S<i>.</i>
      </span>
    </div>
  );
}
