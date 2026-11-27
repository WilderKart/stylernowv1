import { obtenerCatalogoPais, listarPaisesActivos, type PaisPlanes, type PlanPais } from "@/lib/planes/catalogo";
import { caracteristicasComerciales, llamadoAccion } from "@/lib/planes/etiquetas";
import { formatearMoneda } from "@/lib/planes/moneda";
import { calcularPrecio } from "@/lib/planes/precios";
import { createClient } from "@/lib/supabase/server";
import { ArrowUpRight, CalendarDays, Check, ChartColumnIncreasing, ChevronDown, MapPin, Menu, Package, Tag, Users, X, Zap } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CarruselPlanes, MenuMovil, SelectorPais } from "./interactivos";
import s from "./para-negocios.module.css";

/**
 * PARA NEGOCIOS (referencia visual 2026-11-16). Precios, descuentos, cupos y características salen
 * SOLO de la configuración real de planes (obtenerCatalogoPais / plan_caracteristica); aquí no hay
 * ningún precio ni característica escrita a mano. Las seis funcionalidades destacadas existen en el
 * panel (agenda, staff, pos/caja, crm, inventario, reportes); su alcance depende del plan.
 */
const T = {
  seo: {
    titulo: "StylerNow para negocios: agenda, equipo, caja y clientes para barberías, salones, spas y tattoo",
    descripcion:
      "Gestiona tu negocio de principio a fin: citas, equipo y turnos, caja diaria, clientes, inventario y reportes. Para barberías, salones, spas y estudios de tatuaje. Prueba 14 días.",
  },
  heroTitulo: ["Tu agenda", "llena.", "Tu equipo"],
  heroNaranja: "en orden.",
  heroTexto: "Gestiona tu negocio de principio a fin: citas, equipo, caja, clientes y crecimiento.",
  probar: "Probar 14 días",
  planes: "Planes y precios",
  funciones: [
    { t: "Agenda\nreal", d: "Reservas y disponibilidad al minuto.", icono: CalendarDays },
    { t: "Equipo\ny turnos", d: "Profesionales, horarios y turnos.", icono: Users },
    { t: "Caja\ndiaria", d: "Ventas, ingresos y cierre de caja.", icono: IconoCaja },
    { t: "Clientes\n(CRM)", d: "Historial y seguimiento de cada cliente.", icono: Users },
    { t: "Inventario\ny productos", d: "Existencias y venta de productos.", icono: Package },
    { t: "Reportes\ny crecimiento", d: "Cifras del negocio y resultados.", icono: IconoReportes },
  ],
  porQue: "¿Por qué StylerNow?",
  ventajas: [
    { t: "Te encuentran", d: "Tu negocio aparece en el mapa, atrae más clientes y recibe reservas 24/7.", icono: MapPin },
    { t: "Menos plantones", d: "Recordatorios automáticos y, si lo activas, reserva segura con anticipo: el cliente confirma su compromiso y llega.", icono: CalendarDays },
    { t: "Todo en orden", d: "Agenda, caja diaria, clientes e inventario en un solo panel. Sin cuadernos, chats sueltos ni hojas de cálculo.", icono: Package },
    { t: "Crece a tu ritmo", d: "Empieza con un profesional y una sede. Cuando crezcas, suma equipo, sedes y funciones cambiando de plan.", icono: ChartColumnIncreasing },
  ],
  valor: ["Todo lo que necesitas para", "operar, atender y hacer crecer", "tu negocio en un solo lugar."],
  planesSub: "Elige el plan que se adapta a tu negocio.",
  fundador: (pct: number, meses: number) => `Prueba ahora y accede al plan fundador: −${pct}% por ${meses} ${meses === 1 ? "mes" : "meses"}`,
  fundadorCupos: (n: number, total: number) => `Quedan ${n} de ${total} cupos`,
  fundadorPrecio: (precio: string, meses: number) => `Plan fundador: ${precio}/mes por ${meses} ${meses === 1 ? "mes" : "meses"}`,
  fundadorAgotado: "Cupos fundador agotados en este país.",
  mes: "/mes",
  iva: " + IVA",
  desde: "desde ",
  aCotizar: "A cotizar",
  ventas: "Hablar con ventas",
  verTodo: (n: number) => `Ver todo lo que incluye (+${n})`,
  verMenos: "Ver menos",
  sinPlanes: "Los planes de este país estarán disponibles pronto. Escríbenos y te avisamos.",
  pruebaNota: "Prueba gratis de 14 días sin tarjeta: no se cobra nada automáticamente. Al terminar pagas tu plan si quieres seguir. Los precios los define cada país.",
  faqTitulo: "Preguntas frecuentes",
  faq: [
    { q: "¿Cuánto dura la prueba?", a: "Tienes **14 días gratis** con todas las funciones del plan que elijas. Sin tarjeta y sin compromiso." },
    { q: "¿Mis clientes pagan por usar la app?", a: "No. Buscar y reservar en StylerNow es gratis para tus clientes." },
    { q: "¿Qué es el cupo fundador?", a: "Un descuento para los primeros negocios de cada país. En el plan mensual dura los primeros 3 meses; en el anual se aplica una sola vez, solo al primer mes, y luego se cobra el precio normal. Los cupos que quedan se muestran arriba, en Planes y precios. Los «2 meses gratis» del plan anual son una promoción de lanzamiento y pueden cambiar sin previo aviso." },
    { q: "¿Puedo cambiar de plan?", a: "Sí. Puedes subir de plan cuando quieras y bajar al inicio del siguiente ciclo." },
    { q: "¿Cómo se pagan las reservas?", a: "Si conectas tu cuenta de Mercado Pago y activas el anticipo, tu cliente lo paga en línea al reservar y el dinero llega directo a tu cuenta. El resto del servicio lo cobras en tu local y lo registras en la caja." },
    { q: "¿Qué puedo gestionar desde el panel?", a: "Agenda y reservas, equipo y turnos, caja diaria, clientes (CRM), inventario y reportes. El alcance de cada función depende del plan: lo ves en «Ver todo lo que incluye» de cada tarjeta." },
    { q: "Tengo una cadena o franquicia", a: "El plan Signature se cotiza con nuestro equipo de ventas." },
  ],
  cierre: ["Empieza", "hoy"],
  cierreTexto: "Activa tu negocio, centraliza tu operación y ofrece una mejor experiencia a tus clientes.",
  legales: [
    { href: "/legal/terminos", t: "Términos y condiciones" },
    { href: "/legal/politica-de-datos", t: "Política de datos" },
  ],
};

const VISIBLES = 8;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: T.seo.titulo,
    description: T.seo.descripcion,
    alternates: { canonical: "/para-negocios" },
    // Una página que define su propio openGraph REEMPLAZA el del layout (no se mezclan): hay que repetir la imagen.
    openGraph: { title: T.seo.titulo, description: T.seo.descripcion, type: "website", images: [{ url: "/og-stylernow.png", width: 1200, height: 630, alt: "StylerNow" }] },
    twitter: { card: "summary_large_image", title: T.seo.titulo, description: T.seo.descripcion, images: ["/og-stylernow.png"] },
  };
}

function IconoCaja(props: { "aria-hidden"?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="9" y="5" width="16" height="8" rx="1.5" />
      <path d="M13 9h8M17 13v4" />
      <path d="M6 17h28l2 14H4z" />
      <path d="M4 31h32v4H4z" />
      <path d="M12 22h2M18 22h2M24 22h2M12 26h2M18 26h2M24 26h2" />
    </svg>
  );
}

function IconoReportes(props: { "aria-hidden"?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" fill="currentColor" {...props}>
      <rect x="6" y="24" width="7" height="10" />
      <rect x="16" y="17" width="7" height="17" />
      <rect x="26" y="7" width="7" height="27" />
      <rect x="3" y="35" width="34" height="2.6" />
    </svg>
  );
}

/** «**negrita**» simple para los textos fijos de esta página (no hay contenido del usuario). */
function ConNegrita({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("**").map((parte, i) => (i % 2 === 1 ? <b key={i}>{parte}</b> : <span key={i}>{parte}</span>))}
    </>
  );
}

function TarjetaPlan({ plan, pais, hayCupos, urlPrueba }: { plan: PlanPais; pais: PaisPlanes; hayCupos: boolean; urlPrueba: string }) {
  const ventas = llamadoAccion(plan) === "ventas" || plan.precioMensual === null;
  // Precio NORMAL (lo que paga cualquier negocio) y, aparte, el precio fundador: solo para los primeros
  // negocios de cada país mientras queden cupos, y solo durante los meses configurados.
  const precio =
    plan.precioMensual !== null
      ? calcularPrecio({ precioMensual: plan.precioMensual, ciclo: "MENSUAL", mesesPagadosAnual: pais.mesesPagadosAnual, descuentoFundadorPct: 0 })
      : null;
  const conFundador = hayCupos && plan.codigo !== "SIGNATURE" && plan.precioMensual !== null && pais.fundadorDescuentoPct > 0;
  const precioFundador = conFundador
    ? calcularPrecio({ precioMensual: plan.precioMensual!, ciclo: "MENSUAL", mesesPagadosAnual: pais.mesesPagadosAnual, descuentoFundadorPct: pais.fundadorDescuentoPct })
    : null;
  const lineas = caracteristicasComerciales(plan);
  const visibles = lineas.slice(0, VISIBLES);
  const resto = lineas.slice(VISIBLES);
  const limites = [
    plan.staffIncluido != null ? `${plan.staffIncluido} ${plan.staffIncluido === 1 ? "profesional" : "profesionales"}` : null,
    plan.limiteSedes != null ? `${plan.limiteSedes} ${plan.limiteSedes === 1 ? "sede" : "sedes"}` : null,
  ].filter(Boolean);

  return (
    <article className={s.plan} aria-labelledby={`plan-${plan.codigo}`}>
      <div className={s.planCabeza}>
        <h3 id={`plan-${plan.codigo}`} className={`${s.condensada} ${s.planNombre}`}>
          {plan.nombre}
        </h3>
        <div className={s.planPrecio}>
          {precio ? (
            <>
              <strong>
                {plan.esDesde ? T.desde : ""}
                {formatearMoneda(precio.final, pais.moneda, pais.locale)}
              </strong>
              <span>
                {T.mes}
                {pais.precioMasImpuesto ? T.iva : ""}
              </span>
            </>
          ) : (
            <strong>{T.aCotizar}</strong>
          )}
        </div>
      </div>
      {precioFundador ? (
        <p className={s.planFundador}>{T.fundadorPrecio(formatearMoneda(precioFundador.final, pais.moneda, pais.locale), pais.fundadorMeses)}</p>
      ) : null}
      {limites.length > 0 ? <p className={s.planLimites}>{limites.join(" · ")}</p> : null}
      <ul className={s.planLista}>
        {visibles.map((l) => (
          <li key={l}>
            <Check aria-hidden />
            {l}
          </li>
        ))}
      </ul>
      {resto.length > 0 ? (
        <details className={s.verTodo}>
          <summary>
            <span className={s.mostrar}>{T.verTodo(resto.length)}</span>
            <span className={s.ocultar}>{T.verMenos}</span>
            <ChevronDown aria-hidden />
          </summary>
          <ul className={s.planLista}>
            {resto.map((l) => (
              <li key={l}>
                <Check aria-hidden />
                {l}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className={s.planBoton}>
        <Link href={ventas ? "/login?next=/panel/soporte" : urlPrueba} className={`${s.btn} ${s.btnNegro}`}>
          <span>{ventas ? T.ventas : T.probar}</span>
          <ArrowUpRight aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export default async function ParaNegociosPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const paisParam = typeof sp.pais === "string" ? sp.pais.toUpperCase() : "CO";

  const [paises, supabase] = await Promise.all([listarPaisesActivos(), createClient()]);
  const codigosValidos = paises.map((p) => p.codigo);
  const paisCodigo = codigosValidos.includes(paisParam) ? paisParam : codigosValidos.includes("CO") ? "CO" : (codigosValidos[0] ?? "CO");

  const [catalogo, { data: auth }] = await Promise.all([obtenerCatalogoPais(paisCodigo), supabase.auth.getUser()]);
  // Siempre al registro de NEGOCIO (nunca al de clientes): con sesión, directo al onboarding.
  const urlPrueba = auth.user ? "/panel/onboarding" : "/registro?next=/panel/onboarding";
  const hayCupos = (catalogo?.pais.cuposFundadorRestantes ?? 0) > 0;

  return (
    <div className={s.pagina}>
      <header className={s.encabezado}>
        <div className={s.ancho}>
          <Link href="/para-negocios" className={s.logo} aria-label="StylerNow para negocios">
            <b aria-hidden>
              Styler<span className={s.naranja}>Now</span>
            </b>
            <span aria-hidden>Para negocios</span>
          </Link>
          <nav className={s.navAncha} aria-label="Secciones">
            <a href="#funciones">Funciones</a>
            <a href="#por-que">Por qué</a>
            <a href="#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
            <Link href={auth.user ? "/panel" : "/login?next=/panel"}>Ingresar</Link>
            <Link href={urlPrueba} className={`${s.btn} ${s.btnNaranja} ${s.btnChico}`}>
              {T.probar}
            </Link>
          </nav>
          <MenuMovil className={s.menu} etiqueta="Menú" iconoAbrir={<Menu aria-hidden />} iconoCerrar={<X aria-hidden />} claseAbrir={s.abrir} claseCerrar={s.cerrar}>
            <nav className={s.menuPanel} aria-label="Menú">
              <a href="#funciones">Funciones</a>
              <a href="#por-que">Por qué StylerNow</a>
              <a href="#planes">Planes y precios</a>
              <a href="#preguntas">Preguntas frecuentes</a>
              <Link href={auth.user ? "/panel" : "/login?next=/panel"}>Ingresar</Link>
              <Link href={urlPrueba}>{T.probar} ↗</Link>
            </nav>
          </MenuMovil>
        </div>
      </header>

      <main>
        {/* ── Héroe ── */}
        <section className={s.heroe}>
          <div className={s.heroeFoto} aria-hidden>
            <Image src="/img/negocios/silla-barberia.webp" alt="" width={1199} height={1312} priority sizes="(max-width: 767px) 80vw, 50vw" />
          </div>
          <div className={s.ancho}>
            <div className={s.heroeTexto}>
              <h1 className={`${s.condensada} ${s.heroeTitulo}`}>
                {T.heroTitulo.map((l) => (
                  <span key={l}>{l}</span>
                ))}
                <span className={s.naranja}>{T.heroNaranja}</span>
              </h1>
              <p className={s.heroeBajada}>{T.heroTexto}</p>
              <div className={s.heroeBotones}>
                <Link href={urlPrueba} className={`${s.btn} ${s.btnNaranja}`}>
                  <span>{T.probar}</span>
                  <ArrowUpRight aria-hidden />
                </Link>
                <a href="#planes" className={`${s.btn} ${s.btnBlanco}`}>
                  {T.planes}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Funcionalidades ── */}
        <section id="funciones" className={`${s.ancho} ${s.anclaje}`} aria-label="Funcionalidades">
          <ul className={s.funciones}>
            {T.funciones.map(({ t, d, icono: Icono }) => (
              <li key={t} className={s.funcion}>
                <Icono aria-hidden />
                <b>{t}</b>
                <small>{d}</small>
              </li>
            ))}
          </ul>
        </section>

        {/* ── ¿Por qué StylerNow? + bloque de valor ── */}
        <section id="por-que" className={`${s.ancho} ${s.seccion}`}>
          <h2 className={s.tituloSeccion}>{T.porQue}</h2>
          <div className={s.porQue}>
            <div className={s.acordeones}>
              {T.ventajas.map(({ t, d, icono: Icono }, i) => (
                <details key={t} name="por-que" className={s.item} open={i === 0}>
                  <summary>
                    <span className={s.itemNumero}>{String(i + 1).padStart(2, "0")}</span>
                    <span className={s.itemTitulo}>{t}</span>
                    <span className={s.signo} aria-hidden />
                  </summary>
                  <div className={s.itemCuerpo}>
                    <Icono aria-hidden />
                    <p>{d}</p>
                  </div>
                </details>
              ))}
            </div>
            <div className={s.valor}>
              <Zap aria-hidden />
              <p>
                {T.valor[0]}
                <br />
                {T.valor[1]}
                <br />
                {T.valor[2]}
              </p>
            </div>
          </div>
        </section>

        {/* ── Planes y precios ── */}
        <section id="planes" className={`${s.ancho} ${s.seccion}`}>
          <h2 className={s.tituloSeccion}>{T.planes}</h2>
          <p className={s.subtitulo}>{T.planesSub}</p>
          <SelectorPais paises={paises} actual={paisCodigo} />
          {catalogo && catalogo.planes.length > 0 ? (
            <>
              {hayCupos ? (
                <p className={s.fundador}>
                  <Tag aria-hidden />
                  <span>
                    {T.fundador(catalogo.pais.fundadorDescuentoPct, catalogo.pais.fundadorMeses)}
                    <br />
                    {T.fundadorCupos(catalogo.pais.cuposFundadorRestantes, catalogo.pais.fundadorCupos)}
                  </span>
                </p>
              ) : (
                <p className={`sn-meta ${s.fundadorAgotado}`}>{T.fundadorAgotado}</p>
              )}
              <CarruselPlanes nombres={catalogo.planes.map((p) => p.nombre)}>
                {catalogo.planes.map((p) => (
                  <TarjetaPlan key={p.codigo} plan={p} pais={catalogo.pais} hayCupos={hayCupos} urlPrueba={urlPrueba} />
                ))}
              </CarruselPlanes>
              <p className={s.nota}>{T.pruebaNota}</p>
            </>
          ) : (
            <p className={s.subtitulo}>{T.sinPlanes}</p>
          )}
        </section>

        {/* ── Preguntas frecuentes ── */}
        <section id="preguntas" className={`${s.ancho} ${s.seccion}`}>
          <h2 className={s.tituloSeccion}>{T.faqTitulo}</h2>
          <div className={`${s.acordeones} ${s.faq}`}>
            {T.faq.map((f, i) => (
              <details key={f.q} name="faq" className={s.item} open={i === 0}>
                <summary>
                  <span className={s.faqPregunta}>{f.q}</span>
                  <span className={s.signo} aria-hidden />
                </summary>
                <p className={s.faqRespuesta}>
                  <ConNegrita texto={f.a} />
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Cierre ── */}
        <section className={s.cierre}>
          <svg className={s.cierreRaya} viewBox="0 0 140 400" preserveAspectRatio="none" aria-hidden>
            <polygon points="118,120 140,120 140,150 48,400 26,400" />
          </svg>
          <div className={s.ancho}>
            <h2 className={`${s.condensada} ${s.cierreTitulo}`}>
              {T.cierre[0]} <span className={s.naranja}>{T.cierre[1]}</span>
            </h2>
            <p>{T.cierreTexto}</p>
            <Link href={urlPrueba} className={`${s.btn} ${s.btnNegro}`}>
              <span>{T.probar}</span>
              <ArrowUpRight aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className={s.pie}>
        <div className={`${s.ancho} ${s.pieEnlaces}`}>
          {T.legales.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.t}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
