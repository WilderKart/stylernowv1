import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (relativo: string) =>
  readFileSync(path.resolve(__dirname, "..", relativo), "utf8");

describe("Fase 3 · idempotencia atomica de reservas", () => {
  const migracion = leer("supabase/migrations/182_reserva_idempotencia_atomica.sql");
  const reversion = leer("supabase/migrations/182_reserva_idempotencia_atomica_REVERSION.sql.txt");
  const carrera = leer("tests/sql/reservas_concurrencia.sh");

  it("serializa por cliente + Idempotency-Key antes de consultar la reserva existente", () => {
    expect(migracion).toContain(
      "pg_advisory_xact_lock(hashtext(v_cliente::text || ':' || p_idempotency_key))",
    );
    const lock = migracion.indexOf("pg_advisory_xact_lock");
    const primeraLectura = migracion.indexOf("where cliente_id = v_cliente and idempotency_key = p_idempotency_key");
    expect(lock).toBeGreaterThan(-1);
    expect(primeraLectura).toBeGreaterThan(lock);
  });

  it("devuelve la reserva original tanto en unique_violation como en exclusion_violation", () => {
    expect(migracion).toContain("when unique_violation then");
    expect(migracion).toContain("when exclusion_violation then");
    const lecturas = migracion.match(/where cliente_id = v_cliente and idempotency_key = p_idempotency_key/g) ?? [];
    expect(lecturas.length).toBeGreaterThanOrEqual(3);
    expect(migracion.match(/return v_reserva;/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("mantiene la guardia de slot para claves distintas", () => {
    expect(migracion).toContain("raise exception 'SLOT_NO_DISPONIBLE'");
    expect(reversion).not.toContain("pg_advisory_xact_lock");
    expect(reversion).toContain("when exclusion_violation then");
  });

  it("la prueba de carrera exige 6 respuestas, 1 reserva y 1 autorizacion", () => {
    expect(carrera).toContain("correr 6");
    expect(carrera).toContain("(esperado 6, 1, 0)");
    expect(carrera).toContain("(esperado 1, 1)");
    expect(carrera).toContain("crear_reserva_autorizada('$SEDE'");
    expect(carrera).toContain("'$KEY', true)");
    expect(carrera).toContain("AUTORIZACION_STAFF_PUBLICACION");
  });
});
