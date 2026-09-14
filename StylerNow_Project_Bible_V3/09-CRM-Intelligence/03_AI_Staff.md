# 03 — AI: Staff (Rendimiento)

## Objetivo
Especificar la función de IA que analiza el rendimiento del Staff para la Barbería, con entradas, proceso, salida y límites explícitos — sin que esto se confunda ni interfiera con el cálculo determinístico del Sistema PRO/EXPERT/MASTER (`03-Business-Rules/05_Staff_Rewards.md`), que **no es IA**, es una fórmula fija.

## Alcance
Análisis e insights sobre el desempeño del Staff, dirigidos a la Barbería. No sustituye ni recalcula el puntaje de `03-Business-Rules/05_Staff_Rewards.md` — lo consume como una de sus entradas.

## Reglas

### Función: Insights de rendimiento de Staff

**Entradas:**
- Puntaje e historial de `puntaje_staff_evento` (`04-Data-Model/04_Audit.md`).
- Comisión generada por periodo.
- Tasa de Clientes recurrentes atribuidos a ese Staff.
- Tasa de No-show atribuible al Staff (`03-Business-Rules/09_No_Show_Policy.md`).
- Propinas recibidas (`08-Growth-Monetization/03_Tips_Distribution.md`) como señal cualitativa adicional de satisfacción del Cliente.
- Ocupación de su agenda (huecos vs. horas trabajadas).

**Proceso:**
Agrega estas señales por Staff y las compara contra el promedio del propio Negocio (nunca contra otros Negocios, por aislamiento de datos — `06-Security/02_RLS.md`) para identificar patrones: Staff con alta ocupación pero baja recurrencia de clientes (posible problema de calidad no capturado en reseñas), Staff con horarios muertos recurrentes en franjas específicas (candidato a Promoción Flash, `08-Growth-Monetization/06_Advertising_System.md`), Staff cuya tendencia de puntaje cae sostenidamente (riesgo de desmotivación o problema operativo a conversar).

**Salida:**
Panel de insights en el Panel Negocio (no en la App Staff — esta función es una herramienta de gestión de la Barbería, no un dato expuesto al propio Staff evaluado, para evitar que se perciba como una vigilancia algorítmica no solicitada) con: hallazgo, señal que lo sustenta, y una sugerencia accionable en lenguaje simple (ej. "Julián tiene 3 horas muertas los martes por la tarde — considera una Promoción Flash").

**Costo y nivel de IA:** Nivel 2 (IA Premium) — 5 créditos del Negocio por corrida, ejecutada semanalmente y cubriendo a todo el Staff del Negocio en una sola corrida (no se cobra por Staff individual). Si el Negocio no tiene créditos suficientes en el momento de la corrida programada, esa semana se omite (el panel muestra el último resultado disponible con su fecha, marcado como no actualizado) hasta que haya créditos disponibles o el Negocio compre un paquete. Ver `AI_Credit_System.md`.

**Limitaciones:**
- No genera ninguna acción automática sobre la cuenta del Staff (no lo suspende, no le cambia comisión, no le envía mensajes en su nombre) — es 100% informativo para que la Barbería decida, consistente con `Business_Rules_Bible.md`, pregunta de IA y acciones automáticas.
- No se usa como insumo del cálculo de Nivel PRO/EXPERT/MASTER (ese cálculo es una fórmula fija y auditable, nunca un modelo de IA — ver ADL-006).

## Estados
No aplica — es un cálculo de insight, no una entidad transaccional.

## Permisos
Exclusivo de Barbería y Guardian (alcance de su Sede). El Staff evaluado no tiene acceso a este panel específico (sí ve su propio puntaje objetivo en `02-UX/08_Staff_App.md`, que es un dato distinto y determinístico).

## Dependencias
- Depende de: `03-Business-Rules/05_Staff_Rewards.md`, `03-Business-Rules/09_No_Show_Policy.md`, `08-Growth-Monetization/02_Commissions.md`, `08-Growth-Monetization/03_Tips_Distribution.md`, `AI_Credit_System.md`.
- De este documento dependen: `02-UX/09_Business_Panel.md`, `07-QA/09_AI.md`.

## Casos límite

- **Un Negocio tiene un solo Staff activo** (no hay comparación posible contra un promedio del propio Negocio). La función cae a comparar contra su propia tendencia histórica (mes contra mes) en vez de contra pares, y lo comunica explícitamente ("Comparado con su propio promedio de los últimos 3 meses") para no generar una comparación engañosa contra un promedio de un solo dato.
- **Un insight sugiere una acción que la Barbería considera inapropiada o incorrecta** (ej. la IA malinterpreta una ausencia justificada como baja de rendimiento). La Barbería puede descartar el insight explícitamente ("No es relevante"), lo cual reduce la prioridad de insights similares en el futuro para ese caso específico — no hay penalización ni consecuencia oculta por descartar sugerencias.
- **Un Staff con Nivel MASTER muestra una tendencia de puntaje a la baja al cierre de temporada.** El insight se genera de todas formas (es información útil para la Barbería incluso sobre su mejor Staff), sin ninguna relación automática con la regla de Degradación de `03-Business-Rules/05_Staff_Rewards.md`, que opera de forma completamente independiente y determinística.

## Criterios de aceptación
- [ ] Ningún insight de esta función modifica automáticamente ningún dato de `vinculo_staff_negocio`, comisión o puntaje.
- [ ] El Staff evaluado nunca tiene acceso directo a este panel de insights sobre sí mismo.
- [ ] Cada insight mostrado cita explícitamente la señal de datos que lo sustenta (nunca una afirmación sin evidencia visible).

## Checklist
- [x] Completo
- [ ] Revisado
