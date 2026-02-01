# Sitio Colegio Abraham Lincoln

Sitio con páginas estáticas (.html) + autenticación usando **Cloudflare Pages Functions** y **D1**.

## Importante

El login/registro hace `fetch('/api/login')` y `fetch('/api/register')`.
Eso **NO funciona** si abres los HTML como archivos (`file://`) o con un servidor estático simple (por ejemplo `py -m http.server`), porque ahí no existen las rutas `/api/*`.

## Correr en local (con API + D1)

Requisitos:
- Node.js
- Wrangler

Instalar Wrangler:
```
npm i -g wrangler
```

Luego:
```
wrangler pages dev .
```

Abrir la URL que imprima Wrangler (normalmente `http://localhost:8788`).

## D1

El binding se llama `DB` y la base es `prepa_db`.
En [wrangler.toml](wrangler.toml) reemplaza `database_id` por el ID real de tu D1.

## Deploy

Publica como **Cloudflare Pages** (incluyendo la carpeta `functions/`).
Configura el binding D1 `DB` en el proyecto de Pages (o usando `wrangler.toml`).
