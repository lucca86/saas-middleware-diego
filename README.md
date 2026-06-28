# Stockcurve

Middleware SaaS multitenant que sincroniza catálogo, stock y precios entre un ERP y los canales de venta: WooCommerce, Tienda Nube, Mercado Libre y storefront propio.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Base de datos | Supabase (PostgreSQL) |
| Almacenamiento de imágenes | Cloudflare R2 |
| Auth | Supabase Auth |
| Email transaccional | Resend |
| UI | shadcn/ui + Tailwind CSS v4 |
| Deploy | Vercel |

---

## Requisitos previos

- Node.js >= 20
- pnpm >= 9
- Cuenta en [Supabase](https://supabase.com) con un proyecto creado
- Cuenta en [Cloudflare R2](https://developers.cloudflare.com/r2/) (opcional, para imágenes)
- Cuenta en [Resend](https://resend.com) (opcional, para emails)

---

## Instalación local

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd stockcurve
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Configurar variables de entorno

Copiar el archivo de ejemplo y completar los valores:

```bash
cp .env.example .env.local
```

Editar `.env.local` con los valores de tu proyecto Supabase y demás servicios (ver sección Variables de entorno más abajo).

### 4. Configurar la base de datos

Aplicar las migraciones SQL en tu proyecto Supabase. Las migraciones se encuentran en `supabase/migrations/` (si existe) o se deben ejecutar los scripts DDL en el orden correcto desde el panel SQL de Supabase.

Esquema mínimo requerido (tablas principales):

- `tenants` — organizaciones multitenant
- `tenant_members` — usuarios por tenant con roles
- `products` — catálogo de productos
- `product_variants` — variantes por producto
- `product_images` — imágenes por producto
- `product_types` — tipos/categorías de producto
- `categories` — categorías de productos
- `stock_movements` — movimientos de inventario
- `sales_channels` — canales de venta conectados
- `channel_product_mappings` — mapeo producto SC ↔ canal externo
- `orders` — órdenes de venta
- `order_items` — líneas de orden

### 5. Configurar Supabase Auth

En el panel de Supabase → Authentication → URL Configuration:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: agregar `http://localhost:3000/**`

### 6. Configurar cookies para desarrollo local

El archivo `lib/supabase/server.ts` usa `SameSite=None; Secure` para compatibilidad con iframes. En desarrollo local (HTTP) esto puede causar que las cookies no se persistan en algunos navegadores.

Para desarrollo local puro, asegurarse de acceder por `http://localhost:3000` (no por IP ni 127.0.0.1) y usar Chrome o Firefox con las DevTools para verificar que las cookies se establezcan correctamente.

### 7. Levantar el servidor de desarrollo

```bash
pnpm dev
```

La aplicación estará disponible en `http://localhost:3000`.

---

## Variables de entorno

Crear un archivo `.env.local` en la raíz del proyecto con los siguientes valores:

```env
# Supabase — Requerido
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_JWT_SECRET=<jwt_secret>
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_ANON_KEY=<anon_key>

# Supabase Publishable/Secret (nuevo SDK)
SUPABASE_PUBLISHABLE_KEY=<publishable_key>
SUPABASE_SECRET_KEY=<secret_key>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable_key>

# PostgreSQL directo (para migraciones o scripts)
POSTGRES_URL=<connection_string_pooler>
POSTGRES_URL_NON_POOLING=<connection_string_direct>
POSTGRES_HOST=<host>
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<password>
POSTGRES_DATABASE=postgres
POSTGRES_PRISMA_URL=<connection_string_pgbouncer>

# Cloudflare R2 — Opcional (imágenes de productos)
R2_ACCOUNT_ID=<account_id>
R2_ACCESS_KEY_ID=<access_key>
R2_SECRET_ACCESS_KEY=<secret_key>
R2_BUCKET=<bucket_name>
R2_PUBLIC_URL=https://<public_url>.r2.dev

# Resend — Opcional (emails transaccionales)
RESEND_API_KEY=<api_key>
RESEND_FROM_EMAIL=noreply@tudominio.com

# Tienda Nube — Opcional (canal de ventas)
TIENDANUBE_APP_ID=<app_id>
TIENDANUBE_CLIENT_SECRET=<client_secret>
TIENDANUBE_APP_NAME=<app_name>

# Vercel Analytics — Opcional
VERCEL_WEB_ANALYTICS_ID=<analytics_id>
```

> Los valores de `NEXT_PUBLIC_*` son expuestos al browser. Nunca colocar claves privadas con ese prefijo.

---

## Estructura del proyecto

```
app/
  admin/            # Panel de administración global
  api/              # API routes y webhooks
  app/[tenant]/     # Rutas protegidas por tenant (path-based multitenancy)
    channels/       # Canales de venta
    productos/      # Catálogo
    stock/          # Inventario
    orders/         # Órdenes
    settings/       # Configuración del tenant
  auth/             # Login, registro, sign-out
  onboarding/       # Flujo de alta de nuevo tenant
  s/[slug]/         # Storefront público por tenant

components/
  app/              # Componentes del panel (nav, sidebar, user-menu)
  channels/         # Cards de canales (WooCommerce, TiendaNube, ML)
  products/         # Tabla y formularios de productos
  ui/               # Componentes base shadcn/ui

lib/
  channels/         # Lógica de importación/exportación por canal
  products/         # Queries y lógica de productos
  supabase/         # Clientes server/client de Supabase
  r2/               # Upload y proxy de imágenes en R2
  email/            # Notificaciones por email
  orders/           # Lógica de órdenes
  stock/            # Movimientos de stock

public/
  channels/         # Logotipos de canales de venta
```

---

## Multitenancy

La app usa **path-based multitenancy**: cada tenant accede en `/app/[tenant-slug]/*`. El slug del tenant se resuelve en el layout y se propaga via context. Cada query a la base de datos incluye `tenant_id` explícito — no hay Row Level Security automatizado para la mayoría de las operaciones del servidor.

---

## Canales de venta soportados

| Canal | Import | Export/Sync |
|---|---|---|
| WooCommerce | Productos, variantes, imágenes, categorías, tags | Productos, variantes, stock, precio |
| Tienda Nube | Productos, variantes, imágenes | Webhooks de órdenes |
| Mercado Libre | Productos, variantes | Export de catálogo |

---

## Deploy en Vercel

1. Conectar el repositorio en [vercel.com](https://vercel.com)
2. Agregar todas las variables de entorno en el panel de Vercel (Settings → Environment Variables)
3. El build command es `pnpm build` y el output directory es `.next`
4. Configurar el dominio y agregar la URL de producción en Supabase Auth → Redirect URLs

---

## Comandos útiles

```bash
pnpm dev          # Servidor de desarrollo con Turbopack
pnpm build        # Build de producción
pnpm start        # Servidor de producción local
pnpm lint         # ESLint
```
