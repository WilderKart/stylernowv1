import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { redirect } from "next/navigation";
import { listarClientesCRM } from "./actions";
import { ListaCRM } from "./lista-crm";

export const metadata = { title: "Clientes" };

const LIMITE_PAGINA = 20;

export default async function CRMListaPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/crm");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const negocioId = contexto.negocioId!;
  const resListado = await listarClientesCRM({
    negocioId,
    sedeId: contexto.rol === "GUARDIAN" ? contexto.sedeId : undefined,
    limite: LIMITE_PAGINA,
  });

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-10">
        <ListaCRM
          negocioId={negocioId}
          sedeIdFijo={contexto.rol === "GUARDIAN" ? contexto.sedeId : null}
          puedeExportar={contexto.permisos.exportarClientes}
          itemsIniciales={resListado.ok ? resListado.data.items : []}
          totalInicial={resListado.ok ? resListado.data.total : 0}
          errorInicial={resListado.ok ? null : resListado.error}
        />
      </main>
    </div>
  );
}
