# 02 — Functional Architecture

## Objetivo
Definir las 4 superficies del producto, sus responsabilidades, sus límites, y cómo se relacionan entre sí y con la plataforma compartida.

## Alcance
Arquitectura funcional (qué hace cada superficie), no arquitectura técnica de implementación (stack, hosting — eso vive en el repositorio de código, no en la Biblia). Sí define contratos de dependencia entre superficies, que si son vinculantes para `05-API`.

## Reglas

### Las 4 superficies

#### 1. Cliente PWA
Progressive Web App mobile-first, instalable desde navegador, con arquitectura preparada para empaquetarse vía Capacitor en una fase posterior (ver ADL-003). Responsabilidades: descubrimiento (Marketplace), reserva, pago de seña, gestión de citas propias, perfil, fidelización, reseñas.

**No responsabilidades:** no administra el Negocio, no ve datos de otros Clientes, no tiene acceso a reportes internos.

#### 2. Panel Negocio
Web app de escritorio (con soporte responsive) para la Barbería y el Guardian. Responsabilidades: onboarding del Negocio, agenda multi-Staff, catálogo de Servicios, gestión de Staff, CRM de Clientes, caja/POS, reportes, reseñas recibidas, configuración de plan y facturación.

**No responsabilidades:** no aprueba otros Negocios, no configura comisión de plataforma, no modera contenido de otros Negocios.

#### 3. App Staff
Superficie dedicada al Staff individual — **no es una vista reducida del Panel Negocio**, es una app distinta con su propio flujo. Responsabilidades: ver su propia agenda, marcar check-in/check-out de una cita, ver su Nivel PRO/EXPERT/MASTER y su detalle de puntaje, ver sus propias comisiones y propinas, bloquear su propia disponibilidad (ausencias), ver historial de clientes que él mismo atendió (no todo el CRM del Negocio).

**No responsabilidades:** no gestiona Servicios ni precios, no ve la caja completa del Negocio, no ve el desempeño de otros Staff salvo el ranking agregado (si el Negocio lo habilita).

Diseño detallado: `02-UX/08_Staff_App.md`.

#### 4. SuperSU CMS
Panel de plataforma, sin código, operado por el equipo de StylerNow. Responsabilidades: aprobar/suspender Negocios, gestionar Planes y su ciclo de vida, configurar comisión de plataforma, moderar reseñas reportadas, gestionar banners y promociones del Marketplace, gestionar ciudades habilitadas, soporte y tickets.

### Relación entre superficies

```
Cliente PWA ──(reserva + paga seña)──▶ Plataforma StylerNow ◀──(gestiona agenda)── App Staff
                                              │
                                              ▼
                                        Panel Negocio
                                    (administra todo lo anterior
                                     para su propio Negocio)
                                              │
                                              ▼
                                       SuperSU CMS
                                  (gobierna la plataforma completa,
                                   incluidos todos los Negocios)
```

- Toda escritura que afecta a más de un Negocio (comisión de plataforma, aprobación, banners) solo puede originarse en SuperSU CMS.
- Toda escritura que afecta a un solo Negocio pero a varios Staff (precios, horarios base) solo puede originarse en Panel Negocio.
- Toda escritura que afecta solo al propio Staff (su disponibilidad, su check-in) se origina en App Staff.
- Toda escritura que afecta solo al propio Cliente (su reserva, su perfil) se origina en Cliente PWA.

Esta jerarquía es la base de la matriz de permisos en `03-Business-Rules/01_Roles.md` y del diseño de RLS en `06-Security/02_RLS.md`.

### Plataforma compartida (no es una "5ª superficie", es la base común)

Todas las superficies consumen la misma capa de datos y API (`04-Data-Model`, `05-API`). No existen bases de datos ni lógica de negocio duplicadas entre superficies — una regla de negocio (ej. cálculo de comisión) vive en un solo lugar y todas las superficies la consultan, nunca la reimplementan.

### Requisito de instalabilidad y offline básico (Cliente PWA)

- Manifest y Service Worker desde el primer release.
- Cacheo de shell de la app (no de datos transaccionales sensibles como disponibilidad en tiempo real).
- Ver comportamiento offline detallado en `02-UX/12_Errors_States.md` y casos límite de sincronización en `07-QA`.

## Estados
No aplica a nivel de este documento (los ciclos de vida de las entidades están en `04-Data-Model/03_State_Machines.md`).

## Permisos
Ver matriz completa en `03-Business-Rules/01_Roles.md`. Regla general de esta arquitectura: **ninguna superficie puede leer o escribir datos fuera de su responsabilidad declarada arriba**, incluso si técnicamente el endpoint lo permitiera — la restricción se aplica primero a nivel de RLS (`06-Security/02_RLS.md`), no solo de UI.

## Dependencias
- Depende de: `01_Product_Vision.md`, `Glossary.md`.
- De este documento dependen: `02-UX` (las 4 superficies), `05-API` (los contratos siguen esta separación de responsabilidades), `06-Security/02_RLS.md`.

## Casos límite

- **Un Staff es también dueño del Negocio** (caso muy común en negocios pequeños: 1 persona, 1 silla). Esa persona tiene dos identidades funcionales sobre el mismo usuario: puede operar desde Panel Negocio (como Barbería) y desde App Staff (como Staff) indistintamente; el sistema no fuerza a "ser una sola cosa". Ver `03-Business-Rules/01_Roles.md`, caso límite de rol combinado.
- **Un Negocio no tiene App Staff activa** (Staff usa solo el Panel Negocio porque el Negocio es de 1 persona). App Staff sigue siendo la superficie recomendada, pero el Panel Negocio incluye una vista de agenda equivalente para que un Negocio de 1 persona no esté obligado a instalar dos apps.
- **SuperSU necesita actuar como un Negocio específico** (soporte). Se documenta como "modo impersonación" con auditoría obligatoria en `06-Security/01_Security_Model.md` — nunca acceso silencioso.

## Criterios de aceptación
- [ ] Ninguna de las 4 superficies contiene lógica de negocio que no esté también documentada en `03-Business-Rules` o `08-Growth-Monetization`.
- [ ] La matriz de permisos de `03-Business-Rules/01_Roles.md` es una consecuencia directa de la separación de responsabilidades de este documento, no una lista independiente.

## Checklist
- [x] Completo
- [ ] Revisado
