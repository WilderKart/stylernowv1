import { BarraSuperior } from "@/components/layout/header";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { listarProductos } from "../actions";
import { ListaProductos } from "./lista-productos";

export const metadata = { title: "Productos" };

export default async function ProductosPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], "/panel/pos/productos");

  const negocioId = contexto.negocioId!;
  const res = await listarProductos(negocioId);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Productos" volverA="/panel/pos" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        <ListaProductos negocioId={negocioId} productosIniciales={res.ok ? res.data : []} />
      </main>
    </div>
  );
}
