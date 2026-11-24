"use client";

import * as React from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Reemplazo de `window.confirm()` con el diálogo interno. `<ConfirmHost />` se monta una vez en el layout raíz;
 * desde cualquier componente cliente: `if (!(await confirmar("¿…?"))) return;`
 */
interface Opciones {
  titulo?: string;
  confirmar?: string;
  cancelar?: string;
}
interface Peticion extends Opciones {
  mensaje: string;
  resolver: (v: boolean) => void;
}

let abrir: ((p: Peticion) => void) | null = null;

export function confirmar(mensaje: string, opciones?: Opciones): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    // Sin host montado (no debería ocurrir) se niega: nunca se ejecuta una acción destructiva sin confirmación.
    if (!abrir) return resolve(false);
    abrir({ mensaje, ...opciones, resolver: resolve });
  });
}

export function ConfirmHost() {
  const [peticion, setPeticion] = React.useState<Peticion | null>(null);

  React.useEffect(() => {
    abrir = (p) => setPeticion((previa) => {
      previa?.resolver(false); // una confirmación pendiente anterior se descarta
      return p;
    });
    return () => {
      abrir = null;
    };
  }, []);

  const cerrar = (valor: boolean) => {
    peticion?.resolver(valor);
    setPeticion(null);
  };

  return (
    <ConfirmDialog
      isOpen={peticion !== null}
      onOpenChange={(abierto) => {
        if (!abierto) cerrar(false);
      }}
      onConfirm={() => cerrar(true)}
      onCancel={() => cerrar(false)}
      title={peticion?.titulo ?? "Confirmación"}
      description={peticion?.mensaje ?? ""}
      confirmLabel={peticion?.confirmar}
      cancelLabel={peticion?.cancelar}
    />
  );
}
