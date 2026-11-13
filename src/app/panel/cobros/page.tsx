import { EmptyState } from "@/components/brutal";
import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { obtenerConexionCobros } from "./actions";
import { VistaCobros } from "./vista-cobros";

export const metadata = { title: "Cobros en línea" };

const MENSAJES_RETORNO: Record<string, string> = {
  NO_CONFIGURADO: "La conexión con Mercado Pago todavía no está habilitada en StylerNow.",
  NO_AUTORIZADO: "Solo el dueño del negocio puede conectar la cuenta.",
  RESPUESTA_INVALIDA: "Mercado Pago no devolvió una respuesta válida. Intenta de nuevo.",
  SESION_EXPIRADA: "Tu sesión expiró durante la conexión. Inicia sesión e intenta de nuevo.",
  ESTADO_INVALIDO: "El enlace de conexión venció o ya se usó. Vuelve a intentarlo desde aquí.",
  CANJE_FALLIDO: "Mercado Pago rechazó la autorización. Intenta de nuevo.",
  NO_SE_GUARDO: "No pudimos guardar la conexión. Intenta de nuevo.",
};

export default async function CobrosPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // La cuenta donde entra el dinero del negocio la decide solo su dueño.
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/cobros");
  const q = await props.searchParams;
  const r = await obtenerConexionCobros();
  const codigo = typeof q.error === "string" ? q.error : null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-8">
        {r.ok ? (
          <VistaCobros
            conexion={r.data}
            aviso={
              q.ok === "1"
                ? { tipo: "ok", texto: "Tu cuenta de Mercado Pago quedó conectada." }
                : codigo
                  ? { tipo: "error", texto: MENSAJES_RETORNO[codigo] ?? "No pudimos completar la conexión." }
                  : null
            }
          />
        ) : (
          <EmptyState big="Error" title="No pudimos cargar tus cobros" hint={r.error} />
        )}
      </main>
    </div>
  );
}
