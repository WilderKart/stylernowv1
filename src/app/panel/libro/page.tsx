import { EmptyState } from "@/components/brutal";
import { VistaLibro } from "@/components/libro/vista-libro";
import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { alcanceLibro, listarMovimientos, TAMANO_PAGINA, totalesLibro } from "@/lib/libro/consultas";
import { leerFiltros } from "@/lib/libro/filtros";

export const metadata = { title: "Libro financiero" };

export default async function LibroPanelPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Información financiera del negocio: solo su dueño.
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/libro");
  const filtros = leerFiltros(await props.searchParams);

  const datos = await cargar(filtros);
  const contenido = datos ? (
    <VistaLibro modo="panel" filtros={{ ...filtros, negocioId: undefined }} {...datos} tamanoPagina={TAMANO_PAGINA} />
  ) : (
    <EmptyState big="Error" title="No pudimos cargar el libro financiero" hint="Intenta de nuevo en unos minutos." />
  );

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-8 sm:px-8">
        <h1 className="poster-3 mb-4 break-words">Libro financiero</h1>
        {contenido}
      </main>
    </div>
  );
}

async function cargar(filtros: ReturnType<typeof leerFiltros>) {
  try {
    const alcance = await alcanceLibro("panel");
    const [{ filas, total }, totales] = await Promise.all([listarMovimientos(alcance, filtros), totalesLibro(alcance, filtros)]);
    return { filas, total, totales };
  } catch {
    return null;
  }
}
