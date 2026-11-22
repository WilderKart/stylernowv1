"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Casilla } from "@/components/privacidad/casilla";
import { useT } from "@/lib/i18n/proveedor";
import { EJEMPLO_NACIONAL, INDICATIVO, type PaisRegistro } from "@/lib/telefono-registro";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CasillaLegal } from "./_componentes/campos";
import { ErrorForm, Hot, PantallaAuth } from "./_componentes/pantalla-auth";
import { cancelarRegistro, crearCuentaRegistro } from "./registro-actions";

/**
 * COMPLETA TU PERFIL: último paso de toda cuenta nueva (verificada por código o creada con Google).
 * Mientras no se complete, el proxy deja la sesión solo en /login, /auth y /legal (migración 127).
 * `pedirAceptacion`: la cuenta llegó por Google y aún no aceptó Términos y Política de Datos.
 */
export function CompletarPerfil({ email, siguiente, pedirAceptacion }: { email: string; siguiente: string; pedirAceptacion: boolean }) {
  const t = useT();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [pais, setPais] = useState("CO");
  const [telefono, setTelefono] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGuardar(e: React.FormEvent) {
    e.preventDefault();
    if (pedirAceptacion && !acepta) {
      setError(t("auth.err_terminos"));
      return;
    }
    setLoading(true);
    setError(null);
    const res = await crearCuentaRegistro(nombre, pais, telefono, marketing, acepta, siguiente);
    if (!res.ok) {
      setLoading(false);
      setError(res.error);
      return;
    }
    // Navegación completa: la caché del router guardaba «destino → /login» de cuando el perfil estaba
    // pendiente y, con router.replace, volvía a /login en bucle (encontrado en la prueba local).
    window.location.assign(res.pendientesLegales ? `/legal/aceptar?next=${encodeURIComponent(res.destino)}` : res.destino);
  }

  async function onSalir() {
    setLoading(true);
    await cancelarRegistro();
    router.replace("/login");
    router.refresh();
  }

  return (
    <PantallaAuth
      indice={t("auth.i_perfil")}
      onVolver={onSalir}
      titulo={
        <>
          {t("auth.perfil_t1")}
          <br />
          <Hot>{t("auth.perfil_t2")}</Hot>
        </>
      }
      intro={t("auth.perfil_intro")}
    >
      <form onSubmit={onGuardar} className="flex flex-col gap-3.5">
        <Input label={t("auth.perfil_correo")} type="email" value={email} readOnly />
        <Input
          label={t("login.reg_nombre")}
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          placeholder={t("login.reg_nombre_ph")}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="registro-pais" className="font-mono text-xs leading-4 font-bold tracking-[0.72px] text-text uppercase">
            {t("login.reg_pais")}
          </label>
          <div className="relative">
            <select
              id="registro-pais"
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              className="min-h-12 w-full appearance-none border-2 border-border bg-bg py-0 pr-11 pl-3 text-[15px] text-text outline-none focus:shadow-hard"
            >
              <option value="CO">{t("login.pais_co")}</option>
              <option value="US">{t("login.pais_us")}</option>
              <option value="MX">{t("login.pais_mx")}</option>
              <option value="ES">{t("login.pais_es")}</option>
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute top-3.5 right-3.5 size-5" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="registro-telefono" className="font-mono text-xs leading-4 font-bold tracking-[0.72px] text-text uppercase">
            {t("login.reg_telefono")}
          </label>
          <div className="flex min-h-12 w-full border-2 border-border bg-bg focus-within:shadow-hard">
            <span className="flex items-center border-r-2 border-border px-3 font-mono text-[15px] text-text" aria-hidden>
              {INDICATIVO[pais as PaisRegistro] ?? ""}
            </span>
            <input
              id="registro-telefono"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              maxLength={20}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder={EJEMPLO_NACIONAL[pais as PaisRegistro] ?? ""}
              aria-describedby="registro-telefono-ayuda"
              className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-text outline-none"
            />
          </div>
          <p id="registro-telefono-ayuda" className="m-0 text-[12.5px] text-text-muted">
            {t("login.reg_telefono_ayuda")}
          </p>
        </div>
        {pedirAceptacion ? <CasillaLegal checked={acepta} onChange={setAcepta} /> : null}
        <Casilla caja checked={marketing} onChange={setMarketing} etiqueta={t("login.opcional")} descripcion={t("login.marketing")} className="mt-1" />
        {error ? <ErrorForm>{error}</ErrorForm> : null}
        <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
          <span>{t("auth.guardar_continuar")}</span>
          <ArrowUpRight className="size-[18px]" aria-hidden />
        </Button>
      </form>
    </PantallaAuth>
  );
}
