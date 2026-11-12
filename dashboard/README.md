# Monitor Biomecánico de Marcha — Prótesis de pierna instrumentada

SPA estática (React 19 + Vite + Tailwind CSS v4 + Chart.js) que recibe por WebSocket, a 20 Hz,
las tramas JSON de un ESP32 (FSR talón/punta + IMU MPU6050) y muestra en tiempo real:

- **Cinemática sagital**: ángulo del pilón (filtro complementario acelerómetro + giroscopio) con ventana de 5–30 s, pausa e inspección por tooltip.
- **Vista sagital en Canvas**: el pilón y el pie se mueven según el ángulo; talón y punta brillan según la presión.
- **Indicadores de marcha**: Apoyo/Balanceo, sub-fases (contacto inicial → apoyo medio → despegue → balanceo), barras de presión con umbral.
- **Parámetros temporales**: cadencia, tiempo de zancada, % apoyo/balanceo, número de contactos.
- **Calibración**: umbrales FSR con histéresis, ejes de montaje de la IMU, unidades del giroscopio, α del filtro y tara a 0°.
- **Modo demostración**: marcha sintética sin hardware (sirve para probar la página desde GitHub Pages).

Trama esperada (texto JSON, una por mensaje o varias separadas por `\n`):

```json
{"fsr_talon":4000,"fsr_punta":100,"acc_x":0.5,"acc_y":9.8,"acc_z":0.1,"gyr_x":0,"gyr_y":15.2,"gyr_z":0}
```

> ⚠️ La librería `Adafruit_MPU6050` entrega el giroscopio en **rad/s** (opción por defecto en *Calibración*).
> Si el firmware lo envía en °/s, cámbialo en el panel.
> El eje de giro sagital se deduce de los ejes *vertical* y *antero-posterior* que elijas: con el
> montaje por defecto (vertical = `y`, AP = `x`) el giro sagital es `gyr_z`.

## Estructura

```
dashboard/
├── index.html
├── vite.config.js            # base: './' → funciona en GitHub Pages y servido desde el ESP32
├── src/
│   ├── App.jsx               # componente principal (layout + flujo de datos)
│   ├── hooks/
│   │   ├── useWebSocket.js   # conexión, reconexión con back-off, watchdog, estadísticas
│   │   ├── useSimulator.js   # fuente de datos sintética (modo demo)
│   │   └── usePersistentSettings.js
│   ├── lib/
│   │   ├── frame.js          # parseo/validación de la trama
│   │   ├── orientation.js    # ángulo sagital + filtro complementario
│   │   ├── gait.js           # detector de fases y métricas de zancada
│   │   ├── telemetry.js      # búfer de series (fuera del estado de React)
│   │   ├── simulator.js      # generador de marcha sintética
│   │   ├── chartPlugins.js   # umbrales y bandas de apoyo en Chart.js
│   │   └── constants.js
│   └── components/           # ConnectionPanel, LiveChart, LegCanvas, GaitIndicator, …
```

## Desarrollo local

Requiere Node.js ≥ 20.19.

```bash
cd dashboard
npm install
npm run dev        # http://localhost:5173 (también accesible en la LAN por --host)
```

> 💡 Si el proyecto está en Google Drive, `node_modules` (≈130 paquetes) se sincronizará.
> Puedes excluir la carpeta en Drive o clonar el repositorio fuera de la unidad para desarrollar.

## Compilar

```bash
npm run build      # genera dashboard/dist/
npm run preview    # sirve dist/ por HTTP en http://localhost:4173 (y en la LAN)
```

## Publicar en GitHub Pages

### Opción A — GitHub Actions (recomendada)

1. Sube el repositorio a GitHub (la carpeta `dashboard/` y `.github/workflows/deploy-dashboard.yml` en la raíz).
2. En GitHub: **Settings → Pages → Build and deployment → Source: _GitHub Actions_**.
3. Haz `git push` a `main`. El workflow compila y publica `dist/` automáticamente.
4. La app queda en `https://<usuario>.github.io/<repositorio>/`.

### Opción B — Rama `gh-pages` desde tu PC

```bash
cd dashboard
npm run deploy     # build + publica dist/ en la rama gh-pages (paquete gh-pages)
```

Luego **Settings → Pages → Source: _Deploy from a branch_ → `gh-pages` / `(root)`**.

## El problema de Mixed Content (HTTPS → `ws://`)

GitHub Pages siempre sirve por **HTTPS**, y los navegadores bloquean que una página HTTPS abra un
WebSocket **sin cifrar** (`ws://192.168.4.1:81`). Además, cuando el móvil/PC está unido al AP del
ESP32 normalmente no hay Internet, así que la página tampoco puede recargarse desde GitHub.

### ✅ Solución recomendada: servir el mismo `dist/` desde el ESP32

El build usa rutas relativas (`base: './'`), así que puede copiarse tal cual a la memoria flash.
El firmware [`../firmware/protesis_ws`](../firmware/README.md) ya sirve la web en el puerto 80 y el WebSocket en el 81:

1. `npm run build:esp32` — compila y copia `dist/` comprimido (gzip) a `firmware/protesis_ws/data/`.
2. Sube el firmware y luego la imagen LittleFS (pasos en [firmware/README.md](../firmware/README.md)).
3. Conéctate al Wi-Fi del ESP32 y abre **`http://192.168.4.1/`** (la dirección del WebSocket se rellena sola). Página y WebSocket son HTTP → sin
   Mixed Content, funciona sin Internet y sin instalar nada (≈150 kB comprimido).

GitHub Pages queda como escaparate/documentación y para probar la interfaz en **modo demostración**.

### Alternativas

| Opción | Cuándo usarla | Limitaciones |
|---|---|---|
| **Permitir contenido no seguro** en Chrome/Edge de escritorio: candado → *Configuración del sitio* → *Contenido no seguro* → **Permitir**, recargar. Acepta el permiso de “dispositivos de la red local” si aparece. | Demostraciones rápidas desde GitHub Pages en un portátil. | Solo para ese origen y navegador; no disponible en iOS/Safari; la página debe cargarse antes de cambiar al Wi-Fi del ESP32. |
| **`npm run preview`** (HTTP en `localhost`) | Laboratorio con un PC. | Requiere Node en el equipo. |
| **WSS en el ESP32** (TLS con certificado autofirmado) | Solo si es imprescindible HTTPS. | Alto consumo de RAM/CPU en el ESP32, advertencias de certificado y aceptación manual en cada dispositivo. No recomendado. |

La app detecta el caso (página HTTPS + `ws://`) y muestra estas instrucciones en el panel de conexión.

## Notas técnicas

- Los datos llegan a 20 Hz pero React re-renderiza a 10 Hz (`UI_REFRESH_MS`); las tramas se guardan
  en un búfer fuera del estado y Chart.js se actualiza con `update('none')`, sin animaciones.
- El watchdog fuerza la reconexión si no llegan tramas en 3 s (pérdida de Wi-Fi sin cierre TCP).
- El filtro complementario usa el tiempo real de llegada de cada trama (`dt`) y se reinicia tras huecos > 0,5 s.
- Ajustes (IP, umbrales, ejes) se recuerdan en `localStorage` de cada navegador.
- No es un dispositivo médico certificado.
