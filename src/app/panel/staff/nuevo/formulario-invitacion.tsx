"use client";

import { crearInvitacionStaff } from "@/app/panel/staff/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function FormularioInvitacion({
  negocioId,
  sedes,
}: {
  negocioId: string;
  sedes: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? "");
  const [comisionPct, setComisionPct] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const comision = comisionPct.trim() ? Number(comisionPct) : undefined;
    if (comision !== undefined && (Number.isNaN(comision) || comision < 20 || comision > 80)) {
      setEnviando(false);
      setError("La comisión debe estar entre 20% y 80%.");
      return;
    }

    const res = await crearInvitacionStaff({ negocioId, email, sedeId, comisionPct: comision });
    setEnviando(false);
    if (!res.ok) return setError(res.error);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface p-6 text-center">
        <p className="text-[14px] font-bold text-text">Invitación enviada</p>
        <p className="mt-1.5 text-[12.5px] text-text-muted">
          Le enviamos un correo a {email} para que acepte unirse al equipo.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setEnviado(false); setEmail(""); setComisionPct(""); }}>
            Invitar a otra persona
          </Button>
          <Button size="sm" onClick={() => router.push("/panel/staff")}>
            Ver Staff
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface p-5">
      <Input
        label="Correo del invitado"
        type="email"
        required
        placeholder="nombre@correo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Sede</label>
        <select
          required
          value={sedeId}
          onChange={(e) => setSedeId(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-bg px-3 text-[13.5px] text-text outline-none focus:border-accent/60"
        >
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Comisión % (opcional)"
        type="number"
        min={20}
        max={80}
        placeholder="Entre 20 y 80"
        value={comisionPct}
        onChange={(e) => setComisionPct(e.target.value)}
      />

      {error ? <p className="text-[12.5px] text-danger">{error}</p> : null}

      <Button type="submit" loading={enviando} className="w-full">
        ENVIAR INVITACIÓN
      </Button>
    </form>
  );
}
