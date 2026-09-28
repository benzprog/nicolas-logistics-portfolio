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

Pieza A4 vectorial con la lista del mes.

```bash
python3 lista_mensual.py     # PANA_lista_octubre_2026.pdf / .jpg / .png
```

Para el mes siguiente se cambian `MES`, `ANIO`, `BAJADA` y `FILAS` arriba del archivo. Los
teléfonos, el mail y el horario salen de la lista mayorista vigente: si cambian ahí,
cambiarlos acá.

### El sistema visual sale del plan de contenidos

`PANA_PLAN_SETIEMBRE` (el plan de Instagram) es la pieza más reciente de la marca, y de ahí
están medidos —no estimados— todos los valores:

| | |
|---|---|
| Tipografía | **Archivo** (en el plan va embebida como ArchivoRoman / ArchivoSemiBold) |
| Fondo | `#F0EEE6` hueso |
| Tinta | `#131313` |
| Claro | `#F4F3F1` |
| Acento | `#FFCE1F`, **uno solo** |

Tres reglas que se leen del plan y conviene no romper:

- **El amarillo ocupa el 3% de la pieza.** Es señal —el botón, un filete, un chip—, nunca
  plano de fondo. En el flyer terminado da 4,2%, del mismo orden.
- **No hay cobre ni dorado.** Los ámbar que parecen un segundo color son el mismo `#FFCE1F`
  antialiasado sobre negro.
- **Esquinas vivas en todo.** Nada redondeado.

Los componentes son los del plan: barra superior con el logo y un rótulo espaciado a la
derecha, titular corto, filas separadas por filetes finos, tarjeta negra y barra amarilla
de llamada a la acción con el texto a la izquierda y el dato a la derecha (el POST 08 del
plan es casi la misma pieza).

### Logos

`logos/pana_negro.png` y `logos/pana_claro.png` son el logo real de PANA, sacado del plan
(1186 x 371 con alfa). Reemplazan al rescate de 172 px que se había sacado del mail viejo.

`logos/tenaruz_blanco_vector.png` sale del `.ai` de `logos/` en la raíz del repo.

### La tipografía hay que bajarla bien

`fonts/bajar_archivo.py` la trae de Google Fonts. Dos trampas, las dos ya resueltas ahí:

- La API devuelve **varias `@font-face` por peso**, una por rango unicode. Quedarse con la
  primera da un subset sin minúsculas ni acentos, y el navegador completa con una fuente
  del sistema **sin avisar**: se descubre recién al mirar `pdffonts` y ver LiberationSans
  al lado de Archivo. Hay que tomar el bloque que arranca en `U+0000-00FF`.
- Archivo se sirve **variable** (wght 100-900) y se instancia a estáticas, que Chromium
  exporta a PDF de forma más previsible.

El script verifica que estén todos los caracteres que usan las piezas y devuelve error si
falta alguno. La flecha `→` no está en el rango latin: si hace falta, va en SVG.
