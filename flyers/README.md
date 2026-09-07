# Flyers de Pana Iluminación

`flyer_precios.py` regenera el flyer mensual de precios como **PDF A4 vectorial**:
el texto es texto de verdad (Poppins embebida desde `fonts/`) y los iconos son
trazos SVG, así que se imprime nítido en cualquier tamaño y se puede buscar y copiar.

```bash
python3 flyer_precios.py     # deja flyer.html y PANA_precios_septiembre.pdf al lado
```

Requiere Playwright con Chromium (`/opt/pw-browsers/...`); el render se hace con
`page.pdf(format="A4", print_background=True)` y márgenes en cero.

## Para el mes siguiente

- Mes del título: el `<h1>` (`Conocé nuestros / precios <span class="am">de …</span>`).
- Montos y condiciones: las tres llamadas a `fila_envio(...)`.
- Nombre del PDF de salida en `render()`.

## Criterios de redacción

Los textos se acortan a lo imprescindible: nada de repetir la palabra "envío" en
cada fila (ya lo dice el encabezado ENVÍOS) y una sola frase para la idea de la
compra mínima. Los montos y las condiciones no se tocan.
