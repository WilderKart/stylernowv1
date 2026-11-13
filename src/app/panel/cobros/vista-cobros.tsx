"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { desconectarCuentaCobro, type ConexionCobros, type EstadoConexion } from "./actions";

const ESTADO: Record<EstadoConexion, { texto: string; tono: "success" | "danger" | "accent" | "neutral" }> = {
  NO_CONFIGURADO: { texto: "Sin conectar", tono: "neutral" },
  PENDIENTE: { texto: "Pendiente", tono: "accent" },
  CONECTADA: { texto: "Conectada", tono: "success" },
  EXPIRADA: { texto: "Autorización vencida", tono: "danger" },
  REVOCADA: { texto: "Desconectada", tono: "neutral" },
  ERROR: { texto: "Error", tono: "danger" },
};

function fecha(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

export function VistaCobros({
  conexion,
  aviso,
}: {
  conexion: ConexionCobros;
  aviso: { tipo: "ok" | "error"; texto: string } | null;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const e = ESTADO[conexion.estado];
  const conectada = conexion.estado === "CONECTADA";

  function desconectar() {
    if (!confirm("¿Desconectar tu cuenta? Mientras no la conectes de nuevo, tus clientes no pagarán anticipos en línea.")) return;
    setError(null);
    iniciar(async () => {
      const r = await desconectarCuentaCobro(motivo);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="poster-3 break-words">Cobros en línea</h1>
        <p className="sn-meta mt-2">
          Los anticipos, gift cards y membresías que tus clientes pagan en StylerNow entran directo a tu cuenta de
          Mercado Pago. StylerNow no recibe ni guarda ese dinero. Sin tu cuenta conectada, tus reservas se confirman
          sin anticipo en línea.
        </p>
      </header>

      {aviso ? (
        <p
          role={aviso.tipo === "error" ? "alert" : "status"}
          className={`border-2 p-3 text-[13px] font-bold ${aviso.tipo === "error" ? "border-danger text-danger" : "border-border"}`}
        >
          {aviso.texto}
        </p>
      ) : null}

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="section">Mercado Pago</h2>
          <Badge tone={e.tono}>{e.texto}</Badge>
          {conexion.entorno === "SANDBOX" ? <Badge tone="accent">Modo de prueba</Badge> : null}
        </div>

        {conectada ? (
          <ul className="m-0 list-none space-y-1 p-0 text-[13px]">
            <li>Cuenta: {conexion.cuenta ?? "—"}</li>
            <li>Conectada el {fecha(conexion.conectadaAt)}</li>
            <li>La autorización se renueva automáticamente (vence el {fecha(conexion.tokenExpiraAt)} si no se renueva).</li>
          </ul>
        ) : null}

        {conexion.estado === "EXPIRADA" || conexion.estado === "ERROR" ? (
          <p className="text-[13px] text-danger">
            Mercado Pago ya no acepta la autorización ({conexion.ultimoError ?? "sin detalle"}). Vuelve a conectar tu cuenta.
          </p>
        ) : null}

        {!conexion.integracionDisponible && !conectada ? (
          <p className="border-2 border-border p-3 text-[13px]">
            La conexión con Mercado Pago aún no está habilitada en StylerNow. Te avisaremos cuando puedas conectar tu cuenta.
          </p>
        ) : null}

        {!conectada ? (
          conexion.integracionDisponible ? (
            <Button asChild>
              {/* Ruta del servidor: crea el state de un solo uso y redirige a Mercado Pago. */}
              <a href="/api/pagos/mercadopago/conectar">Conectar mi cuenta de Mercado Pago</a>
            </Button>
          ) : (
            <Button disabled>Conectar mi cuenta de Mercado Pago</Button>
          )
        ) : (
          <div className="flex flex-col gap-2">
            <Input label="Motivo (opcional)" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
            <Button variant="danger" loading={pendiente} onClick={desconectar}>
              Desconectar cuenta
            </Button>
          </div>
        )}
        {error ? <p className="text-[13px] font-bold text-danger">{error}</p> : null}
      </Card>

      <p className="sn-meta">
        Necesitas una cuenta de Mercado Pago de vendedor verificada. Mercado Pago te cobra sus tarifas directamente.
        Los reembolsos de tus clientes salen de esta cuenta.
      </p>
    </div>
  );
}
