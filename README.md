# PassGO! — English A2 City Adventure

Sitio web educativo gamificado (HTML + CSS + JavaScript puro, sin frameworks ni proceso de compilación).
Listo para **GitHub Pages**: la raíz del repositorio *es* el sitio.

## Publicar en GitHub Pages
1. Crea un repositorio (o usa el actual) y sube **todo el contenido de esta carpeta** a la raíz: `index.html`, `css/`, `js/`, `assets/`, `tools/`, `.nojekyll`.
   - Desde la web: **Add file → Upload files** y arrastra el contenido de la carpeta.
   - O con git: `git add . && git commit -m "PassGO! living world" && git push`.
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)`**.
3. En uno o dos minutos el sitio estará en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

> Para probarlo en tu computador usa un servidor local (el navegador bloquea algunas cosas si abres el archivo con doble clic):
> `python3 -m http.server` dentro de la carpeta → abre `http://localhost:8000`.

## Estructura
```
index.html            ← página principal
css/                  ← style (base), world (ciudad viva), intro (pasaporte de cuero, equipos, registro), passport (paneles y botones)
js/units-data.js      ← ✏️ LAS 6 UNIDADES: enlaces, video, palabras clave (aquí se edita el contenido)
js/world-data.js      ← posiciones de los letreros, calles por donde camina el personaje, perchas del loro (generado)
js/char-data.js       ← animaciones de Nico, Massie, Luma y Luna (generado)
js/intro.js · app.js · passport.js · characters.js · world.js · audio.js · fx.js
assets/chars/         ← spritesheets optimizados (idle, walk, jump, cheer)
assets/stamps/        ← los 6 sellos de las unidades
assets/audio/         ← notas de voz "Brave together!" y "More friends, more discoveries!"
assets/world/         ← mapa de la ciudad, velero, bandera pirata, máscaras de mar y niebla
tools/                ← scripts para regenerar todo lo anterior a partir de tools/raw/
```

## La experiencia
1. **Pasaporte de cuero** a pantalla completa → al tocarlo pasan las páginas, sale luz mágica y animales de colores → flash.
2. **Welcome, Explorer!** se queda en pantalla hasta que el estudiante toca **Open my passport**.
3. **Elige tu equipo**: Nico & Luma ("Brave together!") o Massie & Luna ("More friends, more discoveries!"). Al pasar el puntero el equipo se ilumina y se anima; al elegir suena la nota de voz.
4. **Datos del pasaporte** (nombre, país, edad) con música de creación de personaje → **I'm ready!** → sello rojo **APPROVED**.
5. (Solo la primera vez) **video de bienvenida**.
6. **La ciudad**: niebla que se despeja unidad por unidad, el personaje elegido camina por las calles, su loro vuela por los tejados, velero y bandera animados, gaviotas, sonido ambiental.
7. Al terminar una unidad: sello ilustrado en **City Stamps**, XP, monedas, nivel, y se abre la siguiente unidad.

## Datos guardados (solo en el navegador del estudiante)
`passgo_a2_progress_v1` (unidades, XP, fechas) y `passgo_a2_profile_v1` (nombre, país, edad, equipo). **New explorer (reset)** en el pie de página borra todo — útil en computadores compartidos.

## Editar unidades
Abre `js/units-data.js`. Cuando tengas los videos, cambia `youtube: null` por el código del video (lo que va después de `youtu.be/`).

## Herramientas opcionales (`tools/`)
- `python3 tools/build.py` → crea `dist/passgo-standalone.html`, una versión de **un solo archivo** para compartir por correo o sin internet.
- `python3 tools/build_city.py` → si cambias el mapa (`tools/raw/city-map.png`): recorta el velero y la bandera, máscaras, calles y posiciones.
- `python3 tools/build_characters.py` → si exportas nuevos spritesheets de Sprite Forge en `tools/raw/sheets/`.
- `python3 tools/build_stamps.py` y `python3 tools/build_portraits.py` → sellos y retratos.
- Requieren `opencv-python`, `numpy`, `pillow`.

## Accesibilidad
Respeta la opción "reducir movimiento" del sistema; el pasaporte se abre también con Enter/Espacio; formularios con etiquetas; botón de sonido siempre visible (abajo a la derecha) con volumen y música por separado.
