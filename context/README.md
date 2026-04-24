# /context — Archivos de referencia para v0

Esta carpeta es un **espacio de referencia humana y para v0**. No se bundlea en
producción ni se importa desde el código de la aplicación.

## Propósito

Dejá aquí cualquier archivo que quieras que v0 use como contexto al trabajar:

- Mockups, screenshots, referencias visuales
- Especificaciones de negocio o flujos
- Documentación de integraciones externas (WooCommerce, Tienda Nube, ML, ERPs)
- Ejemplos de payloads, CSVs, schemas reales de clientes
- Notas de arquitectura o decisiones técnicas

## Estructura sugerida

```
context/
├── README.md              <- este archivo
├── design/                <- imágenes, mockups, referencias visuales
├── specs/                 <- specs de negocio, flujos, requerimientos
├── integrations/          <- docs de WooCommerce, ML, ERPs específicos
└── examples/              <- payloads, CSVs, schemas reales
```

## Cómo usarla con v0

Cuando quieras que v0 revise algo específico, mencionalo con el path:

> "Revisá `context/design/catalogo-mobile.png` y ajustá el layout del catálogo"

v0 puede leer cualquier archivo dentro de `/context` con la tool Read, pero no
va a editar archivos aquí salvo que se lo pidas explícitamente.

## Qué NO poner acá

- **Secretos o credenciales** (van en Vars de la configuración de Vercel)
- **Código que se importe desde la app** (usá `lib/` o `components/`)
- **Assets públicos** (esos van en `public/`)
