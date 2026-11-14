import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { EmptyState } from "@/components/brutal";
import { VistaLibro } from "@/components/libro/vista-libro";
import { alcanceLibro, listarMovimientos, TAMANO_PAGINA, totalesLibro } from "@/lib/libro/consultas";
import { leerFiltros } from "@/lib/libro/filtros";

export const metadata = { title: "Libro financiero" };

export default async function LibroAdminPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filtros = leerFiltros(await props.searchParams);

  const datos = await cargar(filtros);
  const contenido = datos ? (
    <VistaLibro modo="admin" filtros={filtros} {...datos} tamanoPagina={TAMANO_PAGINA} />
  ) : (
    <EmptyState big="Error" title="No pudimos cargar el libro financiero" hint="Verifica tu sesión de SuperSU." />
  );

  return (
    <main className="w-full max-w-6xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Libro contable" titulo="Libro" resaltado="financiero." />
      {contenido}
    </main>
  );
}

async function cargar(filtros: ReturnType<typeof leerFiltros>) {
  try {
    // El layout de /admin ya exige SuperSU; aquí se vuelve a verificar en el servidor.
    const alcance = await alcanceLibro("admin", filtros.negocioId);
    const [{ filas, total }, totales] = await Promise.all([listarMovimientos(alcance, filtros), totalesLibro(alcance, filtros)]);
    return { filas, total, totales };
  } catch {
    return null;
  }
}
