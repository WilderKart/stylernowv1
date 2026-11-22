import Link from "next/link";
import type { EstadoOperativo } from "@/lib/suscripcion/estado-operativo-puro";

/**
 * Aviso del estado «suscripción restringida» (migración 164). Solo MUESTRA lo que decidió la base (`negocio_estado_operativo`): no
 * calcula fechas ni reglas. En restricción la app sigue navegable; el banner dice qué se puede hacer y lleva a pagar.
 *
 * `puedePagar` = quien mira es el propietario (solo él entra a /panel/suscripcion); el resto ve el aviso sin botón.
 */
const MOTIVOS: Record<string, string> = {
  PRUEBA_VENCIDA: "Terminó tu prueba gratuita de 14 días sin un pago confirmado.",
  PERIODO_VENCIDO: "Venció tu periodo pagado y no hay un pago de renovación confirmado.",
  REQUIERE_PLAN: "Tu negocio necesita elegir y pagar un plan.",
  SUSPENDIDA: "La suscripción de tu negocio está suspendida.",
  CANCELADA: "La suscripción de tu negocio está cancelada.",
  ACTIVACION_MANUAL_VENCIDA: "Venció la activación manual de tu plan.",
};

export function BannerSuscripcion({ estado, puedePagar }: { estado: EstadoOperativo; puedePagar: boolean }) {
  if (estado.estado === "GRACIA" && estado.operativo) {
    return (
      <div role="status" className="border-b-2 border-warning bg-warning/10 px-4 py-2.5 text-[12.5px] text-text sm:px-8">
        <b className="uppercase">Día de gracia para renovar.</b>{" "}
        Tu periodo pagado terminó; renueva hoy para no quedar con la operación restringida mañana.{" "}
        {puedePagar ? (
          <Link href="/panel/suscripcion" className="font-bold underline">
            Renovar ahora
          </Link>
        ) : null}
      </div>
    );
  }
  if (estado.operativo) return null;

  const motivo = (estado.motivo && MOTIVOS[estado.motivo]) || "La suscripción de tu negocio está restringida.";
  return (
    <div role="alert" className="border-b-2 border-danger bg-danger/10 px-4 py-3 text-[12.5px] text-text sm:px-8">
      <b className="uppercase">Suscripción restringida.</b> {motivo} Puedes iniciar sesión, consultar tu histórico y cumplir las citas ya
      confirmadas, pero no puedes recibir reservas nuevas ni modificar servicios, disponibilidad, equipo ni precios. Tus datos y citas se conservan.{" "}
      <Link href="/panel/cumplimiento" className="font-bold underline">
        Ver citas pendientes
      </Link>
      {puedePagar && estado.puedePagar ? (
        <>
          {" · "}
          <Link href="/panel/suscripcion" className="font-bold underline">
            Pagar y reactivar
          </Link>
        </>
      ) : null}
    </div>
  );
}
