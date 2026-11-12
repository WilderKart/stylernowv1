"use client";

import { Button } from "@/components/ui/button";
import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { Panel } from "@/components/brutal";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useT } from "@/lib/i18n/proveedor";
import { toast } from "sonner";
import { cambiarContrasena, crearContrasena } from "@/app/login/actions";

/**
 * `passwordEstablecida=false` cubre a alguien que entró solo por Google y
 * todavía no tiene contraseña — en ese caso se usa `crearContrasena()` (no
 * pide "actual", porque no existe una) en vez de `cambiarContrasena()`.
 */
export function CambiarContrasena({ passwordEstablecida }: { passwordEstablecida: boolean }) {
  const t = useT();
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nueva !== confirmar) {
      setError(t("pw.no_coinciden"));
      return;
    }
    setLoading(true);
    setError(null);
    const res = passwordEstablecida ? await cambiarContrasena(actual, nueva) : await crearContrasena(nueva);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(passwordEstablecida ? t("pw.actualizada") : t("pw.creada"));
    setAbierto(false);
    setActual("");
    setNueva("");
    setConfirmar("");
  }

  if (!abierto) {
    return (
      <Panel>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex min-h-14 w-full items-center justify-between gap-3 p-4 text-left"
        >
          <span className="section">{passwordEstablecida ? t("pw.cambiar") : t("pw.crear")}</span>
          <span className="sn-label">{t("pw.editar")}</span>
        </button>
        {!passwordEstablecida ? (
          <p className="sn-help px-4 pb-4">{t("pw.google")}</p>
        ) : null}
      </Panel>
    );
  }

  return (
    <Panel className="p-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <h3 className="section">{passwordEstablecida ? t("pw.cambiar") : t("pw.crear")}</h3>
        {passwordEstablecida ? (
          <Input
            label={t("pw.actual")}
            type="password"
            required
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        ) : null}
        <Input
          label={t("pw.nueva")}
          type="password"
          required
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
        <Input
          label={t("pw.confirmar_nueva")}
          type="password"
          required
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
        />
        <p className="sn-help">{t("pw.reglas")}</p>
        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={() => setAbierto(false)}>
            {t("comun.cancelar")}
          </Button>
          <Button type="submit" loading={loading} className="min-w-0 flex-1">
            {t("comun.guardar")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
