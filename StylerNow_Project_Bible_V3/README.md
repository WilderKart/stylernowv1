# StylerNow — Project Bible V3

Fuente de verdad única del proyecto. Si una regla no está aquí, no existe todavía — se documenta antes de implementarse, no durante.

**Producto:** el sistema operativo para negocios de citas de belleza, cuidado personal y bienestar en Colombia — barberías, salones, estilistas, manicuristas, lashistas, tatuadores, spa, masajes, grooming masculino y negocios multi-servicio. 4 superficies: Cliente PWA (Capacitor-ready), Panel Negocio, App Staff, SuperSU CMS. Marketplace, multi-tenant, IA operacional, CRM, POS, fidelización y publicidad incluidos desde el diseño.

**Antes de leer cualquier otra cosa:** `Glossary.md` y `Architecture_Decision_Log.md`.

## Estado de la Biblia

Ver `00_AUDIT_REPORT.md` para el diagnóstico completo y el orden de ejecución. Este índice se actualiza en cada cambio de estado de un documento.

Leyenda: ✅ completo · 🟡 parcial · ⬜ pendiente

### Raíz
| Documento | Estado |
|---|---|
| `00_AUDIT_REPORT.md` | ✅ |
| `Glossary.md` | ✅ |
| `Architecture_Decision_Log.md` | ✅ |
| `Documentation_Standards.md` | ✅ |
| `Business_Rules_Bible.md` | ✅ |
| `ADR_001_Monetization_Principles.md` | ✅ |
| `ADR_002_Role_Architecture.md` | ✅ |
| `Pricing_Strategy.md` | ✅ |
| `AI_Credit_System.md` | ✅ |
| `WhatsApp_Delivery_Engine.md` | ✅ |
| `Guardian_Lifecycle.md` | ✅ |
| `Staff_Transfer_Workflow.md` | ✅ |
| `README.md` (este archivo) | ✅ |

### 01-PRD
| Documento | Estado |
|---|---|
| `00_Index.md` | ✅ |
| `01_Product_Vision.md` | ✅ |
| `02_Functional_Architecture.md` | ✅ |
| `03_Monetization.md` | ✅ |
| `04_Roadmap.md` | ✅ |
| `05_KPIs.md` | ✅ |

### 02-UX
| Documento | Estado |
|---|---|
| `01_User_Journeys.md` | ✅ |
| `02_Onboarding.md` | ✅ |
| `03_Client_PWA.md` | ✅ |
| `04_Marketplace.md` | ✅ |
| `05_Booking.md` | ✅ |
| `06_Payments.md` | ✅ |
| `07_Appointments.md` | ✅ |
| `08_Staff_App.md` | ✅ |
| `09_Business_Panel.md` | ✅ |
| `10_Super_Admin.md` | ✅ |
| `11_Notifications.md` | ✅ |
| `12_Errors_States.md` | ✅ |

### 03-Business-Rules
| Documento | Estado |
|---|---|
| `01_Roles.md` | ✅ |
| `02_Booking_Rules.md` | ✅ |
| `03_Payment_Rules.md` | ✅ |
| `04_Lealtad.md` | ✅ |
| `05_Staff_Rewards.md` | ✅ |
| `06_Marketplace_Ads.md` | ✅ |
| `07_CRM.md` | ✅ |
| `08_Edge_Cases.md` | ✅ |
| `09_No_Show_Policy.md` | ✅ |
| `10_Waitlist_System.md` | ✅ |

### 04-Data-Model
| Documento | Estado |
|---|---|
| `01_Entities.md` | ✅ |
| `02_Relationships.md` | ✅ |
| `03_State_Machines.md` | ✅ |
| `04_Audit.md` | ✅ |
| `05_Data_Retention.md` | ✅ |

### 05-API
| Documento | Estado |
|---|---|
| `01_Standards.md` | ✅ |
| `02_Auth.md` | ✅ |
| `03_Bookings.md` | ✅ |
| `04_Payments.md` | ✅ |
| `05_Marketplace.md` | ✅ |
| `06_Webhooks.md` | ✅ |

### 06-Security
| Documento | Estado |
|---|---|
| `01_Security_Model.md` | ✅ |
| `02_RLS.md` | ✅ |
| `03_Fraud.md` | ✅ |
| `04_Compliance_Colombia.md` | ✅ |

### 07-QA (completado al final — ver Sección 6 del audit report) — 1.005 casos de prueba totales
| Documento | Estado |
|---|---|
| `01_Strategy.md` | ✅ |
| `02_Client.md` | ✅ (130 casos) |
| `03_Staff.md` | ✅ (90 casos) |
| `04_Business.md` | ✅ (115 casos) |
| `05_Admin.md` | ✅ (65 casos) |
| `06_Marketplace.md` | ✅ (80 casos) |
| `07_Payments.md` | ✅ (110 casos) |
| `08_Notifications.md` | ✅ (75 casos) |
| `09_AI.md` | ✅ (75 casos) |
| `10_Regression.md` | ✅ (265 casos) |

### 08-Growth-Monetization *(carpeta nueva)*
| Documento | Estado |
|---|---|
| `01_Marketplace_Algorithm.md` | ✅ |
| `02_Commissions.md` | ✅ |
| `03_Tips_Distribution.md` | ✅ |
| `04_Subscriptions_Lifecycle.md` | ✅ |
| `05_Billing_Failures.md` | ✅ |
| `06_Advertising_System.md` | ✅ |

### 09-CRM-Intelligence *(carpeta nueva)*
| Documento | Estado |
|---|---|
| `01_CRM_Complete.md` | ✅ |
| `02_AI_Client.md` | ✅ |
| `03_AI_Staff.md` | ✅ |
| `04_AI_Business.md` | ✅ |

### 10-Operations *(carpeta nueva)*
| Documento | Estado |
|---|---|
| `01_Feature_Flags.md` | ✅ |
| `02_Migration_Strategy.md` | ✅ |
| `03_Disaster_Recovery.md` | ✅ |
| `04_Logs_Policy.md` | ✅ |
| `05_Release_Process.md` | ✅ |
| `06_Analytics_Definitions.md` | ✅ |

## Cómo navegar

Ver `01-PRD/00_Index.md` para el orden de lectura recomendado por rol.

## Objetivo de la Biblia

Eliminar vacíos antes del desarrollo. Ningún desarrollador debería preguntar "¿qué pasa si ocurre X?" — si la pregunta es razonable, la respuesta ya está escrita en alguno de estos documentos.
