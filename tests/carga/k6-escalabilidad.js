import http from "k6/http";
import { check, sleep } from "k6";

// Uso: k6 run tests/carga/k6-escalabilidad.js
// Solo staging/local. NO ejecutar contra producción.
// Default seguro local:
const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3000";

export const options = {
  scenarios: {
    marketplace_busqueda: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 5 },
        { duration: "1m", target: 10 },
        { duration: "30s", target: 0 },
      ],
      exec: "buscarMarketplace",
    },
    perfil_publico: {
      executor: "constant-vus",
      vus: 3,
      duration: "2m",
      exec: "verPerfil",
      startTime: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
  },
};

function get(path) {
  return http.get(`${BASE_URL}${path}`, {
    headers: { "Accept": "text/html,application/json" },
    tags: { endpoint: path.split("?")[0] },
  });
}

export function buscarMarketplace() {
  const q = encodeURIComponent("barberia");
  const res = get(`/?q=${q}`);
  check(res, {
    "marketplace status < 500": (r) => r.status < 500,
  });
  sleep(1);
}

export function verPerfil() {
  // Ajustar a un slug/staff real en staging/local antes de ejecutar.
  const negocio = __ENV.NEGOCIO_ID || "negocio-demo";
  const staff = __ENV.STAFF_ID || "staff-demo";
  const res = get(`/negocio/${negocio}/profesional/${staff}`);
  check(res, {
    "perfil status < 500": (r) => r.status < 500,
  });
  sleep(1);
}
