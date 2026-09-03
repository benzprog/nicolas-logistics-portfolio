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

## Sobre los datos del producto

Las fichas nuevas salen del PDF de diseño del packaging (`TZSPOT...design.pdf` y similares),
que trae los datos técnicos y la foto. La foto se saca con `pdfimages -all`; ojo que suelen
venir en **CMYK con marcador Adobe**, así que hay que invertirlas al convertir, y la máscara
de transparencia viene como una imagen aparte en escala de grises. `scripts/extract_photo.py`
resuelve las dos cosas.

Normalizá las unidades al criterio del catálogo (`≥80 Ra`, `240 lm`, `Ø25 x 50 mm`), no al
del packaging. Y si un dato no te lo dieron — por ejemplo cuántas unidades trae el bulto
cerrado — no lo inventes: preguntá o poné algo que sí sepas que es cierto.
