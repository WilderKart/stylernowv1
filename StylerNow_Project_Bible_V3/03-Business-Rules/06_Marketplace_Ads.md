# 06 — Marketplace & Ads (Reglas Invariantes)

## Objetivo
Fijar las reglas de negocio que **nunca** pueden violarse en el Marketplace y la publicidad, independientemente de cómo evolucione el algoritmo. El diseño completo del algoritmo de ranking y del sistema publicitario (fórmulas, pesos, presupuestos, facturación, antifraude) vive en `08-Growth-Monetization/01_Marketplace_Algorithm.md` y `08-Growth-Monetization/06_Advertising_System.md` — este documento es el conjunto de invariantes que esos documentos deben respetar, y por eso vive en Business-Rules.

## Alcance
Reglas de negocio invariantes. No contiene la fórmula de Score ni los formatos publicitarios en detalle (eso está en `08-Growth-Monetization`).

## Reglas

### Formatos publicitarios permitidos
- Destacado (posición preferente dentro de resultados relevantes)
- Pin patrocinado (fijado en la parte superior de una búsqueda, marcado como "Patrocinado")
- Banner (espacio editorial en el Home del Marketplace)
- Promoción Flash (oferta por tiempo limitado, visibilidad temporal elevada)

Detalle completo de cada formato, precios, targeting: `08-Growth-Monetization/06_Advertising_System.md`.

### Score de ranking (invariante de alto nivel)
`Score = Rating + Proximidad + Disponibilidad + Conversión + Patrocinio + Calidad de Staff`

La fórmula exacta, pesos numéricos, normalización y desempates: `08-Growth-Monetization/01_Marketplace_Algorithm.md`.

### Invariantes que ningún cambio de algoritmo puede romper

1. **Nunca ocultar resultados relevantes.** La publicidad puede reordenar o destacar, pero un Negocio relevante para la búsqueda del Cliente (coincide con la especialidad, ciudad y disponibilidad buscada) nunca desaparece de los resultados por no pagar publicidad — como mucho aparece más abajo que un competidor patrocinado.
2. **Todo contenido patrocinado se marca explícitamente como "Patrocinado".** Sin excepción, en las 4 superficies donde aparezca.
3. **Presupuesto diario máximo por Negocio.** Ningún Negocio puede gastar más de su presupuesto diario configurado, incluso si tiene saldo de Wallet disponible — el límite es una protección contra gasto descontrolado, no solo un límite de saldo.
4. **Límite de saturación por zona.** En una misma búsqueda, no más de 2 posiciones consecutivas pueden ser contenido patrocinado — para que el Marketplace no se perciba como "solo anuncios".
5. **El Score nunca puede ser manipulado por señales fraudulentas** (reseñas falsas, autorreservas, referidos circulares) — ver `06-Security/03_Fraud.md`, que este documento exige explícitamente que exista y esté activo antes de que el Marketplace Ads se lance (ver `01-PRD/04_Roadmap.md`, Fase 2).

## Estados
Ver `04-Data-Model/03_State_Machines.md`, máquina "Campaña Publicitaria" (`BORRADOR` → `ACTIVA` → `PAUSADA` / `AGOTADA` / `FINALIZADA`).

## Permisos
- Barbería (Plan Jarl+) crea y gestiona sus propias campañas dentro de su presupuesto.
- SuperSU puede pausar cualquier campaña (ej. por sospecha de fraude o contenido inapropiado) y define los límites globales (presupuesto mínimo, saturación por zona).

## Dependencias
- Depende de: `01-PRD/03_Monetization.md`.
- De este documento dependen: `08-Growth-Monetization/01_Marketplace_Algorithm.md`, `08-Growth-Monetization/06_Advertising_System.md`, `06-Security/03_Fraud.md`.

## Casos límite

- **Un anuncio vencido sigue apareciendo en caché del Cliente.** El Score se recalcula en cada consulta al Marketplace (no se sirve desde una caché de resultados de más de unos minutos); un anuncio `FINALIZADA` no puede aparecer marcado como patrocinado en ninguna consulta nueva.
- **Un Negocio suspendido tenía una campaña activa.** La campaña se pausa automáticamente al momento en que el Negocio pasa a `SUSPENDIDO` (ver `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`); el presupuesto no consumido queda retenido en su Wallet, no se reembolsa automáticamente ni se pierde, hasta que el Negocio se reactive o cancele definitivamente.
- **Fraude de reseñas detectado retroactivamente sobre un periodo ya facturado como Ads.** El detalle de manejo retroactivo (recalcular Score histórico vs. solo prevenir hacia adelante) se resuelve en `06-Security/03_Fraud.md` — la regla de este documento es que, como mínimo, el Negocio fraudulento pierde inmediatamente su elegibilidad para nuevas campañas hasta resolución del caso.

## Criterios de aceptación
- [ ] Ninguna búsqueda de Marketplace puede tener más de 2 posiciones patrocinadas consecutivas, verificado automáticamente en QA.
- [ ] El 100% del contenido patrocinado está etiquetado visualmente.

## Checklist
- [x] Completo
- [ ] Revisado
