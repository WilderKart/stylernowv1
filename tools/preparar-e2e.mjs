import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = process.platform === "win32" ? ["supabase"] : ["npx", "supabase"];
const comun = { cwd: raiz, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 };

function ejecutar(comando, args, opciones = {}) {
  const r =
    process.platform === "win32"
      ? spawnSync(`"${comando}" ${args.map((a) => `"${a}"`).join(" ")}`, { ...comun, shell: true, ...opciones })
      : spawnSync(comando, args, { ...comun, ...opciones });
  if (r.status !== 0) {
    const seguro = `${r.stderr ?? ""}\n${r.stdout ?? ""}`
      .replace(/eyJ[A-Za-z0-9._-]+/g, "[REDACTADO]")
      .split("\n")
      .filter((l) => l.trim())
      .slice(0, 20)
      .join(" | ");
    throw new Error(`${comando} falló: ${r.error?.code ?? r.signal ?? r.status}${seguro ? ` · ${seguro}` : ""}`);
  }
  return r.stdout ?? "";
}

function sqlLocal(sentencias) {
  ejecutar("docker", ["exec", "-i", "supabase_db_stylernow", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: sentencias,
  });
}

function estadoLocal() {
  const salida = ejecutar(cli[0], [...cli.slice(1), "status", "-o", "json"]);
  const inicio = salida.indexOf("{");
  const fin = salida.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) throw new Error("No se pudo leer el estado de Supabase local");
  return JSON.parse(salida.slice(inicio, fin + 1));
}

const ROLES = {
  cliente: { id: "10000000-0000-4000-8000-000000000001", correo: "e2e-cliente@stylernow.test" },
  dueno: { id: "10000000-0000-4000-8000-000000000002", correo: "e2e-dueno@stylernow.test" },
  staff: { id: "10000000-0000-4000-8000-000000000003", correo: "e2e-staff@stylernow.test" },
  guardian: { id: "10000000-0000-4000-8000-000000000004", correo: "e2e-guardian@stylernow.test" },
  superadmin: { id: "10000000-0000-4000-8000-000000000005", correo: "e2e-superadmin@stylernow.test" },
};
const NEGOCIO_ID = "10000000-0000-4000-8000-000000000010";
const SEDE_ID = "10000000-0000-4000-8000-000000000011";
const CLAVE = "E2e#Passw0rd!2026";
const SLUG = "e2e-barberia";
const fallo = (mensaje, error) => {
  throw new Error(`${mensaje}: ${error?.message ?? "error desconocido"}`);
};

async function main() {
  ejecutar(cli[0], [...cli.slice(1), "start"]);
  const estado = estadoLocal();

  const admin = createClient(estado.API_URL, estado.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: existentes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const ids = {};
  for (const [rol, dato] of Object.entries(ROLES)) {
    const metadatos = {
      intencion_registro: rol === "dueno" ? "negocio" : "cliente",
      registro_pendiente: false,
    };
    const previo = (existentes?.users ?? []).find((u) => u.email === dato.correo);
    if (previo) {
      ids[rol] = previo.id;
      const { error } = await admin.auth.admin.updateUserById(previo.id, {
        password: CLAVE,
        email_confirm: true,
        app_metadata: metadatos,
        user_metadata: { rol_e2e: rol },
      });
      if (error) fallo(`No se pudo actualizar el usuario E2E ${rol}`, error);
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({
      id: dato.id,
      email: dato.correo,
      password: CLAVE,
      email_confirm: true,
      app_metadata: metadatos,
      user_metadata: { rol_e2e: rol },
    });
    if (error) fallo(`No se pudo crear el usuario E2E ${rol}`, error);
    ids[rol] = data.user.id;
  }

  const idsRoles = Object.values(ids).map((id) => `'${id}'`).join(",");
  sqlLocal(`
    delete from public.limite_tasa_evento where clave like 'login-ip:%';
    delete from public.intento_auth where email like '%@stylernow.test';
    delete from public.wallet
    where negocio_id = '${NEGOCIO_ID}'::uuid
       or negocio_id in (select id from public.negocio where slug = '${SLUG}' or owner_user_id in (${idsRoles}));
    delete from public.suscripcion
    where negocio_id = '${NEGOCIO_ID}'::uuid
       or negocio_id in (select id from public.negocio where slug = '${SLUG}' or owner_user_id in (${idsRoles}));
    delete from public.evento_auditoria
    where negocio_id = '${NEGOCIO_ID}'::uuid
       or negocio_id in (select id from public.negocio where slug = '${SLUG}' or owner_user_id in (${idsRoles}));
    delete from public.negocio
    where slug = '${SLUG}' or owner_user_id in (${idsRoles});
  `);

  const valoresPerfil = Object.entries(ids)
    .map(([rol, id]) => {
      const nombre = `E2E ${rol}`;
      return `('${id}'::uuid,'${nombre}','${ROLES[rol].correo}','+573001234567','CO',now(),false,${rol === "superadmin"})`;
    })
    .join(",\n    ");

  sqlLocal(`
    insert into public.perfil (id, nombre, email, telefono, pais, consentimiento_datos_at, consentimiento_marketing, es_supersu)
    values
      ${valoresPerfil}
    on conflict (id) do update set
      nombre = excluded.nombre,
      email = excluded.email,
      telefono = excluded.telefono,
      pais = excluded.pais,
      consentimiento_datos_at = excluded.consentimiento_datos_at,
      consentimiento_marketing = excluded.consentimiento_marketing,
      es_supersu = excluded.es_supersu;

    insert into public.cliente_preferencia (usuario_id, permiso_ubicacion, permiso_notificaciones, onboarding_completo)
    values
      ${Object.values(ids).map((id) => `('${id}'::uuid,'MAS_TARDE','MAS_TARDE',true)`).join(",\n      ")}
    on conflict (usuario_id) do update set onboarding_completo = true;

    insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado, onboarding_completo)
    values ('${NEGOCIO_ID}'::uuid,'${ids.dueno}'::uuid,'Barbería E2E','${SLUG}','Cali','CO','ACTIVO',true);

    insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_inicio_ciclo, fecha_proximo_cobro, pais_codigo)
    values ('${NEGOCIO_ID}'::uuid,'STUDIO','ACTIVA',now(),now() + interval '30 days','CO');

    insert into public.sede (id, negocio_id, nombre, direccion, ciudad)
    values ('${SEDE_ID}'::uuid,'${NEGOCIO_ID}'::uuid,'Sede E2E','Calle 1 # 2-3','Cali');

    insert into public.staff (usuario_id, nombre, especialidad)
    values
      ('${ids.staff}'::uuid,'Staff E2E','Barbería'),
      ('${ids.guardian}'::uuid,'Guardián E2E','Barbería')
    on conflict (usuario_id) do update set nombre = excluded.nombre, especialidad = excluded.especialidad;

    insert into public.vinculo_staff_negocio (staff_id, negocio_id, sede_activa_id, estado, es_guardian)
    values
      ('${ids.staff}'::uuid,'${NEGOCIO_ID}'::uuid,'${SEDE_ID}'::uuid,'ACTIVO',false),
      ('${ids.guardian}'::uuid,'${NEGOCIO_ID}'::uuid,'${SEDE_ID}'::uuid,'ACTIVO',true);

    insert into public.aceptacion_legal (usuario_id, texto_legal_id)
    select u.id, t.id
    from (values ${Object.values(ids).map((id) => `('${id}'::uuid)`).join(",")}) as u(id)
    cross join lateral (
      (select id from public.texto_legal where tipo = 'TERMINOS' order by version desc limit 1)
      union all
      (select id from public.texto_legal where tipo = 'POLITICA_DATOS' order by version desc limit 1)
    ) as t
    on conflict do nothing;
  `);

  const entorno = [
    "E2E_BASE_URL=http://127.0.0.1:3100",
    `NEXT_PUBLIC_SUPABASE_URL=${estado.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${estado.ANON_KEY}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${estado.PUBLISHABLE_KEY}`,
    `SUPABASE_SECRET_KEY=${estado.SERVICE_ROLE_KEY}`,
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY=",
    "TURNSTILE_SECRET_KEY=",
    "NEXT_PUBLIC_SENTRY_DSN=",
    "VERCEL_ENV=development",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(raiz, ".env.e2e.local"), entorno, { mode: 0o600 });
  console.log("E2E local listo: 5 roles, 1 negocio, 1 sede.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Error preparando E2E");
  process.exit(1);
});
