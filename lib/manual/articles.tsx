import type { ReactNode } from "react"
import {
  BookOpen,
  Boxes,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Network,
  Package,
  ShieldCheck,
  Store,
} from "lucide-react"
import {
  Callout,
  GlossaryTerm,
  Kbd,
  RoleBadge,
  StepList,
} from "@/components/manual/manual-primitives"

/**
 * The manual is content-as-code: each article is a TSX module so we can use
 * UI primitives (callouts, role badges, glossary terms) directly while still
 * being able to index everything for search.
 */

export type ManualCategoryId =
  | "intro"
  | "roles"
  | "products"
  | "stock"
  | "storefront"
  | "glossary"
  | "faq"

export interface ManualCategory {
  id: ManualCategoryId
  label: string
  description: string
  icon: typeof BookOpen
}

export const MANUAL_CATEGORIES: ManualCategory[] = [
  {
    id: "intro",
    label: "Empezar acá",
    description: "Cómo funciona Pulpo y qué problema resuelve.",
    icon: BookOpen,
  },
  {
    id: "roles",
    label: "Usuarios y permisos",
    description: "Diferencias entre administradores del sistema y del tenant.",
    icon: ShieldCheck,
  },
  {
    id: "products",
    label: "Catálogo",
    description: "Productos, tipos, variantes, listas de opciones e imágenes.",
    icon: Package,
  },
  {
    id: "stock",
    label: "Inventario",
    description: "Movimientos de stock con auditoría inmutable.",
    icon: Boxes,
  },
  {
    id: "storefront",
    label: "Storefront",
    description: "Cómo publicar la tienda pública y configurar el contacto.",
    icon: Store,
  },
  {
    id: "glossary",
    label: "Glosario",
    description: "Definiciones rápidas de los términos del producto.",
    icon: ListChecks,
  },
  {
    id: "faq",
    label: "Preguntas frecuentes",
    description: "Cosas que confunden a casi todos al empezar.",
    icon: HelpCircle,
  },
]

export interface ManualArticle {
  slug: string
  title: string
  category: ManualCategoryId
  summary: string
  /** Plain-text keywords used by the search index. */
  keywords: string[]
  /** Plain-text body used by the search index (no JSX). */
  searchText: string
  content: () => ReactNode
}

/* -------------------------------------------------------------------------- */
/*                                 ARTICLES                                    */
/* -------------------------------------------------------------------------- */

const intro: ManualArticle = {
  slug: "bienvenida",
  title: "Bienvenida al manual",
  category: "intro",
  summary: "Para qué sirve Pulpo y cómo está pensada la app.",
  keywords: ["intro", "que es", "para que sirve", "pulpo", "overview"],
  searchText:
    "Pulpo es un panel de catálogo y stock para comercios. Maneja productos con variantes, listas de opciones reutilizables, imágenes, stock auditado y un storefront público. Es multi-tenant: cada tenant es un negocio independiente con sus propios datos.",
  content: () => (
    <>
      <p>
        Pulpo es un panel para administrar el catálogo, el inventario y la
        tienda pública de un comercio. Está pensado para negocios chicos y
        medianos que necesitan trazabilidad real de stock sin complejizarse con
        un ERP completo.
      </p>
      <h2>Qué incluye</h2>
      <ul>
        <li>Productos con variantes (talles, colores, materiales) generadas a partir de tipos.</li>
        <li>Listas reutilizables de opciones para no recargar talles o paletas a mano cada vez.</li>
        <li>Imágenes por producto con CDN propio.</li>
        <li>Stock con log inmutable: cada cambio queda registrado.</li>
        <li>Storefront público bajo <code>/s/&lt;tu-slug&gt;</code> con WhatsApp como canal de contacto.</li>
      </ul>
      <Callout variant="tip" title="Nuevo en Pulpo">
        Si recién empezás, leé <strong>Arquitectura</strong> y <strong>Usuarios y permisos</strong>{" "}
        antes de cargar productos. Te ahorra cinco re-cargas.
      </Callout>
    </>
  ),
}

const architecture: ManualArticle = {
  slug: "arquitectura",
  title: "Arquitectura: tenants y multi-tenancy",
  category: "intro",
  summary: "Por qué cada negocio vive en su propio tenant y cómo se aísla la información.",
  keywords: ["tenant", "multitenant", "arquitectura", "aislamiento", "rls"],
  searchText:
    "Multi-tenancy: cada negocio es un tenant aislado por RLS. Los datos están separados a nivel base de datos. Un usuario puede pertenecer a varios tenants con distintos roles. Switcher en la barra superior. Storefront público en /s/<slug>.",
  content: () => (
    <>
      <p>
        Pulpo es un sistema multi-tenant. Cada <strong>tenant</strong> es un
        negocio independiente con sus propios productos, stock, storefront y
        miembros. Los datos viven en una sola base de datos, pero están
        aislados por <strong>Row Level Security</strong>: las consultas siempre
        filtran por el tenant del usuario.
      </p>
      <h2>Qué implica esto en la práctica</h2>
      <ul>
        <li>
          Cada tenant tiene un <strong>slug</strong> que aparece en la URL del
          panel (<code>/app/&lt;slug&gt;</code>) y en el storefront público
          (<code>/s/&lt;slug&gt;</code>).
        </li>
        <li>
          Un mismo usuario puede pertenecer a varios tenants. El selector está
          arriba a la izquierda en el sidebar.
        </li>
        <li>
          Si tu rol cambia entre tenants, los menúes y permisos también
          cambian.
        </li>
      </ul>
      <Callout variant="shield" title="Aislamiento real">
        Las políticas de RLS rechazan cualquier consulta que no incluya tu
        membresía como condición. Aunque la app tuviera un bug, la base de
        datos no devuelve filas de tenants ajenos.
      </Callout>
    </>
  ),
}

const roles: ManualArticle = {
  slug: "roles-y-permisos",
  title: "Roles y permisos",
  category: "roles",
  summary:
    "Diferencia entre administradores del sistema (middleware) y administradores de tenant. Qué puede hacer cada rol.",
  keywords: [
    "roles",
    "permisos",
    "owner",
    "admin",
    "operator",
    "viewer",
    "superadmin",
    "sysadmin",
    "middleware",
  ],
  searchText:
    "Roles: superadmin (sistema), owner, admin, operator, viewer (tenant). Superadmin gestiona la plataforma. Owner es dueño del tenant. Admin configura el tenant. Operator opera día a día. Viewer solo lectura. Permisos por acción.",
  content: () => (
    <>
      <p>
        Pulpo distingue dos planos de permisos: el <strong>plano de
        plataforma</strong> (el sistema entero) y el <strong>plano de
        tenant</strong> (un negocio puntual).
      </p>

      <h2>Plano de plataforma</h2>
      <p>
        Es el rol que tiene una persona <em>respecto al sistema completo</em>.
        Hoy hay uno solo:
      </p>
      <ul>
        <li>
          <RoleBadge scope="system" role="superadmin" /> — Administrador del
          sistema. Es quien opera Pulpo como producto: aprueba nuevos tenants,
          gestiona facturación, accede a soporte cross-tenant, hace migraciones
          y mantenimiento. <strong>No</strong> ve el catálogo de un tenant a
          menos que sea miembro de ese tenant.
        </li>
      </ul>
      <Callout variant="info" title="¿Por qué se le dice &ldquo;admin del middleware&rdquo;?">
        Por convención técnica: el superadmin opera capas que están por encima
        de los tenants (autenticación, routing, infraestructura). En la
        documentación interna a veces lo verás como <em>sysadmin</em>,{" "}
        <em>platform admin</em> o <em>middleware admin</em>. Son sinónimos.
      </Callout>

      <h2>Plano de tenant</h2>
      <p>Cada miembro de un tenant tiene exactamente uno de estos roles:</p>
      <ul>
        <li>
          <RoleBadge scope="tenant" role="owner" /> — Dueño del negocio. Único
          rol que puede transferir la titularidad, eliminar el tenant y editar
          la facturación. Puede hacer todo lo que hace un admin.
        </li>
        <li>
          <RoleBadge scope="tenant" role="admin" /> — Administrador del
          tenant. Configura el catálogo (tipos, listas, categorías), invita
          miembros, publica el storefront, gestiona stock y precios.
        </li>
        <li>
          <RoleBadge scope="tenant" role="operator" /> — Opera el día a día:
          carga productos, sube imágenes, registra movimientos de stock. No
          puede invitar gente ni cambiar la configuración del tenant.
        </li>
        <li>
          <RoleBadge scope="tenant" role="viewer" /> — Solo lectura. Útil para
          contadores, auditores o socios que necesitan ver la información sin
          modificarla.
        </li>
      </ul>

      <h2>Tabla rápida de permisos por acción</h2>
      <div className="my-4 overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Acción</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Admin</th>
              <th className="px-3 py-2">Operator</th>
              <th className="px-3 py-2">Viewer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              ["Ver catálogo", "Sí", "Sí", "Sí", "Sí"],
              ["Crear/editar productos", "Sí", "Sí", "Sí", "—"],
              ["Subir imágenes", "Sí", "Sí", "Sí", "—"],
              ["Registrar stock", "Sí", "Sí", "Sí", "—"],
              ["Configurar tipos / listas / categorías", "Sí", "Sí", "—", "—"],
              ["Publicar storefront", "Sí", "Sí", "—", "—"],
              ["Invitar / quitar miembros", "Sí", "Sí", "—", "—"],
              ["Eliminar tenant", "Sí", "—", "—", "—"],
            ].map(([action, ...vals]) => (
              <tr key={action as string}>
                <td className="px-3 py-2 font-medium text-foreground">{action}</td>
                {vals.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-muted-foreground">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout variant="warning" title="Cuidado al asignar &ldquo;admin&rdquo;">
        Un admin del tenant puede invitar a más admins. Si tu equipo va a
        crecer, mantené pocos owners y reservá <em>admin</em> para gente que
        realmente necesita configurar el negocio.
      </Callout>
    </>
  ),
}

const productsModel: ManualArticle = {
  slug: "productos-tipos-variantes",
  title: "Productos, tipos y variantes",
  category: "products",
  summary:
    "Cómo se modelan los productos: el tipo define los atributos, las variantes son las combinaciones reales que vendés.",
  keywords: ["productos", "variantes", "tipos", "atributos", "sku"],
  searchText:
    "Producto, tipo, atributos, variantes. El tipo define qué atributos tiene un producto y cuáles generan variantes. Variantes son combinaciones de valores. Cada variante tiene SKU, precio, stock, status.",
  content: () => (
    <>
      <p>
        Un producto en Pulpo no es una cosa plana. Está formado por:
      </p>
      <ul>
        <li>
          <strong>Producto</strong>: la unidad conceptual (&ldquo;Remera básica&rdquo;).
        </li>
        <li>
          <strong>Tipo de producto</strong>: define qué atributos tiene
          (&ldquo;Indumentaria&rdquo; tiene talle y color). Lo definís una sola
          vez y lo reutilizás.
        </li>
        <li>
          <strong>Variantes</strong>: las combinaciones reales que se venden
          (Talle M / Color Negro). Cada variante tiene SKU, precio, costo y
          stock propios.
        </li>
      </ul>
      <h2>Cómo se generan las variantes</h2>
      <StepList
        steps={[
          <>Definís el tipo de producto y marcás qué atributos generan variantes (ej. talle y color sí, material no).</>,
          <>Asignás ese tipo al producto.</>,
          <>Pulpo genera la matriz cartesiana de variantes (todas las combinaciones).</>,
          <>Editás stock inicial y precio en la matriz; el resto se hereda del producto.</>,
        ]}
      />
      <Callout variant="tip" title="Listas de opciones">
        Para no escribir XS-S-M-L-XL todas las veces, creá una <strong>lista
        de opciones</strong> y enchufala como fuente del atributo. Cambiar la
        lista actualiza todos los tipos que la usan.
      </Callout>
    </>
  ),
}

const optionLists: ManualArticle = {
  slug: "listas-de-opciones",
  title: "Listas de opciones reutilizables",
  category: "products",
  summary: "Talles, colores y materiales que enchufás a varios tipos de producto.",
  keywords: ["listas", "talles", "colores", "materiales", "curva"],
  searchText:
    "Listas de opciones reutilizables: talles, colores, materiales, otras. Antes se llamaban curvas de talles. Cada lista tiene un kind y un set de valores. Se enchufan en atributos de tipos de producto.",
  content: () => (
    <>
      <p>
        Las <strong>Listas de opciones</strong> son catálogos reutilizables de
        valores. Tienen un <em>kind</em> que las clasifica:
      </p>
      <ul>
        <li><strong>Talles</strong> (XS-XXL, 1-12 años, 36-45)</li>
        <li><strong>Colores</strong> (paleta básica, paleta de temporada)</li>
        <li><strong>Materiales</strong> (algodón, lino, denim, sintético)</li>
        <li><strong>Otra</strong> para cualquier dimensión que se te ocurra</li>
      </ul>
      <p>
        Cada atributo de un tipo de producto puede tomar sus opciones de una
        lista o tener opciones manuales. Si después agregás un valor a la lista,
        todos los tipos que la usan lo ven automáticamente.
      </p>
      <Callout variant="info" title="Migración de nombres">
        Antes este módulo se llamaba <em>Curvas de talles</em>. La idea de
        &ldquo;curva&rdquo; quedó chica cuando aparecieron colores y
        materiales. La data anterior se preservó: tus curvas siguen donde las
        dejaste, con el kind <em>Talles</em>.
      </Callout>
    </>
  ),
}

const images: ManualArticle = {
  slug: "imagenes",
  title: "Imágenes y CDN",
  category: "products",
  summary: "Cómo se suben las imágenes, dónde se guardan y por qué pasan por nuestro proxy.",
  keywords: ["imagenes", "fotos", "r2", "cdn", "cors", "proxy"],
  searchText:
    "Las imágenes se suben a Cloudflare R2. La app las sirve a través de /api/images/<key> para evitar problemas de CORS. Storage key incluye tenant id y product id. Máximo 10MB por archivo.",
  content: () => (
    <>
      <p>
        Las imágenes de productos se almacenan en <strong>Cloudflare R2</strong>{" "}
        (compatible con S3) y se sirven a través de un proxy interno{" "}
        <code>/api/images/&lt;storage_key&gt;</code>.
      </p>
      <h2>¿Por qué un proxy?</h2>
      <p>
        Servir las imágenes desde el dominio de la app evita problemas de CORS
        para herramientas externas (snapshot tools, cachés, OG crawlers) que
        intentan hacer <code>fetch()</code> contra los archivos. Es una
        decisión deliberada de portabilidad.
      </p>
      <h2>Límites y formatos</h2>
      <ul>
        <li>Tamaño máximo: <strong>10 MB</strong> por archivo.</li>
        <li>Formatos aceptados: JPEG, PNG, WebP, AVIF, GIF.</li>
        <li>La primera imagen subida queda como <em>principal</em>; podés cambiarla con el botón <Kbd>★</Kbd>.</li>
      </ul>
      <Callout variant="tip" title="Optimización">
        Subí imágenes ya optimizadas (1200px de ancho alcanza para producto).
        El proxy cachea con <em>immutable</em> y los nombres incluyen un UUID,
        así que un cambio de imagen es una subida nueva, no una sobreescritura.
      </Callout>
    </>
  ),
}

const stock: ManualArticle = {
  slug: "stock",
  title: "Stock y movimientos",
  category: "stock",
  summary:
    "Cada cambio de stock es un movimiento inmutable. Por qué importa y cómo registrar entradas, salidas y ajustes.",
  keywords: ["stock", "inventario", "movimientos", "auditoria", "trigger"],
  searchText:
    "Stock con log inmutable. Tipos: initial, in (entrada), out (salida), adjustment (ajuste). Trigger en DB actualiza product_variants.stock. Rechaza movimientos que dejen negativo. Sin update/delete en stock_movements.",
  content: () => (
    <>
      <p>
        El stock en Pulpo no se edita directamente. Cada cambio se registra
        como un <strong>movimiento</strong> en una tabla <em>append-only</em>:
        no se puede modificar ni borrar, solo agregar.
      </p>
      <h2>Tipos de movimiento</h2>
      <ul>
        <li><strong>Inicial</strong>: cuando creás una variante con stock.</li>
        <li><strong>Entrada</strong>: ingreso de mercadería (compra, devolución).</li>
        <li><strong>Salida</strong>: venta, descarte, robo, devolución a proveedor.</li>
        <li><strong>Ajuste</strong>: corrección de inventario (diferencia tras un conteo físico).</li>
      </ul>
      <h2>Cómo se mantiene sincronizado</h2>
      <p>
        Un <em>trigger</em> en la base de datos suma el delta del movimiento al
        campo <code>stock</code> de la variante. Si el resultado quedaría
        negativo, el movimiento se <strong>rechaza</strong> y la operación se
        revierte entera.
      </p>
      <Callout variant="shield" title="Por qué importa">
        Un log inmutable hace que el inventario sea auditable: siempre podés
        responder &ldquo;¿quién, cuándo y por qué bajó el stock de la variante
        X?&rdquo;. Es la diferencia entre &ldquo;creo que vendí cinco&rdquo; y
        &ldquo;el sistema dice que vendí cinco con timestamp y motivo&rdquo;.
      </Callout>
      <h2>Cómo registrar un movimiento</h2>
      <StepList
        steps={[
          <>Andá a <Kbd>Stock</Kbd> en el sidebar.</>,
          <>Buscá la variante en la tabla y hacé click en <em>Movimiento</em>.</>,
          <>Elegí Entrada / Salida / Ajuste, ingresá la cantidad y un motivo.</>,
          <>El stock se actualiza al instante. El movimiento queda en el historial.</>,
        ]}
      />
    </>
  ),
}

const storefront: ManualArticle = {
  slug: "storefront",
  title: "Publicar tu tienda pública",
  category: "storefront",
  summary: "Cómo configurar y publicar el storefront, y cómo se conecta con WhatsApp.",
  keywords: ["storefront", "tienda", "publicar", "whatsapp", "publico"],
  searchText:
    "Storefront público en /s/<slug>. Switch publicar/despublicar. Solo funciona con productos activos. Hero, contacto WhatsApp e Instagram, accent color. Sin carrito: el botón abre WhatsApp.",
  content: () => (
    <>
      <p>
        El storefront es la tienda pública que cualquiera puede visitar en{" "}
        <code>/s/&lt;tu-slug&gt;</code>. No necesita login. La activación es un
        switch en el panel.
      </p>
      <h2>Pre-requisitos</h2>
      <ul>
        <li>Al menos un producto en estado <em>activo</em>.</li>
        <li>Para que el botón de contacto funcione, configurar WhatsApp en el panel.</li>
      </ul>
      <h2>Qué muestra</h2>
      <ul>
        <li>Hero con título, subtítulo y descripción que vos definís.</li>
        <li>Grid de productos activos con filtros por categoría.</li>
        <li>Detalle con galería, selector de variantes y precio dinámico.</li>
        <li>Botón <em>Consultar por WhatsApp</em> con mensaje pre-armado (incluye nombre del producto, variante y URL).</li>
      </ul>
      <Callout variant="info" title="Sin carrito todavía">
        Por ahora el flujo de compra es por WhatsApp. La integración de
        checkout interno con órdenes está en el roadmap.
      </Callout>
      <h2>Tema visual</h2>
      <p>
        El storefront fuerza tema claro y aplica un <em>accent color</em>
        configurable como color de marca. Las imágenes son las mismas que cargás
        en el catálogo (servidas vía proxy).
      </p>
    </>
  ),
}

const channels: ManualArticle = {
  slug: "canales-y-deploy-new-node",
  title: "Canales (Deploy New Node)",
  category: "intro",
  summary: "Qué significa el botón &ldquo;Deploy New Node&rdquo; del sidebar y para qué sirve.",
  keywords: ["nodo", "node", "deploy", "canal", "channel", "integracion"],
  searchText:
    "Deploy New Node es el botón para crear un canal. Un nodo o channel es un destino donde se publica el catálogo: storefront, marketplace, integración API. Pulpo es el hub central.",
  content: () => (
    <>
      <p>
        En el sidebar hay un botón llamado <strong>Deploy New Node</strong>.
        Suena críptico la primera vez. La traducción literal es{" "}
        <em>desplegar un nuevo nodo</em>, pero en el dominio de Pulpo significa{" "}
        <strong>conectar un nuevo canal de venta</strong>.
      </p>
      <h2>Modelo mental</h2>
      <p>
        Pensá tu catálogo como una señal central. Un <strong>nodo</strong> es
        cada destino al que esa señal llega:
      </p>
      <ul>
        <li>El <strong>storefront propio</strong> en <code>/s/&lt;slug&gt;</code>.</li>
        <li>Un <strong>marketplace</strong> (Mercado Libre, TiendaNube) cuando exista la integración.</li>
        <li>Un <strong>endpoint API</strong> de un partner.</li>
        <li>Un <strong>feed de Instagram Shopping / Google Merchant</strong>.</li>
      </ul>
      <p>
        El botón abre el flujo para crear y configurar uno nuevo. Por ahora el
        canal estable es el storefront propio; los demás se van agregando.
      </p>
      <Callout variant="tip" title="¿Por qué la jerga?">
        Pulpo está pensado como un <em>hub</em> de catálogo: el negocio es uno,
        los lugares donde aparece son muchos. Llamarlos &ldquo;nodos&rdquo;
        deja explícito que el origen de verdad es Pulpo y no cada canal.
      </Callout>
    </>
  ),
}

const glossary: ManualArticle = {
  slug: "glosario",
  title: "Glosario",
  category: "glossary",
  summary: "Definiciones rápidas de los términos que vas a ver en la app.",
  keywords: ["glosario", "definicion", "terminos"],
  searchText:
    "Tenant, slug, producto, variante, atributo, lista de opciones, kind, curva, sku, storage key, RLS, superadmin, owner, admin, operator, viewer, node, channel, storefront, movimiento, trigger.",
  content: () => (
    <dl className="mt-2">
      <GlossaryTerm term="Tenant">
        Negocio dentro de Pulpo. Aislado por RLS, con su propio slug, miembros y datos.
      </GlossaryTerm>
      <GlossaryTerm term="Slug">
        Identificador legible de un tenant o un producto, usado en URLs.
      </GlossaryTerm>
      <GlossaryTerm term="Producto">
        Unidad conceptual del catálogo. No tiene SKU ni stock por sí mismo: lo tienen sus variantes.
      </GlossaryTerm>
      <GlossaryTerm term="Variante">
        Combinación concreta de valores de atributos. Talle M + Color Negro = una variante.
      </GlossaryTerm>
      <GlossaryTerm term="Atributo">
        Dimensión de un producto (talle, color, material). Puede ser variante o no.
      </GlossaryTerm>
      <GlossaryTerm term="Tipo de producto">
        Plantilla de atributos. Definís &ldquo;Indumentaria&rdquo; una vez y lo aplicás a varios productos.
      </GlossaryTerm>
      <GlossaryTerm term="Lista de opciones">
        Catálogo reutilizable de valores (XS-XXL, paleta básica). Antes se llamaba <em>curva</em>.
      </GlossaryTerm>
      <GlossaryTerm term="Kind">
        Subtipo de una lista: <em>size</em>, <em>color</em>, <em>material</em>, <em>other</em>.
      </GlossaryTerm>
      <GlossaryTerm term="SKU">
        Código único interno de una variante. No lo expone el storefront.
      </GlossaryTerm>
      <GlossaryTerm term="Storage key">
        Ruta de un archivo en R2. Tiene el formato <code>tenants/&lt;tid&gt;/products/&lt;pid&gt;/&lt;uuid&gt;.jpg</code>.
      </GlossaryTerm>
      <GlossaryTerm term="RLS">
        Row Level Security. Política de la base de datos que filtra filas según el usuario autenticado.
      </GlossaryTerm>
      <GlossaryTerm term="Superadmin">
        Administrador del sistema (plano de plataforma). No accede al catálogo si no es miembro del tenant.
      </GlossaryTerm>
      <GlossaryTerm term="Owner">
        Dueño del tenant. Único rol que puede transferir titularidad y eliminar el tenant.
      </GlossaryTerm>
      <GlossaryTerm term="Admin (tenant)">
        Configura tipos, listas, categorías, miembros y publicación.
      </GlossaryTerm>
      <GlossaryTerm term="Operator">
        Operador del día a día. Carga productos, sube imágenes, registra stock.
      </GlossaryTerm>
      <GlossaryTerm term="Viewer">
        Solo lectura. Útil para auditores o socios.
      </GlossaryTerm>
      <GlossaryTerm term="Node / Channel">
        Canal donde se publica el catálogo (storefront, marketplace, feed). El botón <em>Deploy New Node</em> crea uno.
      </GlossaryTerm>
      <GlossaryTerm term="Storefront">
        Tienda pública en <code>/s/&lt;slug&gt;</code>. No requiere login.
      </GlossaryTerm>
      <GlossaryTerm term="Movimiento de stock">
        Registro inmutable de un cambio de inventario. Tipos: initial, in, out, adjustment.
      </GlossaryTerm>
      <GlossaryTerm term="Trigger">
        Función de la base de datos que se ejecuta automáticamente. El de stock aplica el delta a la variante.
      </GlossaryTerm>
    </dl>
  ),
}

const faq: ManualArticle = {
  slug: "faq",
  title: "Preguntas frecuentes",
  category: "faq",
  summary: "Lo que más confunde al empezar.",
  keywords: ["faq", "preguntas", "ayuda", "soporte"],
  searchText:
    "FAQ. Por qué no aparece el producto en el storefront. Por qué el stock no me deja salir. Cómo cambio el rol de un miembro. Olvidé mi contraseña. Diferencia entre admin del sistema y admin del tenant.",
  content: () => (
    <>
      <h2>No me aparece el producto en el storefront</h2>
      <p>
        Tres condiciones tienen que cumplirse: el producto debe estar{" "}
        <strong>activo</strong>, debe tener al menos una variante activa con
        precio, y el tenant debe estar <strong>publicado</strong> (switch en{" "}
        <Kbd>Storefront</Kbd>).
      </p>

      <h2>El sistema no me deja registrar una salida de stock</h2>
      <p>
        Si la salida deja el stock en negativo, el trigger la rechaza. Verificá
        que la cantidad disponible sea suficiente o registrá primero un{" "}
        <em>ajuste</em> con la cantidad real que tenés en góndola.
      </p>

      <h2>¿Quién puede invitar miembros nuevos?</h2>
      <p>
        Solo <RoleBadge scope="tenant" role="owner" /> y{" "}
        <RoleBadge scope="tenant" role="admin" />.
      </p>

      <h2>¿Un superadmin del sistema puede ver mi catálogo?</h2>
      <p>
        No, salvo que sea miembro de tu tenant. La RLS de la base de datos
        rechaza cualquier consulta cross-tenant aunque el usuario tenga rol de
        plataforma.
      </p>

      <h2>¿Qué pasa si un miembro deja la empresa?</h2>
      <p>
        Quitalo desde <Kbd>Settings → Miembros</Kbd>. Sus movimientos de stock
        permanecen registrados con su nombre (el log es inmutable) pero pierde
        acceso al panel inmediatamente.
      </p>

      <h2>¿Cómo cambio el slug de mi tenant?</h2>
      <p>
        Solo el owner puede hacerlo, desde Settings. Tené en cuenta que cambia
        la URL pública del storefront: links viejos dejan de funcionar.
      </p>
    </>
  ),
}

/* -------------------------------------------------------------------------- */

export const MANUAL_ARTICLES: ManualArticle[] = [
  intro,
  architecture,
  channels,
  roles,
  productsModel,
  optionLists,
  images,
  stock,
  storefront,
  glossary,
  faq,
]

export function getArticle(slug: string): ManualArticle | undefined {
  return MANUAL_ARTICLES.find((a) => a.slug === slug)
}

export function articlesByCategory(category: ManualCategoryId): ManualArticle[] {
  return MANUAL_ARTICLES.filter((a) => a.category === category)
}

/**
 * Plain-text index used by the search box. Keeps the client bundle small:
 * no JSX, just strings.
 */
export interface ManualSearchIndex {
  slug: string
  title: string
  category: ManualCategoryId
  summary: string
  haystack: string
}

export function buildSearchIndex(): ManualSearchIndex[] {
  return MANUAL_ARTICLES.map((a) => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    summary: a.summary,
    haystack: [a.title, a.summary, a.keywords.join(" "), a.searchText]
      .join(" ")
      .toLowerCase(),
  }))
}

/** Re-export icons used by category cards on the manual home. */
export const CATEGORY_FALLBACK_ICONS = {
  Layers,
  ImageIcon,
  Network,
} as const
