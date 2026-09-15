import { listarMisClientes } from "./actions";

export const metadata = { title: "Mis Clientes" };

export default async function ClientesStaffPage() {
  const res = await listarMisClientes();
  const clientes = res.ok ? res.data : [];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">Mis Clientes</h1>
      <p className="mb-6 text-[12px] text-text-faint">Solo los clientes que vos mismo atendiste — no el listado completo del negocio.</p>

      {!res.ok ? (
        <p className="text-[13px] font-semibold text-danger">{res.error}</p>
      ) : clientes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          Todavía no completaste ninguna atención.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {clientes.map((c) => (
            <li key={c.clienteId} className="rounded-2xl border border-border-subtle bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13.5px] font-bold text-text">{c.nombre}</p>
                  <p className="text-[11.5px] text-text-faint">{c.telefono ?? "Sin teléfono"}</p>
                </div>
                <p className="text-[11.5px] font-semibold text-text-muted">{c.visitas} visitas</p>
              </div>
              <p className="mt-2 text-[11.5px] text-text-faint">
                {c.servicios.slice(0, 3).join(" · ")} · Última visita {new Date(c.ultimaVisita).toLocaleDateString("es-CO")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
