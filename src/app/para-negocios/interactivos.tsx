"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import s from "./para-negocios.module.css";

/**
 * Selector de país y moneda. Solo cambia `?pais=` en la URL: los precios los vuelve a calcular el
 * servidor desde la configuración real (nunca se toman del navegador). Sin JavaScript, el botón
 * «Ver» del <noscript> envía el mismo formulario GET.
 */
export function SelectorPais({ paises, actual }: { paises: { codigo: string; nombre: string; moneda: string }[]; actual: string }) {
  const router = useRouter();
  return (
    <form action="/para-negocios#planes" method="get" className={s.pais}>
      <label htmlFor="pais-negocio">País:</label>
      <div className={s.paisSelect}>
        <select
          id="pais-negocio"
          name="pais"
          defaultValue={actual}
          onChange={(e) => router.replace(`/para-negocios?pais=${encodeURIComponent(e.target.value)}#planes`, { scroll: false })}
        >
          {paises.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.nombre} · {p.moneda}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden />
      </div>
      <noscript>
        <button type="submit">Ver</button>
      </noscript>
    </form>
  );
}

/**
 * Planes: carrusel con imán en móvil y grilla en escritorio.
 *  · El plan SELECCIONADO lleva el borde naranja y se ve un poco más grande. Se selecciona tocándolo
 *    (o al entrar con el teclado); en el carrusel del celular, el que queda centrado al deslizar.
 *  · Cerradas, todas las tarjetas miden lo mismo (la más alta manda); al abrir «Ver todo lo que
 *    incluye» solo esa tarjeta crece lo que necesite.
 */
export function CarruselPlanes({ children, nombres }: { children: React.ReactNode; nombres: string[] }) {
  const pista = React.useRef<HTMLDivElement>(null);
  const [sel, setSel] = React.useState(0);
  const tarjetas = React.Children.toArray(children);

  // Altura común de las tarjetas CERRADAS (sin contar el contenido de «Ver todo» abierto).
  React.useEffect(() => {
    const el = pista.current;
    if (!el) return;
    const medir = () => {
      el.style.setProperty("--alto-plan", "auto");
      let max = 0;
      for (const r of Array.from(el.children) as HTMLElement[]) {
        const tarjeta = r.firstElementChild as HTMLElement | null;
        if (!tarjeta) continue;
        const abierto = tarjeta.querySelector("details[open] > ul") as HTMLElement | null;
        max = Math.max(max, tarjeta.offsetHeight - (abierto ? abierto.offsetHeight : 0));
      }
      if (max > 0) el.style.setProperty("--alto-plan", `${Math.ceil(max)}px`);
    };
    medir();
    const ro = new ResizeObserver(() => medir());
    ro.observe(el);
    document.fonts?.ready.then(medir).catch(() => {});
    return () => ro.disconnect();
  }, [nombres.length]);

  // En el carrusel del celular, la tarjeta centrada al deslizar queda seleccionada.
  React.useEffect(() => {
    const el = pista.current;
    if (!el) return;
    const ranuras = Array.from(el.children) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entradas) => {
        if (window.matchMedia("(min-width: 768px)").matches) return; // grilla (tableta/escritorio): solo clic
        for (const e of entradas) if (e.isIntersecting) setSel(ranuras.indexOf(e.target as HTMLElement));
      },
      { root: el, threshold: 0.75 }
    );
    ranuras.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, [nombres.length]);

  function ir(i: number) {
    setSel(i);
    const t = pista.current?.children[i] as HTMLElement | undefined;
    const el = pista.current;
    if (t && el && !window.matchMedia("(min-width: 768px)").matches) {
      el.scrollTo({ left: t.offsetLeft - (el.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });
    }
  }

  return (
    <>
      <div ref={pista} className={s.carrusel}>
        {tarjetas.map((t, i) => (
          <div
            key={nombres[i] ?? i}
            className={s.ranura}
            data-seleccionado={i === sel ? "true" : undefined}
            onClick={(e) => {
              // Tocar la tarjeta la selecciona; los enlaces y «Ver todo» siguen funcionando igual.
              if (!(e.target as Element).closest("a")) ir(i);
            }}
            onFocusCapture={() => setSel(i)}
          >
            {t}
          </div>
        ))}
      </div>
      <div className={s.puntos} role="group" aria-label="Planes">
        {nombres.map((n, i) => (
          <button key={n} type="button" aria-label={`Ver plan ${n}`} aria-current={i === sel ? "true" : undefined} onClick={() => ir(i)} />
        ))}
      </div>
    </>
  );
}

/**
 * Menú móvil (un <details> nativo: funciona y es accesible sin JavaScript). Con JavaScript, además
 * se cierra al elegir un enlace, al pulsar Escape o al tocar fuera.
 */
export function MenuMovil({ className, children, etiqueta, iconoAbrir, iconoCerrar, claseAbrir, claseCerrar }: {
  className: string;
  children: React.ReactNode;
  etiqueta: string;
  iconoAbrir: React.ReactNode;
  iconoCerrar: React.ReactNode;
  claseAbrir: string;
  claseCerrar: string;
}) {
  const ref = React.useRef<HTMLDetailsElement>(null);
  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const cerrar = () => d.removeAttribute("open");
    const alClic = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!d.contains(t) || (t instanceof Element && t.closest("a"))) cerrar();
    };
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && d.open) {
        cerrar();
        d.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", alClic);
    document.addEventListener("keydown", alTecla);
    return () => {
      document.removeEventListener("click", alClic);
      document.removeEventListener("keydown", alTecla);
    };
  }, []);
  return (
    <details ref={ref} className={className}>
      <summary aria-label={etiqueta}>
        <span className={claseAbrir}>{iconoAbrir}</span>
        <span className={claseCerrar}>{iconoCerrar}</span>
      </summary>
      {children}
    </details>
  );
}
