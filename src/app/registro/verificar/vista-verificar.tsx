"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { useT } from "@/lib/i18n/proveedor";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Aviso, borrarVerificacion, enmascararCorreo, leerVerificacion } from "../../login/_componentes/campos";
import { ErrorForm, Hot, PantallaAuth, claseEnlace } from "../../login/_componentes/pantalla-auth";
import { reenviarCodigoVerificacion, verificarCorreo } from "../../login/actions";

const ESPERA_REENVIO = 60;

/**
 * VERIFICA TU CORREO: pantalla propia. El correo llega desde el registro (o desde «Ingresar» cuando
 * la cuenta aún no está verificada) por sessionStorage, nunca en la URL. Si se perdió (otra pestaña,
 * otro dispositivo), se pide aquí mismo: la persona nunca queda atrapada.
 */
export function VistaVerificar({ siguiente }: { siguiente: string }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [conocido, setConocido] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [espera, setEspera] = useState(ESPERA_REENVIO);
  const [, iniciar] = useTransition();

  useEffect(() => {
    iniciar(() => {
      const v = leerVerificacion();
      if (v) {
        setEmail(v.email);
        setConocido(true);
      } else {
        setEspera(0);
      }
    });
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  async function onVerificar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    if (!email.trim()) return setError(t("auth.err_correo"));
    if (codigo.length < 6) return setError(t("auth.err_codigo_largo"));
    setLoading(true);
    setError(null);
    const res = await verificarCorreo(email, codigo);
    if (!res.ok) {
      setLoading(false);
      setError(res.error);
      return;
    }
    borrarVerificacion();
    // Cuenta verificada y con sesión: el Super Admin a su panel; el resto completa su perfil
    // (vive en /login mientras el registro está pendiente).
    window.location.assign(res.esSupersu ? "/admin" : `/login${siguiente !== "/" ? `?next=${encodeURIComponent(siguiente)}` : ""}`);
  }

  async function onReenviar() {
    setError(null);
    setAviso(null);
    const res = await reenviarCodigoVerificacion(email, siguiente);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAviso(t("auth.reenviado"));
    setCodigo("");
    setEspera(ESPERA_REENVIO);
  }

  const qs = siguiente && siguiente !== "/" ? `?next=${encodeURIComponent(siguiente)}` : "";

  return (
    <PantallaAuth
      indice={t("auth.i_verificar")}
      volver={`/registro${qs}`}
      titulo={
        <>
          {t("auth.ver_t1")}
          <br />
          <Hot>{t("auth.ver_t2")}</Hot>
        </>
      }
      intro={conocido ? t("auth.ver_intro", { email: enmascararCorreo(email) }) : t("auth.ver_intro_sin")}
    >
      <form onSubmit={onVerificar} className="flex flex-col gap-4" noValidate>
        {!conocido ? (
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
        ) : null}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] leading-4 font-semibold text-text">{t("auth.codigo")}</span>
          <div className="min-[400px]:hidden">
            <OtpInput length={6} size="sm" value={codigo} onChange={setCodigo} status={error ? "error" : "idle"} aria-label={t("auth.codigo")} />
          </div>
          <div className="hidden min-[400px]:block">
            <OtpInput length={6} size="md" value={codigo} onChange={setCodigo} status={error ? "error" : "idle"} aria-label={t("auth.codigo")} />
          </div>
        </div>
        {aviso ? <Aviso>{aviso}</Aviso> : null}
        {error ? <ErrorForm>{error}</ErrorForm> : null}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {t("auth.verificar")}
        </Button>

        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <button type="button" onClick={onReenviar} disabled={espera > 0 || !email} className={`${claseEnlace} disabled:text-text-muted disabled:no-underline`}>
            {espera > 0 ? t("auth.reenviar_en", { s: String(espera) }) : `${t("auth.reenviar")} ↗`}
          </button>
          <Link
            href={`/registro${qs}`}
            onClick={() => borrarVerificacion()}
            className={claseEnlace}
          >
            {t("auth.cambiar_correo")}
          </Link>
          <p className="p-note normal-case">{t("auth.ver_ayuda")}</p>
        </div>
      </form>
    </PantallaAuth>
  );
}
