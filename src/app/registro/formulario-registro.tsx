"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/proveedor";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

type Campo = "email" | "password" | "confirmar" | "terminos";

/**
 * CREAR CUENTA (rediseño 2026-11-15): correo + contraseña + confirmación + aceptación legal.
 * Al crearla se envía el código de verificación y se pasa a /registro/verificar.
 * El profesional (staff) no se registra aquí: entra por invitación de su barbería.
 */
export function FormularioRegistro({ siguiente }: { siguiente: string }) {
  const t = useT();
  const router = useRouter();
  const paraNegocio = siguiente.startsWith("/panel/onboarding");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleCargando, setGoogleCargando] = useState(false);
  const [error, setError] = useState<{ campo?: Campo; texto: string } | null>(null);

  const qs = siguiente && siguiente !== "/" ? `?next=${encodeURIComponent(siguiente)}` : "";

  async function onCrear(e: React.FormEvent) {
    e.preventDefault();
    // Aviso inmediato (el servidor vuelve a validar todo).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError({ campo: "email", texto: t("auth.err_correo") });
    if (!cumpleReglas(password)) return setError({ campo: "password", texto: t("auth.err_pw") });
    if (password !== confirmar) return setError({ campo: "confirmar", texto: t("auth.no_coinciden") });
    if (!acepta) return setError({ campo: "terminos", texto: t("auth.err_terminos") });

    setLoading(true);
    setError(null);
    const res = await registrarCuenta({ email, password, confirmar, aceptaTerminos: acepta, siguiente });
    if (!res.ok) {
      setLoading(false);
      setError({ campo: res.campo, texto: res.error });
      return;
    }
    guardarVerificacion(res.email, siguiente);
    router.push(`/registro/verificar${qs}`);
  }

  async function onGoogle() {
    setGoogleCargando(true);
    setError(null);
    const res = await iniciarSesionConGoogle(siguiente);
    if (!res.ok) {
      setGoogleCargando(false);
      setError({ texto: res.error });
      return;
    }
    window.location.href = res.url;
  }

  const errorDe = (c: Campo) => (error?.campo === c ? <ErrorForm>{error.texto}</ErrorForm> : null);

  return (
    <PantallaAuth
      indice={t("auth.i_registro")}
      volver={paraNegocio ? "/para-negocios" : "/"}
      titulo={
        <>
          {paraNegocio ? t("auth.reg_neg_t1") : t("auth.reg_t1")}
          <br />
          <Hot>{paraNegocio ? t("auth.reg_neg_t2") : t("auth.reg_t2")}</Hot>
        </>
      }
      intro={paraNegocio ? t("auth.reg_intro_neg") : t("auth.reg_intro")}
    >
      <form onSubmit={onCrear} className="flex flex-col gap-4" noValidate>
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

        {error && !error.campo ? <ErrorForm>{error.texto}</ErrorForm> : null}

        <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
          <span>{t("auth.crear_cuenta")}</span>
          <ArrowUpRight className="size-[18px]" aria-hidden />
        </Button>

        <Separador>{t("login.o")}</Separador>
        <BotonGoogle texto={t("login.google_registro")} onClick={onGoogle} cargando={googleCargando} />

        <CambioPantalla pregunta={t("auth.ya_tienes")} accion={t("auth.ingresa")} href={`/login${qs}`} />
      </form>
    </PantallaAuth>
  );
}
