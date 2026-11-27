"use client";

import { ArrowRight, BarChart3, CalendarDays, Check, Scissors, Star, Store, TrendingUp, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { InsigniaEstatica } from "@/components/negocio/insignia-verificado";
import s from "./onboarding.module.css";

const NARANJA = "#ff6600";
const DESTINO_REGISTRO = "/registro?next=/panel/onboarding";
const TOTAL = 3;

/** Cada pantalla: textos, fondo (imagen «N») y modelo que va encima (imagen «N.1»). El orden es fijo. */
const SLIDES = [
  { a: "Lleva tu negocio", b: "al", c: "siguiente nivel", d: "Haz que más clientes te descubran, reserven y visiten tu negocio.", fondo: "/onboarding/fondo-1.webp", modelo: "/onboarding/barbero.webp", mw: 900, mh: 819 },
  { a: "Gestiona tu", b: "negocio", c: "fácilmente", d: "Agenda, servicios, equipo, clientes y pagos, todo en un solo lugar.", fondo: "/onboarding/fondo-2.webp", modelo: "/onboarding/equipo.webp", mw: 1100, mh: 733 },
  { a: "Más clientes,", b: "más", c: "crecimiento", d: "Sé parte del marketplace de bienestar y belleza que conecta negocios con miles de clientes.", fondo: "/onboarding/fondo-3.webp", modelo: "/onboarding/duena.webp", mw: 900, mh: 985 },
] as const;

/* Posición de cada modelo y de cada tarjeta en el celular (porcentajes sobre la pantalla, medidos de la maqueta). */
const MOVIL: Record<number, { modelo: CSSProperties; tarjeta: CSSProperties; extra?: CSSProperties }> = {
  0: { modelo: { left: "-9%", width: "119%", top: "31%" }, tarjeta: { left: "13%", right: "6%", top: "70%" }, extra: { right: "6%", top: "43.5%", width: "22%" } },
  1: { modelo: { left: "-2%", width: "104%", top: "34%" }, tarjeta: { left: "7%", right: "9%", top: "65.5%" } },
  2: { modelo: { left: "-9%", width: "100%", top: "34%" }, tarjeta: { left: "54%", right: "5%", top: "35%" }, extra: { left: "51%", right: "3%", top: "59%" } },
};
const SIN_FONDO_ABAJO: CSSProperties = { maskImage: "linear-gradient(to bottom, #000 80%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, #000 80%, transparent 100%)" };

const suscribirEscritorio = (cb: () => void) => {
  const mq = window.matchMedia("(min-width: 900px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
function useEscritorio() {
  return useSyncExternalStore(
    suscribirEscritorio,
    () => window.matchMedia("(min-width: 900px)").matches,
    () => false,
  );
}

/* ───────────── Piezas comunes ───────────── */
function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="StylerNow">
      <svg width={grande ? 38 : 30} height={grande ? 26 : 20} viewBox="0 0 30 20" aria-hidden>
        <path d="M9 0h5L5 20H0zM20 0h5l-9 20h-5z" fill={NARANJA} transform="translate(2 0)" />
      </svg>
      <span className={`${grande ? "text-[34px]" : "text-[26px]"} leading-none font-black tracking-[-0.06em] text-[#16181d] italic`}>
        STYLER<span style={{ color: NARANJA }}>NOW</span>
      </span>
    </div>
  );
}

function Titulo({ i, escritorio }: { i: number; escritorio: boolean }) {
  const sl = SLIDES[i];
  return (
    <h1
      className={`m-0 font-black text-[#16181d] italic ${s.titulo}`}
      style={{ fontSize: escritorio ? "clamp(38px, 3.9vw, 66px)" : "clamp(28px, 8.6vw, 40px)", lineHeight: 1.03 }}
    >
      {sl.a}
      <br />
      {sl.b} <span style={{ color: NARANJA }}>{sl.c}</span>
    </h1>
  );
}

function Descripcion({ i, escritorio }: { i: number; escritorio: boolean }) {
  return (
    <p className={`mb-0 text-[#23262d] ${escritorio ? "mt-5 max-w-[34rem] text-[21px] leading-snug" : "mt-3 max-w-[20rem] text-[16px] leading-snug"}`}>{SLIDES[i].d}</p>
  );
}

function IconoTienda({ style, className = "" }: { style?: CSSProperties; className?: string }) {
  return (
    <div style={style} className={`${s.flota} ${s.r22} absolute z-10 grid aspect-square place-items-center border-[3px] border-white bg-gradient-to-br from-[#ff8a2a] to-[#ff6600] text-white shadow-[0_10px_24px_rgba(255,102,0,0.45)] ${className}`}>
      <Store className="size-[52%]" strokeWidth={1.8} aria-hidden />
    </div>
  );
}

/* Tarjeta MAFIA (pantalla 1) */
function TarjetaNegocio() {
  return (
    <div className={`${s.sube} ${s.r16} overflow-hidden border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]`} style={{ animationDelay: "0.35s" }}>
      <div className="relative h-[74px] w-full min-[900px]:h-[150px]">
        <Image src="/img/facade.jpg" alt="" fill sizes="(min-width: 900px) 560px, 430px" className="object-cover" />
        <span className={`absolute top-2 right-2 ${s.r3} bg-white/90 px-2 py-0.5 font-mono text-[11px] font-bold text-[#16181d]`}>CALI</span>
      </div>
      <div className="flex items-center justify-between px-3.5 py-2 min-[900px]:px-5 min-[900px]:py-3">
        <div>
          <div className="flex items-center gap-1.5 text-[20px] leading-none font-black text-[#16181d] min-[900px]:text-[26px]">
            MAFIA
            <InsigniaEstatica etiqueta="Negocio verificado por StylerNow" className="!ml-0 !size-[22px]" />
          </div>
          <div className="mt-1 flex items-center gap-1 text-[13px] text-[#23262d]">
            <Star className="size-3.5 fill-[#ff6600] text-[#ff6600]" aria-hidden /> Nuevo
          </div>
        </div>
        <div className="text-right">
          <span className={`${s.latido} inline-block bg-[#39e86c] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#0b3d1c]`}>DISPONIBLE HOY</span>
          <div className="mt-1 text-[13px] text-[#23262d]">Desde $ 30.000 ↗</div>
        </div>
      </div>
    </div>
  );
}

/* Agenda de hoy (pantalla 2): cada 2 ticks entra una cita nueva («agendando…») y al siguiente se completa su check. El ciclo no termina. */
const CITAS = [
  { hora: "10:00", servicio: "Corte clásico" },
  { hora: "11:30", servicio: "Coloración" },
  { hora: "14:00", servicio: "Sesión de tattoo" },
  { hora: "15:30", servicio: "Barba y perfilado" },
  { hora: "17:00", servicio: "Manicure" },
];
const AVATARES = ["#c88b5a", "#8a5a44", "#b27a52"];

function Agenda() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((v) => v + 1), 1300);
    return () => window.clearInterval(id);
  }, []);
  const inicio = Math.floor(n / 2);
  const filas = [0, 1, 2].map((k) => {
    const abs = inicio + k;
    const ultima = k === 2;
    return { abs, cita: CITAS[abs % CITAS.length], ok: !ultima || n % 2 === 1, nueva: ultima };
  });
  return (
    <div className={`${s.sube} ${s.r16} overflow-hidden border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.2)]`} style={{ animationDelay: "0.3s" }}>
      <div className="flex">
        <div className="flex w-[64px] flex-none flex-col items-center gap-3 border-r border-black/5 py-3 min-[900px]:w-[78px] min-[900px]:gap-5 min-[900px]:py-5">
          <span className={`grid size-11 place-items-center ${s.r12} text-white`} style={{ background: NARANJA }}>
            <CalendarDays className="size-6" aria-hidden />
          </span>
          <Users className="size-6 text-[#23262d]" aria-hidden />
          <Scissors className="size-6 text-[#23262d]" aria-hidden />
          <BarChart3 className="size-6 text-[#23262d]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 p-3 min-[900px]:p-5">
          <div className="mb-2 flex items-center gap-2 text-[15px] font-bold text-[#16181d] min-[900px]:mb-3 min-[900px]:text-[18px]">
            <CalendarDays className="size-4" aria-hidden /> Agenda de hoy
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 min-[900px]:gap-3">
            {filas.map(({ abs, cita, ok, nueva }) => (
              <li key={abs} className={`${nueva ? s.filaEntra : ""} ${s.r12} flex items-center gap-2.5 bg-[#f3f4f6] px-2.5 py-1.5 min-[900px]:px-4 min-[900px]:py-2.5`}>
                <span className="size-7 flex-none rounded-full border-2 border-white" style={{ background: AVATARES[abs % 3] }} aria-hidden />
                <span className="text-[14px] font-bold text-[#16181d] tabular-nums min-[900px]:text-[16px]">{cita.hora}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-[#23262d] min-[900px]:text-[16px]">{cita.servicio}</span>
                <span className="relative grid size-6 flex-none place-items-center">
                  {!ok ? <span className={`${s.pendiente} absolute inset-0 rounded-full border-2 border-dashed border-[#9aa0a6]`} /> : null}
                  <span className={`${s.check} ${ok ? s.checkOk : ""} grid size-6 place-items-center rounded-full bg-[#22c55e]`}>
                    <Check className="size-4 text-white" strokeWidth={4} aria-hidden />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* Tarjeta de ingresos (pantalla 3): barras y cifra suben escalonadas, se mantienen, bajan y vuelven a subir. */
const ALTURAS = [18, 26, 34, 46, 60, 78, 100];
const META = 8430000;
const formatoCOP = (v: number) => "$ " + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function TarjetaCrecimiento() {
  const barras = useRef<(HTMLSpanElement | null)[]>([]);
  const cifra = useRef<HTMLSpanElement>(null);
  const pct = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // queda el estado final estático
    let raf = 0;
    const t0 = performance.now();
    const CICLO = 5600;
    const pinta = (now: number) => {
      const t = ((now - t0) % CICLO) / CICLO;
      const sube = Math.min(t / 0.62, 1);
      const baja = t < 0.82 ? 0 : (t - 0.82) / 0.18;
      const cuerpo = (1 - baja) * (1 - baja);
      barras.current.forEach((el, i) => {
        if (!el) return;
        const ini = i * 0.09;
        const p = Math.max(0, Math.min((sube - ini) / (1 - ini * 1.6), 1));
        const ease = 1 - Math.pow(1 - p, 3);
        el.style.transform = `scaleY(${Math.max(0.04, ease * cuerpo)})`;
      });
      const total = (1 - Math.pow(1 - sube, 3)) * cuerpo;
      if (cifra.current) cifra.current.textContent = formatoCOP(META * total);
      if (pct.current) pct.current.textContent = `+${Math.round(42 * total)}%`;
      raf = requestAnimationFrame(pinta);
    };
    raf = requestAnimationFrame(pinta);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`${s.sube} ${s.flotaLenta} ${s.r16} border border-black/5 bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)] min-[900px]:p-5`} style={{ animationDelay: "0.3s, 1s" }}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-[12px] text-[#23262d] min-[900px]:text-[15px]">Ingresos del mes</div>
          <div className="flex items-center gap-1.5">
            <span ref={cifra} className="text-[21px] leading-tight font-black whitespace-nowrap text-[#16181d] tabular-nums min-[900px]:text-[32px]">
              {formatoCOP(META)}
            </span>
            <TrendingUp className="size-5 text-[#22c55e]" strokeWidth={3} aria-hidden />
          </div>
          <span ref={pct} className="text-[13px] font-bold text-[#22c55e] tabular-nums min-[900px]:text-[16px]">+42%</span>
        </div>
        <div className="flex h-[58px] items-end gap-[5px] min-[900px]:h-[84px] min-[900px]:gap-[7px]" aria-hidden>
          {ALTURAS.map((h, i) => (
            <span
              key={i}
              ref={(el) => {
                barras.current[i] = el;
              }}
              className={`block w-[9px] origin-bottom min-[900px]:w-[13px] ${s.r3}`}
              style={{ height: `${h}%`, background: i < 3 ? "#ffa05a" : NARANJA }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Chips({ style, className = "" }: { style?: CSSProperties; className?: string }) {
  const chips = [
    { t: "Más reservas", i: CalendarDays },
    { t: "Más clientes", i: Users },
    { t: "Más ingresos", i: BarChart3 },
  ];
  return (
    <ul style={style} className={`absolute z-10 m-0 flex list-none flex-col gap-2 p-0 ${className}`}>
      {chips.map(({ t, i: Icono }, k) => (
        <li key={t} className={`${s.sube} flex items-center gap-2 rounded-full bg-white py-1 pr-3 pl-1 shadow-[0_6px_18px_rgba(0,0,0,0.16)]`} style={{ animationDelay: `${0.5 + k * 0.18}s` }}>
          <span className="grid size-9 flex-none place-items-center rounded-full text-white" style={{ background: NARANJA }}>
            <Icono className="size-5" aria-hidden />
          </span>
          <span className="text-[14px] font-bold text-[#16181d] min-[900px]:text-[17px]">{t}</span>
        </li>
      ))}
    </ul>
  );
}

function TarjetaDe({ i }: { i: number }) {
  return i === 0 ? <TarjetaNegocio /> : i === 1 ? <Agenda /> : <TarjetaCrecimiento />;
}

/* Controles: puntos, flecha y «Registrar mi negocio» */
function Puntos({ paso, ir }: { paso: number; ir: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2" role="tablist" aria-label="Pasos">
      {Array.from({ length: TOTAL }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === paso}
          aria-label={`Ir al paso ${i + 1}`}
          onClick={() => ir(i)}
          className="h-2 rounded-full transition-all duration-300"
          style={{ width: i === paso ? 28 : 14, background: i === paso ? NARANJA : "#c9ccd1" }}
        />
      ))}
    </div>
  );
}

function Flecha({ ir, paso, grande = false }: { ir: (n: number) => void; paso: number; grande?: boolean }) {
  return (
    <button
      type="button"
      aria-label="Siguiente"
      onClick={() => ir(paso + 1)}
      className={`${s.latido} grid place-items-center rounded-full border-4 border-white text-white shadow-[0_8px_20px_rgba(255,102,0,0.45)] transition-transform active:scale-95 ${grande ? "size-[76px]" : "size-[62px]"}`}
      style={{ background: `linear-gradient(135deg, #ff8a2a, ${NARANJA})` }}
    >
      <ArrowRight className={grande ? "size-9" : "size-7"} aria-hidden />
    </button>
  );
}

function BotonRegistro({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <Link
      href={DESTINO_REGISTRO}
      className={`flex items-center justify-center gap-2 rounded-full font-semibold text-white shadow-[0_10px_24px_rgba(255,102,0,0.5)] transition-transform active:scale-[0.98] ${className}`}
      style={{ background: `linear-gradient(135deg, #ff8a2a, ${NARANJA})`, ...style }}
    >
      Registrar mi negocio <ArrowRight className="size-6" aria-hidden />
    </Link>
  );
}

/* ───────────── Celular ───────────── */
function Movil({ paso, dir, ir }: { paso: number; dir: "der" | "izq"; ir: (n: number) => void }) {
  const sl = SLIDES[paso];
  const pos = MOVIL[paso];
  const ultima = paso === TOTAL - 1;
  return (
    <main className="relative h-dvh min-h-[600px] w-full overflow-hidden bg-white" style={{ touchAction: "pan-y" }}>
      <div key={paso} className={`${dir === "der" ? s.entraDer : s.entraIzq} absolute inset-0`}>
        <Image src={sl.fondo} alt="" fill priority sizes="100vw" className={`${s.fondoEntra} object-cover object-top`} />
        <div className="absolute inset-x-0 top-[11%] z-10 px-6">
          <Titulo i={paso} escritorio={false} />
          <Descripcion i={paso} escritorio={false} />
        </div>
        <Image
          src={sl.modelo}
          alt=""
          width={sl.mw}
          height={sl.mh}
          priority
          sizes="480px"
          className={`${s.persona} absolute h-auto max-w-none`}
          style={{ ...pos.modelo, ...SIN_FONDO_ABAJO }}
        />
        {paso === 0 ? <IconoTienda style={pos.extra} /> : null}
                {paso === 2 ? <Chips style={pos.extra} /> : null}
        <div className="absolute z-10" style={pos.tarjeta}>
          <TarjetaDe i={paso} />
        </div>
      </div>

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 pt-5">
        <Marca />
        <Link href="/login" className="text-[15px] font-medium text-[#23262d]">
          Omitir
        </Link>
      </header>

      <footer className="absolute inset-x-0 bottom-0 z-20 flex h-[76px] items-center justify-between px-6 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <Puntos paso={paso} ir={ir} />
        {ultima ? null : <Flecha ir={ir} paso={paso} />}
      </footer>
      {ultima ? <BotonRegistro className="absolute inset-x-6 bottom-[72px] z-30 h-[60px] text-[20px]" /> : null}
    </main>
  );
}

/* ───────────── PC / tablet horizontal: aprovecha todo el ancho ───────────── */
function Escritorio({ paso, dir, ir }: { paso: number; dir: "der" | "izq"; ir: (n: number) => void }) {
  const sl = SLIDES[paso];
  const ultima = paso === TOTAL - 1;
  return (
    <main className="relative grid h-dvh min-h-[640px] w-full grid-cols-[1.08fr_1fr] overflow-hidden bg-white">
      {/* Escenario: fondo + modelo */}
      <div key={paso} className={`${dir === "der" ? s.entraDer : s.entraIzq} relative overflow-hidden`}>
        <Image src={sl.fondo} alt="" fill priority sizes="55vw" className={`${s.fondoEntra} object-cover`} style={{ objectPosition: "60% 50%" }} />
        {paso === 0 ? (
          <>
            <Image src={sl.modelo} alt="" width={sl.mw} height={sl.mh} priority sizes="55vw" className={`${s.persona} absolute bottom-0 left-[6%] h-auto w-[88%] max-w-none`} />
            <IconoTienda className="top-[34%] right-[8%] w-[15%] min-w-[90px]" />
          </>
        ) : null}
        {paso === 1 ? <Image src={sl.modelo} alt="" width={sl.mw} height={sl.mh} priority sizes="55vw" className={`${s.persona} absolute bottom-[-2%] left-[-4%] h-auto w-[110%] max-w-none`} /> : null}
        {paso === 2 ? (
          <>
            <Image src={sl.modelo} alt="" width={sl.mw} height={sl.mh} priority sizes="55vw" className={`${s.persona} absolute bottom-0 left-[6%] h-[88%] w-auto max-w-none`} style={SIN_FONDO_ABAJO} />
            <Chips className="right-[5%] bottom-[14%] w-[40%]" />
          </>
        ) : null}
      </div>

      {/* Texto, tarjeta y controles */}
      <div className="relative flex flex-col justify-center px-[4.5vw] pt-24 pb-10">
        <div key={`t${paso}`} className={dir === "der" ? s.entraDer : s.entraIzq}>
          <Titulo i={paso} escritorio />
          <Descripcion i={paso} escritorio />
          <div className="mt-8 w-full max-w-[560px]">
            <TarjetaDe i={paso} />
          </div>
        </div>
        <div className="mt-10 flex max-w-[560px] items-center justify-between gap-6">
          <Puntos paso={paso} ir={ir} />
          {ultima ? <BotonRegistro className="h-[68px] flex-1 text-[22px]" /> : <Flecha ir={ir} paso={paso} grande />}
        </div>
      </div>

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-[3vw] pt-6">
        <Marca grande />
        <Link href="/login" className="rounded-full px-4 py-2 text-[17px] font-medium text-[#23262d] hover:bg-black/5">
          Omitir
        </Link>
      </header>
    </main>
  );
}

/* ───────────── Contenedor ───────────── */
export default function OnboardingPage() {
  const escritorio = useEscritorio();
  const [paso, setPaso] = useState(0);
  const [dir, setDir] = useState<"der" | "izq">("der");
  const inicioX = useRef<number | null>(null);

  const ir = useCallback((n: number) => {
    setPaso((p) => {
      const nuevo = Math.max(0, Math.min(TOTAL - 1, n));
      if (nuevo !== p) setDir(nuevo > p ? "der" : "izq");
      return nuevo;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") ir(paso + 1);
      if (e.key === "ArrowLeft") ir(paso - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paso, ir]);

  // Precarga de fondos y modelos para que el cambio de pantalla no parpadee
  useEffect(() => {
    SLIDES.forEach((x) => {
      [x.fondo, x.modelo].forEach((src) => {
        const img = new window.Image();
        img.src = src;
      });
    });
  }, []);

  return (
    <div
      className="min-h-dvh bg-white"
      onPointerDown={(e) => {
        inicioX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (inicioX.current === null) return;
        const dx = e.clientX - inicioX.current;
        inicioX.current = null;
        if (Math.abs(dx) > 60) ir(paso + (dx < 0 ? 1 : -1));
      }}
    >
      {escritorio ? <Escritorio paso={paso} dir={dir} ir={ir} /> : <Movil paso={paso} dir={dir} ir={ir} />}
    </div>
  );
}
