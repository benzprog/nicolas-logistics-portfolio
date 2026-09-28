"""Flyer mensual de la lista de precios, rediseñado con la identidad actual de PANA.

Rehace el mail de "LISTA DE PRECIOS / MES AÑO" manteniendo lo que lo hace reconocible —la
cabecera amarilla con el patrón de lámparas, el círculo negro con el logo, el mes como
protagonista, el botón de descarga y el pie con WhatsApp— pero llevado al lenguaje del
catálogo 2026: crema #F1EDE8, negro, Poppins y mucho aire.

Dos decisiones de diseño que vale la pena dejar escritas:

- **El amarillo se usa menos y rinde más.** En el original ocupaba un tercio de la pieza en
  plano; acá queda en la cabecera, en un filete y en el botón. Un plano grande de amarillo
  satura y le saca jerarquía a todo lo demás.
- **Se va el cobre del original.** La identidad de hoy —la del catálogo— es negro, crema y
  amarillo; un cuarto color no suma y ensucia la paleta.

El patrón de lámparas se dibuja en SVG en vez de repetir un bitmap: la pieza sale en PDF
vectorial y así el patrón queda nítido a cualquier tamaño.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from flyer_common import FACES, logo, render  # noqa: E402

# ── contenido del envío ──────────────────────────────────────────────────────
MES, ANIO = "OCTUBRE", "2026"
ENTRADA = ("Ya está disponible la lista mayorista de octubre. "
           "Los productos están en el catálogo 2026, actualizado al 100%.")
DATOS = [
    ("SIN CAMBIOS", "Ningún precio se movió respecto de septiembre"),
    ("15 DÍAS", "Plazo de entrega de lo que no está en stock: antes eran 30"),
    ("30 · 45 · 60", "Financiación en tres pagos con echeq"),
]
LETRA_CHICA = ("Precios en USD sin IVA · Tipo de cambio oficial vendedor BNA · "
               "Venta por bulto cerrado")
CONTACTO = [("VENTAS", "11-6288-3659"), ("CONSULTAS", "11-4176-4205")]
MAIL = "panailuminacion@gmail.com"
HORARIO = "Lunes a viernes de 9:30 a 16:30 hs"

AMARILLO = "#F8D332"
NEGRO = "#121212"
CREMA = "#F1EDE8"
TINTA = "#1A1A1A"
GRIS = "#8D8D8D"


# ── el patrón de lámparas de la cabecera ─────────────────────────────────────
def gu10(x, y, e):
    """Dicroica GU10: cono recto, casquillo y dos patas."""
    return (f'<g transform="translate({x},{y}) scale({e})">'
            '<rect x="2" y="2.4" width="34" height="4.6" rx="2.3"/>'
            '<path d="M5.4 7 L11.6 29 H26.4 L32.6 7"/>'
            '<rect x="13.2" y="29" width="11.6" height="8.6"/>'
            '<path d="M15.8 37.6v3.6M22.2 37.6v3.6"/></g>')


def dicroica(x, y, e):
    """Dicroica MR16: reflector más ancho y bajo, con las facetas marcadas."""
    facetas = "".join(
        f'<path d="M{7.2 + i * 5.4:.1f} 7.6 L{15.6 + i * 3.6:.1f} 25.4"/>' for i in range(8))
    return (f'<g transform="translate({x},{y}) scale({e})">'
            '<rect x="2" y="2.4" width="50" height="4.6" rx="2.3"/>'
            '<path d="M5.4 7 L14.4 26.6 H39.6 L48.6 7"/>'
            f'{facetas}'
            '<rect x="20.4" y="26.6" width="13.2" height="7.4"/>'
            '<path d="M23.4 34v3.4M30.6 34v3.4"/></g>')


def patron(ancho, alto):
    """Rejilla alternada de las dos lámparas, tono sobre tono sobre el amarillo."""
    piezas, paso_x, paso_y, fila = [], 52, 42, 0
    y = -22
    while y < alto + 30:
        x = -30 + (0 if fila % 2 == 0 else -26)
        col = 0
        while x < ancho + 60:
            dibujo = gu10 if (fila + col) % 2 == 0 else dicroica
            piezas.append(dibujo(x, y, 0.62))
            x += paso_x
            col += 1
        y += paso_y
        fila += 1
    return (f'<svg class="patron" viewBox="0 0 {ancho} {alto}" '
            f'preserveAspectRatio="xMidYMid slice">'
            f'<g fill="none" stroke="#FFFFFF" stroke-opacity=".40" stroke-width="1.5" '
            f'stroke-linejoin="round">{"".join(piezas)}</g></svg>')


def puntos(ancho, alto):
    """La columna de puntos negros detrás del disco.

    En el original es un rectángulo de bordes duros. Acá corre a toda la altura de la
    cabecera —así no queda una hilera suelta cortada contra el crema— y se disuelve sólo
    hacia los costados, que es donde el borde se notaría.
    """
    p, paso = [], 13.0
    y = paso / 2
    while y < alto:
        x = paso / 2
        while x < ancho:
            p.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.95"/>')
            x += paso
        y += paso
    return (f'<svg class="puntos" viewBox="0 0 {ancho} {alto}" preserveAspectRatio="none">'
            f'<defs><linearGradient id="esfumado">'
            f'<stop offset="0" stop-color="#fff" stop-opacity="0"/>'
            f'<stop offset=".28" stop-color="#fff" stop-opacity="1"/>'
            f'<stop offset=".72" stop-color="#fff" stop-opacity="1"/>'
            f'<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
            f'<mask id="m"><rect width="{ancho}" height="{alto}" fill="url(#esfumado)"/>'
            f'</mask></defs>'
            f'<g fill="{NEGRO}" mask="url(#m)">{"".join(p)}</g></svg>')


datos_html = "".join(
    f'<div class="dato"><div class="cifra">{c}</div><div class="pie">{t}</div></div>'
    for c, t in DATOS)
contacto_html = "".join(
    f'<div class="via"><span class="rot">{r}</span><span class="num">{n}</span></div>'
    for r, n in CONTACTO)

HTML = f"""<!doctype html><html lang="es"><meta charset="utf-8"><style>
{FACES}
@page {{ size: A4; margin: 0 }}
*{{ margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased }}
body {{ width:210mm; height:297mm; background:{CREMA}; font-family:'Poppins',sans-serif;
        color:{TINTA}; display:flex; flex-direction:column; overflow:hidden }}

/* ── cabecera ── */
.cabecera {{ position:relative; height:70mm; background:{AMARILLO}; overflow:hidden;
             display:flex; align-items:center; justify-content:center; flex:none }}
.patron {{ position:absolute; inset:0; width:100%; height:100% }}
.puntos {{ position:absolute; top:0; bottom:0; left:50%; transform:translateX(-50%);
           width:126mm; height:100% }}
.disco {{ position:relative; width:57mm; height:57mm; border-radius:50%; background:{NEGRO};
          display:flex; align-items:center; justify-content:center }}
.disco img {{ width:40mm; display:block }}

/* ── cuerpo ── */
.cuerpo {{ flex:1; display:flex; flex-direction:column; align-items:center;
           justify-content:center; padding:10mm 22mm 12mm }}
.rotulo {{ font-size:8pt; font-weight:500; letter-spacing:.44em; color:{GRIS};
           text-transform:uppercase; text-indent:.44em }}
.mes {{ font-size:36pt; font-weight:300; letter-spacing:.055em; line-height:1.06;
        margin-top:4.5mm; text-indent:.055em }}
.mes b {{ font-weight:600 }}
.filete {{ width:22mm; height:2.6pt; background:{AMARILLO}; margin:5.5mm 0 0 }}
.entrada {{ margin-top:7mm; max-width:132mm; text-align:center; font-size:10.5pt;
            font-weight:300; line-height:1.85; color:#3B3B3B }}

.datos {{ display:flex; width:100%; margin-top:10mm; border-top:.6pt solid #DFDAD3;
          border-bottom:.6pt solid #DFDAD3 }}
.dato {{ flex:1; padding:6.5mm 4mm; text-align:center }}
.dato + .dato {{ border-left:.6pt solid #DFDAD3 }}
.cifra {{ font-size:14.5pt; font-weight:600; letter-spacing:.055em; white-space:nowrap }}
.pie {{ margin-top:3mm; font-size:7.6pt; font-weight:300; line-height:1.6; color:{GRIS} }}

.boton {{ margin-top:11mm; background:{AMARILLO}; color:{NEGRO}; font-size:9.5pt;
          font-weight:600; letter-spacing:.24em; padding:5.6mm 16mm; text-indent:.24em }}
.chica {{ margin-top:6mm; font-size:7pt; font-weight:300; letter-spacing:.02em;
          color:#A0A0A0; text-align:center }}

/* ── pie ── */
.pieza {{ flex:none; background:{NEGRO}; color:#FFF; padding:9mm 22mm 8.5mm;
          display:flex; flex-direction:column; align-items:center }}
.pieza .marca {{ width:40mm; opacity:.95 }}
.pieza .bajada {{ margin-top:4mm; font-size:7pt; font-weight:300; letter-spacing:.34em;
                  color:#8A8A8A; text-indent:.34em }}
.vias {{ display:flex; gap:18mm; margin-top:6.5mm }}
.via {{ text-align:center }}
.rot {{ display:block; font-size:6.6pt; font-weight:500; letter-spacing:.3em;
        color:{AMARILLO}; text-indent:.3em }}
.num {{ display:block; margin-top:2mm; font-size:11pt; font-weight:300;
        letter-spacing:.04em }}
.sello {{ margin-top:5.5mm; font-size:7.6pt; font-weight:300; color:#9A9A9A;
          text-align:center; line-height:1.9 }}
</style>

<div class="cabecera">
  {patron(760, 280)}
  {puntos(300, 170)}
  <div class="disco"><img src="{logo('pana_blanco_mail.png')}" alt="PANA iluminación"></div>
</div>

<div class="cuerpo">
  <div class="rotulo">Lista mayorista</div>
  <div class="mes">{MES} <b>{ANIO}</b></div>
  <div class="filete"></div>
  <p class="entrada">{ENTRADA}</p>
  <div class="datos">{datos_html}</div>
  <div class="boton">DESCARGAR LA LISTA</div>
  <div class="chica">{LETRA_CHICA}</div>
</div>

<div class="pieza">
  <img class="marca" src="{logo('tenaruz_blanco_vector.png')}" alt="TENARUZ">
  <div class="bajada">Importa y distribuye PANA iluminación s.a</div>
  <div class="vias">{contacto_html}</div>
  <div class="sello">{MAIL}<br>{HORARIO}</div>
</div>
</html>"""

if __name__ == "__main__":
    render(HTML, f"PANA_lista_{MES.lower()}_{ANIO}")
