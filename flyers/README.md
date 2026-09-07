# Flyers de Pana Iluminación

`flyer_precios.py` regenera el flyer mensual de precios en tres formatos:

- **`.jpg` (1080x1528)** — el que se manda por WhatsApp. WhatsApp no muestra
  vista previa de los PDF, así que para difusión va siempre la imagen.
- **`.png`** — la misma imagen sin compresión, para redes o para retocar.
- **`.pdf`** — A4 vectorial con Poppins embebida, para imprimir o adjuntar por mail.

```bash
python3 flyer_precios.py     # deja los tres archivos al lado del script
```

Requiere Playwright con Chromium (`/opt/pw-browsers/...`). La imagen se captura
al triple de tamaño y recién ahí se reduce con Lanczos: dejar que Chromium
rasterice directo al tamaño final ensucia los bordes del texto.

## Para el mes siguiente

- Mes del título: el `<h1>` (`Conocé nuestros / precios <span class="am">de …</span>`).
- Montos y condiciones: las tres llamadas a `fila_envio(...)`.
- `SALIDA`, el nombre base de los archivos generados.

## Criterios de redacción

Los textos se acortan a lo imprescindible: nada de repetir la palabra "envío" en
cada fila (ya lo dice el encabezado ENVÍOS) y una sola frase para la idea de la
compra mínima. Los montos y las condiciones no se tocan.
