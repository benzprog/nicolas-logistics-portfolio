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

## Logos

`logos/tenaruz_blanco.png` y `logos/tenaruz_negro.png` son el logo real, sacado del
propio catálogo: se rasteriza la zona del logo a 1200 dpi y se pasa la luminancia a
canal alfa, así que sirve sobre cualquier fondo. Blanco para la A (fondo negro),
negro para la B (fondo crema) — en las dos la idea es la misma, que contraste.

`pana_logo.py` dibuja el lockup de PANA como SVG. Es de trazo uniforme, así que se
construye con `stroke` sobre las líneas medias en vez de contornear cada letra: los
empalmes salen exactos y el grosor se cambia en un solo lugar. `svg(color, alto)`
devuelve el bloque listo, en el color que haga falta.

**Es un trazado a ojo, no el archivo original.** El logo llegó como imagen pegada en
el chat, que no baja a disco, y la web de la marca no es alcanzable desde acá. Las
proporciones (altura de mayúscula 130, trazo 22, radios de los hombros) salieron de
medir la imagen. Si alguna curva no cierra con el original, se corrige ahí y listo; y
si aparece el archivo real (SVG o PNG con transparencia), va a `logos/` y se cambia
la llamada a `pana_logo.svg(...)` por un `<img>`, igual que el de Tenaruz.

## Qué separa a las dos versiones

|  | A | B |
|---|---|---|
| Fondo | negro | crema, el de las portadillas del catálogo |
| Logos | PANA + Tenaruz en blanco | PANA + Tenaruz en negro |
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


## Flyer mensual de la lista (`lista_mensual.py`)

Rediseño del mail de "LISTA DE PRECIOS / MES AÑO" en A4 vectorial.

```bash
python3 lista_mensual.py     # PANA_lista_octubre_2026.pdf / .jpg / .png
```

Para el mes siguiente se cambian `MES`, `ANIO`, `ENTRADA` y `DATOS` arriba del archivo.
Los teléfonos, el mail y el horario salen de la lista mayorista vigente: si cambian ahí,
cambiarlos acá.

### Qué se mantuvo del original y qué no

Se mantiene lo que lo hace reconocible: la cabecera amarilla con el patrón de lámparas, el
círculo negro con el logo, el mes como protagonista, el botón de descarga y el pie oscuro
con los WhatsApp.

Se cambió:

- **El amarillo se usa menos.** En el original ocupaba un tercio de la pieza en plano. Un
  plano grande de amarillo satura y le saca jerarquía a todo lo demás; ahora queda en la
  cabecera, en un filete y en el botón, y el resto va sobre el crema del catálogo.
- **Se fue el cobre** del titular y del botón. La identidad de hoy —la del catálogo 2026—
  es negro, crema y amarillo. Un cuarto color no sumaba.
- **La trama de puntos corre a toda la altura** y se disuelve hacia los costados. Probada
  como rectángulo de bordes duros, como en el original, se leía como una franja pegada; y
  esfumada en redondo dejaba una hilera suelta cortada contra el crema.
- **El patrón de lámparas se dibuja en SVG**, no es un bitmap repetido: la pieza sale en
  PDF vectorial y el patrón tiene que aguantar el tamaño de impresión.

### El logo de PANA sigue siendo provisorio

`logos/pana_blanco_mail.png` está sacado del mail original, donde el lockup mide **172 x 52
px**. Se lo enmascara contra el círculo negro, se pasa la luminancia a alfa y se endurece el
borde con una smoothstep —es una marca de dos tonos, así que cerrar el filo ayuda—, pero no
hay detalle que recuperar: ampliado a los 40 mm que ocupa en la pieza se nota blando.

Hace falta el vectorial, igual que el de TENARUZ (`logos/Logo-TENARUZ.ai` en la raíz). Con
ese archivo se reemplaza el `<img>` y la cabecera queda perfecta.
