"use client";

import { Turnstile, type ControlTurnstile } from "@/components/seguridad/turnstile";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/proveedor";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Aviso, BotonGoogle, CambioPantalla, CampoContrasena, guardarVerificacion } from "./_componentes/campos";
import { ErrorForm, Hot, PantallaAuth, Separador, claseEnlace } from "./_componentes/pantalla-auth";
import { iniciarSesionConContrasena, iniciarSesionConGoogle, reenviarCodigoVerificacion } from "./actions";

/**
 * INGRESAR (rediseño 2026-11-15): solo para cuentas existentes, con correo + contraseña.
 * El código por correo ya no es un método de ingreso. Crear cuenta vive en /registro y
 * recuperar la contraseña en /login/olvide: cada pantalla tiene una sola acción principal.
 */
export function FormularioIngreso({
  siguiente,
  aviso,
  invitacion,
}: {
  siguiente: string;
  aviso?: "recuperada" | "enlace";
  /** Staff invitado que ya tiene cuenta: correo precargado y aviso de la invitación. */
  invitacion?: { email: string; negocio: string } | null;
}) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState(invitacion?.email ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleCargando, setGoogleCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sinVerificar, setSinVerificar] = useState(false);

  const qs = siguiente && siguiente !== "/" ? `?next=${encodeURIComponent(siguiente)}` : "";

  const [tokenTs, setTokenTs] = useState<string | null>(null);
  const controlTs = useRef<ControlTurnstile>(null);

  async function onIngresar(e: React.FormEvent) {
    e.preventDefault();
    setSinVerificar(false);
    if (!email.trim() || !password) {
      setError(t("auth.err_campos"));
      return;
    }
    if (!tokenTs) {
      setError(t("auth.err_verificando"));
      return;
    }
    setLoading(true);
    setError(null);
    const res = await iniciarSesionConContrasena(email, password, siguiente, tokenTs);
    // Cada token sirve una sola vez: se pide uno nuevo para el siguiente intento.
    controlTs.current?.reiniciar();
    if (!res.ok) {
      setLoading(false);
      if ("sinVerificar" in res && res.sinVerificar) setSinVerificar(true);
      else setError(res.error);
      return;
    }
    // Super Admin a su panel; el resto a su destino (el servidor desvía a «Completa tu perfil»
    // o a /legal/aceptar si hace falta, y cada rol aterriza en su propia zona).
    // Navegación completa al cambiar la sesión: nada de la caché del router de antes de ingresar.
    window.location.assign(res.destino);
  }

  async function onVerificarAhora() {
    setLoading(true);
    const res = await reenviarCodigoVerificacion(email, siguiente);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    guardarVerificacion(email.trim().toLowerCase(), siguiente);
    router.push(`/registro/verificar${qs}`);
  }

  async function onGoogle() {
    setGoogleCargando(true);
    setError(null);
    const res = await iniciarSesionConGoogle(siguiente);
    if (!res.ok) {
      setGoogleCargando(false);
      setError(res.error);
      return;
    }
    window.location.href = res.url;
  }

  return (
    <PantallaAuth
      indice={t("auth.i_ingresar")}
      volver="/"
      titulo={
        <>
          {t("auth.ing_t1")}
          <br />
          {t("auth.ing_t2")}
          <br />
          <Hot>{t("auth.ing_t3")}</Hot>
        </>
      }
      intro={t("auth.ing_intro")}
    >
      <form onSubmit={onIngresar} className="flex flex-col gap-4" noValidate>
        {invitacion ? <Aviso>Ingresa con tu cuenta para continuar con la invitación de {invitacion.negocio}.</Aviso> : null}
        {aviso === "recuperada" ? <Aviso>{t("auth.aviso_recuperada")}</Aviso> : null}
        {aviso === "enlace" ? <Aviso>{t("auth.aviso_enlace")}</Aviso> : null}

        <Input
          label={t("login.correo")}
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder={t("login.correo_ph")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <CampoContrasena label={t("login.contrasena")} name="password" value={password} onChange={setPassword} autoComplete="current-password" />
          <Link href={`/login/olvide${qs}`} className={`${claseEnlace} self-end`}>
            {t("auth.olvide")}
          </Link>
        </div>

        <Turnstile ref={controlTs} accion="ingreso" onToken={setTokenTs} />
        {error ? <ErrorForm>{error}</ErrorForm> : null}
        {sinVerificar ? (
          <div className="flex flex-col gap-2 border-2 border-danger p-3">
            <p className="text-[14px] text-text">{t("auth.sin_verificar")}</p>
            <button type="button" onClick={onVerificarAhora} disabled={loading} className={`${claseEnlace} self-start`}>
              {t("auth.verificar_ahora")}
            </button>
          </div>
        ) : null}

        <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
          <span>{t("auth.ingresar")}</span>
          <ArrowUpRight className="size-[18px]" aria-hidden />
        </Button>

        <Separador>{t("login.o")}</Separador>
        <BotonGoogle texto={t("login.google")} onClick={onGoogle} cargando={googleCargando} />

        <CambioPantalla pregunta={t("auth.sin_cuenta")} accion={t("auth.crea_una")} href={`/registro${qs}`} />
        <Link href="/para-negocios" className={claseEnlace}>
          {t("login.registrar_negocio")}
        </Link>
      </form>
    </PantallaAuth>
  );
}
