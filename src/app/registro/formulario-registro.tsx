"use client";

import { Turnstile, type ControlTurnstile } from "@/components/seguridad/turnstile";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/proveedor";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  BotonGoogle,
  CambioPantalla,
  CampoContrasena,
  CasillaLegal,
  Coincidencia,
  RequisitosContrasena,
  cumpleReglas,
  guardarVerificacion,
} from "../login/_componentes/campos";
import { ErrorForm, Hot, PantallaAuth, Separador } from "../login/_componentes/pantalla-auth";
import { iniciarSesionConGoogle, registrarCuenta } from "../login/actions";
import { SelectorServicio } from "./selector-servicio";
import { AuthDividido, fijarAspectoActual } from "@/components/auth/auth-dividido";
import type { CategoriaRegistro } from "@/lib/tema/vertical";
import { SelectorTipoCuenta, type TipoCuenta } from "./tipo-cuenta";

type Campo = "tipo" | "categoria" | "email" | "password" | "confirmar" | "terminos";

/**
 * CREAR CUENTA (rediseño 2026-11-16): tipo de cuenta (cliente o negocio) + correo + contraseña +
 * confirmación + aceptación legal. Al crearla se envía el código de verificación y se pasa a
 * /registro/verificar. El tipo solo decide el recorrido (negocio → onboarding); el servidor lo
 * valida y arma el destino, y nunca lo trata como permiso.
 * Con `invitacion` (Staff invitado): correo del invitado BLOQUEADO, sin selector de tipo ni Google;
 * el servidor vuelve a leer la invitación y usa SU correo, nunca el del formulario.
 */
export function FormularioRegistro({
  siguiente,
  tipoInicial,
  invitacion,
}: {
  siguiente: string;
  tipoInicial: TipoCuenta | null;
  invitacion?: { id: string; email: string; negocio: string } | null;
}) {
  const t = useT();
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoCuenta | null>(tipoInicial);
  const [categoria, setCategoria] = useState<CategoriaRegistro | null>(null);
  const [email, setEmail] = useState(invitacion?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleCargando, setGoogleCargando] = useState(false);
  const [error, setError] = useState<{ campo?: Campo; texto: string } | null>(null);
  const [tokenTs, setTokenTs] = useState<string | null>(null);
  const controlTs = useRef<ControlTurnstile>(null);

  const qs = siguiente && siguiente !== "/" ? `?next=${encodeURIComponent(siguiente)}` : "";

  async function onCrear(e: React.FormEvent) {
    e.preventDefault();
    // Aviso inmediato (el servidor vuelve a validar todo).
    if (!tipo && !invitacion) {
      document.getElementById("tipo-cuenta")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return setError({ campo: "tipo", texto: t("auth.err_tipo") });
    }
    if (tipo === "negocio" && !categoria && !invitacion) {
      document.getElementById("servicio-registro")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return setError({ campo: "categoria", texto: t("auth.err_cat_neg") });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError({ campo: "email", texto: t("auth.err_correo") });
    if (!cumpleReglas(password)) return setError({ campo: "password", texto: t("auth.err_pw") });
    if (password !== confirmar) return setError({ campo: "confirmar", texto: t("auth.no_coinciden") });
    if (!acepta) return setError({ campo: "terminos", texto: t("auth.err_terminos") });
    if (!tokenTs) return setError({ texto: t("auth.err_verificando") });

    setLoading(true);
    setError(null);
    const res = await registrarCuenta({
      tipo: invitacion ? "staff" : tipo,
      categoria: invitacion ? undefined : categoria,
      email,
      password,
      confirmar,
      aceptaTerminos: acepta,
      siguiente,
      turnstile: tokenTs,
      invitacion: invitacion?.id,
    });
    // Cada token sirve una sola vez: se pide uno nuevo por si hay que reintentar.
    controlTs.current?.reiniciar();
    if (!res.ok) {
      setLoading(false);
      setError({ campo: res.campo, texto: res.error });
      return;
    }
    // El destino lo devuelve el servidor (negocio → onboarding); viaja por sessionStorage, no por la URL.
    fijarAspectoActual();
    guardarVerificacion(res.email, res.siguiente);
    router.push(`/registro/verificar${res.siguiente !== "/" ? `?next=${encodeURIComponent(res.siguiente)}` : ""}`);
  }

  async function onGoogle() {
    // Con Google también hay que elegir antes el tipo: el servidor arma el destino a partir de él.
    if (!tipo) {
      document.getElementById("tipo-cuenta")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return setError({ campo: "tipo", texto: t("auth.err_tipo") });
    }
    setGoogleCargando(true);
    setError(null);
    if (tipo === "negocio" && !categoria) {
      document.getElementById("servicio-registro")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return setError({ campo: "categoria", texto: t("auth.err_cat_neg") });
    }
    const res = await iniciarSesionConGoogle(siguiente, tipo, categoria);
    if (!res.ok) {
      setGoogleCargando(false);
      setError({ texto: res.error });
      return;
    }
    window.location.href = res.url;
  }

  const errorDe = (c: Campo) => (error?.campo === c ? <ErrorForm>{error.texto}</ErrorForm> : null);

  return (
    <AuthDividido categoria={categoria} viva>
    <PantallaAuth
      indice={t("auth.i_registro")}
      volver={tipoInicial === "negocio" ? "/para-negocios" : "/"}
      titulo={
        <>
          {t("auth.reg_t1")}
          <br />
          <Hot>{t("auth.reg_t2")}</Hot>
        </>
      }
      intro={invitacion ? `Te uniste por invitación de ${invitacion.negocio}. Crea tu cuenta con el correo invitado y verifícalo.` : t("auth.reg_intro")}
    >
      <form onSubmit={onCrear} className="flex flex-col gap-4" noValidate>
        {invitacion ? null : (
        <div id="tipo-cuenta" className="mb-1 flex scroll-mt-20 flex-col gap-2">
          <SelectorTipoCuenta
            valor={tipo}
            onChange={(v) => {
              setTipo(v);
              if (error?.campo === "tipo") setError(null);
            }}
            error={error?.campo === "tipo"}
            idError="error-tipo"
          />
          {error?.campo === "tipo" ? <ErrorForm className="mt-1" >{error.texto}</ErrorForm> : null}
        </div>
        )}

        {tipo && !invitacion ? (
          <div className="flex flex-col gap-2">
            <SelectorServicio
              tipo={tipo}
              valor={categoria}
              onChange={(v) => {
                setCategoria(v);
                if (error?.campo === "categoria") setError(null);
              }}
              error={error?.campo === "categoria"}
              idError="error-categoria"
            />
            {error?.campo === "categoria" ? <ErrorForm className="mt-1">{error.texto}</ErrorForm> : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
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
            readOnly={Boolean(invitacion)}
            aria-readonly={Boolean(invitacion) || undefined}
            aria-invalid={error?.campo === "email" || undefined}
          />
          {errorDe("email")}
        </div>

        <div className="flex flex-col gap-2">
          <CampoContrasena
            label={t("login.contrasena")}
            name="new-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            error={error?.campo === "password"}
            describedBy="requisitos-contrasena"
          />
          <RequisitosContrasena password={password} id="requisitos-contrasena" />
          {errorDe("password")}
        </div>

        <div className="flex flex-col gap-2">
          <CampoContrasena
            label={t("auth.confirmar")}
            name="confirm-password"
            value={confirmar}
            onChange={setConfirmar}
            autoComplete="new-password"
            error={error?.campo === "confirmar"}
          />
          <Coincidencia password={password} confirmar={confirmar} />
          {errorDe("confirmar")}
        </div>

        <div className="flex flex-col gap-2">
          <CasillaLegal checked={acepta} onChange={setAcepta} error={error?.campo === "terminos"} />
          {errorDe("terminos")}
        </div>

        <Turnstile ref={controlTs} accion="registro" onToken={setTokenTs} />
        {error && !error.campo ? <ErrorForm>{error.texto}</ErrorForm> : null}

        <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
          <span>{t("auth.crear_cuenta")}</span>
          <ArrowUpRight className="size-[18px]" aria-hidden />
        </Button>

        {invitacion ? null : (
          <>
            <Separador>{t("login.o")}</Separador>
            <BotonGoogle texto={t("login.google_registro")} onClick={onGoogle} cargando={googleCargando} />
            <CambioPantalla pregunta={t("auth.ya_tienes")} accion={t("auth.ingresa")} href={`/login${qs}`} />
          </>
        )}
      </form>
    </PantallaAuth>
    </AuthDividido>
  );
}
