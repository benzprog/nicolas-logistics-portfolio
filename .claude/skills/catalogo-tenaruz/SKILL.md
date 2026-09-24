---
name: catalogo-tenaruz
description: Editar el catálogo PDF de TENARUZ / Pana Iluminación (CATALOGO_TENARUZ_XXXX.pdf) manteniendo la tipografía, tamaños, colores y grilla idénticos al resto del documento. Usar SIEMPRE que se pida agregar un producto o artefacto nuevo, eliminar o discontinuar un producto, reemplazar una foto de producto, cambiar la portada, corregir datos de una ficha técnica o actualizar el índice del catálogo — incluso si el pedido suena simple ("sacá el AR70", "meté este spot nuevo", "cambiá la foto de tapa"). También aplica ante cualquier PDF generado con wkhtmltopdf donde haya que insertar texto que combine perfecto con el existente.
---

# Editar el catálogo TENARUZ

El catálogo se generó con **wkhtmltopdf** desde HTML. No existe el archivo fuente: solo
tenemos el PDF. Por eso toda edición se hace **inyectando contenido nativo en el content
stream del PDF**, reutilizando las fuentes que ya están embebidas en el archivo.

## La regla que evita el 90% de los errores

**Nunca estimes tamaños de fuente mirando el render. Leelos del content stream.**

Esto no es pedantería. El catálogo tiene una transformación de escala de **0.576271**
(wkhtmltopdf renderiza a 0.75 y adentro hay otro `cm` de 0.768361587). Un texto que en el
PDF dice `/F11 11 Tf` se dibuja a **6.34pt efectivos**, no a 11pt. Si mirás el render y
"calculás" que el cuerpo de texto son ~10pt, vas a errar por un factor de 1.5 y el
resultado va a saltar a la vista aunque a vos te parezca parecido.

La primera vez que se hizo esta edición se estimó a ojo y salió todo 1.5× más grande, con
los grises equivocados. Se rehizo leyendo los valores reales. Empezá por ahí.

## Flujo de trabajo

### 1. Analizar la página que vas a tocar

```bash
python3 scripts/analyze_page.py CATALOGO.pdf --page 5
python3 scripts/analyze_page.py CATALOGO.pdf --page 5 --below 400   # solo mitad inferior
```

Devuelve, para cada bloque de texto: posición en coordenadas de página, recurso de fuente,
tamaño nominal, **tamaño efectivo**, tracking, color y el texto decodificado. Eso es la
receta exacta que tenés que replicar.

Copiá los valores del bloque que vas a reemplazar. No los inventes ni los redondees:
usá los que te devuelve el script.

`references/design-system.md` tiene los valores ya medidos de la página 5 (ambas mitades),
la portada y el índice. Sirve como atajo y como control cruzado, pero si trabajás sobre
otra página **corré el analizador igual** — la grilla varía sutilmente entre páginas.

### 2. Construir la página

`scripts/catalog.py` tiene las primitivas. El patrón es siempre el mismo:

```python
from catalog import Catalog, BOTTOM

cat = Catalog("CATALOGO.pdf")
page = cat.pdf.pages[4]
S = BOTTOM                                   # geometría de la mitad inferior

frag = []
frag.append(cat.rect(*S.dark_cover, S.dark))     # tapar lo viejo sin tocar el logo
frag.append(cat.rect(*S.white_panel, S.white))
frag.append(cat.show("SPOT", "/F19", 18.44, S.text_x, S.title_y, -0.405, cat.TITLE))
frag.append(cat.show_right("3W", "/F20", 6.34, S.value_right, S.row_baselines[0], 0.0, cat.VALUE))
cat.append(page, "\n".join(frag))
cat.save("salida.pdf")
```

`scripts/build_product_page.py` es un ejemplo completo y funcional: toma un diccionario con
los datos del producto y arma la ficha entera. Lo más rápido suele ser copiarlo y editar el
diccionario.

### 3. Verificar con números, no con la vista

```bash
python3 scripts/verify_page.py original.pdf salida.pdf --page 5
```

Renderiza ambas a 200 dpi y compara las cajas de tinta de cada elemento. La prueba que
realmente cierra el tema son las **cadenas idénticas**: palabras que aparecen tanto en la
página vieja como en la nueva (`Potencia`, `Medidas`, `CRI`, las líneas de la tabla). Si
`Potencia` no cae exactamente en las mismas coordenadas y con el mismo ancho, algo está mal.

Las diferencias legítimas son solo las que explica el texto distinto: una `Ó` con tilde sube
unos píxeles más que una letra sin tilde, y un texto centrado o alineado a la derecha
arranca en otra `x`. Cualquier otra diferencia es un error tuyo.

## Trampas conocidas

**El clip.** Los streams originales dejan un clipping path activo al terminar. Si agregás
contenido al final, se dibuja pero **no se ve**. La solución es envolver el contenido
original en `q`/`Q` para descartar el estado gráfico antes de dibujar lo tuyo — ya está
resuelto en `Catalog.append()`. Si algo "no aparece" y jurás que el stream está bien, es esto.

**Las fuentes son subsets con codificación Identity-H.** El texto se guarda como IDs de
glifo, no como ASCII. `pdftext.py` arma el mapa unicode→CID leyendo el `ToUnicode`. Dos
detalles: el CMap usa la forma de array (`<lo> <hi> [ <u> <u> ... ]`), y **el glifo de
espacio está mapeado a U+0009**, no a U+0020.

**Subset = solo los glifos que ya se usan en el documento.** Si escribís un carácter que no
aparece en ningún lado del catálogo, `encode()` va a fallar con `missing glyph`. Verificá
antes con `Catalog.check_glyphs(texto, "/F11")`. Si falta algo, reformulá el texto.

**La portada solo tiene `/F11`.** Si necesitás Bold o Medium ahí, copiá el recurso desde
otra página con `cat.ensure_font(page, "/F19")`.

**No repintes el logo.** El logo TENARUZ del panel oscuro es vectorial y está arriba de la
zona del producto (en la mitad inferior ocupa y≈347–365). Tapá solo hasta y=340 y el logo
queda intacto y perfecto. Redibujarlo a mano nunca queda bien.

**El recuadro con el número de página.** Está en la esquina inferior derecha. Si tapás el
panel blanco entero lo borrás, así que hay que repintarlo (rectángulo `#1a1a1a` + número en
blanco). `build_product_page.py` ya lo hace.

**Posición del texto = línea de base.** Las coordenadas que devuelve el analizador son
baselines en el sistema de la página (origen abajo a la izquierda), no el borde superior
de la tinta.

## Cómo está armado el catálogo

19 páginas Letter (612×792 pt). Cada página de producto lleva **dos fichas**, una arriba y
otra abajo, con los paneles espejados:

- **Mitad superior** (y 396–792): panel blanco a la **izquierda**, panel oscuro a la derecha.
- **Mitad inferior** (y 0–396): panel oscuro a la **izquierda**, panel blanco a la derecha.

El panel blanco lleva título, subtítulo, barra de acento, descripción, tabla de
especificaciones, códigos y el pie. El panel oscuro lleva el logo, la foto del producto y el
código, o los bloques de variantes de color (3000K / 4000K / 6000K).

Los márgenes son **36.84 pt** desde los bordes del panel, de los dos lados.

## Insertar una ficha o moverla de sección

Reemplazar una ficha por otra no mueve nada: la paginación queda igual. Insertar una ficha
nueva, o mover una de sección, sí corre la numeración y toca varias páginas.

Como cada página lleva dos fichas, sumar una ficha implica una media página libre en algún
lado — no hay forma de evitarlo salvo reflowear la sección entera. Conviene dejar el hueco
donde se lea como decisión de diseño y no como error. El catálogo ya tiene un patrón para
eso: la página del TUBO T5 es una ficha sola con los paneles a toda la altura. Se replica
pintando la mitad libre con los mismos paneles del slot ocupado (blanco de un lado, oscuro
del otro, según la orientación de ese slot) y queda sin costura visible.

Checklist completo, en este orden:

1. **La ficha** en su slot (o la página nueva entera).
2. **La media página libre**, pintada como continuación de los paneles.
3. **El índice** (página 2): las filas se re-arman con paso de 24.0 pt, la divisoria 9.6 pt
   debajo de cada línea de base, y los números alineados a la derecha en x 543.55. Si un
   producto pasa de una sección a otra, el encabezado de sección se corre un renglón, así
   que conviene repintar el bloque desde la primera fila que se mueve para abajo.
4. **Los números de página** de todo lo que corrió: el recuadro va en x 581–612, y 0–25.2,
   con el número centrado en x 596.5. Ojo: **la portada y la página de contacto no llevan
   número** — si se los agregás, se nota.
5. **La portadilla de la sección** (páginas 3, 12, 17): la lista usa `/F11` 6.92 pt con
   tracking +0.594, paso 13.83 pt, y el fondo es **crema `#f1ede8`**, no blanco. Actualizá
   también el contador `N CÓDIGOS` sumando o restando los códigos del producto.
6. **El índice del final** (si el producto se movió) — verificá que la última fila siga
   entrando en la página.

Para crear una página nueva alcanza con un `Dictionary` de tipo `/Page` cuyo `/Resources`
apunte al `/Font` de otra página, insertarlo con `pdf.pages.insert(i, pikepdf.Page(obj))` y
pintarle los dos paneles a toda la altura. El logo del panel oscuro se coloca con la imagen
recortada del original (`Slot.logo_pos` trae la posición de cada slot).

Al terminar, comprobá la numeración de punta a punta: es el error más fácil de que se
escape.

## Mover fichas sin rehacerlas (reflow)

Cuando hay que reordenar media sección, no rehagas las fichas: convertí la página de origen
en un Form XObject y dibujá cada panel recortado y trasladado. La ficha conserva tipografía,
fotos, chips y colores exactamente como estaban.

```python
form = pdf.make_indirect(pikepdf.Page(pdf.pages[i]).as_form_xobject())
# clip en coordenadas del destino, después la traslación
frag = f"q {x} {y} {w} {h} re W n 1 0 0 1 {dx} {dy} cm /Src Do Q"
```

Pasar del slot superior al inferior (o al revés) es un espejo: el panel blanco cruza de un
lado al otro y el oscuro hace lo contrario, así que cada panel se traslada por separado
(±306 en x, ±396 en y). Los márgenes internos de los dos slots son idénticos, por eso el
contenido cae justo. `scripts/reflow_sections.py` es el reflow completo del catálogo 2026 y
sirve de plantilla.

Cosas que muerden en un reflow:

- **El recuadro de numeración viaja dentro del panel blanco del slot inferior.** Al mover ese
  panel hay que taparlo en su nueva posición y repintar el de la página. Tapá con margen: en
  páginas ya editadas puede haber dos recuadros superpuestos con geometrías distintas.
- **No todas las fichas usan el panel oscuro.** Varias (apliques, estacas) van sobre crema
  `#f1ede8` y con el logo en su versión oscura. Al mover el panel entero eso viene solo,
  pero si armás una ficha a mano tenés que mirar de qué color es su panel.
- **Las fotos suelen estar recortadas por una máscara del estado gráfico, no por un SMask
  de la imagen.** Si sacás el XObject de imagen y lo dibujás suelto, aparece su fondo (crema
  o blanco). Copiá y escalá la región desde la página de origen en vez de recolocar la
  imagen, salvo que compruebes que el JPEG ya trae el fondo correcto.
- **Después de un reflow, `analyze_page.py` deja de ver el texto de las fichas** porque queda
  dentro de los Form XObjects. Para verificar contenido usá `pdftotext`, que sí los recorre.

## Cambiar el color de fondo de un panel

Una sección puede quedar con paneles de producto mezclados: unos negros `#1e1e1e` y otros
crema `#f1ede8`. Para unificarlos no hace falta rehacer las fichas, pero **no alcanza con
pintar el panel**: hay cuatro cosas atadas al color de fondo.

1. el relleno del panel                 `#1e1e1e` -> `#f1ede8`
2. el gris de los códigos bajo la foto  `#c9c9c9` -> `#6d6d6d`
3. el logo TENARUZ                      versión blanca -> versión oscura
4. **la foto**, que trae el fondo negro cocido en el JPEG

`scripts/panel_a_crema.py` hace las cuatro. Los tres primeros son reemplazos dentro del
content stream del Form XObject; el cuarto lo resuelve `scripts/recorte_fondo.py`.

Cuidados:

- **Los forms se comparten entre páginas.** S15, por ejemplo, lo usan la 13 (mitad de
  arriba) y la 14 (mitad de abajo). Editarlo en el lugar cambia las dos, así que la página
  que se toca se lleva una copia propia del form, de su `/Resources` y de su `/XObject`.
- **`Stream(pdf, datos, **kwargs)` vuelve a anteponer `/` a cada clave**, así que copiar el
  diccionario del form por kwargs deja claves `//BBox` y el visor tira "XObject subtype is
  missing". Copiá las claves después de crear el stream.
- El documento escribe los colores con 9 decimales en las páginas originales y con 6 en las
  que se agregaron después. Contemplá las dos escrituras.

## Recortar el fondo de una foto de producto

Las fotos de los paneles oscuros tienen el fondo `#1e1e1e` cocido en el JPEG y **no** traen
SMask (el SMask que aparece en esas páginas es el del logo). Para pasarlas a crema hay que
recortarlas: `scripts/recorte_fondo.py`.

Lo que hace que salga bien:

- **Umbral alto** (14 sobre 255). El JPEG deja anillos alrededor del contorno; con un umbral
  bajo esos píxeles de fondo entran en la silueta y quedan como dientes negros, muy visibles
  al 300 dpi.
- **Rellenar huecos.** El producto es macizo, así que `binary_fill_holes` recupera las zonas
  que coinciden con el fondo. Es lo que permite recortar un spot negro sobre negro.
- **Limar con disco, no con cuadrado**, y con radio chico: el radio lo limita la parte más
  fina de la foto (el cable del spot de 12V, ~7 px), así que la apertura va con radio 2.
- **No promediar al recomponer.** Si lo observado es `obs = producto*a + fondo*(1-a)`, sobre
  el crema queda `obs + (crema - fondo)*(1-a)`. Eso respeta el antialias del borde sin dejar
  orla oscura, y funciona aunque la máscara no sea perfecta.

Verificá siempre a 300 dpi contra el original: los dientes de la silueta no se ven a 100.

Al revés no funciona: una foto tomada sobre crema no se puede poner sobre negro sin recortar
el producto del fondo.

## Antes de borrar un producto: mirá si la foto es la que dice ser

En el catálogo 2026 las fotos de la AR70 y la AR111 estaban cambiadas de ficha. Cada ficha
tenía su título, sus datos y su código correctos; lo único cruzado era la foto, y eso no se
nota leyendo. Al borrar la ficha "AR70 LED" —que era la que llevaba la foto de la AR111—
el catálogo quedó sin AR70 y con la AR111 mostrando la lámpara equivocada, y la foto buena
se fue con la ficha borrada.

Antes de borrar una ficha, comprobá que su foto corresponda. Para lámparas con casquillo
estándar alcanza con una regla: el casquillo GU10 mide ~20 mm, así que

    diámetro real ≈ 20 mm x (ancho del reflector / ancho del casquillo)

medidos en píxeles sobre la foto. Contra el campo "Medidas" de la ficha el cruce salta solo:
daba 124 mm en la ficha que declaraba Ø70 y 84 mm en la que declaraba Ø111.

Si hay que rehacer una sección entera, fijate primero si el archivo original sirve de
fuente: si esa sección no cambió salvo la paginación, traerla completa del original y
renumerar es mucho menos riesgoso que reinsertar una ficha y reflowear las que siguen.
Verificá la equivalencia pantalla contra pantalla antes de confiar en eso.

## Recomponer una foto en el formato de otra ficha

Cada ficha tiene su hueco de foto en puntos, y una imagen con otra proporción sale estirada.
`scripts/recomponer_foto.py` recorta la lámpara de su fondo y la vuelve a montar en el
lienzo que espera el hueco destino, con el mismo peso visual que la que reemplaza.

El halo de color detrás de las lámparas no se inventa: se mide sobre las fotos que ya lo
tienen. Tomando el realce de luminancia por distancia al contorno sale una caída
exponencial, con dominante cálida en 3000K y neutra fría en 4000K. Reconstruirlo con esa
fórmula sobre la transformada de distancia da un resultado indistinguible del original.

Dos cosas que hay que calibrar al trasplantarlo a otra foto:

- **El realce medido sirve de piso, no de receta.** Los valores del original valen para una
  lámpara que ocupa el 57% del cuadro; si la nueva lo llena más, queda menos fondo donde se
  vea el halo y a tamaño de página las dos temperaturas se confunden. Mirá el resultado al
  tamaño al que se imprime, no al 100%.
- **La luz rebota en el cuerpo de la lámpara**, y ese rebote se concentra en el borde y se
  apaga hacia adentro: se calcula con la transformada de distancia hacia el interior de la
  silueta. Aplicado plano sobre toda la lámpara parece un filtro de color y le saca el
  blanco al cuerpo.

Ojo con el umbral de recorte: si la foto de origen ya trae halo, un umbral bajo se lo lleva
como parte de la silueta. Para esas hay que subirlo bastante (45 sobre 255).

## Tapar un texto no lo borra

Reemplazar un texto pintándole un rectángulo encima y escribiendo el nuevo lo saca de la
vista, pero el viejo **sigue en la capa de texto**: aparece al copiar y pegar, al buscar y en
cualquier extractor. En la página de contacto llegaron a convivir así el número de
administración que se había pedido borrar, los teléfonos viejos y el horario viejo.

`scripts/limpiar_capa_texto.py` borra los bloques `BT...ET` cuyo texto decodificado coincide
con los que ya no van. Dos cosas:

- Decodificá siguiendo el `/Fxx Tf` vigente dentro del bloque. Cada subset tiene su propio
  mapa CID -> unicode; mezclarlos da texto falso que parece corrupción del archivo.
- Borrá sólo del stream original de la página (índice 2). Los siguientes son las capas de
  corrección y son las que hay que conservar; el mismo texto puede estar en las dos.

Los rectángulos que tapaban se dejan: pintan el color de fondo. La verificación es que el
render quede idéntico y que `pdftotext` ya no devuelva los textos viejos.

## Portadillas de sección

Las portadillas (LÁMPARAS, ARTEFACTOS, FUENTES) son páginas crema con eyebrow, título,
lista de productos y contador `N CÓDIGOS`. En el diseño original el bloque era chico y
quedaba flotando en la página; se reescaló con un mismo factor para las tres, así los
títulos coinciden entre secciones y el texto queda acorde al tamaño de la hoja.

El reescalado se hace dibujando la página original como Form XObject con una matriz de
escala (`scripts/scale_dividers.py`): crece todo en proporción exacta, sin retocar textos.
El factor lo limita la portadilla más larga —conviene recalcularlo si cambia la cantidad de
productos— y el bloque se posiciona con el margen izquierdo de siempre (68 pt) y centrado
en vertical. Recortá la zona de contenido antes de dibujar, para que el recuadro de
numeración escalado no se cuele, y repintalo aparte.

## Escribir caracteres que los subsets no traen

Los subsets solo incluyen los glifos ya usados en el documento. La `w` minúscula, por
ejemplo, no existe en ninguna de las tres fuentes (ningún texto del catálogo la usa), así que
`www.tenaruz.com` no se puede componer con ellas. `scripts/simplefont.py` embebe Poppins
Regular completa como fuente simple con WinAnsiEncoding para esos casos; al ser la misma
familia, el resultado combina perfecto con el resto. Verificá siempre con
`Catalog.check_glyphs()` antes de dar por hecho que un texto entra.

## La ficha fluye: la tabla no está siempre en el mismo lugar

`Slot.row_baselines` vale cuando la descripción ocupa lo que el diseño previó: **tres
renglones en el slot superior y dos en el inferior**. Con un renglón de más, toda la tabla
—y los códigos con ella— baja 10.95 pt. Los códigos van 24.78 pt debajo de la última fila
de la tabla, y el subcódigo 9.22 pt debajo del código.

Esto muerde al reemplazar el valor de una fila o un código: si tomás la coordenada de la
grilla sin mirar, escribís encima del renglón equivocado y el viejo queda a la vista. Antes
de tocar una fila, medí dónde está realmente la primera divisoria de esa tabla:

```python
# las divisorias son filas casi enteras de gris #ededed dentro del panel
gris = ((sub > 225) & (sub < 248)).sum(axis=1) > ancho * 0.8
```

Y acordate de que al cambiar el largo de la descripción cambiás también dónde arranca la
tabla, así que o mantenés la misma cantidad de renglones o redibujás la ficha entera.

`scripts/editar_fichas.py` es el lote de correcciones de contenido del 2026 y sirve de
plantilla: descripciones con reajuste de línea, tablas completas, pies de dos renglones,
códigos y leyendas de foto.

## El crema no es uno solo

La sección ARTEFACTOS usa `#f1ede8`, pero **la ficha de la estaca de aluminio venía en
`#e4e0da`**, un crema más oscuro: arrastra el fondo de la página de la que salió. No se
nota mirando una página sola, y sí apenas repintás una parte del panel — quedan dos tonos
partidos por el borde del rectángulo.

Antes de tapar un pedazo de panel, muestreá el color real de ese panel en particular, no
el de la sección. Y si vas a unificarlo con el de las páginas vecinas, repintá el panel
**entero**: eso se lleva puesto el logo, que hay que volver a colocar (`Slot.logo_pos`,
imagen `Im134`, la versión oscura).

Lo mismo vale para las fotos: la de la estaca traía ese crema cocido en el JPEG y apareció
como un recuadro al recolocarla suelta. Se recorta contra **su propio** fondo —el de las
esquinas— y se recompone sobre el del panel.

Y embebelas con Flate, no con JPEG: sobre una superficie plana y grande, el punto de
diferencia que deja la compresión se ve como un recuadro fantasma.

## Una ficha que compara dos variantes

Cuando un producto tiene dos versiones con datos distintos, el catálogo venía resolviéndolo
metiendo los dos valores en la misma celda ("1x7W / 1x3W (mini)"), que se lee mal apenas
hay más de un dato que cambia. La alternativa que entra en la grilla es partir la columna
de valores en dos, con una fila de encabezado:

- encabezados en el estilo de subcódigo (/F11 5.19, #8d8d8d), alineados a la derecha de
  cada columna
- columna 1 a la derecha de **478**, columna 2 en `value_right`
- los valores comunes **se repiten en las dos columnas**. Dejarlos sólo en la de la derecha
  parece que pertenecen a esa variante.

Contá las filas antes de empezar: el encabezado ocupa una de las diez posiciones de
`row_baselines`, y cada fila que sumás baja los códigos 14.4 pt.

`scripts/ficha_comparativa.py` es la ficha de la estaca de aluminio, que además apila las
dos fotos: al pasar de una foto sola a dos, la altura baja a **130 pt**, que es la que usan
las fotos apareadas del resto de la sección.

Ojo con las tapas: los códigos viejos quedan **por encima** de los nuevos cuando la tabla
crece, así que el rectángulo tiene que arrancar arriba de la posición vieja, no de la nueva.

## El pie no siempre entra en un renglón

El pie lleva tracking +1.496 a cuerpo 5.76, así que un texto largo se pasa de los 232.3 pt
de la columna aunque parezca corto. Medilo con `cat.advance()` antes de escribirlo. Si no
entra, partilo en dos renglones separados 12.67 pt —la ficha del LED STICK ya usaba ese
patrón— en vez de achicar el cuerpo.

## Auditar el catálogo antes de entregarlo

Los errores que más cuesta ver son los de coherencia entre partes, no los de una página
suelta. Esta batería los saca a la luz en un minuto:

0. **Todas las fichas en el índice.** El índice original dejaba afuera las últimas por
   falta de lugar. `scripts/rehacer_indice.py` lo redibuja entero repartiendo el alto
   disponible entre las filas que haya: con 26 fichas el paso queda en 19.4 pt, que con
   cuerpo 7.49 sigue leyéndose cómodo. Redibujarlo entero es mejor que insertar filas:
   evita sumar otra capa tapada.
1. **Códigos contra portadilla.** Contá los `TZ-...` distintos de cada sección y comparalos
   con el `N CÓDIGOS` de su portadilla. Tienen que dar exacto — es el mejor detector de una
   ficha perdida o duplicada. En el 2026: 29 + 18 + 15 = 62.

   **Si movés una ficha de sección, movele el contador a las dos.** El spot de 12V
   (`TZ-SPOT12V-3W-NG-3K`) estaba en LÁMPARAS en el original y es un artefacto: al mudarlo,
   LÁMPARAS pasó de 30 a 29 y ARTEFACTOS de 17 a 18. Actualicé el de destino y el de origen
   quedó peor que antes, en 31. El contador no se deduce de la portadilla anterior: contalo
   siempre contra los códigos que hay, y hacelo de nuevo al final, después del último cambio.
2. **Índice contra páginas.** Cada fila del índice tiene que caer en la página que dice.
3. **Numeración.** Los recuadros van de 2 a N-1; la portada y la página de contacto **no**
   llevan número.
4. **Diferencia contra la fuente.** Renderizá a 72 dpi y comparé página por página contra
   el archivo del que partiste. Todo lo que cambió tiene que estar explicado: si una página
   que no tocaste da distinto, ahí hay un problema. Y en las que sí tocaste, mirá **dónde**
   cae la diferencia: al cambiar dos fotos, el diff tiene que vivir dentro de los huecos de
   esas fotos y en ningún otro lado.
5. **Capa de texto.** `pdftotext` de cada página tiene que salir legible y sin renglones
   encimados. Si aparecen dos versiones de un texto, quedó una tapada (ver más arriba).

### Los números de página se acumulan

Renumerar tapa el recuadro y dibuja el número nuevo encima, así que cada renumeración deja
el anterior debajo. Después de dos rondas había páginas con cuatro números en la capa de
texto. `scripts/limpiar_numeros.py` deja sólo el que se ve.

Filtrá por posición (x>570, y<40): sin eso, la columna de números del índice —que son 23 y
sí se ven— entra en la redada. Me pasó.

### El texto tapado también vive dentro de los Form XObjects

En las portadillas y en las páginas armadas moviendo paneles, el texto viejo no está en el
stream de la página sino en el form que dibuja. Para limpiarlo hay que copiar el form
—puede estar compartido con otra página, como S17 entre la 16 y la 17— y borrar los bloques
ahí adentro. Verificá siempre que el render quede idéntico: si cambia, borraste algo que se
veía.

## Texto dentro de un form con escala: el cuerpo no es el que dice `Tf`

Las portadillas dibujan su contenido con `/Src Do` bajo un `cm` de 1.9. Un `/F11 12 Tf` ahí
adentro no son 12 pt ni los 6.91 de la escala global: son `12 x 0.576271 x 1.9 = 13.139`.
Para reescribir ese texto en coordenadas de página hay que componer toda la cadena — el `cm`
de la página, el `0.75 ... 792` que abre el form, el `cm` interno vigente y el `Tm` con la
`y` invertida — y recién ahí tenés la línea de base.

La cadena es fácil de equivocar, así que **validala antes de cambiar nada**: borrá el bloque
del form, redibujá *el mismo texto* en coordenadas de página y diffeá contra el archivo de
partida. Tiene que dar **0 píxeles de diferencia a 300 dpi**. Si da 0, la posición, el cuerpo,
el tracking y el color están bien y podés cambiar el texto tranquilo. Lo usé para pasar el
contador de la portadilla de 31 a 29.

Dos detalles que muerden:

- **Los dígitos de Poppins no son tabulares**: `1` avanza 320 y `9` avanza 630. Cambiar el
  CID de un número dentro del run corre todo lo que sigue. Hay que rehacer el run entero.
- El tracking sacalo del propio run (`Td` menos avance del glifo) y multiplicalo por el
  factor form -> página. No lo estimes.

## Sobre los datos del producto

Las fichas nuevas salen del PDF de diseño del packaging (`TZSPOT...design.pdf` y similares),
que trae los datos técnicos y la foto. La foto se saca con `pdfimages -all`; ojo que suelen
venir en **CMYK con marcador Adobe**, así que hay que invertirlas al convertir, y la máscara
de transparencia viene como una imagen aparte en escala de grises. `scripts/extract_photo.py`
resuelve las dos cosas.

Normalizá las unidades al criterio del catálogo (`≥80 Ra`, `240 lm`, `Ø25 x 50 mm`), no al
del packaging. Y si un dato no te lo dieron — por ejemplo cuántas unidades trae el bulto
cerrado — no lo inventes: preguntá o poné algo que sí sepas que es cierto.
