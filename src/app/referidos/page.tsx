import { Pantalla, Top, ErrorAviso, diaYMes } from "@/app/lealtad/ui-cliente";
import { EmptyState } from "@/components/brutal";
import { obtenerReferidos } from "@/lib/cliente/mylook-pagos";
import { formatCOP } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CopiarInvitar } from "./copiar-invitar";

export const metadata = { title: "Referidos", robots: { index: false, follow: false } };

const TZ = "America/Bogota";

const ESTADOS: Record<string, { etiqueta: string; fondo: string; borde: boolean }> = {
  CITA_HECHA: { etiqueta: "Cita hecha", fondo: "var(--success)", borde: true },
  REGISTRADO: { etiqueta: "Registrado", fondo: "var(--warning)", borde: true },
  EXPIRADO: { etiqueta: "Expirado", fondo: "transparent", borde: false },
};

function iniciales(nombre: string) {
  if (nombre === "Cliente anónimo") return "··";
  return nombre
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function ReferidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/referidos");

  const res = await obtenerReferidos();

  return (
    <Pantalla className="pb-10">
      <Top titulo="/Perfil/Referidos" volverA="/perfil" />

      <div className="p-4">
        <h1 className="poster-2 break-words">
          Invita. <span className="sn-hot">Gana.</span>
        </h1>
        <p className="body-sm mt-2 break-words">
          Tú y tu amigo reciben <b>saldo</b> cuando completa su primera cita.
        </p>
      </div>

      {!res.ok ? (
        <div className="px-4">
          <ErrorAviso>{res.error}</ErrorAviso>
        </div>
      ) : (
        <>
          <section aria-label="Tu código" className="mx-4 flex flex-col gap-3 border-2 border-line p-4 shadow-[var(--sn-shadow-hard)]">
            <span className="sn-num">01 / Tu código</span>
            <CopiarInvitar codigo={res.data.codigo} />
          </section>

          <div className="mt-4 grid grid-cols-3 border-y-2 border-line">
            <div className="min-w-0 border-r border-border p-3">
              <span className="sn-meta">Invitados</span>
              <div className="sn-fig text-2xl">{res.data.invitados}</div>
            </div>
            <div className="min-w-0 border-r border-border p-3">
              <span className="sn-meta">Con cita</span>
              <div className="sn-fig text-2xl">{res.data.con_cita}</div>
            </div>
            <div className="min-w-0 p-3">
              <span className="sn-meta">Ganado</span>
              <div className="sn-fig break-words text-lg min-[380px]:text-2xl">{formatCOP(Number(res.data.ganado))}</div>
            </div>
          </div>

          <div className="p-sec">
            <h2 className="sn-num">02 / Tus invitados</h2>
          </div>
          {res.data.lista.length === 0 ? (
            <div className="px-4">
              <EmptyState big="Aún nadie" title="Todavía no invitas a nadie" hint="Comparte tu código con un amigo para empezar a ganar saldo." />
            </div>
          ) : (
            <div className="border-t-2 border-border">
              {res.data.lista.map((p) => {
                const e = ESTADOS[p.estado] ?? ESTADOS.EXPIRADO;
                const { dia, mes } = diaYMes(p.se_unio_at, TZ);
                return (
                  <div key={p.referido_id} className="p-row">
                    <span className="grid size-10 shrink-0 place-items-center border-2 border-line bg-surface sn-label">{iniciales(p.nombre)}</span>
                    <span className="p-row__t">
                      <b className="break-words">{p.nombre}</b>
                      <span className="sn-meta">
                        Se unió {Number(dia)} {mes.toUpperCase()}
                      </span>
                    </span>
                    <span
                      className={`sn-label shrink-0 px-2 py-1 ${e.borde ? "border-2 border-ink text-ink" : "border-2 border-line"}`}
                      style={{ background: e.fondo }}
                    >
                      {e.etiqueta}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Link href="/legal/terminos" className="sn-label mx-4 mt-6 inline-flex min-h-12 items-center underline">
        Condiciones del programa ↗
      </Link>
    </Pantalla>
  );
}
