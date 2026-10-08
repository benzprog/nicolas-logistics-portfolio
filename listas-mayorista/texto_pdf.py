"""Medición y escritura de texto para la lista mayorista TENARUZ.

El PDF original es un export de Excel: todo el cuerpo es Roboto 8,04pt centrado en
su columna. Para que las filas nuevas caigan exactamente donde caen las viejas hay
que medir con las mismas métricas, así que las anchuras salen del TTF real de
Roboto —verificado idéntico al subset incrustado (w=751, Í=272, S=594, 0=562)— y
no de una estimación.

Los recursos de fuente que usa el emisor son los que monta `agregar_12v.py`:
`/F4` Roboto normal, `/F5` Roboto negrita y `/F1` el Calibri que ya traía el
archivo para el folio.
"""
import pathlib

from fontTools.ttLib import TTFont

FUENTES = pathlib.Path(__file__).parent / "fuentes"
REGULAR, NEGRITA, FOLIO = b"/F4", b"/F5", b"/F1"
_CACHE = {}


def anchos_ttf(ruta):
    if ruta not in _CACHE:
        tt = TTFont(ruta)
        cmap, hmtx = tt.getBestCmap(), tt["hmtx"]
        upem = tt["head"].unitsPerEm
        _CACHE[ruta] = {c: (hmtx[cmap[c]][0] * 1000 / upem if c in cmap else 0.0)
                        for c in range(32, 256)}
    return _CACHE[ruta]


def tabla(recurso):
    if recurso == NEGRITA:
        return anchos_ttf(FUENTES / "Roboto-Bold.ttf")
    if recurso == REGULAR:
        return anchos_ttf(FUENTES / "Roboto-Regular.ttf")
    return _CACHE[recurso]        # Calibri: lo carga agregar_12v desde el propio PDF


def registrar(recurso, anchos):
    _CACHE[recurso] = anchos


def ancho(texto, cuerpo=8.04, recurso=REGULAR):
    t = tabla(recurso)
    return sum(t.get(ch.encode("cp1252", "replace")[0], 0.0) for ch in texto) * cuerpo / 1000


def ancho_tramos(tramos, cuerpo=8.04):
    return sum(ancho(t, cuerpo, r) for t, r in tramos)


def num(v):
    return (f"{v:.4f}".rstrip("0").rstrip(".") or "0").encode("ascii")


def escapar(texto):
    b = texto.encode("cp1252", "replace")
    return b.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def mostrar(texto, x, y, cuerpo=8.04, recurso=REGULAR, gris=0.0):
    """Operadores para dibujar un tramo con su origen en (x, y)."""
    return b"BT\n%s %s Tf\n1 0 0 1 %s %s Tm\n%s g\n(%s) Tj\nET\n" % (
        recurso, num(cuerpo), num(x), num(y), num(gris), escapar(texto))


def centrado(tramos, centro, y, cuerpo=8.04, gris=0.0):
    """Dibuja una línea de tramos (texto, recurso) centrada en `centro`."""
    x = centro - ancho_tramos(tramos, cuerpo) / 2
    salida = b""
    for texto, recurso in tramos:
        salida += mostrar(texto, x, y, cuerpo, recurso, gris)
        x += ancho(texto, cuerpo, recurso)
    return salida


def partir(tramos, max_ancho, cuerpo=8.04):
    """Parte una línea de tramos en varias que no superen `max_ancho`."""
    palabras = [(p, r) for t, r in tramos for p in t.split(" ") if p]
    lineas, actual = [], []
    for palabra in palabras:
        prueba = actual + [palabra]
        if actual and ancho_tramos(_juntar(prueba), cuerpo) > max_ancho:
            lineas.append(_juntar(actual))
            actual = [palabra]
        else:
            actual = prueba
    if actual:
        lineas.append(_juntar(actual))
    return lineas


def _juntar(palabras):
    """Reconstruye los tramos de una línea, fusionando los del mismo recurso."""
    tramos = []
    for i, (p, r) in enumerate(palabras):
        texto = p if i == 0 else " " + p
        if tramos and tramos[-1][1] == r:
            tramos[-1] = (tramos[-1][0] + texto, r)
        else:
            tramos.append((texto, r))
    return tramos
