# Flyers de Pana Iluminación

Dos versiones del flyer mensual de precios, pensadas para un test A/B por WhatsApp.

```bash
python3 variante_a.py     # PANA_septiembre_A.jpg / .png / .pdf
python3 variante_b.py     # PANA_septiembre_B.jpg / .png / .pdf
```

Cada script arma su propio HTML y lo pasa por `render()` de `flyer_common.py`, que
comparte las fuentes embebidas, el set de iconos y el pipeline de salida.

## Formatos de salida

- **`.jpg` (1080x1528)** — el que se manda por WhatsApp. WhatsApp no muestra vista
  previa de los PDF, así que para difusión va siempre la imagen.
- **`.png`** — la misma imagen sin compresión, para redes o para retocar.
- **`.pdf`** — A4 vectorial con Poppins embebida, para imprimir o adjuntar por mail.

Requiere Playwright con Chromium (`/opt/pw-browsers/...`). La imagen se captura al
triple de tamaño y recién ahí se reduce con Lanczos: dejar que Chromium rasterice
directo al tamaño final ensucia los bordes del texto.

## Qué separa a las dos versiones

|  | A | B |
|---|---|---|
| Fondo | negro | crema, el de las portadillas del catálogo |
| Titular | "Conocé nuestros precios de septiembre" | "Comprá sin mínimo" |
| Apuesta | curiosidad: el beneficio aparece más abajo | beneficio adelante |
| Envíos | tres frases corridas | tres fichas con el monto grande a la derecha |
| Cierre | "Consultanos para más información" | "Escribinos y te pasamos la lista de septiembre" |

Los montos y las condiciones son idénticos en las dos: cambia cómo se cuentan, no qué
se ofrece.

## Cómo leer el test

Son varias diferencias a la vez, así que el resultado dice **cuál funciona mejor**, no
**por qué**. Para una lista de WhatsApp chica eso es lo razonable: con pocos contactos
sólo se detectan diferencias grandes, y dos piezas muy distintas dan más chance de ver
algo. Si en la próxima ronda querés aislar una causa, dejá ganar a una y cambiale una
sola cosa (por ejemplo el titular).

Conviene mandar las dos el mismo día y a la misma hora, repartiendo los contactos al
azar y no por zona ni por antigüedad: si un grupo compra distinto que el otro de por
sí, el resultado mide eso y no el flyer. Como métrica sirve cuánta gente responde,
no cuánta lo abre.

## Para el mes siguiente

- El mes: en A está en el `<h1>`; en B, en la píldora `SEPTIEMBRE 2026` y en el cierre.
- Montos y condiciones: las llamadas a `fila_envio(...)` en A y a `ficha(...)` en B.
- `SALIDA`, el nombre base de los archivos generados.

## Criterios de redacción

Los textos se acortan a lo imprescindible: nada de repetir la palabra "envío" en cada
fila (ya lo dice el encabezado) y una sola frase para la idea de la compra mínima. Los
montos y las condiciones no se tocan, y el "sin cargo en compras superiores a" queda
siempre pegado al monto para no prometer envío gratis sin condición.
