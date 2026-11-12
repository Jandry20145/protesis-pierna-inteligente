# Prótesis de pierna inteligente

Monitoreo biomecánico en tiempo real de una prótesis de pierna instrumentada con **ESP32**,
dos **FSR** (talón y punta) y una **IMU MPU6050**.

**Dashboard en línea:** https://jandry20145.github.io/protesis-pierna-inteligente/
(sin hardware, activa el *Modo demostración*).

| Carpeta | Contenido |
|---|---|
| [`dashboard/`](dashboard/) | App web React + Vite + Tailwind + Chart.js (cinemática sagital, fases de marcha, presión plantar) |
| [`firmware/`](firmware/) | Firmware ESP32: Wi-Fi, WebSocket a 20 Hz y servidor del dashboard desde LittleFS |
| [`sketch_nov11a/`](sketch_nov11a/) | Sketch original de lectura de sensores por puerto serie |

## Conectar el dashboard con la prótesis

- **Recomendado:** abre el dashboard que sirve el propio ESP32, en `http://<IP-del-ESP32>/`.
  Funciona sin Internet y sin bloqueos del navegador.
- **Desde GitHub Pages:** la página usa HTTPS y el ESP32 transmite por `ws://` sin cifrar, así que el
  navegador bloquea la conexión. En Chrome/Edge de escritorio: candado → *Configuración del sitio* →
  *Contenido no seguro* → **Permitir**, recarga y escribe la IP del ESP32 en el panel de conexión.

Más detalles en [dashboard/README.md](dashboard/README.md) y [firmware/README.md](firmware/README.md).

> Herramienta de apoyo para investigación y docencia; no es un dispositivo médico certificado.
