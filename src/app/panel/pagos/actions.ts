"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { traducirErrorPagos } from "@/lib/pagos-directos/errores";
import { createClient } from "@/lib/supabase/server";
import { exigirOperativo, MENSAJE_RESTRINGIDA } from "@/lib/suscripcion/estado-operativo";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

/**
 * Zero Trust: el negocio sale SIEMPRE del contexto resuelto en el servidor, nunca del cliente, y solo el dueño
 * (BARBERIA) llega a estas acciones. Guardian y Staff quedan fuera. La base de datos vuelve a exigirlo en cada RPC
 * (`is_barberia_de` o `is_supersu`), así que esta capa es defensa en profundidad.
 */
async function contextoDueno() {
  const contexto = await resolverContexto();
  if (!contexto.userId || contexto.rol !== "BARBERIA" || !contexto.negocioId) throw new Error("NO_AUTORIZADO");
  return { supabase: await createClient(), negocioId: contexto.negocioId, userId: contexto.userId };
}

function falla(e: unknown): { ok: false; error: string } {
  return { ok: false, error: traducirErrorPagos(e instanceof Error ? e.message : "") };
}

// ── Medios de pago ──────────────────────────────────────────────────────────

export interface MediosPago {
  activo: boolean;
  llaveBreb: string;
  nequi: string;
  daviplata: string;
  linkPago: string;
  instrucciones: string;
  qrPath: string | null;
  qrUrl: string | null;
}

export async function obtenerMediosPago(): Promise<Resultado<MediosPago>> {
  try {
    const { supabase, negocioId } = await contextoDueno();
    const { data, error } = await supabase
      .from("negocio_medio_pago_directo")
      .select("activo, llave_breb, nequi, daviplata, link_pago, instrucciones, qr_path")
      .eq("negocio_id", negocioId)
      .maybeSingle();
    if (error) return { ok: false, error: "No pudimos cargar tus medios de pago." };
    let qrUrl: string | null = null;
    if (data?.qr_path) {
      const { data: firmada } = await supabase.storage.from("pagos-directos").createSignedUrl(data.qr_path, 3600);
      qrUrl = firmada?.signedUrl ?? null;
    }
    return {
      ok: true,
      data: {
        activo: data?.activo ?? false,
        llaveBreb: data?.llave_breb ?? "",
        nequi: data?.nequi ?? "",
        daviplata: data?.daviplata ?? "",
        linkPago: data?.link_pago ?? "",
        instrucciones: data?.instrucciones ?? "",
        qrPath: data?.qr_path ?? null,
        qrUrl,
      },
    };
  } catch (e) {
    return falla(e);
  }
}

export async function guardarMediosPago(f: {
  activo: boolean; llaveBreb: string; nequi: string; daviplata: string; linkPago: string; instrucciones: string;
}): Promise<Resultado> {
  try {
    const { supabase, negocioId, userId } = await contextoDueno();
    const op = await exigirOperativo(negocioId);
    if (!op.ok) return { ok: false, error: MENSAJE_RESTRINGIDA };

    const limpio = (v: string) => v.trim() || null;
    const llave = limpio(f.llaveBreb), nequi = limpio(f.nequi), daviplata = limpio(f.daviplata);
    const link = limpio(f.linkPago), instrucciones = limpio(f.instrucciones);
    if ((llave?.length ?? 0) > 60) return { ok: false, error: "La llave Bre-B es demasiado larga (máximo 60 caracteres)." };
    if ((nequi?.length ?? 0) > 30 || (daviplata?.length ?? 0) > 30) return { ok: false, error: "El número de Nequi o Daviplata es demasiado largo." };
    if (link && !/^https:\/\//i.test(link)) return { ok: false, error: "El link de pago debe empezar por https://" };
    if ((link?.length ?? 0) > 300) return { ok: false, error: "El link de pago es demasiado largo." };
    if ((instrucciones?.length ?? 0) > 500) return { ok: false, error: "Las instrucciones no pueden superar 500 caracteres." };

    const { data: actual } = await supabase.from("negocio_medio_pago_directo").select("qr_path").eq("negocio_id", negocioId).maybeSingle();
    if (f.activo && !(llave || nequi || daviplata || link || actual?.qr_path)) {
      return { ok: false, error: "Para activar los pagos directos agrega al menos un medio: llave Bre-B, Nequi, Daviplata, link o QR." };
    }

    const { error } = await supabase.from("negocio_medio_pago_directo").upsert(
      {
        negocio_id: negocioId, activo: f.activo, llave_breb: llave, nequi, daviplata, link_pago: link,
        instrucciones, updated_by: userId, updated_at: new Date().toISOString(),
      },
      { onConflict: "negocio_id" }
    );
    if (error) return { ok: false, error: "No pudimos guardar los medios de pago. Revisa los datos e intenta de nuevo." };
    revalidatePath("/panel/pagos");
    return { ok: true };
  } catch (e) {
    return falla(e);
  }
}

/** Sube el QR (imagen ya comprimida en el navegador) al bucket privado y reemplaza el anterior. */
export async function subirQrPago(dataUrl: string): Promise<Resultado> {
  try {
    const { supabase, negocioId } = await contextoDueno();
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) return { ok: false, error: "Usa una imagen PNG, JPG o WebP." };
    const [, mime, base64] = match;
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > 2 * 1024 * 1024) return { ok: false, error: "El QR no puede superar 2 MB." };
    const firmaOk =
      (mime === "image/png" && bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) ||
      (mime === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
      (mime === "image/webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP");
    if (!firmaOk) return { ok: false, error: "El archivo no es una imagen válida." };

    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const ruta = `${negocioId}/qr/qr-${Date.now()}.${ext}`;
    const { error: eUp } = await supabase.storage.from("pagos-directos").upload(ruta, bytes, { contentType: mime });
    if (eUp) return { ok: false, error: "No pudimos subir el QR. Intenta de nuevo." };

    const { data: previo } = await supabase.from("negocio_medio_pago_directo").select("qr_path").eq("negocio_id", negocioId).maybeSingle();
    const { error } = await supabase.from("negocio_medio_pago_directo").upsert(
      { negocio_id: negocioId, qr_path: ruta, updated_at: new Date().toISOString() },
      { onConflict: "negocio_id" }
    );
    if (error) {
      await supabase.storage.from("pagos-directos").remove([ruta]);
      return { ok: false, error: "No pudimos guardar el QR. Intenta de nuevo." };
    }
    if (previo?.qr_path) await supabase.storage.from("pagos-directos").remove([previo.qr_path]);
    revalidatePath("/panel/pagos");
    return { ok: true };
  } catch (e) {
    return falla(e);
  }
}

export async function quitarQrPago(): Promise<Resultado> {
  try {
    const { supabase, negocioId } = await contextoDueno();
    const { data: previo } = await supabase
      .from("negocio_medio_pago_directo")
      .select("qr_path, activo, llave_breb, nequi, daviplata, link_pago")
      .eq("negocio_id", negocioId)
      .maybeSingle();
    if (!previo?.qr_path) return { ok: true };
    if (previo.activo && !(previo.llave_breb || previo.nequi || previo.daviplata || previo.link_pago)) {
      return { ok: false, error: "Es tu único medio de pago activo. Agrega otro o desactiva los pagos directos antes de quitar el QR." };
    }
    const { error } = await supabase
      .from("negocio_medio_pago_directo")
      .update({ qr_path: null, updated_at: new Date().toISOString() })
      .eq("negocio_id", negocioId);
    if (error) return { ok: false, error: "No pudimos quitar el QR." };
    await supabase.storage.from("pagos-directos").remove([previo.qr_path]);
    revalidatePath("/panel/pagos");
    return { ok: true };
  } catch (e) {
    return falla(e);
  }
}

// ── Bandeja "Pagos por revisar" ─────────────────────────────────────────────

export interface PagoPorRevisar {
  id: string;
  reservaId: string;
  estadoReserva: string;
  horaInicio: string;
  clienteNombre: string;
  montoEsperado: number;
  montoReportado: number;
  referencia: string | null;
  comprobanteUrl: string | null;
  creadoEn: string;
}

export async function listarPagosPorRevisar(): Promise<Resultado<PagoPorRevisar[]>> {
  try {
    const { supabase, negocioId } = await contextoDueno();
    const { data, error } = await supabase
      .from("pago_reserva")
      .select("id, reserva_id, monto_esperado, monto_reportado, referencia_corta, comprobante_url, created_at, reserva:reserva_id (hora_inicio, estado, cliente:cliente_id (nombre))")
      .eq("negocio_id", negocioId)
      .eq("estado", "REPORTADO")
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) return { ok: false, error: "No pudimos cargar los pagos por revisar." };
    // Embebidos reserva→cliente: el cliente de tipos los infiere como objeto, no lista (FK muchos-a-uno).
    const filas = (data ?? []) as unknown as {
      id: string; reserva_id: string; monto_esperado: number; monto_reportado: number; referencia_corta: string | null;
      comprobante_url: string | null; created_at: string;
      reserva: { hora_inicio: string; estado: string; cliente: { nombre: string } | null } | null;
    }[];
    const rutas = filas.map((p) => p.comprobante_url).filter((r): r is string => !!r);
    const firmadas = new Map<string, string>();
    if (rutas.length > 0) {
      const { data: urls } = await supabase.storage.from("pagos-directos").createSignedUrls(rutas, 900);
      for (const u of urls ?? []) if (u.path && u.signedUrl) firmadas.set(u.path, u.signedUrl);
    }
    return {
      ok: true,
      data: filas.map((p) => ({
        id: p.id,
        reservaId: p.reserva_id,
        estadoReserva: p.reserva?.estado ?? "",
        horaInicio: p.reserva?.hora_inicio ?? p.created_at,
        clienteNombre: p.reserva?.cliente?.nombre ?? "Cliente",
        montoEsperado: Number(p.monto_esperado),
        montoReportado: Number(p.monto_reportado),
        referencia: p.referencia_corta,
        comprobanteUrl: p.comprobante_url ? (firmadas.get(p.comprobante_url) ?? null) : null,
        creadoEn: p.created_at,
      })),
    };
  } catch (e) {
    return falla(e);
  }
}

export async function contarPagosPorRevisar(negocioId: string): Promise<number> {
  try {
    const contexto = await resolverContexto();
    if (contexto.rol !== "BARBERIA" || contexto.negocioId !== negocioId) return 0;
    const supabase = await createClient();
    const { count } = await supabase
      .from("pago_reserva")
      .select("id", { count: "exact", head: true })
      .eq("negocio_id", negocioId)
      .eq("estado", "REPORTADO");
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ── Acciones exclusivas del dueño (cada una la vuelve a exigir la RPC) ──────

export async function verificarPago(pagoId: string): Promise<Resultado> {
  try {
    const { supabase } = await contextoDueno();
    const { error } = await supabase.rpc("verificar_pago_reserva", { p_pago_id: pagoId });
    if (error) return falla(new Error(error.message));
    revalidatePath("/panel/pagos");
    revalidatePath("/panel");
    return { ok: true };
  } catch (e) {
    return falla(e);
  }
}

export async function anularCitaPorPago(reservaId: string, motivo: string): Promise<Resultado> {
  try {
    const { supabase } = await contextoDueno();
    const { error } = await supabase.rpc("anular_cita_por_pago_invalido", { p_reserva_id: reservaId, p_motivo: motivo });
    if (error) return falla(new Error(error.message));
    revalidatePath("/panel/pagos");
    revalidatePath("/panel/agenda");
    return { ok: true };
  } catch (e) {
    return falla(e);
  }
}

export async function marcarPagoNoRecibido(pagoId: string, motivo: string): Promise<Resultado<{ saldo: number }>> {
  try {
    const { supabase } = await contextoDueno();
    const { data, error } = await supabase.rpc("marcar_pago_no_recibido_post_cita", { p_pago_id: pagoId, p_motivo: motivo });
    if (error) return falla(new Error(error.message));
    revalidatePath("/panel/pagos");
    revalidatePath("/panel/crm");
    return { ok: true, data: { saldo: Number(data ?? 0) } };
  } catch (e) {
    return falla(e);
  }
}

export async function ajustarSaldoCliente(
  clienteId: string, nuevoSaldo: number, motivo: string, tipo: "AJUSTE" | "ABONO" | "CONDONACION"
): Promise<Resultado<{ saldo: number }>> {
  try {
    const { supabase, negocioId } = await contextoDueno();
    if (!Number.isFinite(nuevoSaldo) || nuevoSaldo < 0) return { ok: false, error: "El saldo no puede ser negativo." };
    const { data, error } = await supabase.rpc("ajustar_saldo_pendiente_cliente", {
      p_negocio_id: negocioId, p_cliente_id: clienteId, p_nuevo_saldo: nuevoSaldo, p_motivo: motivo, p_tipo: tipo,
    });
    if (error) return falla(new Error(error.message));
    revalidatePath("/panel/crm");
    return { ok: true, data: { saldo: Number(data ?? nuevoSaldo) } };
  } catch (e) {
    return falla(e);
  }
}

/** Saldo pendiente de un cliente en ESTE negocio (para el CRM). */
export async function obtenerSaldoCliente(clienteId: string): Promise<number> {
  try {
    const contexto = await resolverContexto();
    if (!contexto.userId || !contexto.negocioId || (contexto.rol !== "BARBERIA" && contexto.rol !== "GUARDIAN")) return 0;
    const supabase = await createClient();
    const { data } = await supabase.rpc("saldo_pendiente_cliente", { p_negocio_id: contexto.negocioId, p_cliente_id: clienteId });
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}
