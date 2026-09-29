# Listas de precios

## Comparar dos listas de PANA mes a mes

```bash
python3 comparar.py LISTA_MES_ANTERIOR.pdf LISTA_MES_NUEVO.pdf
```

`lista.py` lee una lista de PANA (exportada de Excel) a filas estructuradas y `comparar.py`
informa altas, bajas y qué campos cambiaron. Como control independiente del parseo, suma
las dos columnas de precios: si las sumas coinciden, no se movió ningún precio.

`pie_octubre.py` fue una corrección puntual del bloque de contacto de octubre.

## La lista propia, a partir de la de un proveedor

```bash
python3 extraer_tdc.py LISTA_PROVEEDOR.pdf     # -> tdc_datos.json + fotos_tdc/
python3 lista_pana.py                          # -> PANA_LISTA_OCTUBRE_2026.pdf
```

El recargo, el mes y los datos de contacto están arriba de `lista_pana.py`.

### Lo que hay que saber del PDF del proveedor

Sale de Excel por "Print To PDF", y eso deja tres trampas:

- **La grilla no está en el texto sino en los rectángulos** con que Excel dibuja los bordes.
  Hay celdas combinadas —la foto y la cantidad por bulto abarcan varias filas— y ahí Excel
  **no dibuja** el segmento: mirando qué columnas cruza cada línea se sabe exactamente dónde
  empieza y termina cada celda.
- **La fila la define la columna de precio, no la de descripción.** Hay descripciones
  combinadas de a dos con un precio por renglón; anclando en la descripción se juntan dos
  productos en una fila y se pierde un precio.
- **El código del proveedor y el número de ítem se pisan en x.** El código arranca fuera de
  la tabla y su cola entra en la columna del ítem. Los separa la línea de base: vienen de
  celdas distintas y difieren 0,24 pt.

Los rubros **no se reconocen por el texto** —"ALUMINIO PULIDO" parece un título y no lo es—
sino por el relleno de color de la banda, que es lo que el proveedor usa para marcarlos.

### Dato sensible

Los códigos de compra del proveedor (`SH007-001-5A`, `YJ-DS2034B`…) están en la capa de
texto del PDF original, tapados por el relleno blanco de la primera columna: no se ven al
imprimir pero se recuperan con cualquier extractor. **No se publican** en la lista propia.
Si alguna vez se reenvía el PDF del proveedor a un tercero, esos códigos viajan con él.

### Reglas de los datos

- Los precios salen del archivo del proveedor, uno por uno, multiplicados por el recargo.
  Ninguno se calcula a partir de otro ni se completa a ojo.
- El orden y el agrupamiento son los del original.
- Los productos que el proveedor marca "REEMP." no tienen precio: se sacan junto con sus
  renglones de medida, que sueltos parecerían pertenecer al producto siguiente.
- El cierre verifica que cada precio del PDF entregado sea un precio del proveedor por el
  recargo, sin faltantes ni sobrantes.

### Las fotos

Se extraen del PDF y se apoyan sobre el hueso del documento. Se reemplaza **sólo el fondo
conectado al borde**, tomando el color del propio marco como referencia: con un umbral fijo
de "todo lo casi blanco", los productos cromados y los blancos quedan agujereados por dentro.
