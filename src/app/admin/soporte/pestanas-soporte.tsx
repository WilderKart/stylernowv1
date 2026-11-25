"use client";

import s from "@/components/soporte/chat-3d.module.css";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

/** Pestañas «Chat en vivo / Tickets» de Soporte Admin. Los dos contenidos llegan ya renderizados desde el servidor. */
export function PestanasSoporte({ chat, tickets, sinLeer, ticketsAbiertos }: { chat: ReactNode; tickets: ReactNode; sinLeer: number; ticketsAbiertos: number }) {
  const [pestana, setPestana] = useState<"chat" | "tickets">("chat");
  return (
    <>
      <div className={cn(s.raiz, "mb-4")}>
        <div className={s.pestanas} role="tablist" aria-label="Soporte">
          <button type="button" role="tab" aria-selected={pestana === "chat"} className={cn(s.pestana, pestana === "chat" && s.pestanaActiva)} onClick={() => setPestana("chat")}>
            Chat en vivo {sinLeer > 0 ? <span className={s.contador}>{sinLeer}</span> : null}
          </button>
          <button type="button" role="tab" aria-selected={pestana === "tickets"} className={cn(s.pestana, pestana === "tickets" && s.pestanaActiva)} onClick={() => setPestana("tickets")}>
            Tickets {ticketsAbiertos > 0 ? <span className={s.contador}>{ticketsAbiertos}</span> : null}
          </button>
        </div>
      </div>
      <div hidden={pestana !== "chat"}>{chat}</div>
      <div hidden={pestana !== "tickets"}>{tickets}</div>
    </>
  );
}
