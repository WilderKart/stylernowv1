"use client";

import { Button } from "@/components/ui/button";
import { confirmar } from "@/components/ui/confirmar";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

type Estado = { ok: true } | { ok: false; error: string };

/**
 * Formulario de una acción de servidor con estado de carga, error visible y confirmación opcional (diálogo interno, no el nativo).
 * Al terminar bien limpia el formulario; la página se refresca sola por revalidatePath.
 */
export function FormAccion({
  accion,
  children,
  etiqueta,
  confirmacion,
  variante = "secondary",
  className,
  exito = "Listo.",
}: {
  accion: (previo: Estado | null, fd: FormData) => Promise<Estado>;
  children?: React.ReactNode;
  etiqueta: string;
  confirmacion?: string;
  variante?: "primary" | "secondary" | "ghost";
  className?: string;
  exito?: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const ref = useRef<HTMLFormElement>(null);
  const yaConfirmado = useRef(false);

  useEffect(() => {
    if (estado?.ok) {
      toast.success(exito);
      ref.current?.reset();
    }
  }, [estado, exito]);

  return (
    <form
      ref={ref}
      action={enviar}
      className={className}
      onSubmit={async (e) => {
        if (!confirmacion) return;
        if (yaConfirmado.current) {
          yaConfirmado.current = false; // el reenvío tras confirmar pasa sin preguntar de nuevo
          return;
        }
        e.preventDefault();
        const form = e.currentTarget;
        if (await confirmar(confirmacion)) {
          yaConfirmado.current = true;
          form.requestSubmit();
        }
      }}
    >
      {children}
      <Button type="submit" size="sm" variant={variante} loading={pendiente} className="mt-2">
        {etiqueta}
      </Button>
      {estado && !estado.ok ? (
        <p role="alert" className="mt-2 text-[12.5px] font-semibold text-danger">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
