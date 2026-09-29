"""Cambia el mes de la lista TENARUZ HD en todas las páginas.

El PDF sale de wkhtmltopdf y el mes está escrito de dos maneras distintas:

- **En la tapa**, letra por letra: cada glifo es su propio bloque `BT..ET` **y su propio
  content stream** —la página tiene dieciséis— para conseguir el espaciado ancho. Hay que
  rehacer el renglón entero y volver a centrarlo, porque el mes nuevo tiene otro largo. El
  tracking no se estima: sale de restarle a la distancia entre dos letras el avance de la
  primera.
- **En el encabezado de las páginas 2 a 14**, como un único `TJ` con todos los CID pegados y
  alineado a la izquierda. Ahí alcanza con reemplazar la cadena de CIDs: al no haber
  posicionamiento por glifo, el ancho lo resuelve la fuente.

Los subsets traen los glifos de OCTUBRE (se verifica antes de escribir).
"""
import pathlib
import re
import sys

import pikepdf

sys.path.insert(0, str(pathlib.Path(__file__).parents[1] / ".claude/skills/catalogo-tenaruz/scripts"))
from pdftext import load_fonts  # noqa: E402

VIEJO, NUEVO = "SEPTIEMBRE", "OCTUBRE"
Y_TAPA = 84.4          # la línea de base del mes en la portada


def mapa(pdf, pagina, res):
    f = load_fonts(pdf, pagina - 1)[res]
    return {u: c for c, u in f["cid2uni"].items()}, f["widths"]


def cids(texto, uni2cid):
    faltan = [c for c in texto if c not in uni2cid]
    assert not faltan, f"faltan glifos: {faltan}"
    return "".join(f"{uni2cid[c]:04x}" for c in texto)


def ancho(texto, anchos, uni2cid, cuerpo, trk):
    return (sum(anchos[uni2cid[c]] for c in texto) * cuerpo / 1000
            + trk * (len(texto) - 1))


def cambiar(entrada, salida):
    pdf = pikepdf.open(entrada)

    # ── tapa: los bloques de una letra, a la altura del mes ──
    uni2cid, anchos = mapa(pdf, 1, "/PopR")
    LETRA = re.compile(r"BT\n1 0 0 1 ([\d.]+) ([\d.]+) Tm\n(/PopR ([\d.]+) Tf [^\n]*?)"
                       r"\[<([0-9A-Fa-f]{4})>\]TJ\nET")
    flujos = list(pdf.pages[0].obj["/Contents"])
    # cada letra vive en su propio stream, así que se recorren todos y después se reescribe
    letras = []
    for idx, fl in enumerate(flujos):
        raw = fl.read_bytes().decode("latin-1")
        for m in LETRA.finditer(raw):
            if abs(float(m.group(2)) - Y_TAPA) < 0.5:
                letras.append((idx, m))
    letras.sort(key=lambda t: float(t[1].group(1)))
    assert len(letras) >= 10, f"sólo {len(letras)} letras en la tapa"

    cuerpo = float(letras[0][1].group(4))
    estilo = letras[0][1].group(3)
    cid2uni = {c: u for u, c in uni2cid.items()}
    primera = cid2uni[int(letras[0][1].group(5), 16)]
    paso = float(letras[1][1].group(1)) - float(letras[0][1].group(1))
    trk = paso - anchos[uni2cid[primera]] * cuerpo / 1000

    viejo_txt = "".join(cid2uni[int(m.group(5), 16)] for _, m in letras)
    assert VIEJO in viejo_txt.replace(" ", ""), viejo_txt
    # el espacio no se dibuja: el renglón se reconstruye completo, con él
    largo_viejo = ancho(f"{VIEJO} 2026", anchos, uni2cid, cuerpo, trk)
    centro = float(letras[0][1].group(1)) + largo_viejo / 2

    nuevo_txt = f"{NUEVO} 2026"
    x = centro - ancho(nuevo_txt, anchos, uni2cid, cuerpo, trk) / 2
    bloques = []
    for ch in nuevo_txt:
        if ch != " ":
            bloques.append(f"BT\n1 0 0 1 {x:.5f} {Y_TAPA} Tm\n{estilo}"
                           f"[<{uni2cid[ch]:04x}>]TJ\nET")
        x += anchos[uni2cid[ch]] * cuerpo / 1000 + trk

    # todas las letras nuevas van al stream de la primera vieja; el resto se vacía
    por_stream = {}
    for idx, m in letras:
        por_stream.setdefault(idx, []).append(m)
    principal = letras[0][0]
    for idx, ms in por_stream.items():
        raw = flujos[idx].read_bytes().decode("latin-1")
        partes, i = [], 0
        for k, m in enumerate(sorted(ms, key=lambda m: m.start())):
            partes.append(raw[i:m.start()])
            if idx == principal and k == 0:
                partes.append("\n".join(bloques))
            i = m.end()
        partes.append(raw[i:])
        flujos[idx].write("".join(partes).encode("latin-1"))
    hechos = 1
    print(f"tapa: {viejo_txt!r} -> {nuevo_txt!r}  (cuerpo {cuerpo}, tracking {trk:.4f})")

    assert hechos == 1, f"la tapa se tocó {hechos} veces"

    # ── encabezado de las páginas 2 a 14: una sola cadena de CIDs ──
    uni2cid_b, _ = mapa(pdf, 2, "/PopB")
    de, a = cids(f"{VIEJO} 2026", uni2cid_b), cids(f"{NUEVO} 2026", uni2cid_b)
    cambiadas = 0
    for n, pg in enumerate(pdf.pages, 1):
        c = pg.obj["/Contents"]
        for fl in (list(c) if isinstance(c, pikepdf.Array) else [c]):
            raw = fl.read_bytes().decode("latin-1")
            if de in raw:
                fl.write(raw.replace(de, a).encode("latin-1"))
                cambiadas += 1
    print(f"encabezado: {cambiadas} páginas")
    pdf.save(salida)
    print("guardado", salida)


if __name__ == "__main__":
    cambiar(sys.argv[1], sys.argv[2])
