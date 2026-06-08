# Estrategia de Integración con ERPs de Terceros — Stockcurve
**Versión:** 1.0 — Junio 2026  
**Clasificación:** Interno / Decisión Técnica

---

## 1. Contexto

Stockcurve es un SaaS multi-tenant de sincronización de catálogo, stock y canales de venta. A medida que los tenants crecen, necesitan que Stockcurve se convierta en la fuente de verdad bidireccional con sus sistemas de gestión (ERP/contabilidad). Este documento analiza las opciones de integración disponibles y recomienda una arquitectura de implementación.

### ERPs objetivo (mercado AR + global)

| ERP | Mercado | Tipo API | Notas |
|---|---|---|---|
| **Tango Gestión** | AR (dominante PyME) | REST + Webhooks | Requiere plan Plus/Gold; token por empresa |
| **Xubio** | AR (cloud, contable) | REST | API pública documentada |
| **Colppy** | AR (cloud, contable) | REST | Orientado a facturación AFIP |
| **Odoo** | Global (open source) | JSON-RPC / REST (v19+) | Self-hosted o cloud; MCP disponible |
| **SAP Business One** | Global (mediana empresa) | Service Layer (REST) | On-premise + SAP Cloud |
| **Zoho Books** | Global (cloud) | REST | OAuth 2.0 |
| **QuickBooks** | Global (anglosajón) | REST | OAuth 2.0 |

---

## 2. Opciones de Integración Evaluadas

### Opción A — API Propia de Stockcurve (push/pull directo)

Stockcurve expone y consume endpoints REST. El tenant configura credenciales en el panel. Los datos fluyen directamente entre Stockcurve y el ERP sin intermediarios.

**Flujo:**
```
ERP  ←──── REST/Webhooks ────→  Stockcurve API  ←───  Tenant panel
```

**Variantes:**
- **A1. Stockcurve llama al ERP**: Stockcurve actúa como cliente REST, consulta y escribe en el ERP.
- **A2. ERP llama a Stockcurve (Webhooks)**: El ERP notifica cambios via webhook; Stockcurve los procesa.
- **A3. Bidireccional**: Combinación de A1 + A2 con lógica de conflictos.

---

### Opción B — iPaaS como capa intermedia (Make, n8n, Zapier)

Un servicio de automatización actúa como router entre Stockcurve y el ERP. El tenant configura los flujos en la plataforma iPaaS con templates provistos por Stockcurve.

**Flujo:**
```
ERP  ←──── Make / n8n ────→  Stockcurve Webhook API
```

---

### Opción C — MCP (Model Context Protocol)

Stockcurve expone un MCP Server que describe su catálogo y stock como herramientas. Los ERPs o agentes AI que soporten MCP pueden consumirlo dinámicamente sin integración específica por ERP.

**Flujo:**
```
Agente AI / ERP con MCP Client  ←──── MCP Server Stockcurve
```

---

### Opción D — Arquitectura Híbrida (Recomendada)

Combina las tres opciones según la madurez del tenant y el ERP:

```
                    ┌──────────────────────────────────┐
                    │         STOCKCURVE CORE           │
                    │                                   │
ERP Tier 1          │  ┌─────────────┐                 │
(Tango, Odoo) ──────┼─►│ REST Bridge │                 │
                    │  └─────────────┘                 │
ERP Tier 2          │  ┌─────────────┐                 │
(Xubio, Colppy)─────┼─►│ iPaaS Layer │ (n8n self-host) │
                    │  └─────────────┘                 │
Agentes AI /        │  ┌─────────────┐                 │
ERP con MCP ────────┼─►│ MCP Server  │                 │
                    │  └─────────────┘                 │
                    └──────────────────────────────────┘
```

---

## 3. Análisis FODA

### Opción A — API Propia REST

| | FORTALEZAS | DEBILIDADES |
|---|---|---|
| | Control total sobre el contrato de datos | Alto costo de desarrollo por ERP |
| | Sin dependencia de terceros | Mantenimiento permanente (cambios en ERP) |
| | SLA propio; trazabilidad completa | Requiere equipo dedicado a integraciones |
| | Diferenciador competitivo de largo plazo | Curva lenta: meses por ERP nuevo |

| | OPORTUNIDADES | AMENAZAS |
|---|---|---|
| | Marketplace de conectores (modelo Shopify) | ERPs pueden cambiar sus APIs sin aviso |
| | Cobrar por conector (plan Enterprise) | Competidores con más conectores ya hechos |
| | Webhooks entrantes = SaaS más robusto | Autenticación compleja (OAuth per-tenant) |

---

### Opción B — iPaaS (n8n / Make)

| | FORTALEZAS | DEBILIDADES |
|---|---|---|
| | Time-to-market extremadamente rápido | Dependencia de plataforma externa |
| | Cientos de conectores ya construidos | Costo escala con volumen de operaciones |
| | Sin código de integración en Stockcurve | Debugging difícil (caja negra parcial) |
| | Templates reutilizables por tenant | Latencia adicional en cada operación |

| | OPORTUNIDADES | AMENAZAS |
|---|---|---|
| | Monetizar templates en marketplace n8n | Outages de iPaaS = outage de integración |
| | Comunidad construye conectores adicionales | Costos imprevisibles a escala |
| | Puente mientras se construye API propia | Lock-in del tenant en la plataforma |

---

### Opción C — MCP

| | FORTALEZAS | DEBILIDADES |
|---|---|---|
| | Estándar emergente con adopción acelerada | Ecosistema aún inmaduro para ERPs AR |
| | Los ERPs que adopten MCP conectan solos | Pocos ERPs locales tienen MCP Client |
| | Posiciona Stockcurve como "AI-ready" | Requiere que el tenant use agentes AI |
| | Sin costo de integración por ERP | Seguridad compleja (permisos por tool) |

| | OPORTUNIDADES | AMENAZAS |
|---|---|---|
| | Diferenciador radical en el mercado | Tango/Xubio tardarán años en adoptar MCP |
| | Agentes AI autónomos para gestión de stock | Protocolo puede cambiar (versión 1.0 reciente) |
| | Vender el MCP Server a otros SaaS | Adopción lenta = ROI diferido |

---

### Opción D — Híbrida (Recomendada)

| | FORTALEZAS | DEBILIDADES |
|---|---|---|
| | Cubre todos los casos de uso y madurez | Mayor complejidad arquitectural |
| | Riesgo distribuido | Requiere mantener 3 capas |
| | Velocidad: iPaaS primero, API luego | Documentación más extensa para tenants |

| | OPORTUNIDADES | AMENAZAS |
|---|---|---|
| | Migración gradual sin disrupción | Puede crecer en deuda técnica si no se ordena |
| | Ingresos por cada capa (tiers) | Necesita governance claro por capa |

---

## 4. Plan de Implementación

### Fase 1 — Fundación (Meses 1–3)
**Costo estimado: USD 8.000–12.000 en desarrollo**

**Objetivos:**
- Diseñar y publicar la **Stockcurve Integration API** (endpoints entrantes)
- Buildear el **Webhook Receiver** + sistema de colas (Upstash o Vercel Queue)
- Publicar documentación pública de la API en `/docs/api`
- Crear 2–3 **templates n8n** para Tango y Xubio (los más pedidos en AR)

**Entregables:**
```
POST /api/webhooks/erp/{tenant}/{provider}
  → Recibe eventos de stock/pedidos del ERP
  → Valida HMAC signature
  → Encola procesamiento async

GET  /api/erp/catalog?tenant=xxx
PUT  /api/erp/stock
POST /api/erp/orders
```

**Herramientas necesarias:**
- Upstash QStash (colas async, idempotency)
- Zod (validación de payloads)
- n8n Cloud o self-hosted en Railway (~USD 5/mes)

---

### Fase 2 — Conectores Nativos Tier 1 (Meses 3–6)
**Costo estimado: USD 15.000–25.000 en desarrollo**

**Objetivos:**
- Construir el **REST Bridge** para Tango Gestión y Odoo (los de mayor demanda)
- Sistema de credenciales por tenant (encriptado en DB: `erp_connections` table)
- Sincronización bidireccional de stock: ERP → Stockcurve → ERP
- UI de configuración en el panel del tenant (igual que los canales de venta)

**Entidades sincronizadas (prioridad):**
1. Stock disponible por SKU/variante
2. Pedidos confirmados (Stockcurve → ERP)
3. Precios (ERP → Stockcurve, lectura)

**Herramientas necesarias:**
- Librería de cifrado para credenciales (`@node-rs/bcrypt` o KMS)
- Worker dedicado para polling (Vercel Cron o Trigger.dev)
- Retry logic con backoff exponencial

---

### Fase 3 — MCP Server + Conectores Tier 2 (Meses 6–12)
**Costo estimado: USD 10.000–18.000 en desarrollo**

**Objetivos:**
- Publicar **Stockcurve MCP Server** con tools de lectura/escritura
- Agregar conectores para Xubio, Colppy, Zoho Books
- Dashboard de logs de sincronización (similar al sync log de canales)
- Alertas de conflicto (stock difiere > X% entre sistemas)

**Tools MCP expuestas:**
```
get_catalog(tenant_id)           → lista de productos + variantes
get_stock(sku, tenant_id)        → stock actual
update_stock(sku, qty, reason)   → ajuste de inventario
list_orders(from_date, status)   → órdenes de venta
create_order(...)                → crear pedido
```

---

### Fase 4 — Marketplace de Conectores (Mes 12+)
**Costo estimado: USD 5.000–8.000 (plataforma) + USD 0 si terceros construyen**

- Abrir el SDK de conectores a partners/integradores
- Certificación de conectores de terceros
- Revenue sharing por uso mensual del conector

---

## 5. Costos Detallados

### Infraestructura mensual estimada (estado estable)

| Componente | Herramienta | Costo/mes |
|---|---|---|
| Cola async | Upstash QStash | USD 0–20 (tier gratuito hasta 500k msgs) |
| Jobs / Workers | Trigger.dev o Vercel Cron | USD 0–25 |
| n8n self-hosted | Railway o Fly.io | USD 5–15 |
| Logging / Observabilidad | Sentry (ya en stack) | USD 0 (plan actual) |
| Cifrado credenciales | Supabase Vault | USD 0 (incluido en Pro) |
| **Total infraestructura** | | **USD 25–60/mes** |

### Costo de desarrollo (one-time)

| Fase | Meses | USD (dev junior/mid AR) | USD (dev senior o agencia) |
|---|---|---|---|
| Fase 1 — Fundación | 1–3 | USD 6.000–9.000 | USD 12.000–18.000 |
| Fase 2 — Conectores Tier 1 | 3–6 | USD 12.000–18.000 | USD 25.000–40.000 |
| Fase 3 — MCP + Tier 2 | 6–12 | USD 8.000–14.000 | USD 18.000–30.000 |
| **Total** | **12 meses** | **USD 26.000–41.000** | **USD 55.000–88.000** |

### Modelo de monetización propuesto

| Tier | Precio/tenant/mes | Incluye |
|---|---|---|
| Starter | USD 0 | Solo webhooks entrantes + templates n8n |
| Growth | USD 29 | 1 conector nativo, 10.000 operaciones |
| Scale | USD 79 | 3 conectores, 100.000 operaciones, MCP |
| Enterprise | Custom | Conectores a medida, SLA, soporte |

**Break-even estimado:** 50 tenants en plan Growth = USD 1.450/mes cubre infraestructura. Con 200 tenants mixtos proyecta USD 8.000–12.000 MRR incremental.

---

## 6. Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Tango cambia su API sin aviso | Alta | Alto | Versionado, tests de contrato automatizados |
| ERP cliente no tiene plan con API (Tango requiere Gold+) | Alta | Medio | Documentar prerequisitos; fallback via iPaaS |
| Conflicto de stock (dos sistemas escriben simultáneamente) | Media | Alto | Event log con timestamps; Stockcurve como fuente de verdad, ERP como destino |
| Credenciales de ERP comprometidas | Baja | Muy alto | Cifrado AES-256 + Supabase Vault; nunca en env del tenant |
| Adopción MCP lenta en ERPs AR | Alta | Bajo | MCP es Fase 3; las Fases 1–2 no dependen de él |
| Costo iPaaS escala mal | Media | Medio | Migrar a API nativa cuando supere 50.000 ops/mes |
| Latencia en sync bidireccional (polling) | Media | Medio | Webhooks primero; polling solo como fallback |

---

## 7. Recomendación Final

**Implementar la Opción D (Híbrida) en orden estrictamente incremental:**

1. **Primero**: Webhook receiver + API de entrada (Fase 1) — bajo costo, alto valor inmediato, desbloquea a tenants que ya usan n8n/Make.
2. **Segundo**: Conector nativo Tango Gestión (el ERP más usado por los tenants AR actuales) — máximo ROI por ser el más solicitado.
3. **Tercero**: MCP Server — posicionamiento estratégico de largo plazo, no urgente.

**No construir conectores para ERPs que ningún tenant actual use.** Priorizar por demanda real: abrir un formulario de interés en el panel antes de invertir en un conector específico.

---

*Documento generado: Junio 2026 — Stockcurve Engineering*
