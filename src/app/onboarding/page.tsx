"use client";

import { ArrowRight, BarChart3, CalendarDays, Check, Scissors, Star, Store, TrendingUp, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import s from "./onboarding.module.css";

const NARANJA = "#ff6600";
const DESTINO_REGISTRO = "/registro?next=/panel/onboarding";
const TOTAL = 3;

function Marca() {
  return (
    <div className="flex items-center gap-1.5" aria-label="StylerNow">
      <svg width="30" height="20" viewBox="0 0 30 20" aria-hidden>
        <path d="M9 0h5L5 20H0zM20 0h5l-9 20h-5z" fill={NARANJA} transform="translate(2 0)" />
      </svg>
      <span className="text-[26px] leading-none font-black tracking-[-0.06em] text-[#16181d] italic">
        STYLER<span style={{ color: NARANJA }}>NOW</span>
      </span>
    </div>
  );
}

function Titulo({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <h1 className={`m-0 text-[38px] leading-[1.02] font-black text-[#16181d] italic sm:text-[42px] ${s.titulo}`}>
      {a}
      <br />
      {b} <span style={{ color: NARANJA }}>{c}</span>
    </h1>
  );
}

/* ───────────── Pantalla 1 ───────────── */
function Pantalla1() {
  return (
    <>
      <div className="relative z-10 px-6">
        <Titulo a="Lleva tu negocio" b="al" c="siguiente nivel" />
        <p className="mt-3 mb-0 max-w-[19rem] text-[16px] leading-snug text-[#23262d]">Haz que más clientes te descubran, reserven y visiten tu negocio.</p>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className={s.raya} />
        <div className={s.rayaFina} />
        <Image
          src="/onboarding/barbero.webp"
          alt=""
          width={900}
          height={819}
          priority
          sizes="(max-width: 480px) 100vw, 430px"
          className={`${s.persona} absolute right-[-12%] bottom-[150px] w-[104%] max-w-none`}
        />
        <div className={`${s.flota} absolute top-[26%] right-4 z-10 grid size-[76px] place-items-center ${s.r22} border-[3px] border-white bg-gradient-to-br from-[#ff8a2a] to-[#ff6600] text-white shadow-[0_10px_24px_rgba(255,102,0,0.45)]`}>
          <Store className="size-10" strokeWidth={1.8} aria-hidden />
        </div>
        {/* Tarjeta de un negocio verificado */}
        <div className={`${s.sube} absolute right-5 bottom-[84px] left-5 z-10 overflow-hidden ${s.r16} border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]`} style={{ animationDelay: "0.35s" }}>
          <div className="relative h-[74px] w-full">
            <Image src="/img/facade.jpg" alt="" fill sizes="430px" className="object-cover" />
            <span className="absolute top-2 right-2 ${s.r3} bg-white/90 px-2 py-0.5 font-mono text-[11px] font-bold text-[#16181d]">CALI</span>
          </div>
          <div className="flex items-center justify-between px-3.5 py-2">
            <div>
              <div className="flex items-center gap-1.5 text-[20px] leading-none font-black text-[#16181d]">
                MAFIA
                <span className="grid size-[18px] place-items-center rounded-full bg-[#1d9bf0]" aria-label="Negocio verificado">
                  <Check className="size-3 text-white" strokeWidth={4} aria-hidden />
                </span>
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
      </div>
    </>
  );
}

/* ───────────── Pantalla 2 ───────────── */
const CITAS = [
  { hora: "10:00", servicio: "Corte clásico" },
  { hora: "11:30", servicio: "Coloración" },
  { hora: "14:00", servicio: "Sesión de tattoo" },
  { hora: "15:30", servicio: "Barba y perfilado" },
  { hora: "17:00", servicio: "Manicure" },
];
const AVATARES = ["#c88b5a", "#8a5a44", "#b27a52"];

function Agenda() {
  // Cada 2 ticks entra una cita nueva: primero aparece «agendando…» y al siguiente tick se completa el check. Así el ciclo nunca termina.
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
    <div className="flex">
      <div className="flex w-[64px] flex-none flex-col items-center gap-3 border-r border-black/5 py-3">
        <span className="grid size-11 place-items-center ${s.r12} text-white" style={{ background: NARANJA }}>
          <CalendarDays className="size-6" aria-hidden />
        </span>
        <Users className="size-6 text-[#23262d]" aria-hidden />
        <Scissors className="size-6 text-[#23262d]" aria-hidden />
        <BarChart3 className="size-6 text-[#23262d]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 p-3">
        <div className="mb-2 flex items-center gap-2 text-[15px] font-bold text-[#16181d]">
          <CalendarDays className="size-4" aria-hidden /> Agenda de hoy
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {filas.map(({ abs, cita, ok, nueva }) => (
            <li key={abs} className={`${nueva ? s.filaEntra : ""} flex items-center gap-2.5 ${s.r12} bg-[#f3f4f6] px-2.5 py-1.5`}>
              <span className="size-7 flex-none rounded-full border-2 border-white" style={{ background: AVATARES[abs % 3] }} aria-hidden />
              <span className="text-[14px] font-bold text-[#16181d] tabular-nums">{cita.hora}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-[#23262d]">{cita.servicio}</span>
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
  );
}

function Pantalla2() {
  return (
    <>
      <div className="relative z-10 px-6">
        <Titulo a="Gestiona tu" b="negocio" c="fácilmente" />
        <p className="mt-3 mb-0 max-w-[20rem] text-[16px] leading-snug text-[#23262d]">Agenda, servicios, equipo, clientes y pagos, todo en un solo lugar.</p>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className={s.raya} />
        <div className={s.rayaFina} />
        <Image src="/onboarding/equipo.webp" alt="" width={1100} height={733} priority sizes="(max-width: 480px) 110vw, 470px" className={`${s.persona} absolute right-[-4%] bottom-[200px] w-[108%] max-w-none`} />
        <div className={`${s.sube} absolute right-4 bottom-[84px] left-4 z-10 overflow-hidden ${s.r16} border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.2)]`} style={{ animationDelay: "0.3s" }}>
          <Agenda />
        </div>
      </div>
    </>
  );
}

/* ───────────── Pantalla 3 ───────────── */
const ALTURAS = [18, 26, 34, 46, 60, 78, 100];
const META = 8430000;

function formatoCOP(v: number) {
  return "$ " + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function TarjetaCrecimiento() {
  const barras = useRef<(HTMLSpanElement | null)[]>([]);
  const cifra = useRef<HTMLSpanElement>(null);
  const pct = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // queda el estado final estático
    let raf = 0;
    const t0 = performance.now();
    const CICLO = 5600; // ms: sube → mantiene → baja → vuelve a subir
    const pinta = (now: number) => {
      const t = ((now - t0) % CICLO) / CICLO;
      // 0–0,62 sube escalonado · 0,62–0,82 mantiene · 0,82–1 se repliega
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
    <div className="flex items-end justify-between gap-2">
      <div>
        <div className="text-[12px] text-[#23262d]">Ingresos del mes</div>
        <div className="flex items-center gap-1.5">
          <span ref={cifra} className="text-[21px] leading-tight whitespace-nowrap font-black text-[#16181d] tabular-nums">{formatoCOP(META)}</span>
          <TrendingUp className="size-5 text-[#22c55e]" strokeWidth={3} aria-hidden />
        </div>
        <span ref={pct} className="text-[13px] font-bold text-[#22c55e] tabular-nums">+42%</span>
      </div>
      <div className="flex h-[58px] items-end gap-[5px]" aria-hidden>
        {ALTURAS.map((h, i) => (
          <span
            key={i}
            ref={(el) => {
              barras.current[i] = el;
            }}
            className="block w-[9px] origin-bottom ${s.r3}"
            style={{ height: `${h}%`, background: i < 3 ? "#ffa05a" : NARANJA }}
          />
        ))}
      </div>
    </div>
  );
}

function Pantalla3() {
  const chips = [
    { t: "Más reservas", i: CalendarDays },
    { t: "Más clientes", i: Users },
    { t: "Más ingresos", i: BarChart3 },
  ];
  return (
    <>
      <div className="relative z-10 px-6">
        <Titulo a="Más clientes," b="más" c="crecimiento" />
        <p className="mt-3 mb-0 max-w-[21rem] text-[16px] leading-snug text-[#23262d]">Sé parte del marketplace de bienestar y belleza que conecta negocios con miles de clientes.</p>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className={s.raya} />
        <div className={s.rayaFina} />
        <Image src="/onboarding/duena.webp" alt="" width={900} height={985} priority sizes="(max-width: 480px) 80vw, 340px" className={`${s.persona} absolute bottom-[132px] left-[-10%] w-[66%] max-w-none`} />
        <div className={`${s.sube} ${s.flotaLenta} absolute top-[4%] right-4 z-10 w-[68%] ${s.r16} border border-black/5 bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)]`} style={{ animationDelay: "0.3s, 1s" }}>
          <TarjetaCrecimiento />
        </div>
        <svg className={`${s.chispa} absolute top-[46%] right-[40%] z-10`} width="34" height="30" viewBox="0 0 34 30" aria-hidden>
          <path d="M4 22l8-4M10 8l8 6M22 2l-2 10" stroke={NARANJA} strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
        <ul className="absolute right-3 bottom-[138px] z-10 m-0 flex w-[52%] list-none flex-col gap-2 p-0">
          {chips.map(({ t, i: Icono }, k) => (
            <li key={t} className={`${s.sube} flex items-center gap-2 rounded-full bg-white py-1 pr-3 pl-1 shadow-[0_6px_18px_rgba(0,0,0,0.16)]`} style={{ animationDelay: `${0.5 + k * 0.18}s` }}>
              <span className="grid size-9 flex-none place-items-center rounded-full text-white" style={{ background: NARANJA }}>
                <Icono className="size-5" aria-hidden />
              </span>
              <span className="text-[14px] font-bold text-[#16181d]">{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/* ───────────── Contenedor ───────────── */
export default function OnboardingPage() {
  const [paso, setPaso] = useState(0);
  const [dir, setDir] = useState<"der" | "izq">("der");
  const inicioX = useRef<number | null>(null);
  const ultima = paso === TOTAL - 1;

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

  return (
    <div className="min-h-dvh bg-[#eef0f3]">
      <main
        className="relative mx-auto flex h-dvh max-h-[920px] min-h-[640px] w-full max-w-[430px] flex-col overflow-hidden bg-white sm:my-4 sm:h-[calc(100dvh-2rem)] ${s.r40} sm:shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        onPointerDown={(e) => {
          inicioX.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (inicioX.current === null) return;
          const dx = e.clientX - inicioX.current;
          inicioX.current = null;
          if (Math.abs(dx) > 60) ir(paso + (dx < 0 ? 1 : -1));
        }}
        style={{ touchAction: "pan-y" }}
      >
        <header className="relative z-20 flex items-center justify-between px-6 pt-5 pb-4">
          <Marca />
          <Link href="/login" className="text-[15px] font-medium text-[#23262d]">
            Omitir
          </Link>
        </header>

        <div key={paso} className={`${dir === "der" ? s.entraDer : s.entraIzq} flex min-h-0 flex-1 flex-col`}>
          {paso === 0 ? <Pantalla1 /> : paso === 1 ? <Pantalla2 /> : <Pantalla3 />}
        </div>

        {/* Pie: puntos + acción */}
        <footer className="absolute right-0 bottom-0 left-0 z-20 flex h-[76px] items-center justify-between px-6 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
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
          {ultima ? null : (
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => ir(paso + 1)}
              className={`${s.latido} grid size-[62px] place-items-center rounded-full border-4 border-white text-white shadow-[0_8px_20px_rgba(255,102,0,0.45)] transition-transform active:scale-95`}
              style={{ background: `linear-gradient(135deg, #ff8a2a, ${NARANJA})` }}
            >
              <ArrowRight className="size-7" aria-hidden />
            </button>
          )}
        </footer>

        {ultima ? (
          <Link
            href={DESTINO_REGISTRO}
            className="absolute right-6 bottom-[64px] left-6 z-30 flex h-[60px] items-center justify-center gap-2 rounded-full text-[20px] font-semibold text-white shadow-[0_10px_24px_rgba(255,102,0,0.5)] transition-transform active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, #ff8a2a, ${NARANJA})` }}
          >
            Registrar mi negocio <ArrowRight className="size-6" aria-hidden />
          </Link>
        ) : null}
      </main>
    </div>
  );
}
