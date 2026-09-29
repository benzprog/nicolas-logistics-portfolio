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

- Un solo teléfono, el de ventas. El 11 4176-4205 quedó fuera de uso y no va en ninguna pieza.
- Los precios salen del archivo del proveedor, uno por uno, multiplicados por el recargo.
  Ninguno se calcula a partir de otro ni se completa a ojo.
- El orden y el agrupamiento son los del original.
- Los productos que el proveedor marca "REEMP." no tienen precio: se sacan junto con sus
  renglones de medida, que sueltos parecerían pertenecer al producto siguiente.
- El cierre verifica que cada precio del PDF entregado sea un precio del proveedor por el
  recargo, sin faltantes ni sobrantes.

### Decisiones de maquetación

- **Una fila por producto, todas del mismo alto.** El proveedor combina la foto y el bulto
  sobre el grupo de variantes (mismo artefacto en otro color o temperatura). Replicar esa
  combinación daba filas de alturas dispares, huecos en la columna del bulto y una banda
  alterna que se cortaba contra las fotos. El dato del grupo se repite en cada variante —que
  es a lo que corresponde— y la fila queda pareja.
- **Banda alterna.** Con el filete solo no se distinguía dónde terminaba un producto; la
  banda lo resuelve, y para eso las fotos van con alfa: apoyadas sobre un color plano
  dejaban un recuadro visible sobre la banda.
- **La cantidad por bulto del proveedor no se publica.** Acá se vende por unidad o la
  cantidad que el cliente pida, así que cualquier "bulto x N" se leería como un mínimo.
- **Los renglones de medida van como segunda línea de la descripción**, no como fila propia.
- **Una sola tabla, no una por sección.** Cortando en la náutica quedaba un tercio de hoja en
  blanco; la banda negra del rubro ya marca dónde empieza la otra.

### Las fotos

Se extraen del PDF y se recortan con el fondo transparente. Se saca **sólo el fondo
conectado al borde**, tomando el color del propio marco como referencia: con un umbral fijo
de "todo lo casi blanco", los productos cromados y los blancos quedan agujereados por dentro.

Cinco fotos del proveedor tienen fondo de color, un marco negro o son tomas de packaging:
ahí no hay fondo que sacar sin romper la imagen y se dejan opacas.

`reemplazar_fotos.py` cambia fotos puntuales por versiones de mejor calidad. El destino se
identifica por el archivo que generó la extracción, no por el número de ítem: una misma foto
sirve a varias variantes, así que reemplazándola se actualizan todas juntas.


## Cambiar el mes de la lista TENARUZ HD

```bash
python3 cambiar_mes_hd.py LISTA_HD.pdf LISTA_HD_OCTUBRE.pdf
```

El mes está escrito de dos maneras distintas en el mismo archivo:

- **En la tapa**, letra por letra: cada glifo es su propio bloque `BT..ET` **y su propio
  content stream** —la página tiene dieciséis—, que es como se consigue ese espaciado ancho.
  Hay que rehacer el renglón entero y volver a centrarlo, porque el mes nuevo mide distinto.
  El tracking sale de restarle a la distancia entre dos letras el avance de la primera; no se
  estima.
- **En el encabezado de las páginas 2 a 14**, como un único `TJ` con todos los CID pegados y
  alineado a la izquierda: ahí alcanza con reemplazar la cadena de CIDs, porque sin
  posicionamiento por glifo el ancho lo resuelve la fuente.

Los subsets ya traen los glifos de OCTUBRE, y el script lo verifica antes de escribir.

El control es doble: el diff por página tiene que caer sólo sobre el mes, y la capa de texto
con el mes normalizado tiene que quedar idéntica a la del original.
