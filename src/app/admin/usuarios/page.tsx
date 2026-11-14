import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { EncabezadoAdmin } from "../_componentes/encabezado-admin";
import { rpcAdmin } from "../_componentes/rpc";
import { Caja, Insignia, Vacio } from "../_componentes/ui-admin";

type Fila = {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  telefono_verificado: boolean;
  pais: string | null;
  rol: "SUPERSU" | "NEGOCIO" | "STAFF" | "CLIENTE";
  suspendido: boolean;
  registro_pendiente: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  proveedor: string;
  negocios: number;
  vinculos: number;
  reservas: number;
};
type Listado = {
  total: number;
  filas: Fila[];
  conteo: { todos: number; supersu: number; negocio: number; staff: number; suspendido: number; pendiente: number };
};

const POR_PAGINA = 25;
const ROLES = ["", "NEGOCIO", "STAFF", "CLIENTE", "SUPERSU", "SUSPENDIDO", "PENDIENTE"] as const;
const ETIQUETA_ROL: Record<string, string> = {
  "": "Todos",
  NEGOCIO: "Barberías",
  STAFF: "Staff",
  CLIENTE: "Clientes",
  SUPERSU: "Super Admin",
  SUSPENDIDO: "Suspendidos",
  PENDIENTE: "Registro incompleto",
};

const ROL_FILA: Record<string, string> = { SUPERSU: "Super Admin", NEGOCIO: "Barbería", STAFF: "Staff", CLIENTE: "Cliente" };

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota" }) : "—";

export default async function AdminUsuariosPage(props: PageProps<"/admin/usuarios">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const rolParam = typeof sp.rol === "string" ? sp.rol : "";
  const rol = (ROLES as readonly string[]).includes(rolParam) ? rolParam : "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const res = await rpcAdmin<Listado>("admin_usuarios_listar", {
    p_q: q || null,
    p_rol: rol || null,
    p_limite: POR_PAGINA,
    p_offset: (pagina - 1) * POR_PAGINA,
  });

  const conteoDe = (r: string, c: Listado["conteo"]) =>
    ({ "": c.todos, NEGOCIO: c.negocio, STAFF: c.staff, CLIENTE: c.todos - c.negocio - c.staff - c.supersu, SUPERSU: c.supersu, SUSPENDIDO: c.suspendido, PENDIENTE: c.pendiente })[r] ?? 0;

  const url = (cambios: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const v = { q, rol, pagina: 1, ...cambios };
    if (v.q) p.set("q", String(v.q));
    if (v.rol) p.set("rol", String(v.rol));
    if (Number(v.pagina) > 1) p.set("pagina", String(v.pagina));
    const s = p.toString();
    return `/admin/usuarios${s ? `?${s}` : ""}`;
  };

  const totalPaginas = res.ok ? Math.max(1, Math.ceil(res.data.total / POR_PAGINA)) : 1;

  return (
    <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin
        seccion="Usuarios"
        titulo="Cuentas de la"
        resaltado="plataforma."
        descripcion="Todas las cuentas reales: barberías, staff, clientes y Super Admin. Busca, filtra y abre la ficha para ver su actividad o suspender el acceso."
      />

      <form action="/admin/usuarios" className="mb-4 flex gap-2">
        {rol && <input type="hidden" name="rol" value={rol} />}
        <label className="flex min-w-0 flex-1 items-center gap-2 border-2 border-border bg-bg px-3">
          <Search className="size-4 shrink-0 text-text-faint" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, correo o celular…"
            className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-faint"
            aria-label="Buscar usuarios"
          />
        </label>
        <button type="submit" className="h-[48px] shrink-0 bg-text px-4 font-mono text-[12px] font-bold uppercase text-bg hover:bg-accent">
          Buscar
        </button>
      </form>

      {res.ok && (
        <nav aria-label="Filtrar por tipo de cuenta" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {ROLES.map((r) => {
            const activo = r === rol;
            return (
              <Link
                key={r || "todos"}
                href={url({ rol: r })}
                className={`flex shrink-0 items-center gap-2 border-2 px-3 py-2 text-[12.5px] font-semibold ${
                  activo ? "border-accent bg-accent text-white" : "border-border text-text hover:border-accent"
                }`}
              >
                {ETIQUETA_ROL[r]}
                <span className={`font-mono text-[11px] ${activo ? "text-white" : "text-text-faint"}`}>{conteoDe(r, res.data.conteo)}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {!res.ok ? (
        <p className="border-2 border-danger px-4 py-3 text-[13px] font-semibold text-danger">{res.error}</p>
      ) : (
        <Caja destacada>
          <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
            <h2 className="font-mono text-[12.5px] font-bold uppercase tracking-[0.08em] text-text">
              {res.data.total} {res.data.total === 1 ? "cuenta" : "cuentas"}
              {q && <span className="text-text-faint"> · “{q}”</span>}
            </h2>
          </div>

          {res.data.filas.length === 0 ? (
            <Vacio>No hay cuentas con ese filtro.</Vacio>
          ) : (
            <>
              {/* Escritorio: tabla */}
              <div className="mt-3 hidden overflow-x-auto md:block">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-y-2 border-border font-mono text-[10.5px] uppercase tracking-wide text-text-muted">
                      <th className="px-5 py-2.5 font-bold">Cuenta</th>
                      <th className="px-3 py-2.5 font-bold">Tipo</th>
                      <th className="px-3 py-2.5 font-bold">Celular</th>
                      <th className="px-3 py-2.5 text-right font-bold">Reservas</th>
                      <th className="px-3 py-2.5 font-bold">Último ingreso</th>
                      <th className="px-5 py-2.5 font-bold">Alta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {res.data.filas.map((u) => (
                      <tr key={u.id} className="hover:bg-surface">
                        <td className="max-w-[280px] px-5 py-3">
                          <Link href={`/admin/usuarios/${u.id}`} className="block min-w-0 hover:text-accent">
                            <span className="block truncate font-semibold text-text">{u.nombre || "Sin nombre"}</span>
                            <span className="block truncate text-[12px] text-text-muted">{u.email}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <span className="flex flex-wrap gap-1">
                            <Insignia tono={u.rol === "SUPERSU" ? "acento" : "neutro"}>{ROL_FILA[u.rol] ?? u.rol}</Insignia>
                            {u.suspendido && <Insignia tono="peligro">Suspendido</Insignia>}
                            {u.registro_pendiente && <Insignia tono="alerta">Incompleto</Insignia>}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-text-muted">
                          {u.telefono ?? "—"}
                          {u.telefono && !u.telefono_verificado && <span className="ml-1 text-[11px] text-text-faint">(sin verificar)</span>}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-text">{u.reservas}</td>
                        <td className="px-3 py-3 text-text-muted">{fecha(u.last_sign_in_at)}</td>
                        <td className="px-5 py-3 text-text-muted">{fecha(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Móvil: tarjetas */}
              <ul className="mt-3 divide-y divide-border-subtle md:hidden">
                {res.data.filas.map((u) => (
                  <li key={u.id}>
                    <Link href={`/admin/usuarios/${u.id}`} className="flex flex-col gap-1.5 px-4 py-3.5 active:bg-surface">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-text">{u.nombre || "Sin nombre"}</span>
                          <span className="block truncate text-[12px] text-text-muted">{u.email}</span>
                        </span>
                        <Insignia tono={u.rol === "SUPERSU" ? "acento" : "neutro"}>{ROL_FILA[u.rol] ?? u.rol}</Insignia>
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-faint">
                        <span>{u.reservas} reservas</span>
                        <span>Alta {fecha(u.created_at)}</span>
                        {u.suspendido && <Insignia tono="peligro">Suspendido</Insignia>}
                        {u.registro_pendiente && <Insignia tono="alerta">Incompleto</Insignia>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              {totalPaginas > 1 && (
                <div className="flex items-center justify-between border-t-2 border-border px-4 py-3 sm:px-5">
                  <span className="font-mono text-[11.5px] text-text-muted">
                    Página {pagina} de {totalPaginas}
                  </span>
                  <span className="flex gap-2">
                    {pagina > 1 && (
                      <Link href={url({ pagina: pagina - 1 })} className="grid size-10 place-items-center border-2 border-border hover:border-accent" aria-label="Página anterior">
                        <ChevronLeft className="size-4" aria-hidden />
                      </Link>
                    )}
                    {pagina < totalPaginas && (
                      <Link href={url({ pagina: pagina + 1 })} className="grid size-10 place-items-center border-2 border-border hover:border-accent" aria-label="Página siguiente">
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    )}
                  </span>
                </div>
              )}
            </>
          )}
        </Caja>
      )}
    </main>
  );
}
