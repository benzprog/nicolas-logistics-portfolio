# Lista mayorista TENARUZ

La lista mayorista sale de Excel. Para agregarle productos no se rehace el
documento: se editan los operadores del PDF original, de modo que las páginas que
ya estaban aprobadas quedan intactas salvo en lo que se toca a propósito. El ida y
vuelta del stream se verificó idéntico al pixel antes de empezar a tocar nada.

| archivo | para qué |
|---|---|
| `origen/` | el PDF tal como llegó, sin tocar |
| `leer_mayorista.py` | lee el stream y devuelve rellenos, fotos y textos con sus coordenadas |
| `texto_pdf.py` | mide y escribe texto con las métricas reales de Roboto |
| `preparar_fotos.py` | recorta las fotos nuevas al producto y las deja en JPEG |
| `agregar_12v.py` | arma la sección PRODUCTOS 12 VOLTS y mueve el spot 12V a esa sección |

## Lo que hay que saber antes de tocarlo

- **El subset de fuentes del Excel está recortado.** El Roboto incrustado no tiene
  la `í` de «Cortesía» y el Calibri sólo trae los dígitos 1 a 4, así que la página 5
  decía «Página ▯». La página nueva usa Roboto bajado de Google —verificado métrica
  por métrica contra el subset— y Carlito, que es el clon métrico de Calibri.
- **Cada foto trae su propio recorte a medida.** Si se mueve la foto y no el
  `re W* n` que la precede, la foto aparece cortada: la estaca solar perdió la
  cabeza y quedó sólo el palo.
- **Las fotos cuelgan fuera de su fila.** La estaca solar arranca 42pt por debajo
  del piso de su fila, así que no se las puede seleccionar por banda vertical: van
  por nombre.
- **El rayado arranca en gris en cada grupo.** Al sacar una fila del medio hay que
  invertir el rayado de todo lo que queda debajo, y también el verde de la celda
  STOCK, que tiene un tono para la fila gris y otro para la blanca.
- Los huecos entre grupos de productos son separadores, no sobrantes: se respetan.
