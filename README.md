# Mi Colección Pokémon

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/meh889/pokemon-collection)

App estática para gestionar tu colección de cartas Pokémon TCG con:

- Carga de cartas con 12 idiomas (Español, Español LATAM, Inglés, Portugués, Francés, Italiano, Alemán, Holandés, Ruso, Chino, Coreano, Indonesio).
- Sección **Búsquedas** (wishlist) con botón "Ya la tengo" para mover cartas a colección.
- Simulador de **binder** configurable. Por defecto **Vault X 480** (4×3 × 20 hojas = 480 slots).
- Persistencia en `localStorage` (todo queda en tu dispositivo).
- Import / export de backup en JSON.
- Sin backend, sin build step — HTML + CSS + JS plano.

## Cómo correrlo localmente

Abrí `index.html` en el navegador, o serví la carpeta:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Deploy en Netlify desde GitHub

### 1. Crear el repo en GitHub

Andá a https://github.com/new y creá un repo (por ejemplo `pokemon-collection`). **No** inicialices con README — el repo local ya tiene archivos.

### 2. Subir el código

Desde esta carpeta:

```bash
git remote add origin https://github.com/TU_USUARIO/pokemon-collection.git
git branch -M main
git push -u origin main
```

(la primera vez Git te pedirá tus credenciales o un token — usá un Personal Access Token de GitHub si te pide password)

### 3. Conectar Netlify

1. Iniciá sesión en https://app.netlify.com.
2. **Add new site → Import an existing project → GitHub**.
3. Elegí el repo `pokemon-collection`.
4. Build settings: dejá todo vacío (es estático). Publish directory: `.`
5. **Deploy site**.

Netlify te asigna una URL tipo `https://nombre-aleatorio.netlify.app`. Podés cambiarla en *Site settings → Domain management*.

### 4. Usarlo en el celular

Abrí la URL en el celular. Para tenerlo como app:

- **iOS Safari**: tocar el botón compartir → "Agregar a pantalla de inicio".
- **Android Chrome**: menú ⋮ → "Instalar app" / "Agregar a pantalla de inicio".

Como tiene `manifest.json` y `theme-color`, va a abrirse en pantalla completa como una app.

## Estructura

```
.
├── index.html       # Layout principal
├── app.css          # Estilos
├── app.js           # Lógica + persistencia localStorage
├── manifest.json    # PWA-ish (instalable en celu)
├── netlify.toml     # Config para Netlify
└── README.md
```

## Datos

Todo se guarda en `localStorage` bajo la clave `pokemon-collection-v1`. Si querés migrar a otro dispositivo, usá el botón **⬇** (export) y luego **⬆** (import) en el destino.

## Tip para imágenes

Podés copiar URLs de imágenes desde sitios como:
- https://images.pokemontcg.io
- https://www.tcgplayer.com
- Cualquier imagen pública

Pegalas en el campo "URL de la imagen" al cargar la carta.
