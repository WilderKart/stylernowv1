"use client";

import { Turnstile, type ControlTurnstile } from "@/components/seguridad/turnstile";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/proveedor";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { enmascararCorreo } from "../_componentes/campos";
import { ErrorForm, Hot, PantallaAuth, claseEnlace } from "../_componentes/pantalla-auth";
import { solicitarRecuperacion } from "../actions";

/**
 * RECUPERAR CONTRASEÑA, paso 1 (pantalla propia, no reutiliza registro ni ingreso).
 * La confirmación es siempre la misma exista o no la cuenta (anti-enumeración). El enlace del
 * correo pasa por /auth/callback y abre /login/recuperar para crear la contraseña nueva.
 */
export function VistaOlvide({ siguiente }: { siguiente: string }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenTs, setTokenTs] = useState<string | null>(null);
  const controlTs = useRef<ControlTurnstile>(null);
  const qs = siguiente && siguiente !== "/" ? `?next=${encodeURIComponent(siguiente)}` : "";

  async function onEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenTs) {
      setError(t("auth.err_verificando"));
      return;
    }
    setLoading(true);
    setError(null);
    const res = await solicitarRecuperacion(email, tokenTs);
    controlTs.current?.reiniciar();
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <PantallaAuth
        indice={t("auth.i_olvide")}
        volver={`/login${qs}`}
        titulo={
          <>
            {t("auth.olv_env_t1")}
            <br />
            <Hot>{t("auth.olv_env_t2")}</Hot>
          </>
        }
        intro={t("auth.olv_enviado", { email: enmascararCorreo(email.trim().toLowerCase()) })}
      >
        <div className="flex flex-col gap-1">
          <Link href={`/login${qs}`} className={claseEnlace}>
            {t("auth.volver_ingresar")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setEnviado(false);
              setEmail("");
            }}
            className={claseEnlace}
          >
            {t("auth.otro_correo")}
          </button>
        </div>
      </PantallaAuth>
    );
  }

  return (
    <PantallaAuth
      indice={t("auth.i_olvide")}
      volver={`/login${qs}`}
      titulo={
        <>
          {t("auth.olv_t1")}
          <br />
          <Hot>{t("auth.olv_t2")}</Hot>
        </>
      }
      intro={t("auth.olv_intro")}
    >
      <form onSubmit={onEnviar} className="flex flex-col gap-4">
        <Input
          label={t("login.correo")}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder={t("login.correo_ph")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Turnstile ref={controlTs} accion="recuperar" onToken={setTokenTs} />
        {error ? <ErrorForm>{error}</ErrorForm> : null}
        <Button type="submit" size="lg" loading={loading} className="w-full">
          <span>{t("auth.enviar_enlace")}</span>
          <ArrowUpRight className="size-[18px]" aria-hidden />
        </Button>
        <Link href={`/login${qs}`} className={claseEnlace}>
          {t("auth.volver_ingresar")}
        </Link>
      </form>
    </PantallaAuth>
  );
}
