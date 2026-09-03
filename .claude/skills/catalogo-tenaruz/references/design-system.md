# Sistema de diseño del catálogo TENARUZ 2026

Todos estos valores salen del content stream del PDF original (vía `analyze_page.py`), no
de estimaciones sobre el render. Sirven como referencia rápida y como control cruzado.

**Si trabajás sobre otra página, corré igual el analizador**: la grilla varía sutilmente
entre páginas y estos números son los de la página 5.

## Página y escala

| | |
|---|---|
| Tamaño | Letter, 612 × 792 pt |
| Generador | wkhtmltopdf 0.12.6 |
| Factor de escala | **0.576271** (0.75 externo × 0.768361587 interno) |
| Fuentes | `/F11` Poppins-Regular · `/F19` Poppins-Bold · `/F20` Poppins-Medium |
| Codificación | Identity-H (CIDs de 2 bytes), subsets |

El factor de escala es la razón por la que no se puede estimar a ojo: `/F11 11 Tf` se
dibuja a **6.34 pt efectivos**. Multiplicá siempre el tamaño nominal por 0.576271.

Ojo: la portada (página 1) solo tiene `/F11` entre sus recursos. Para usar Bold o Medium
ahí hay que copiar el recurso desde otra página (`Catalog.ensure_font`).

## Paleta

| Color | Uso |
|---|---|
| `#1a1a1a` | Títulos, valores de la tabla, códigos, recuadro del número de página |
| `#3b3b3b` | Texto de descripción, filas del índice |
| `#818181` | Etiquetas de la tabla de especificaciones |
| `#7a7a7a` | Subtítulo de la ficha |
| `#8d8d8d` | Subcódigo (bajo el código en negrita) |
| `#9c9c9c` | Pie ("BULTO CERRADO x N") |
| `#9a9a9a` | Números de página en el índice; etiquetas de variante ("BLANCO CÁLIDO") |
| `#c9c9c9` | Epígrafe del código bajo la foto, en el panel oscuro |
| `#e0e0e0` | Chips de código dentro del panel oscuro |
| `#ededed` | Líneas divisorias de la tabla (trazo de 0.576 pt) |
| `#1e1e1e` | Fondo de los paneles oscuros (plano y uniforme) |
| `#ffffff` | Fondo de los paneles blancos |

## Estructura

19 páginas. Cada página de producto lleva **dos fichas** con los paneles espejados:

- **Mitad superior** (y 396–792): panel blanco a la izquierda, oscuro a la derecha.
- **Mitad inferior** (y 0–396): panel oscuro a la izquierda, blanco a la derecha.

Márgenes de contenido: **36.84 pt** desde los bordes del panel, de los dos lados.

| Página | Contenido |
|---|---|
| 1 | Portada |
| 2 | Índice |
| 3 | Portadilla "LÁMPARAS Y TUBOS LED" (con contador `N CÓDIGOS`) |
| 4–11 | Fichas de lámparas |
| 12 | Portadilla "ARTEFACTOS" |
| 13–16 | Fichas de artefactos |
| 17 | Portadilla "FUENTES SWITCHING" |
| 18 | Fichas de fuentes |
| 19 | Contacto |

## Slot inferior (verificado píxel a píxel)

Panel oscuro x 0–306, panel blanco x 306–612, ambos y 0–396.

| Elemento | Fuente | Tam. nominal | **Efectivo** | Tracking | Color | Posición |
|---|---|---|---|---|---|---|
| Título | `/F19` | 32 | **18.44 pt** | −0.405 | `#1a1a1a` | x 342.83, y 343.66 |
| Subtítulo | `/F20` | 11 | **6.34 pt** | +1.895 | `#7a7a7a` | x 342.83, y 326.37 |
| Descripción | `/F11` | 12 | **6.92 pt** | 0 | `#3b3b3b` | x 342.83, y 294.10; interlínea 10.95 |
| Etiqueta de fila | `/F11` | 11 | **6.34 pt** | +0.245 | `#818181` | x 342.83 |
| Valor de fila | `/F20` | 11 | **6.34 pt** | 0 | `#1a1a1a` | alineado a la derecha en x 575.15 |
| Código | `/F20` | 10 | **5.76 pt** | +0.396 | `#1a1a1a` | x 342.83, y 103.93 |
| Subcódigo | `/F11` | 9 | **5.19 pt** | +0.895 | `#8d8d8d` | x 342.83, y 94.14 |
| Pie | `/F11` | 10 | **5.76 pt** | +1.496 | `#9c9c9c` | x 342.83, y 30.75 |
| Epígrafe de foto | `/F11` | 9 | **5.19 pt** | +1.596 | `#c9c9c9` | centrado en x 153, y 88.37 |
| Número de página | `/F11` | 11 | **6.34 pt** | 0 | blanco | x 594.39, y 14.61 |

Otros elementos:

- **Barra de acento** bajo el subtítulo: rectángulo x 342.72, y 312.48, 129.96 × 1.08, `#1a1a1a`
- **Líneas de la tabla**: trazo `#ededed` de 0.576 pt, de x 342.60 a 575.40
- **Recuadro del número de página**: rectángulo x 581, y 0, 31 × 25.2, `#1a1a1a`
- **Logo TENARUZ** (vectorial, no lo repintes): tinta en x 207.72–275.04, y 347.04–365.04.
  Tapá el panel oscuro solo hasta y = 340.

Líneas de base de las 10 filas: 258.95, 244.54, 229.56, 215.15, 200.75, 186.34, 171.93,
157.53, 143.12, 128.71.
Líneas divisorias: 253.44, 239.04, 224.64, 210.24, 195.84, 181.44, 167.04, 152.64, 138.24,
123.84.

El paso nominal es 14.4 pt, pero la separación real tiene una irregularidad de ~0.5 pt
heredada del redondeo de wkhtmltopdf. Por eso conviene usar la lista literal y no
recalcularla con una fórmula.

## Slot superior

Espejado: panel blanco x 0–306, panel oscuro x 306–612, ambos y 396–792. Mismos estilos
tipográficos que el slot inferior; cambian las coordenadas.

| Elemento | Posición |
|---|---|
| Borde izquierdo del texto | x 36.85 |
| Alineación derecha de valores | x 269.17 |
| Título | y 739.56 |
| Subtítulo | y 722.27 |
| Descripción (1er renglón) | y 690.00, interlínea 10.95 |
| Filas | 643.90, 629.49, 615.08, 600.68, 585.69, 571.29, 556.88, 542.47, 528.07, 513.66 |
| Código | y 488.88 (si hay varios códigos van en fila: 2º en x 114.26) |
| Subcódigo | y 479.66 |
| Pie | y 426.64 |

`accent_bar` y `row_rules` del slot superior en `catalog.py` están **derivados**, no
medidos. Si vas a tocar una ficha superior, confirmalos con `analyze_page.py` antes.

### Bloques de variantes de color (panel oscuro)

Las fichas con varias temperaturas (3000K / 4000K / 6000K) llevan, por variante:

| Elemento | Fuente | Efectivo | Tracking | Color |
|---|---|---|---|---|
| Temperatura ("3000K") | `/F20` 21 | 12.10 pt | −0.004 | blanco |
| Etiqueta ("BLANCO CÁLIDO") | `/F11` 9 | 5.19 pt | +1.494 | `#9a9a9a` |
| Chip de código | `/F11` 9 | 5.19 pt | +0.895 | `#e0e0e0` |

En la página 5 (MR16) esos bloques arrancan en x 459.46, y el chip en x 465.70.

## Índice (página 2)

| Elemento | Fuente | Efectivo | Tracking | Color | Posición |
|---|---|---|---|---|---|
| Nombre del producto | `/F11` 13 | **7.49 pt** | 0 | `#3b3b3b` | x 68.03 |
| Número de página | `/F11` 11 | **6.34 pt** | 0 | `#9a9a9a` | x 539.96 |

Las filas miden 23.4 pt de alto y están separadas por líneas divisorias que se comparten
entre filas contiguas. Para reemplazar una fila, tapá solo la banda interior (por ejemplo
x 60–535, y 485–506 para la fila de AR70) y dejá intactos el número de página y las líneas.

## Portada (página 1)

Fondo `#1e1e1e` uniforme. Todo el texto es vectorial y se conserva sin tocarlo:

| Elemento | Posición (desde arriba) |
|---|---|
| Logo TENARUZ | y 100.8 – 138.6 |
| "CATÁLOGO 2026" | y 159.5 – 166.7 |
| "IMPORTA Y DISTRIBUYE · PANA ILUMINACIÓN S.A." | y 713.2 – 719.3 |

La zona de la foto va entre el subtítulo y el pie: se puede tapar de y 190 a 703 (desde
arriba) sin tocar el texto. La foto de la edición 2026 quedó a 380 pt de ancho, centrada
horizontalmente y centrada en esa banda.
