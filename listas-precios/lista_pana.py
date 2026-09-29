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
import json
import pathlib
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

# de la lista mayorista de PANA, no del proveedor
VENTAS, CONSULTAS = "11 6288-3659", "11 4176-4205"
MAIL = "panailuminacion@gmail.com"
HORARIO = "Lunes a viernes de 9:30 a 16:30"
NOTA = "Los precios no incluyen IVA · Venta por bulto cerrado"

HUESO, NEGRO, CLARO, AMARILLO = "#F0EEE6", "#131313", "#F4F3F1", "#FFCE1F"
FILETE, GRIS = "#D6D2CA", "#8A8884"


def pesos(n):
    return "$ " + f"{n:,}".replace(",", ".")


def uri(ruta):
    tipo = "png" if ruta.suffix == ".png" else "jpeg"
    return f"data:image/{tipo};base64,{base64.b64encode(ruta.read_bytes()).decode()}"


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

secciones = {"náuticos": [f for f in filas if f["pagina"] <= 3],
             "iluminación": [f for f in filas if f["pagina"] >= 4]}
n_nautica = sum(1 for f in secciones["náuticos"] if f["tipo"] == "producto")
n_luz = sum(1 for f in secciones["iluminación"] if f["tipo"] == "producto")

RESUMEN = [
    ("Accesorios náuticos", f"{n_nautica} productos · acero inoxidable 316"),
    ("Iluminación", f"{n_luz} productos · 12V y 220V"),
    ("Total", f"{len(productos)} productos con precio"),
    ("Condición", "Precios sin IVA · venta por bulto cerrado"),
]


def cuerpo_tabla(items):
    """Arma las filas respetando las celdas de foto combinadas.

    El `rowspan` se calcula acá y no en la extracción: recién al maquetar se sabe cuántas
    filas sobreviven dentro de cada celda de foto, porque los discontinuados y sus
    renglones de detalle ya salieron. Contarlas antes descoloca las columnas.
    """
    span = {}
    for f in items:
        if f.get("celda", ""):
            span[f.get("celda", "")] = span.get(f.get("celda", ""), 0) + 1

    out, restantes, puesta = [], 0, set()
    for f in items:
        dentro = bool(f.get("celda", "")) and restantes > 0 and f.get("celda", "") in puesta
        if f["tipo"] == "rubro":
            clase = "rubro bajada" if out and 'class="rubro' in out[-1] else "rubro"
            out.append(f'<tr class="{clase}"><td colspan="5">{f["desc"]}</td></tr>')
            continue
        if dentro:
            restantes -= 1

        celdas = [f'<td class="item">{f["item"]}</td>']
        if f["tipo"] == "detalle":
            celdas.append(f'<td class="desc">{f["desc"]}</td>')
        else:
            celdas.append(f'<td class="desc">{f["desc"]}</td>')
        if not dentro:
            if f.get("foto", "") and (FOTOS / f.get("foto", "")).exists() and f.get("celda", "") not in puesta:
                n = span.get(f.get("celda", ""), 1)
                puesta.add(f.get("celda", ""))
                restantes = n - 1
                rs = f' rowspan="{n}"' if n > 1 else ""
                celdas.append(f'<td class="foto"{rs}><img src="{uri(FOTOS / f.get("foto", ""))}"></td>')
            else:
                celdas.append('<td class="foto"></td>')
        celdas.append(f'<td class="bulto">{f["bulto"]}</td>')
        celdas.append('<td class="precio">' +
                      (pesos(f["precio"]) if f["tipo"] == "producto" else "") + '</td>')
        clase = ' class="detalle"' if f["tipo"] == "detalle" else ""
        out.append(f"<tr{clase}>" + "".join(celdas) + "</tr>")
    return "\n".join(out)


resumen_html = "".join(
    f'<div class="fila"><span class="rot">{r}</span><span class="val">{v}</span></div>'
    for r, v in RESUMEN)

tablas = "".join(
    f'''<section class="hoja">
  <table>
    <thead><tr>
      <th class="item">Ítem</th><th class="desc">Descripción</th><th class="foto"></th>
      <th class="bulto">Bulto</th><th class="precio">Precio</th>
    </tr></thead>
    <tfoot><tr><td colspan="3">{NOTA}</td>
      <td colspan="2" class="der">PANA iluminación · {VENTAS}</td></tr></tfoot>
    <tbody>{cuerpo_tabla(items)}</tbody>
  </table>
</section>''' for items in secciones.values())

HTML = f"""<!doctype html><html lang="es"><meta charset="utf-8"><title>Lista PANA</title><style>
{ARCHIVO}
@page {{ size: A4; margin: 0 }}
*{{ margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased }}
html {{ background:{HUESO} }}
body {{ font-family:'Archivo',sans-serif; color:{NEGRO}; background:{HUESO}; font-size:8.2pt }}

.rotulo {{ font-size:6.6pt; font-weight:500; letter-spacing:.3em; text-transform:uppercase;
           color:{GRIS}; text-indent:.3em }}

/* ── tapa ── */
.tapa {{ height:297mm; padding:15mm 14mm 0; display:flex; flex-direction:column; page-break-after:always }}
.tapa .barra {{ display:flex; align-items:center; justify-content:space-between;
                padding-bottom:5mm; border-bottom:.7pt solid {FILETE} }}
.tapa .barra img {{ width:33mm; display:block }}
.tapa .mes {{ font-size:48pt; font-weight:700; letter-spacing:-.022em; line-height:.96;
              margin-top:20mm }}
.tapa .filete {{ width:17mm; height:3.2pt; background:{AMARILLO}; margin:7mm 0 0 }}
.tapa .bajada {{ margin-top:6mm; font-size:10.5pt; font-weight:400; color:#4A4844 }}
.tapa .fila {{ display:flex; justify-content:space-between; align-items:baseline;
               padding:5mm 0; border-bottom:.7pt solid {FILETE} }}
.tapa .filas {{ margin-top:14mm }}
.tapa .filas .fila:first-child {{ border-top:.7pt solid {FILETE} }}
.tapa .rot {{ font-size:6.8pt; font-weight:500; letter-spacing:.3em; text-transform:uppercase;
              color:{GRIS}; text-indent:.3em }}
.tapa .val {{ font-size:10pt; font-weight:500 }}
.tarjeta {{ margin-top:auto; background:{NEGRO}; color:{CLARO}; padding:10mm 10mm 0 }}
.tarjeta h2 {{ font-size:15pt; font-weight:600; line-height:1.25; max-width:110mm }}
.vias {{ display:flex; gap:14mm; margin-top:7mm }}
.via .r {{ display:block; font-size:6.4pt; font-weight:500; letter-spacing:.28em;
           color:{AMARILLO}; text-indent:.28em }}
.via .n {{ display:block; margin-top:1.5mm; font-size:11pt; font-weight:600 }}
.cta {{ margin:8mm -10mm 0; background:{AMARILLO}; color:{NEGRO}; display:flex;
        justify-content:space-between; padding:4.4mm 10mm; font-size:8pt; font-weight:600;
        letter-spacing:.22em; text-transform:uppercase }}

/* ── tablas ── */
.hoja {{ page-break-before:always; padding:0 14mm }}
table {{ width:100%; border-collapse:collapse }}
thead {{ display:table-header-group }}
th {{ font-size:6.6pt; font-weight:500; letter-spacing:.26em; text-transform:uppercase;
      color:{GRIS}; text-align:left; padding:15mm 2mm 2.2mm; border-bottom:.9pt solid {NEGRO} }}
tfoot {{ display:table-footer-group }}
tfoot td {{ height:13mm; border:none; vertical-align:bottom; padding:0 2mm 5mm;
            font-size:6.4pt; letter-spacing:.14em; text-transform:uppercase;
            color:#A5A39F }}
tfoot .der {{ text-align:right }}
th.precio, th.bulto {{ text-align:right }}
tr {{ page-break-inside:avoid }}
td {{ padding:1.6mm 2mm; border-bottom:.5pt solid {FILETE}; vertical-align:middle }}
td.item {{ width:12mm; font-size:7pt; color:{GRIS}; font-weight:500 }}
td.desc {{ font-size:8pt; font-weight:400; line-height:1.3 }}
td.foto {{ width:26mm; text-align:center; padding:1mm }}
td.foto img {{ max-width:24mm; max-height:17mm; display:inline-block }}
td.bulto {{ width:13mm; text-align:right; font-size:7.4pt; color:{GRIS} }}
td.precio {{ width:22mm; text-align:right; font-size:9pt; font-weight:600;
             white-space:nowrap }}

tr.rubro td {{ background:{NEGRO}; color:{CLARO}; font-size:7pt; font-weight:600;
               letter-spacing:.26em; text-transform:uppercase; padding:2.6mm 3mm;
               border-bottom:none; text-indent:.26em }}
tr.rubro.bajada td {{ font-size:6.2pt; font-weight:400; letter-spacing:.16em;
                      color:#9A9894; padding:0 3mm 2.8mm; text-indent:.16em }}
tr.detalle td {{ font-size:7pt; font-weight:400; color:{GRIS}; padding:1mm 2mm;
                 border-bottom:.5pt solid {FILETE} }}
</style>

<div class="tapa">
  <div class="barra">
    <img src="{uri(LOGOS / 'pana_negro.png')}" alt="PANA iluminación">
    <div class="rotulo">Lista de precios</div>
  </div>
  <div class="mes">{MES} <span>{ANIO}</span></div>
  <div class="filete"></div>
  <p class="bajada">{VIGENCIA}</p>
  <div class="filas">{resumen_html}</div>
  <div class="tarjeta">
    <h2>Náutica, motorhome, obra y hogar.<br>Todo con entrega desde stock.</h2>
    <div class="vias">
      <div class="via"><span class="r">Ventas</span><span class="n">{VENTAS}</span></div>
      <div class="via"><span class="r">Consultas</span><span class="n">{CONSULTAS}</span></div>
    </div>
    <div class="cta"><span>{MAIL}</span><span>{HORARIO}</span></div>
  </div>
</div>

{tablas}
</html>"""

if __name__ == "__main__":
    fuente = BASE / "_lista.html"
    fuente.write_text(HTML, encoding="utf-8")
    salida = BASE / f"PANA_LISTA_{MES.upper()}_{ANIO}.pdf"
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME)
        pg = b.new_page()
        pg.goto(f"file://{fuente}")
        pg.pdf(path=str(salida), format="A4", print_background=True,
               margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        b.close()
    print(f"{len(productos)} productos, recargo {RECARGO:.0%}")
    print("guardado", salida.name)
