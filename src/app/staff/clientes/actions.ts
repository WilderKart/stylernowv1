"use server";

import { createClient } from "@/lib/supabase/server";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export interface ClienteAtendido {
  clienteId: string;
  nombre: string;
  telefono: string | null;
  visitas: number;
  ultimaVisita: string;
  servicios: string[];
}

export async function listarMisClientes(): Promise<Resultado<ClienteAtendido[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("NO_AUTENTICADO");

    const { data, error } = await supabase
      .from("reserva")
      .select(
        `cliente_id, hora_inicio, cliente:cliente_id (nombre, telefono),
         reserva_servicio (servicio:servicio_id (nombre))`
      )
      .eq("staff_id", user.id)
      .eq("estado", "COMPLETADA")
      .order("hora_inicio", { ascending: false });
    if (error) return { ok: false, error: error.message };

    const porCliente = new Map<string, ClienteAtendido>();
    for (const r of data ?? []) {
      const cliente = r.cliente as unknown as { nombre: string; telefono: string | null } | null;
      const servicios = (r.reserva_servicio ?? [])
        .map((rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre)
        .filter((n): n is string => Boolean(n));
      const existente = porCliente.get(r.cliente_id);
      if (existente) {
        existente.visitas += 1;
        for (const s of servicios) if (!existente.servicios.includes(s)) existente.servicios.push(s);
      } else {
        porCliente.set(r.cliente_id, {
          clienteId: r.cliente_id,
          nombre: cliente?.nombre ?? "Cliente",
          telefono: cliente?.telefono ?? null,
          visitas: 1,
          ultimaVisita: r.hora_inicio,
          servicios,
        });
      }
    }

    return { ok: true, data: [...porCliente.values()].sort((a, b) => (a.ultimaVisita < b.ultimaVisita ? 1 : -1)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
