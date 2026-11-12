# Firmware ESP32 — Telemetría Wi-Fi de la prótesis

`protesis_ws/protesis_ws.ino` conecta el ESP32 a tu red Wi-Fi (p. ej. el punto de acceso del
teléfono) y ofrece:

> 🔑 **Credenciales Wi-Fi:** copia `protesis_ws/secrets.example.h` como `protesis_ws/secrets.h` y
> escribe tu red y contraseña. `secrets.h` está en `.gitignore`, así que no se publica en GitHub.
> Sin ese archivo el firmware compila igual y crea directamente su red de respaldo.

| Servicio | Dirección | Contenido |
|---|---|---|
| Dashboard web | `http://<IP>/` o `http://protesis.local/` | La app React servida desde LittleFS |
| Telemetría | `ws://<IP>:81/` | JSON a 20 Hz (mismo formato que el sketch serie) |
| Diagnóstico | `http://<IP>/status` | Wi-Fi, RSSI, IMU/FS OK, clientes, heap, tramas descartadas |

**`<IP>` la asigna el teléfono** y se imprime en el Monitor Serie (115200 baudios) al arrancar, p. ej.:

```
Conectado a "MiTelefono" · IP 10.84.12.37 · RSSI -48 dBm
 Dashboard:   http://10.84.12.37/   (o http://protesis.local/)
```

En Android también puedes verla en *Ajustes → Punto de acceso → Dispositivos conectados* (según el
modelo). `protesis.local` funciona en Windows, macOS e iOS; en Android Chrome a menudo no, así que
usa la IP.

Si tu red no está disponible en 15 s, el ESP32 crea su propia red de respaldo **`Protesis-ESP32`**
(contraseña `protesis2026`) en `http://192.168.4.1/`.

Pines sin cambios respecto a `sketch_nov11a.ino`: SDA 33, SCL 32, FSR talón 34, FSR punta 35
(ADC1: siguen funcionando con Wi-Fi; los pines de ADC2 no).

## 1. Librerías (Arduino IDE → Gestor de librerías)

- **ESP Async WebServer** — autor *ESP32Async* (probado con 3.12.1)
- **Async TCP** — autor *ESP32Async* (probado con 3.5.0)
- Adafruit MPU6050, Adafruit Unified Sensor, Adafruit BusIO (ya instaladas)

Placa: **ESP32 Dev Module** (core esp32 de Espressif 3.x).
Partition Scheme: **Default 4MB with spiffs** (la partición se usa para LittleFS).

## 2. Generar la carpeta `data/` con el dashboard

```bash
cd dashboard
npm install          # solo la primera vez
npm run build:esp32  # compila y copia dist/ comprimido a firmware/protesis_ws/data/
```

## 3. Subir firmware y sistema de archivos

1. Abre `firmware/protesis_ws/protesis_ws.ino` y súbelo normalmente.
2. Sube la imagen LittleFS con la carpeta `data/`:
   - **Arduino IDE 2.x**: instala el plugin
     [arduino-littlefs-upload](https://github.com/earlephilhower/arduino-littlefs-upload)
     (copiar el `.vsix` a `~/.arduinoIDE/plugins/`), reinicia el IDE, cierra el Monitor Serie y pulsa
     `Ctrl+Shift+P` → **Upload LittleFS to Pico/ESP8266/ESP32**.
   - **PlatformIO**: `pio run -t uploadfs`.
3. Repite solo el paso 2 cuando cambies el dashboard (el firmware no hace falta).

## 4. Uso

1. Activa el punto de acceso del teléfono (la red de `secrets.h`) y enciende el ESP32.
2. Desde el propio teléfono (o un PC conectado a esa red) abre `http://<IP>/` — el campo de conexión ya
   trae `ws://<IP>:81`; pulsa **Conectar**.
3. Ventaja de usar el punto de acceso del teléfono: el teléfono mantiene datos móviles, así que puedes
   seguir usando Internet mientras monitoreas.
4. Si el dashboard no está subido, la página raíz muestra un aviso, pero el WebSocket funciona igual
   (p. ej. desde `npm run preview` o desde GitHub Pages con contenido no seguro permitido).

## Notas

- El muestreo usa `millis()` con periodo fijo de 50 ms (sin `delay()`), así la frecuencia no deriva.
- Cada FSR se promedia sobre 4 lecturas ADC para reducir ruido.
- Si un cliente no puede seguir el ritmo, se descartan tramas en vez de acumular retraso (`dropped` en `/status`).
- Si el MPU6050 no responde al arrancar, el AP y la web siguen activos y se reintenta cada 2 s.
- `SERIAL_STREAM = true` reenvía además cada trama por el puerto serie (115200) para depurar.
