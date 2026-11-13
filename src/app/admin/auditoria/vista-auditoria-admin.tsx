"use client";

import { VisorAuditoria } from "@/components/auditoria/visor-auditoria";
import type { PaginaAuditoria } from "@/lib/auditoria/listado";
import { buscarNegociosAuditoria, listarAuditoriaAdmin } from "./actions";

export function VistaAuditoriaAdmin({
  inicial,
  errorInicial,
  entidades,
}: {
  inicial: PaginaAuditoria | null;
  errorInicial: string | null;
  entidades: string[];
}) {
  return (
    <VisorAuditoria
      inicial={inicial}
      errorInicial={errorInicial}
      entidades={entidades}
      cargar={listarAuditoriaAdmin}
      buscarNegocios={buscarNegociosAuditoria}
    />
  );
}
