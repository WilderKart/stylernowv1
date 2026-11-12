"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { Chip, ChipGroup, Panel, Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIAS_NEGOCIO } from "@/lib/categorias-negocio";
import { CODIGOS_PAIS, separarTelefono } from "@/lib/codigos-pais";
import { Check, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/proveedor";
import type { Clave } from "@/lib/i18n/diccionario";
import { actualizarPerfil, cerrarSesion } from "./actions";

export function FormularioPerfil({
  nombreInicial,
  telefonoInicial,
  fechaNacimientoInicial,
  categoriasInicial,
  email,
  bienvenida,
}: {
  nombreInicial: string;
  telefonoInicial: string;
  fechaNacimientoInicial: string;
  categoriasInicial: string[];
  email: string;
  bienvenida: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const telefonoSeparado = separarTelefono(telefonoInicial);

  const [nombre, setNombre] = useState(nombreInicial);
  const [codigoPais, setCodigoPais] = useState(telefonoSeparado.codigo);
  const [telefonoLocal, setTelefonoLocal] = useState(telefonoSeparado.local);
  // Cumpleaños: solo día y mes (se pide con calidez y no se exige el año). Si la persona ya tenía una fecha
  // completa guardada se conserva su año; si no, se guarda con un año de referencia (bisiesto, para admitir 29/02).
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaNacimientoInicial);
  const anioGuardado = partes ? partes[1] : "2000";
  const [mes, setMes] = useState(partes ? String(Number(partes[2])) : "");
  const [dia, setDia] = useState(partes ? String(Number(partes[3])) : "");
  const [categorias, setCategorias] = useState<string[]>(categoriasInicial);
  const diasDelMes = mes ? new Date(2000, Number(mes), 0).getDate() : 31;
  const fechaNacimiento = mes && dia ? `${anioGuardado}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}` : "";

  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  // Solo el nombre es obligatorio para usar la app — el resto suma para
  // recordatorios, promociones relevantes y futuros beneficios de puntos,
  // nunca bloquea nada si se deja vacío.
  const faltantes = [
    !telefonoLocal && t("fp.celular"),
    !fechaNacimiento && t("fp.cumple"),
    categorias.length === 0 && t("fp.intereses"),
  ].filter(Boolean) as string[];

  function alternarCategoria(valor: string) {
    setCategorias((prev) => (prev.includes(valor) ? prev.filter((c) => c !== valor) : [...prev, valor]));
  }

  async function onGuardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setGuardado(false);
    const res = await actualizarPerfil({
      nombre,
      codigoPais,
      telefonoLocal,
      fechaNacimiento,
      categoriasInteres: categorias,
    });
    setGuardando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setGuardado(true);
    router.refresh();
  }

  async function onCerrarSesion() {
    setCerrando(true);
    await cerrarSesion();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {bienvenida ? (
        <div className="border-2 border-border bg-signal p-4 text-ink shadow-hard">
          <h3 className="section">{t("fp.bienvenido")}</h3>
          <p className="body-sm mt-1.5 break-words">
            {t("fp.bienvenido_txt")}
          </p>
        </div>
      ) : null}

      {faltantes.length > 0 ? (
        <Panel className="p-4">
          <p className="sn-label flex items-center gap-2">
            <Star aria-hidden className="size-4" />
            {t("fp.suma_puntos")}
          </p>
          <p className="body-sm mt-2 break-words">
            {t("fp.te_falta", { lista: faltantes.join(", ") })}
          </p>
        </Panel>
      ) : null}

      <form onSubmit={onGuardar} className="flex flex-col gap-4">
        <Input
          label={t("fp.nombre")}
          required
          minLength={2}
          maxLength={80}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Input label={t("fp.correo")} value={email} disabled />

        <div className="flex flex-col gap-2">
          <label htmlFor="perfil-telefono" className="sn-label">
            {t("fp.celular_wa")}
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              value={codigoPais}
              onChange={(e) => setCodigoPais(e.target.value)}
              aria-label={t("fp.codigo_pais")}
              className="min-h-12 shrink-0 border-2 border-border bg-bg px-2.5 text-[15px] text-text outline-none focus:shadow-hard"
            >
              {CODIGOS_PAIS.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.bandera} {c.codigo}
                </option>
              ))}
            </select>
            <input
              id="perfil-telefono"
              type="tel"
              inputMode="numeric"
              placeholder="300 000 0000"
              value={telefonoLocal}
              onChange={(e) => setTelefonoLocal(e.target.value.replace(/\D/g, ""))}
              className="min-h-12 min-w-0 flex-1 basis-40 border-2 border-border bg-bg px-3 text-[15px] text-text outline-none placeholder:text-text-muted focus:shadow-hard"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span id="perfil-cumple" className="sn-label">
            {t("fp.cuando_cumples")}
          </span>
          <div className="flex gap-2" role="group" aria-labelledby="perfil-cumple">
            <select
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              aria-label={t("fp.dia_aria")}
              className="min-h-12 min-w-0 flex-1 border-2 border-border bg-bg px-2.5 text-[15px] text-text outline-none focus:shadow-hard"
            >
              <option value="">{t("fp.dia")}</option>
              {Array.from({ length: diasDelMes }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={mes}
              onChange={(e) => {
                setMes(e.target.value);
                const max = e.target.value ? new Date(2000, Number(e.target.value), 0).getDate() : 31;
                if (Number(dia) > max) setDia(String(max)); // p. ej. 31 → 30 al elegir abril
              }}
              aria-label={t("fp.mes_aria")}
              className="min-h-12 min-w-0 flex-[2] border-2 border-border bg-bg px-2.5 text-[15px] text-text outline-none focus:shadow-hard"
            >
              <option value="">{t("fp.mes")}</option>
              {(["mes.1", "mes.2", "mes.3", "mes.4", "mes.5", "mes.6", "mes.7", "mes.8", "mes.9", "mes.10", "mes.11", "mes.12"] as const).map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {t(m)}
                </option>
              ))}
            </select>
          </div>
          <p className="sn-help">{t("fp.cumple_ayuda")}</p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="sn-label">{t("fp.que_te_interesa")}</span>
          <ChipGroup>
            {CATEGORIAS_NEGOCIO.map((c) => (
              <Chip key={c.valor} selected={categorias.includes(c.valor)} onClick={() => alternarCategoria(c.valor)}>
                {t(`catn.${c.valor}` as Clave)}
              </Chip>
            ))}
          </ChipGroup>
          <p className="sn-help">{t("fp.intereses_ayuda")}</p>
        </div>

        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
        {guardado ? (
          <Status tone="ok" role="status" icon={<Check aria-hidden className="size-3.5" />}>
            {t("fp.guardado")}
          </Status>
        ) : null}

        <Button type="submit" size="lg" loading={guardando} className="w-full">
          {t("fp.guardar_cambios")}
        </Button>
      </form>

      <Button variant="secondary" size="lg" loading={cerrando} onClick={onCerrarSesion} className="w-full">
        {t("comun.cerrar_sesion")}
      </Button>
    </div>
  );
}
