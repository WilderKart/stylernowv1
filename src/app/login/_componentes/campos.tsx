"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/proveedor";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Check, Eye, EyeOff, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/** Campo de contraseña con botón para mostrarla u ocultarla (mismo estilo que `Input`). */
export function CampoContrasena({
  label,
  value,
  onChange,
  autoComplete,
  error,
  describedBy,
  name,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  error?: boolean;
  describedBy?: string;
  name?: string;
}) {
  const t = useT();
  const id = React.useId();
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-mono text-xs leading-4 font-bold tracking-[0.72px] text-text uppercase">
        {label}
      </label>
      <div className={cn("flex min-h-12 w-full border-2 border-border bg-bg focus-within:shadow-hard", error && "border-danger")}>
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error || undefined}
          aria-describedby={describedBy}
          className="min-w-0 flex-1 bg-transparent px-3 text-[15px] leading-[22px] text-text outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="grid w-12 shrink-0 place-items-center border-l-2 border-border text-text hover:bg-surface focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--focus)]"
          aria-label={visible ? t("auth.ocultar") : t("auth.mostrar")}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

/** Mismas reglas que `PASSWORD_SCHEMA` (src/lib/auth/password.ts); el servidor es quien decide. */
export const REGLAS_PASSWORD = [
  { clave: "auth.req_largo", ok: (p: string) => p.length >= 8 },
  { clave: "auth.req_mayus", ok: (p: string) => /[A-Z]/.test(p) },
  { clave: "auth.req_minus", ok: (p: string) => /[a-z]/.test(p) },
  { clave: "auth.req_numero", ok: (p: string) => /[0-9]/.test(p) },
  { clave: "auth.req_simbolo", ok: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export const cumpleReglas = (p: string) => REGLAS_PASSWORD.every((r) => r.ok(p));

/** Lista de requisitos que se marca a medida que se escribe. */
export function RequisitosContrasena({ password, id }: { password: string; id?: string }) {
  const t = useT();
  return (
    <div id={id} className="border-2 border-border px-3 py-2.5">
      <p className="sn-meta mb-1.5">{t("auth.req_titulo")}</p>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {REGLAS_PASSWORD.map((r) => {
          const ok = r.ok(password);
          return (
            <li key={r.clave} className={cn("flex items-center gap-2 text-[13px]", ok ? "text-text" : "text-text-muted")}>
              <span
                aria-hidden
                className={cn("grid size-4 shrink-0 place-items-center border-2", ok ? "border-ink bg-signal text-ink" : "border-border")}
              >
                {ok ? <Check className="size-3" /> : null}
              </span>
              <span>{t(r.clave)}</span>
              <span className="sr-only">{ok ? "✓" : "✗"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Aviso en vivo de coincidencia entre contraseña y confirmación (solo cuando ya se escribió algo). */
export function Coincidencia({ password, confirmar }: { password: string; confirmar: string }) {
  const t = useT();
  if (!confirmar) return null;
  const ok = password === confirmar;
  return (
    <p className={cn("flex items-center gap-2 text-[13px]", ok ? "text-text" : "text-[var(--accent-text)]")} aria-live="polite">
      {ok ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
      {ok ? t("auth.coinciden") : t("auth.no_coinciden")}
    </p>
  );
}

/** Casilla obligatoria de Términos y Política de Tratamiento de Datos. */
export function CasillaLegal({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: boolean }) {
  const t = useT();
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 border-2 border-border p-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
        error && "border-danger"
      )}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="grid size-6 flex-none place-items-center border-2 border-border text-ink peer-checked:bg-signal [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
      >
        <Check className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="body-sm break-words">
          {t("login.acepto_1")}{" "}
          <Link href="/legal/terminos" target="_blank" className="font-bold underline underline-offset-2">
            {t("login.terminos")}
          </Link>{" "}
          {t("login.y_la")}{" "}
          <Link href="/legal/politica-de-datos" target="_blank" className="font-bold underline underline-offset-2">
            {t("login.politica_datos")}
          </Link>{" "}
          {t("login.de_stylernow")}
        </span>
        <span className="sn-meta text-[var(--accent-text)]">{t("login.obligatoria")}</span>
      </span>
    </label>
  );
}

/** Botón de Google (secundario: la acción principal de cada pantalla es la del correo). */
export function BotonGoogle({ texto, onClick, cargando }: { texto: string; onClick: () => void; cargando?: boolean }) {
  return (
    <Button type="button" variant="secondary" size="lg" onClick={onClick} loading={cargando} className="w-full justify-between">
      <span className="flex items-center gap-3">
        {/* Logo "G" de Google en sus colores oficiales. */}
        <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {texto}
      </span>
      <ArrowUpRight className="size-[18px]" aria-hidden />
    </Button>
  );
}

/** Aviso informativo (no error): bloque con borde naranja. */
export function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="border-2 border-l-8 border-[var(--accent)] px-3 py-2 text-[13.5px] text-text">
      {children}
    </p>
  );
}

/** Enlace de cambio de pantalla al pie: «¿Ya tienes cuenta? INGRESA ↗». */
export function CambioPantalla({ pregunta, accion, href }: { pregunta: string; accion: string; href: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 border-t-2 border-border pt-4 text-[14px] text-text-muted">
      {pregunta}
      <Link href={href} className="sn-label inline-flex min-h-12 items-center text-text underline-offset-4 hover:underline">
        {accion}
      </Link>
    </p>
  );
}

/** "ab•••@dominio.com": muestra lo justo para reconocer el correo. */
export function enmascararCorreo(email: string) {
  const [usuario, dominio] = email.split("@");
  if (!usuario || !dominio) return email;
  const visibles = usuario.length <= 2 ? usuario.slice(0, 1) : usuario.slice(0, 2);
  return `${visibles}${"•".repeat(Math.max(3, usuario.length - visibles.length))}@${dominio}`;
}

/** Correo y destino de la verificación pendiente: sobrevive a cambiar de pestaña o recargar. */
export const CLAVE_VERIFICACION = "stylernow_verificacion";
export function guardarVerificacion(email: string, siguiente: string) {
  try {
    sessionStorage.setItem(CLAVE_VERIFICACION, JSON.stringify({ email, siguiente, en: Date.now() }));
  } catch {
    /* navegación privada o cuota: la pantalla pide el correo */
  }
}
export function leerVerificacion(): { email: string; siguiente: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(CLAVE_VERIFICACION) ?? "null") as { email?: string; siguiente?: string } | null;
    return v?.email ? { email: v.email, siguiente: v.siguiente ?? "/" } : null;
  } catch {
    return null;
  }
}
export function borrarVerificacion() {
  try {
    sessionStorage.removeItem(CLAVE_VERIFICACION);
  } catch {
    /* no crítico */
  }
}
