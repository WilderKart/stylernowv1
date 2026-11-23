"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { comprimirADataUrl } from "@/lib/imagen/comprimir";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  actualizarMiPerfilStaff,
  autorizarDesdePerfil,
  revocarPublicacion,
  type MisAutorizaciones,
  crearMiBloqueo,
  eliminarMiBloqueo,
  guardarDiaDisponibilidad,
  subirFotoPerfilStaff,
  type BloqueoStaff,
  type DiaDisponibilidad,
  type MiPerfilStaff,
  type MisGanancias,
} from "./actions";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function VistaPerfilStaff({
  vinculoId,
  sedeId,
  perfilInicial,
  gananciasIniciales,
  disponibilidadInicial,
  bloqueosIniciales,
  autorizaciones,
  textoTratamiento,
  textoPublicacion,
  bienvenida,
}: {
  vinculoId: string;
  sedeId: string | null;
  perfilInicial: MiPerfilStaff;
  gananciasIniciales: MisGanancias;
  disponibilidadInicial: DiaDisponibilidad[];
  bloqueosIniciales: BloqueoStaff[];
  autorizaciones: MisAutorizaciones | null;
  textoTratamiento: string;
  textoPublicacion: string;
  bienvenida: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      {bienvenida ? (
        <Card className="p-5">
          <p className="m-0 text-[14px] font-bold text-text">¡Bienvenido al equipo!</p>
          <p className="m-0 mt-1 text-[13px] text-text-muted">
            Completa tu perfil profesional. Si quieres que los clientes te vean y reserven contigo, sube tu foto y activa la
            publicación de tu perfil más abajo. Es opcional: sin ella sigues usando tu agenda y el panel normalmente.
          </p>
        </Card>
      ) : null}
      <SeccionDatos perfilInicial={perfilInicial} />
      {autorizaciones ? (
        <SeccionAutorizaciones estado={autorizaciones} textoTratamiento={textoTratamiento} textoPublicacion={textoPublicacion} />
      ) : null}
      <SeccionGanancias ganancias={gananciasIniciales} />
      {sedeId ? (
        <SeccionDisponibilidad vinculoId={vinculoId} sedeId={sedeId} disponibilidadInicial={disponibilidadInicial} />
      ) : (
        <p className="text-[12px] text-text-faint">Sin sede asignada todavía — no se puede configurar disponibilidad.</p>
      )}
      <SeccionBloqueos vinculoId={vinculoId} bloqueosIniciales={bloqueosIniciales} />
    </div>
  );
}

function SeccionDatos({ perfilInicial }: { perfilInicial: MiPerfilStaff }) {
  const [nombre, setNombre] = useState(perfilInicial.nombre);
  const [especialidad, setEspecialidad] = useState(perfilInicial.especialidad ?? "");
  const [bio, setBio] = useState(perfilInicial.bio ?? "");
  const [fotoUrl, setFotoUrl] = useState(perfilInicial.fotoUrl);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCambiarFoto(archivo: File) {
    setSubiendoFoto(true);
    setError(null);
    // Avatar de staff: WebP 0.8, lado máx. 512 px (utilidad central).
    const comprimida = await comprimirADataUrl(archivo, "avatar");
    if (!comprimida.ok) {
      setSubiendoFoto(false);
      return setError(comprimida.error);
    }
    const res = await subirFotoPerfilStaff(comprimida.data);
    setSubiendoFoto(false);
    if (!res.ok) return setError(res.error);
    setFotoUrl(res.data.url);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    setMensaje(null);
    const res = await actualizarMiPerfilStaff({ nombre, especialidad, bio });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setMensaje("Datos guardados.");
  }

  return (
    <section>
      <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Datos personales</h2>
      <div className="mb-4 flex items-center gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-full bg-surface-2">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto subida por el propio usuario a Storage, no un asset del build
            <img src={fotoUrl} alt={nombre} className="size-full object-cover" />
          ) : null}
        </div>
        <label className="text-[12px] font-bold text-accent">
          {subiendoFoto ? "Subiendo..." : "Cambiar foto"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && onCambiarFoto(e.target.files[0])} />
        </label>
      </div>
      <div className="flex flex-col gap-3">
        <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Input label="Especialidad" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} placeholder="Ej. Fade, color, barba..." />
        <div className="flex flex-col gap-2">
          <label className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="min-h-[70px] rounded-xl border border-border bg-surface p-3 text-[13px] text-text outline-none focus:border-accent/60"
          />
        </div>
        {error ? <p className="text-[12px] font-semibold text-danger">{error}</p> : null}
        {mensaje ? <p className="text-[12px] font-semibold text-success">{mensaje}</p> : null}
        <Button size="sm" loading={guardando} onClick={guardar} className="self-start">
          Guardar
        </Button>
      </div>
    </section>
  );
}

function SeccionGanancias({ ganancias }: { ganancias: MisGanancias }) {
  return (
    <section>
      <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Mis Ganancias (esta semana)</h2>
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center">
          <p className="text-[16px] font-bold text-text">{formatCOP(ganancias.comisionGenerada)}</p>
          <p className="text-[10.5px] text-text-faint">Comisión</p>
        </Card>
        <Card className="text-center">
          <p className="text-[16px] font-bold text-text">{formatCOP(ganancias.propinas)}</p>
          <p className="text-[10.5px] text-text-faint">Propinas</p>
        </Card>
        <Card className="text-center">
          <p className="text-[16px] font-bold text-text">{ganancias.reservasCompletadas}</p>
          <p className="text-[10.5px] text-text-faint">Atenciones</p>
        </Card>
      </div>
    </section>
  );
}

function SeccionDisponibilidad({
  vinculoId,
  sedeId,
  disponibilidadInicial,
}: {
  vinculoId: string;
  sedeId: string;
  disponibilidadInicial: DiaDisponibilidad[];
}) {
  const [dias, setDias] = useState(disponibilidadInicial);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardarDia(diaSemana: number, horaInicio: string, horaFin: string, activo: boolean) {
    setGuardando(diaSemana);
    setError(null);
    const res = await guardarDiaDisponibilidad(vinculoId, sedeId, diaSemana, activo ? horaInicio : null, activo ? horaFin : null);
    setGuardando(null);
    if (!res.ok) return setError(res.error);
    setDias((prev) => prev.map((d) => (d.diaSemana === diaSemana ? { ...d, horaInicio: activo ? horaInicio : null, horaFin: activo ? horaFin : null } : d)));
  }

  return (
    <section>
      <h2 className="font-display mb-1 text-[13px] font-bold uppercase text-text">Mi Disponibilidad</h2>
      <p className="mb-3 text-[11.5px] text-text-faint">Horario semanal base — una franja por día.</p>
      {error ? <p className="mb-2 text-[12px] font-semibold text-danger">{error}</p> : null}
      <ul className="flex flex-col gap-2">
        {dias.map((d) => (
          <FilaDia key={d.diaSemana} dia={d} guardando={guardando === d.diaSemana} onGuardar={(hi, hf, activo) => guardarDia(d.diaSemana, hi, hf, activo)} />
        ))}
      </ul>
    </section>
  );
}

function FilaDia({
  dia,
  guardando,
  onGuardar,
}: {
  dia: DiaDisponibilidad;
  guardando: boolean;
  onGuardar: (horaInicio: string, horaFin: string, activo: boolean) => void;
}) {
  const [activo, setActivo] = useState(Boolean(dia.horaInicio && dia.horaFin));
  const [horaInicio, setHoraInicio] = useState(dia.horaInicio ?? "09:00");
  const [horaFin, setHoraFin] = useState(dia.horaFin ?? "18:00");

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5">
      <label className="flex w-24 shrink-0 items-center gap-2 text-[12.5px] font-semibold text-text">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => {
            setActivo(e.target.checked);
            onGuardar(horaInicio, horaFin, e.target.checked);
          }}
        />
        {DIAS[dia.diaSemana]}
      </label>
      {activo ? (
        <>
          <input
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            onBlur={() => onGuardar(horaInicio, horaFin, true)}
            className="h-8 rounded-lg border border-border bg-bg px-2 text-[12px] text-text"
          />
          <span className="text-text-faint">—</span>
          <input
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            onBlur={() => onGuardar(horaInicio, horaFin, true)}
            className="h-8 rounded-lg border border-border bg-bg px-2 text-[12px] text-text"
          />
        </>
      ) : (
        <span className="text-[11.5px] text-text-faint">Sin disponibilidad</span>
      )}
      {guardando ? <span className="text-[10.5px] text-text-faint">Guardando...</span> : null}
    </li>
  );
}

function SeccionBloqueos({ vinculoId, bloqueosIniciales }: { vinculoId: string; bloqueosIniciales: BloqueoStaff[] }) {
  const [bloqueos, setBloqueos] = useState(bloqueosIniciales);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({ fechaInicio: "", fechaFin: "", motivo: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    if (!form.fechaInicio || !form.fechaFin) return setError("Completa las fechas de inicio y fin.");
    setGuardando(true);
    setError(null);
    const res = await crearMiBloqueo(vinculoId, new Date(form.fechaInicio).toISOString(), new Date(form.fechaFin).toISOString(), form.motivo);
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setBloqueos((prev) =>
      [...prev, { id: crypto.randomUUID(), fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, motivo: form.motivo || null }].sort((a, b) =>
        a.fechaInicio.localeCompare(b.fechaInicio)
      )
    );
    setForm({ fechaInicio: "", fechaFin: "", motivo: "" });
    setCreando(false);
  }

  async function eliminar(id: string) {
    setError(null);
    const res = await eliminarMiBloqueo(id);
    if (!res.ok) return setError(res.error);
    setBloqueos((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-[13px] font-bold uppercase text-text">Mis Ausencias</h2>
        <Button size="sm" variant="secondary" onClick={() => setCreando((v) => !v)}>
          {creando ? "Cancelar" : "Nueva ausencia"}
        </Button>
      </div>

      {creando ? (
        <Card className="mb-3 flex flex-col gap-3">
          <div className="flex gap-2">
            <Input label="Desde" type="datetime-local" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
            <Input label="Hasta" type="datetime-local" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
          </div>
          <Input label="Motivo (opcional)" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          <Button size="sm" loading={guardando} onClick={crear}>
            Guardar ausencia
          </Button>
        </Card>
      ) : null}

      {error ? <p className="mb-2 text-[12px] font-semibold text-danger">{error}</p> : null}

      {bloqueos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">Sin ausencias próximas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bloqueos.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5">
              <div>
                <p className="text-[12.5px] font-semibold text-text">
                  {new Date(b.fechaInicio).toLocaleDateString("es-CO")} — {new Date(b.fechaFin).toLocaleDateString("es-CO")}
                </p>
                {b.motivo ? <p className="text-[11px] text-text-faint">{b.motivo}</p> : null}
              </div>
              <button type="button" onClick={() => eliminar(b.id)} className="text-[11px] font-semibold text-danger">
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const FECHA = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });
const fecha = (iso: string | null) => (iso ? FECHA.format(new Date(iso)) : "");

/**
 * Autorizaciones del profesional. La de tratamiento se otorga al aceptar la invitación (aquí se
 * consulta, o se otorga si falta). La de PUBLICACIÓN es independiente, voluntaria y revocable aquí
 * mismo; nunca se marca sola. Los textos son BORRADORES de trabajo (pendientes de validación jurídica).
 */
function SeccionAutorizaciones({
  estado,
  textoTratamiento,
  textoPublicacion,
}: {
  estado: MisAutorizaciones;
  textoTratamiento: string;
  textoPublicacion: string;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState<null | "tratamiento" | "publicacion" | "revocar">(null);
  const [error, setError] = useState<string | null>(null);
  const tratamientoOk = estado.tratamiento === "ACEPTA";
  const publicacionOk = estado.publicacion === "ACEPTA";

  async function ejecutar(accion: "tratamiento" | "publicacion" | "revocar") {
    setCargando(accion);
    setError(null);
    const res = accion === "revocar" ? await revocarPublicacion() : await autorizarDesdePerfil(accion);
    setCargando(null);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div>
        <h2 className="font-display m-0 text-[15px] font-bold uppercase text-text">Mis autorizaciones</h2>
        <p className="m-0 mt-1 text-[12px] text-text-faint">
          Textos en revisión jurídica: pueden ajustarse. Cada decisión queda registrada con su fecha y el texto exacto.
        </p>
      </div>

      <section className="flex flex-col items-start gap-2">
        <p className="m-0 text-[13px] font-bold text-text">Tratamiento de datos para tu vínculo profesional</p>
        <p className="m-0 text-[13px] text-text-muted">{textoTratamiento}</p>
        {tratamientoOk ? (
          <p className="m-0 text-[12px] text-text-faint">Autorizada el {fecha(estado.tratamientoAt)}.</p>
        ) : (
          <Button size="sm" loading={cargando === "tratamiento"} disabled={cargando !== null} onClick={() => ejecutar("tratamiento")}>
            Autorizar tratamiento
          </Button>
        )}
      </section>

      <section className="flex flex-col items-start gap-2 border-t border-border pt-4">
        <p className="m-0 text-[13px] font-bold text-text">Publicar mi perfil a los clientes (opcional)</p>
        <p className="m-0 text-[13px] text-text-muted">{textoPublicacion}</p>
        {publicacionOk ? (
          <>
            <p className="m-0 text-[12px] text-text-faint">
              Autorizada el {fecha(estado.publicacionAt)}.{" "}
              {estado.tieneFoto ? "Tu perfil se muestra a los clientes." : "Sube una foto para que tu perfil se muestre."}
            </p>
            <Button variant="secondary" size="sm" loading={cargando === "revocar"} disabled={cargando !== null} onClick={() => ejecutar("revocar")}>
              Dejar de publicar mi perfil
            </Button>
          </>
        ) : (
          <>
            {estado.publicacion === "REVOCA" ? (
              <p className="m-0 text-[12px] text-text-faint">Retiraste esta autorización el {fecha(estado.publicacionAt)}.</p>
            ) : null}
            {estado.enTransicion && estado.transicionFin ? (
              <p className="m-0 text-[12px] text-text-faint">
                Por ahora tu perfil sigue visible. Si no lo autorizas antes del {fecha(estado.transicionFin)}, dejará de
                mostrarse (tu cuenta y tu agenda siguen igual).
              </p>
            ) : null}
            {!estado.tieneFoto ? <p className="m-0 text-[12px] text-text-faint">Para mostrarse, tu perfil también necesita una foto.</p> : null}
            <Button
              size="sm"
              loading={cargando === "publicacion"}
              disabled={cargando !== null || !tratamientoOk}
              onClick={() => ejecutar("publicacion")}
            >
              Autorizar publicación
            </Button>
          </>
        )}
      </section>
      {error ? (
        <p role="alert" className="m-0 text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
