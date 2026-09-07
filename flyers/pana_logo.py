"""El lockup de PANA como SVG monolineal.

El logo es de trazo uniforme, así que se dibuja con `stroke` sobre las líneas
medias en vez de contornear cada letra: los empalmes salen exactos y el grosor
se cambia en un solo lugar.

Sistema de coordenadas: altura de mayúscula de 210 a 340, grosor de trazo 22.
"""

TRAZO = 22
PALABRA = [
    # P: asta y panza semicircular a la derecha
    "M36 340 V221 H80 A32 32 0 0 1 80 285 H36",
    # A: arco de hombros redondeados sobre dos astas, con travesaño
    "M156 340 V249 A28 28 0 0 1 184 221 H226 A28 28 0 0 1 254 249 V340",
    "M156 302 H254",
    # N: asta recta a la izquierda y hombro redondeado a la derecha
    "M306 340 V221 H376 A28 28 0 0 1 404 249 V340",
    # A
    "M456 340 V249 A28 28 0 0 1 484 221 H526 A28 28 0 0 1 554 249 V340",
    "M456 302 H554",
]

PUNTOS = [(27 + 45.3 * i, 377) for i in range(8)]   # 8 puntos bajo la palabra
RADIO = 9


def svg(color, alto=62):
    """Devuelve el lockup completo escalado a `alto` px de alto."""
    trazos = "".join(
        f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{TRAZO}" '
        f'stroke-linecap="butt" stroke-linejoin="miter"/>' for d in PALABRA)
    puntos = "".join(f'<circle cx="{x:.1f}" cy="{y}" r="{RADIO}" fill="{color}"/>'
                     for x, y in PUNTOS)
    # la palabra se alinea a la derecha con la "A" final y su altura de x queda
    # centrada con la fila de puntos
    texto = (f'<text x="565" y="386" text-anchor="end" fill="{color}" '
             f'font-family="Poppins" font-size="31" font-weight="300" '
             f'letter-spacing="2">iluminación</text>')
    vb = (14, 202, 576, 200)
    ancho = alto * vb[2] / vb[3]
    return (f'<svg viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" width="{ancho:.1f}" '
            f'height="{alto}">{trazos}{puntos}{texto}</svg>')
