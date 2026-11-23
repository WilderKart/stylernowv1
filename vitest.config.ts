import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: { statements: 95, branches: 90, functions: 100, lines: 95 },
      include: [
        "src/lib/auth/destino-seguro.ts",
        "src/lib/auth/password.ts",
        "src/lib/auth/password-policy.ts",
        "src/lib/auth/password-validator.ts",
        "src/lib/libro/filtros.ts",
        "src/lib/notificaciones/web-push.ts",
        "src/lib/pagos/cifrado.ts",
        "src/lib/pagos/entorno.ts",
        "src/lib/pagos/sena.ts",
      ],
    },
  },
});
