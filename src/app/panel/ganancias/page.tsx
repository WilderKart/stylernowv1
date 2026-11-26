import { FiltrosForm, Paginacion, ResumenCards, TablaGanancias } from "@/components/ganancias/vista-ganancias";
import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { argumentosListar, leerFiltros } from "@/lib/ganancias/filtros";
import { clienteGanancias, llamar } from "@/lib/ganancias/rpc";
import type { Capacidades, Liquidacion, ListaGanancias, ResumenGanancias } from "@/lib/ganancias/tipos";
import Link from "next/link";
import {
  PestanaEquipo, PestanaLiquidaciones, PestanaNovedades, PestanaReglas, PestanaRevisiones,
  type AccesoSoporteFila, type NovedadFila, type Opcion, type PagoFila, type PermisoFila, type ReglaFila, type RevisionFila,
} from "./pestanas";

export const metadata = { title: "Ganancias del equipo" };

type Vista = "ganancias" | "liquidaciones" | "reglas" | "novedades" | "revisiones" | "equipo";

export default async function GananciasPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // La ruta admite a propietario, administrador y guardián, pero lo que cada uno ve lo decide la base (capacidades explícitas).
  const contexto = await verificarAccesoPanel(["BARBERIA", "ADMIN", "GUARDIAN"], "/panel/ganancias");
  const sp = await props.searchParams;
  const negocioId = contexto.negocioId!;
  const filtros = leerFiltros(sp);

  const capsRes = await llamar<Capacidades>("ganancia_mis_capacidades", { p_negocio: negocioId });
  const caps: Capacidades = capsRes.ok ? capsRes.data : { propietario: false, ver: false, ver_sede: false, configurar: false, liquidar: false, pagar: false, exportar: false, novedades: false };
  const puedeVer = caps.ver || caps.ver_sede;

  const disponibles: Array<{ id: Vista; etiqueta: string }> = [
    ...(puedeVer ? [{ id: "ganancias" as const, etiqueta: "Ganancias" }, { id: "liquidaciones" as const, etiqueta: "Liquidaciones" }] : []),
    ...(caps.configurar || puedeVer ? [{ id: "reglas" as const, etiqueta: "Reglas" }] : []),
    ...(caps.novedades ? [{ id: "novedades" as const, etiqueta: "Novedades" }, { id: "revisiones" as const, etiqueta: "Revisiones" }] : []),
    ...(caps.propietario ? [{ id: "equipo" as const, etiqueta: "Permisos y soporte" }] : []),
  ];
  const pedida = (Array.isArray(sp.vista) ? sp.vista[0] : sp.vista) as Vista | undefined;
  const vista = disponibles.find((d) => d.id === pedida)?.id ?? disponibles[0]?.id;

  const supabase = await clienteGanancias();
  const [equipoRes, sedesRes, serviciosRes] = await Promise.all([
    supabase.from("vista_staff_negocio").select("staff_id, nombre, estado").eq("negocio_id", negocioId),
    supabase.from("sede").select("id, nombre").eq("negocio_id", negocioId),
    supabase.from("servicio").select("id, nombre").eq("negocio_id", negocioId).eq("estado", "ACTIVO"),
  ]);
  const equipo: Opcion[] = ((equipoRes.data ?? []) as Array<{ staff_id: string; nombre: string | null }>).map((e) => ({ id: e.staff_id, nombre: e.nombre ?? "Profesional" }));
  const sedes: Opcion[] = (sedesRes.data ?? []) as Opcion[];
  const servicios: Opcion[] = (serviciosRes.data ?? []) as Opcion[];

  let contenido: React.ReactNode = (
    <p className="border-2 border-dashed border-border p-6 text-center text-[13px] text-text-muted">
      No tienes acceso a las ganancias del equipo. El propietario puede concedértelo en «Permisos y soporte».
    </p>
  );

  if (vista === "ganancias") {
    const [lista, resumen] = await Promise.all([
      llamar<ListaGanancias>("ganancias_listar", argumentosListar(filtros, negocioId)),
      llamar<ResumenGanancias>("ganancias_resumen", { p_negocio: negocioId, p_sede: filtros.sede ?? null, p_staff: filtros.staff ?? null, p_desde: filtros.desde ?? null, p_hasta: filtros.hasta ?? null }),
    ]);
    const params = {
      vista: "ganancias", desde: filtros.rapido ? undefined : filtros.desde, hasta: filtros.rapido ? undefined : filtros.hasta, rapido: filtros.rapido, sede: filtros.sede, staff: filtros.staff,
      estado_comision: filtros.estadoComision, estado_cobro: filtros.estadoCobro, estado_liquidacion: filtros.estadoLiquidacion, q: filtros.q,
    };
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as Array<[string, string]>).toString();
    contenido = (
      <>
        <FiltrosForm accion="/panel/ganancias" vista="ganancias" valores={filtros} sedes={sedes} equipo={equipo} />
        {resumen.ok ? <ResumenCards r={resumen.data} esProfesional={false} /> : <p className="text-danger">{resumen.error}</p>}
        <div className="mb-2 flex justify-end">
          {caps.exportar ? <Link href={`/panel/ganancias/exportar?${qs}`} className="text-[12.5px] font-semibold underline">Exportar CSV</Link> : null}
        </div>
        {lista.ok ? (
          <>
            <TablaGanancias filas={lista.data.filas} mostrarProfesional mostrarParticipacion />
            <Paginacion total={Number(lista.data.total)} pagina={filtros.pagina} base="/panel/ganancias" params={params} />
          </>
        ) : (
          <p className="text-danger">{lista.error}</p>
        )}
      </>
    );
  } else if (vista === "liquidaciones") {
    const [liq, pagos] = await Promise.all([
      llamar<Liquidacion[]>("liquidaciones_listar", { p_negocio: negocioId, p_staff: null, p_sede: null, p_limite: 50, p_desplazamiento: 0 }),
      supabase.from("ganancia_pago").select("id, liquidacion_id, monto, medio, referencia, estado, pagado_el").eq("negocio_id", negocioId).order("created_at", { ascending: false }).limit(300),
    ]);
    contenido = <PestanaLiquidaciones liquidaciones={liq.ok ? liq.data : []} pagos={(pagos.data ?? []) as PagoFila[]} equipo={equipo} sedes={sedes} caps={caps} />;
  } else if (vista === "reglas") {
    const { data } = await supabase.from("comision_regla").select("id, sede_id, staff_id, servicio_id, categoria, pct, base, vigente_desde, vigente_hasta, estado, version, motivo, created_at").eq("negocio_id", negocioId).order("created_at", { ascending: false }).limit(100);
    contenido = <PestanaReglas reglas={(data ?? []) as ReglaFila[]} equipo={equipo} sedes={sedes} servicios={servicios} caps={caps} />;
  } else if (vista === "novedades") {
    const { data } = await supabase.from("ganancia_novedad").select("id, tipo, severidad, estado, descripcion, impacto, created_at, resolucion, reserva_id").eq("negocio_id", negocioId).order("created_at", { ascending: false }).limit(150);
    contenido = <PestanaNovedades novedades={(data ?? []) as NovedadFila[]} />;
  } else if (vista === "revisiones") {
    const { data } = await supabase.from("ganancia_revision").select("id, staff_id, objeto_tipo, objeto_id, motivo, estado, respuesta, created_at").eq("negocio_id", negocioId).order("created_at", { ascending: false }).limit(100);
    contenido = <PestanaRevisiones revisiones={(data ?? []) as RevisionFila[]} equipo={equipo} />;
  } else if (vista === "equipo") {
    const [perm, acc] = await Promise.all([
      supabase.from("ganancia_permiso").select("id, usuario_id, sede_id, ver, configurar, liquidar, pagar, exportar, novedades").eq("negocio_id", negocioId),
      supabase.from("soporte_acceso_ganancias").select("id, estado, motivo, duracion_min, expira_at, agente_id, created_at").eq("negocio_id", negocioId).order("created_at", { ascending: false }).limit(20),
    ]);
    contenido = <PestanaEquipo permisos={(perm.data ?? []) as PermisoFila[]} equipo={equipo} sedes={sedes} accesos={(acc.data ?? []) as AccesoSoporteFila[]} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-8 sm:px-8">
        <h1 className="poster-3 mb-4 break-words">Ganancias del equipo</h1>
        {disponibles.length > 0 ? (
          <nav aria-label="Secciones" className="mb-5 flex gap-1 overflow-x-auto border-b-2 border-border">
            {disponibles.map((d) => (
              <Link
                key={d.id}
                href={`/panel/ganancias?vista=${d.id}`}
                aria-current={d.id === vista ? "page" : undefined}
                className={`shrink-0 border-b-4 px-3 py-2 text-[12.5px] font-bold uppercase ${d.id === vista ? "border-accent text-accent" : "border-transparent text-text-muted"}`}
              >
                {d.etiqueta}
              </Link>
            ))}
          </nav>
        ) : null}
        {contenido}
      </main>
    </div>
  );
}
