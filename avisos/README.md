# Avisos

## Liquidación Sylvania (`oferta_sylvania.py`)

```bash
python3 preparar_fotos.py lamparas.pdf     # -> fotos/
python3 oferta_sylvania.py                 # -> PANA_OFERTA_SYLVANIA.pdf + .jpg
```

A4 vectorial más un JPG, porque un aviso de oferta se manda por WhatsApp y ahí el PDF no
muestra vista previa.

### De dónde sale cada dato

**Precios y cantidades: de `Oferta_Sylvania.xlsx`.** El PDF `lamparas.pdf` trae otros
números —$450, $3.000, $4.000— que son los de **costo**: la planilla es la de venta. Se usa
el PDF sólo para las fotos.

Las cantidades también difieren: el PDF dice 1.300 del PLL y 300-400 del de 400W, la
planilla dice 1.600 y 300. Manda la planilla.

### Dos cosas que conviene revisar antes de publicar

- **El de 400W no es de mercurio.** La etiqueta del bulto, en la foto, dice `METAL HALIDE
  LAMP / LÁMPARA DE HALOGENUROS METÁLICOS`, `MH 400`, `E40`, `3700K`, código `P64484`. Los
  dos archivos lo llaman "mercurio de alta presión", pero son tecnologías distintas y piden
  balastos distintos. En el aviso quedó como dice la planilla.
- **La foto del de 400W es la etiqueta del bulto envuelto**, no la lámpara: en el PDF no hay
  otra.

### Las fotos

Son de depósito —manos, pallets, plástico de embalaje—, así que ninguna se recorta contra el
fondo: sacárselo deja restos grises peores que la foto entera. Van las cuatro como recuadro,
que además es más coherente entre sí.

Illustrator las guardó en CMYK; hay que convertirlas antes de tocarlas.
