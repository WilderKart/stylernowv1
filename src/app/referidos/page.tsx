import { Pantalla, Top, ErrorAviso, diaYMes } from "@/app/lealtad/ui-cliente";
import { EmptyState } from "@/components/brutal";
import { obtenerReferidos } from "@/lib/cliente/mylook-pagos";
import { formatCOP } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CopiarInvitar } from "./copiar-invitar";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("ref.meta"), robots: { index: false, follow: false } };
}

const TZ = "America/Bogota";

const ESTADOS = {
  CITA_HECHA: { etiqueta: "ref.e_cita_hecha", fondo: "var(--success)", borde: true },
  REGISTRADO: { etiqueta: "ref.e_registrado", fondo: "var(--warning)", borde: true },
  EXPIRADO: { etiqueta: "ref.e_expirado", fondo: "transparent", borde: false },
} as const;

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
  const t = await obtenerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/referidos");

  const res = await obtenerReferidos();

  return (
    <Pantalla className="pb-10">
      <Top titulo={t("ref.top")} volverA="/perfil" />

      <div className="p-4">
        <h1 className="poster-2 break-words">
          {t("ref.t1")} <span className="sn-hot">{t("ref.t2")}</span>
        </h1>
        <p className="body-sm mt-2 break-words">
          {t("ref.txt_1")} <b>{t("ref.txt_saldo")}</b> {t("ref.txt_2")}
        </p>
      </div>

      {!res.ok ? (
        <div className="px-4">
          <ErrorAviso>{res.error}</ErrorAviso>
        </div>
      ) : (
        <>
          <section aria-label={t("ref.tu_codigo_aria")} className="mx-4 flex flex-col gap-3 border-2 border-line p-4 shadow-[var(--sn-shadow-hard)]">
            <span className="sn-num">{t("ref.sec_codigo")}</span>
            <CopiarInvitar codigo={res.data.codigo} />
          </section>

          <div className="mt-4 grid grid-cols-3 border-y-2 border-line">
            <div className="min-w-0 border-r border-border p-3">
              <span className="sn-meta">{t("ref.invitados")}</span>
              <div className="sn-fig text-2xl">{res.data.invitados}</div>
            </div>
            <div className="min-w-0 border-r border-border p-3">
              <span className="sn-meta">{t("ref.con_cita")}</span>
              <div className="sn-fig text-2xl">{res.data.con_cita}</div>
            </div>
            <div className="min-w-0 p-3">
              <span className="sn-meta">{t("ref.ganado")}</span>
              <div className="sn-fig break-words text-lg min-[380px]:text-2xl">{formatCOP(Number(res.data.ganado))}</div>
            </div>
          </div>

          <div className="p-sec">
            <h2 className="sn-num">{t("ref.sec_invitados")}</h2>
          </div>
          {res.data.lista.length === 0 ? (
            <div className="px-4">
              <EmptyState big={t("ref.aun_nadie")} title={t("ref.nadie_titulo")} hint={t("ref.nadie_hint")} />
            </div>
          ) : (
            <div className="border-t-2 border-border">
              {res.data.lista.map((p) => {
                const e = ESTADOS[p.estado as keyof typeof ESTADOS] ?? ESTADOS.EXPIRADO;
                const { dia, mes } = diaYMes(p.se_unio_at, TZ);
                return (
                  <div key={p.referido_id} className="p-row">
                    <span className="grid size-10 shrink-0 place-items-center border-2 border-line bg-surface sn-label">{iniciales(p.nombre)}</span>
                    <span className="p-row__t">
                      <b className="break-words">{p.nombre}</b>
                      <span className="sn-meta">
                        {t("ref.se_unio", { dia: Number(dia), mes: mes.toUpperCase() })}
                      </span>
                    </span>
                    <span
                      className={`sn-label shrink-0 px-2 py-1 ${e.borde ? "border-2 border-ink text-ink" : "border-2 border-line"}`}
                      style={{ background: e.fondo }}
                    >
                      {t(e.etiqueta)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Link href="/legal/terminos" className="sn-label mx-4 mt-6 inline-flex min-h-12 items-center underline">
        {t("ref.condiciones")}
      </Link>
    </Pantalla>
  );
}
