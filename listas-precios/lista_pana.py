"""Arma la lista de precios de PANA a partir del dataset del proveedor.

Toma `tdc_datos.json` (lo produce `extraer_tdc.py`), aplica el recargo y maqueta el PDF con
el sistema visual de PANA: Archivo, hueso / negro / un solo amarillo, esquinas vivas y
filetes finos.

Reglas de los datos, que no se negocian:

- **Los precios salen del archivo del proveedor, uno por uno.** No hay ninguno calculado a
  partir de otro ni completado a ojo.
- **El orden y el agrupamiento son los del original.** Los rubros y los renglones de detalle
  van donde estaban; no se reordena ni se junta nada que allá estuviera separado.
- Los productos sin precio (los que el proveedor marca "REEMP.") ya quedaron afuera en la
  extracción, y los códigos del proveedor no se publican.
"""
import base64
import io
import json
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parents[1] / "flyers"))
from flyer_common import ARCHIVO, CHROME  # noqa: E402

BASE = pathlib.Path(__file__).parent
DATOS = BASE / "tdc_datos.json"
FOTOS = BASE / "fotos_tdc"
LOGOS = BASE.parent / "flyers" / "logos"

RECARGO = 1.08                    # 8% sobre el precio de lista del proveedor
MES, ANIO = "Octubre", "2026"
VIGENCIA = "Vigente desde el 1 de octubre de 2026"

# de la lista de PANA, no del proveedor. El 11 4176-4205 quedó fuera de uso.
VENTAS = "11 6288-3659"
MAIL = "panailuminacion@gmail.com"
HORARIO = "Lunes a viernes de 9:30 a 16:30"
NOTA = "Los precios no incluyen IVA"

HUESO, NEGRO, CLARO, AMARILLO = "#F0EEE6", "#131313", "#F4F3F1", "#FFCE1F"
FILETE, GRIS = "#D6D2CA", "#8A8884"


def pesos(n):
    return "$ " + f"{n:,}".replace(",", ".")


# la foto se imprime a 24 mm de ancho: a 300 ppp son ~285 px. Embeberlas al tamaño original
# dejaba un PDF de 11 MB, imposible de mandar por mail o WhatsApp, sin ninguna ganancia visible.
ANCHO_FOTO_PX = 300
_cache = {}


def uri(ruta):
    if ruta not in _cache:
        from PIL import Image
        im = Image.open(ruta)
        if im.width > ANCHO_FOTO_PX:
            im = im.resize((ANCHO_FOTO_PX, round(im.height * ANCHO_FOTO_PX / im.width)),
                           Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "PNG", optimize=True)
        _cache[ruta] = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"
    return _cache[ruta]


crudas = json.loads(DATOS.read_text(encoding="utf-8"))
# los discontinuados salen, y con ellos los renglones de medida que los acompañaban:
# sueltos no dicen nada y parecerían pertenecer al producto siguiente
filas, saltar = [], False
for f in crudas:
    if f["tipo"] == "descontinuado":
        saltar = True
        continue
    if saltar and f["tipo"] == "detalle":
        continue
    saltar = False
    filas.append(f)

productos = [f for f in filas if f["tipo"] == "producto"]
for f in productos:
    f["precio"] = round(f["costo"] * RECARGO)

# El índice son los rubros tal como los marca el proveedor. Queda afuera el renglón largo
# que enumera los subtipos de la sección náutica: es una bajada, no un rubro.
RUBROS = [f["desc"] for f in filas if f["tipo"] == "rubro" and len(f["desc"]) <= 70]
# en el índice los signos de admiración del proveedor sobran; en la tabla quedan como están
INDICE = {r: r.rstrip(" !") for r in RUBROS}

# el pie de la tapa, con las categorías que cubre esta lista
CATEGORIAS = "Hogar / Náutica / Embarcaciones / Motorhome / Campers / y más…"


def agrupar(items):
    """Cada producto se queda con los renglones de medida que lo siguen.

    En la lista del proveedor esos renglones ocupan una fila propia casi vacía. Acá van como
    segunda línea de la descripción: es donde están en el original y la tabla no queda con
    huecos.
    """
    salida = []
    for f in items:
        if f["tipo"] == "detalle" and salida and salida[-1]["tipo"] == "producto":
            salida[-1].setdefault("detalles", []).append(f["desc"])
        else:
            salida.append(dict(f))
    return salida


def cuerpo_tabla(items):
    """Una fila por producto, todas del mismo alto y con todas sus celdas llenas.

    El proveedor combina la foto sobre el grupo de variantes (mismo artefacto en otro color o
    temperatura). Replicar esa combinación daba filas de alturas dispares y una banda alterna
    que se cortaba contra las fotos. Acá la foto del grupo se repite en cada variante —que es
    a lo que corresponde— y la fila queda pareja: así se ve de un vistazo dónde termina un
    producto y empieza el otro.

    La cantidad por bulto del proveedor no se publica: acá se vende por unidad o la cantidad
    que el cliente pida.
    """
    out, cebra = [], 0
    for f in agrupar(items):
        if f["tipo"] == "rubro":
            clase = "rubro bajada" if out and 'class="rubro' in out[-1] else "rubro"
            out.append(f'<tr class="{clase}"><td colspan="4">{f["desc"]}</td></tr>')
            cebra = 0
            continue

        cebra += 1
        det = "".join(f'<span class="det">{d}</span>' for d in f.get("detalles", []))
        foto = ""
        if f.get("foto") and (FOTOS / f["foto"]).exists():
            foto = f'<img src="{uri(FOTOS / f["foto"])}">'
        out.append(
            f'<tr class="{"par" if cebra % 2 == 0 else "impar"}">'
            f'<td class="item">{f["item"]}</td>'
            f'<td class="desc">{f["desc"]}{det}</td>'
            f'<td class="foto">{foto}</td>'
            f'<td class="precio">{pesos(f["precio"])}</td></tr>')
    return "\n".join(out)


# una sola tabla y no una por sección: cortando en la sección náutica quedaba un tercio de
# hoja en blanco, y la banda negra del rubro ya marca de sobra dónde empieza la otra.
TABLAS = f"""<section class="hoja">
  <table>
    <thead><tr>
      <th class="item">Ítem</th><th class="desc">Descripción</th><th class="foto"></th>
      <th class="precio">Precio</th>
    </tr></thead>
    <tfoot><tr><td colspan="2">{NOTA}</td>
      <td colspan="2" class="der">PANA iluminación · WhatsApp {VENTAS}</td></tr></tfoot>
    <tbody>{cuerpo_tabla(filas)}</tbody>
  </table>
</section>"""


def documento(paginas=None):
    """El HTML completo. `paginas` mapea rubro -> hoja; en la primera pasada va vacío."""
    indice = "".join(
        f'<div class="fila"><span class="rot">{INDICE[r]}</span>'
        f'<span class="val">{(paginas or {}).get(r, "")}</span></div>' for r in RUBROS)
    return f"""<!doctype html><html lang="es"><meta charset="utf-8"><title>Lista PANA</title><style>
{ARCHIVO}
@page {{ size: A4; margin: 0 }}
*{{ margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased }}
html {{ background:{HUESO} }}
body {{ font-family:'Archivo',sans-serif; color:{NEGRO}; background:{HUESO}; font-size:8.2pt }}

.rotulo {{ font-size:6.6pt; font-weight:500; letter-spacing:.3em; text-transform:uppercase;
           color:{GRIS}; text-indent:.3em }}

/* ── tapa ── */
.tapa {{ height:297mm; padding:15mm 14mm 0; display:flex; flex-direction:column;
         page-break-after:always }}
.tapa .barra {{ display:flex; align-items:center; justify-content:space-between;
                padding-bottom:5mm; border-bottom:.7pt solid {FILETE} }}
.tapa .barra img {{ width:33mm; display:block }}
.titulo {{ margin-top:13mm; font-size:34pt; font-weight:500; letter-spacing:-.015em;
           line-height:1.02; color:#5E5C58 }}
.titulo b {{ display:block; font-size:46pt; font-weight:700; letter-spacing:-.025em;
             color:{NEGRO} }}
.tapa .filete {{ width:17mm; height:3.2pt; background:{AMARILLO}; margin:6mm 0 0 }}
.tapa .bajada {{ margin-top:5mm; font-size:10.5pt; font-weight:400; color:#4A4844 }}

.indice {{ margin-top:11mm }}
.indice .fila {{ display:flex; justify-content:space-between; align-items:baseline;
                 padding:3.1mm 0; border-bottom:.6pt solid {FILETE} }}
.indice .fila:first-child {{ border-top:.6pt solid {FILETE} }}
.indice .rot {{ font-size:8.4pt; font-weight:500; letter-spacing:.02em; color:{NEGRO} }}
.indice .val {{ font-size:8pt; font-weight:600; color:{GRIS} }}

.tarjeta {{ margin-top:9mm; background:{NEGRO}; color:{CLARO}; padding:9mm 10mm 0 }}
.tarjeta h2 {{ font-size:14pt; font-weight:600; line-height:1.25; max-width:110mm }}
.vias {{ display:flex; gap:14mm; margin-top:6mm }}
.via .r {{ display:block; font-size:6.4pt; font-weight:500; letter-spacing:.28em;
           color:{AMARILLO}; text-indent:.28em }}
.via .n {{ display:block; margin-top:1.5mm; font-size:11pt; font-weight:600 }}
.cta {{ margin:7mm -10mm 0; background:{AMARILLO}; color:{NEGRO}; display:flex;
        justify-content:space-between; padding:4.2mm 10mm; font-size:8pt; font-weight:600;
        letter-spacing:.22em; text-transform:uppercase }}

.categorias {{ margin-top:auto; padding:6mm 0 8mm; text-align:center; font-size:7.6pt;
               font-weight:600; letter-spacing:.24em; text-transform:uppercase;
               color:#7C7A75; text-indent:.24em }}

/* el cierre llena el pie de la última hoja, que si no termina a media página */
.cierre {{ padding:6mm 14mm 0 }}

/* ── tablas ── */
.hoja {{ page-break-before:always; padding:0 14mm }}
table {{ width:100%; border-collapse:collapse }}
thead {{ display:table-header-group }}
th {{ font-size:6.6pt; font-weight:600; letter-spacing:.26em; text-transform:uppercase;
      color:{GRIS}; text-align:left; padding:15mm 2.5mm 2.4mm; border-bottom:1pt solid {NEGRO} }}
th.precio {{ text-align:right }}
tfoot {{ display:table-footer-group }}
tfoot td {{ height:13mm; border:none; vertical-align:bottom; padding:0 2.5mm 5mm;
            font-size:6.2pt; letter-spacing:.1em; text-transform:uppercase;
            color:#A5A39F; white-space:nowrap }}
tfoot .der {{ text-align:right }}

tr {{ page-break-inside:avoid }}
td {{ padding:1.7mm 2.5mm; border-bottom:.5pt solid {FILETE}; vertical-align:middle;
      height:13mm }}

/* la banda alterna es lo que deja claro dónde termina un producto y empieza el otro:
   con el filete solo, y filas de alto distinto, no se distinguía */
tr.par td {{ background:#E7E3DA }}

td.item {{ width:13mm; font-size:7.4pt; color:#77756F; font-weight:600;
           letter-spacing:.04em }}
td.desc {{ font-size:8.8pt; font-weight:500; line-height:1.28 }}
td.desc .det {{ display:block; margin-top:.8mm; font-size:7.2pt; font-weight:400;
                color:#7C7A75 }}
td.foto {{ width:26mm; text-align:center; padding:1mm }}
td.foto img {{ max-width:24mm; max-height:11.5mm; display:block; margin:0 auto }}

/* el precio, contra un filete propio y en negrita: es el dato que se busca */
td.precio {{ width:25mm; text-align:right; font-size:10pt; font-weight:700;
             white-space:nowrap; border-left:.5pt solid {FILETE} }}

tr.rubro td {{ background:{NEGRO}; color:{CLARO}; font-size:7.4pt; font-weight:600;
               letter-spacing:.26em; text-transform:uppercase; padding:3mm 3.5mm 1mm;
               border-bottom:none; text-indent:.26em }}
tr.rubro.bajada td {{ font-size:6.2pt; font-weight:400; letter-spacing:.16em;
                      color:#9A9894; padding:0 3.5mm 3mm; text-indent:.16em }}
</style>

<div class="tapa">
  <div class="barra">
    <img src="{uri(LOGOS / 'pana_negro.png')}" alt="PANA iluminación">
    <div class="rotulo">Precios en pesos · sin IVA</div>
  </div>
  <div class="titulo">Lista de precios<b>{MES} {ANIO}</b></div>
  <div class="filete"></div>
  <p class="bajada">{VIGENCIA}</p>
  <div class="indice">{indice}</div>
  <div class="tarjeta">
    <h2>Contamos con amplia variedad de stock.</h2>
    <div class="vias">
      <div class="via"><span class="r">Ventas · WhatsApp</span><span class="n">{VENTAS}</span></div>
    </div>
    <div class="cta"><span>{MAIL}</span><span>{HORARIO}</span></div>
  </div>
  <div class="categorias">{CATEGORIAS}</div>
</div>

{TABLAS}

<div class="cierre">
  <div class="tarjeta">
    <h2>¿Necesitás algo que no está en la lista?</h2>
    <div class="vias">
      <div class="via"><span class="r">Ventas · WhatsApp</span><span class="n">{VENTAS}</span></div>
    </div>
    <div class="cta"><span>{MAIL}</span><span>{HORARIO}</span></div>
  </div>
</div>
</html>"""


def render(html, salida):
    from playwright.sync_api import sync_playwright
    fuente = BASE / "_lista.html"
    fuente.write_text(html, encoding="utf-8")
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME)
        pg = b.new_page()
        pg.goto(f"file://{fuente}")
        pg.pdf(path=str(salida), format="A4", print_background=True,
               margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        b.close()


def compactar(t):
    """Sólo letras y números.

    Las bandas de rubro van con `letter-spacing`, y `pdftotext` las devuelve con un espacio
    entre caracteres y algunos pares pegados ("A RT E FA C T O S"). Comparar por palabras no
    engancha nunca; comparar la cadena compacta, siempre.
    """
    return re.sub(r"[^A-Z0-9]", "", t.upper())


def paginas_de_rubros(pdf):
    """En qué hoja cae cada rubro. Hay que renderizar para saberlo."""
    import subprocess
    mapa = {}
    n = int(subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True
                           ).stdout.split("Pages:")[1].split()[0])
    for hoja in range(2, n + 1):      # la 1 es la tapa, donde está el propio índice
        txt = subprocess.run(["pdftotext", "-f", str(hoja), "-l", str(hoja), str(pdf), "-"],
                             capture_output=True, text=True).stdout
        plano = compactar(txt)
        for r in RUBROS:
            if r not in mapa and compactar(r) in plano:
                mapa[r] = hoja
    return mapa


if __name__ == "__main__":
    salida = BASE / f"PANA_LISTA_{MES.upper()}_{ANIO}.pdf"
    # dos pasadas: la primera para saber en qué hoja cae cada rubro, la segunda con el
    # índice ya numerado. La tapa mide una hoja fija, así que agregarle el índice no corre
    # la paginación del resto.
    render(documento(), salida)
    render(documento(paginas_de_rubros(salida)), salida)
    print(f"{len(productos)} productos, recargo {RECARGO:.0%}, {len(RUBROS)} rubros en el índice")
    print("guardado", salida.name)
