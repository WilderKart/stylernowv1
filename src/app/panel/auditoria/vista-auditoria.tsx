"use client";

import { VisorAuditoria } from "@/components/auditoria/visor-auditoria";
import type { PaginaAuditoria } from "@/lib/auditoria/listado";
import { listarAuditoriaNegocio } from "./actions";

export function VistaAuditoria({
  inicial,
  errorInicial,
  entidades,
}: {
  inicial: PaginaAuditoria | null;
  errorInicial: string | null;
  entidades: string[];
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">Auditoría</h1>
      <p className="mb-5 text-[12px] text-text-faint">
        Historial inmutable de lo que pasó en tu negocio: quién hizo cada cambio, el valor anterior y el nuevo.
      </p>
      <VisorAuditoria inicial={inicial} errorInicial={errorInicial} entidades={entidades} cargar={listarAuditoriaNegocio} />
    </main>
  );
}
