import { Marquee, Panel, Poster, Status } from "@/components/brutal";
import { buttonVariants } from "@/components/ui/button";
import { obtenerCatalogoPais, listarPaisesActivos, type PlanPais } from "@/lib/planes/catalogo";
import { lineasIncluye, llamadoAccion } from "@/lib/planes/etiquetas";
import { formatearMoneda } from "@/lib/planes/moneda";
import { calcularPrecio } from "@/lib/planes/precios";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

// Textos centralizados (español neutro) para facilitar la traducción a inglés.
const T = {
  seo: {
    titulo: "StylerNow para negocios: agenda, reservas y clientes para barberías y salones",
    descripcion:
      "Llena tu agenda con reservas reales. Perfil en el mapa, recordatorios, caja y CRM para barberías, peluquerías, uñas y estética. Prueba 14 días.",
  },
  marca: "StylerNow para negocios",
  heroTitulo: "Tu agenda llena. Tu equipo en orden.",
  heroTexto:
    "Reservas con agenda real, recordatorios, caja y clientes en un solo lugar, hecho para barberías, peluquerías, uñas y estética. Reservar es gratis para tus clientes.",
  probar: "Probar 14 días",
  ventas: "Hablar con ventas",
  marquesina: "Menos llamadas ✶ Más citas ✶ Tu agenda siempre llena ✶ Cobra el anticipo online ✶ Recordatorios automáticos ✶ Clientes que vuelven",
  valorTitulo: "Por qué StylerNow",
  valores: [
    { t: "Te encuentran", d: "Tu perfil aparece en el mapa y recibe reservas de clientes cerca de ti." },
    { t: "Menos plantones", d: "Recordatorios y reserva segura con anticipo para que el cliente sí llegue." },
    { t: "Todo en orden", d: "Agenda, caja, clientes y comisiones del equipo sin hojas de cálculo." },
    { t: "Crece a tu ritmo", d: "Empieza con un profesional y suma sedes y equipo cuando lo necesites." },
  ],
  planesTitulo: "Planes y precios",
  pais: "País",
  fundadorQuedan: (n: number, pct: number, meses: number) => `Fundador −${pct}% durante ${meses} meses · quedan ${n} cupos`,
  fundadorAgotado: "Cupos fundador agotados en este país",
  mensual: "/mes",
  iva: " + IVA",
  desde: "desde ",
  aCotizar: "A cotizar",
  sinPlanes: "Los planes de este país estarán disponibles pronto. Escríbenos y te avisamos.",
  incluye: "Qué incluye",
  pruebaNota: "Prueba de 14 días con método de pago; el cobro es automático al terminar. Los precios los define cada país.",
  faqTitulo: "Preguntas frecuentes",
  faq: [
    { q: "¿Cuánto dura la prueba?", a: "14 días. Registras un método de pago y el cobro se hace solo al terminar la prueba; puedes cancelar antes." },
    { q: "¿Mis clientes pagan por usar la app?", a: "No. Reservar es gratis para tus clientes." },
    { q: "¿Qué es el cupo fundador?", a: "Un descuento para los primeros negocios de cada país, en planes mensuales, durante un periodo limitado." },
    { q: "¿Puedo cambiar de plan?", a: "Sí. Puedes subir de plan cuando quieras y bajar al inicio del siguiente ciclo." },
    { q: "Tengo una cadena o franquicia", a: "El plan Allfather se cotiza con nuestro equipo de ventas." },
  ],
  cierreTitulo: "Empieza hoy",
  legales: [
    { href: "/legal/terminos", t: "Términos y condiciones" },
    { href: "/legal/politica-de-datos", t: "Política de datos" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: T.seo.titulo,
    description: T.seo.descripcion,
    alternates: { canonical: "/para-negocios" },
    openGraph: { title: T.seo.titulo, description: T.seo.descripcion, type: "website" },
  };
}

function PlanCard({ plan, catalogoPais, hayCupos, urlPrueba }: { plan: PlanPais; catalogoPais: NonNullable<Awaited<ReturnType<typeof obtenerCatalogoPais>>>["pais"]; hayCupos: boolean; urlPrueba: string }) {
  const ventas = llamadoAccion(plan) === "ventas" || plan.precioMensual === null;
  const precio =
    plan.precioMensual !== null
      ? calcularPrecio({
          precioMensual: plan.precioMensual,
          ciclo: "MENSUAL",
          mesesPagadosAnual: catalogoPais.mesesPagadosAnual,
          descuentoFundadorPct: hayCupos && plan.codigo !== "ALLFATHER" ? catalogoPais.fundadorDescuentoPct : 0,
        })
      : null;

  return (
    <article className="flex min-w-0 flex-col gap-4 border-2 border-border bg-bg p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="poster-4 break-words">{plan.nombre}</h3>
        <div className="text-right">
          {precio ? (
            <>
              {precio.ahorro > 0 ? (
                <span className="sn-meta block line-through">{formatearMoneda(precio.lista, catalogoPais.moneda, catalogoPais.locale)}</span>
              ) : null}
              <span className="figure-md block">
                {plan.esDesde ? T.desde : ""}
                {formatearMoneda(precio.final, catalogoPais.moneda, catalogoPais.locale)}
              </span>
              <span className="sn-meta">
                {T.mensual}
                {catalogoPais.precioMasImpuesto ? T.iva : ""}
              </span>
            </>
          ) : (
            <span className="sn-label">{T.aCotizar}</span>
          )}
        </div>
      </header>
      <span className="sn-label">{T.incluye}</span>
      <ul className="grid gap-1.5">
        {lineasIncluye(plan).map((l) => (
          <li key={l} className="flex items-start gap-2 text-[13px] leading-[18px]">
            <Check className="mt-0.5 !size-4 shrink-0" aria-hidden />
            {l}
          </li>
        ))}
      </ul>
      <Link href={ventas ? "/login?next=/panel/soporte" : urlPrueba} className={cn(buttonVariants({ variant: ventas ? "secondary" : "primary" }), "mt-auto w-full text-center")}>
        {ventas ? T.ventas : T.probar}
      </Link>
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
  const urlPrueba = auth.user ? "/panel/onboarding" : "/login?next=/panel/onboarding";
  const hayCupos = (catalogo?.pais.cuposFundadorRestantes ?? 0) > 0;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg text-text">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border px-4 py-3 sm:px-8">
        <span className="sn-label">{T.marca}</span>
        <Link href={urlPrueba} className={cn(buttonVariants({ size: "sm" }))}>
          {T.probar}
        </Link>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-8 sm:py-16">
          <Poster as="h1" size={1} className="break-words">
            {T.heroTitulo}
          </Poster>
          <p className="max-w-2xl text-[16px] leading-[24px]">{T.heroTexto}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={urlPrueba} className={cn(buttonVariants(), "grow sm:grow-0")}>
              {T.probar}
            </Link>
            <Link href="#planes" className={cn(buttonVariants({ variant: "secondary" }), "grow sm:grow-0")}>
              {T.planesTitulo}
            </Link>
          </div>
        </section>

        <Marquee text={T.marquesina} tone="signal" />

        {/* Propuesta de valor */}
        <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-8">
          <h2 className="section mb-6">{T.valorTitulo}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {T.valores.map((v, i) => (
              <Panel key={v.t} className="flex min-w-0 flex-col gap-2 p-4">
                <span className="sn-num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="poster-4 break-words">{v.t}</h3>
                <p className="text-[14px] leading-[20px]">{v.d}</p>
              </Panel>
            ))}
          </div>
        </section>

        {/* Planes */}
        <section id="planes" className="mx-auto w-full max-w-5xl scroll-mt-4 px-4 py-12 sm:px-8">
          <h2 className="section mb-4">{T.planesTitulo}</h2>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="sn-label">{T.pais}</span>
            <div className="p-chips !px-0" role="group" aria-label={T.pais}>
              {paises.map((p) => (
                <Link
                  key={p.codigo}
                  href={`/para-negocios?pais=${p.codigo}#planes`}
                  scroll={false}
                  aria-current={p.codigo === paisCodigo ? "true" : undefined}
                  className={cn("sn-chip inline-flex items-center", p.codigo === paisCodigo && "is-selected")}
                >
                  {p.nombre} · {p.moneda}
                </Link>
              ))}
            </div>
          </div>

          {catalogo && catalogo.planes.length > 0 ? (
            <>
              <div className="mb-4">
                {hayCupos ? (
                  <Status tone="warn">{T.fundadorQuedan(catalogo.pais.cuposFundadorRestantes, catalogo.pais.fundadorDescuentoPct, catalogo.pais.fundadorMeses)}</Status>
                ) : (
                  <span className="sn-meta">{T.fundadorAgotado}</span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {catalogo.planes.map((p) => (
                  <PlanCard key={p.codigo} plan={p} catalogoPais={catalogo.pais} hayCupos={hayCupos} urlPrueba={urlPrueba} />
                ))}
              </div>
              <p className="sn-meta mt-4 block">{T.pruebaNota}</p>
            </>
          ) : (
            <Panel className="p-4">
              <p className="text-[14px]">{T.sinPlanes}</p>
            </Panel>
          )}
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-8">
          <h2 className="section mb-6">{T.faqTitulo}</h2>
          <div className="flex flex-col gap-3">
            {T.faq.map((f) => (
              <details key={f.q} className="group border-2 border-border p-4">
                <summary className="flex min-h-12 cursor-pointer list-none items-center font-bold break-words">{f.q}</summary>
                <p className="pt-2 text-[14px] leading-[20px]">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Cierre */}
        <section className="border-y-2 border-border bg-signal px-4 py-12 text-ink sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <Poster as="h2" size={2} className="break-words">
              {T.cierreTitulo}
            </Poster>
            <div className="flex flex-wrap gap-3">
              <Link href={urlPrueba} className={cn(buttonVariants({ variant: "ink" }), "grow sm:grow-0")}>
                {T.probar}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-6 gap-y-2 px-4 py-8 sm:px-8">
        {T.legales.map((l) => (
          <Link key={l.href} href={l.href} className="sn-meta inline-flex min-h-12 items-center underline underline-offset-2">
            {l.t}
          </Link>
        ))}
      </footer>
    </div>
  );
}
