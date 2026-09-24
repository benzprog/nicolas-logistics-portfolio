"""Repone CONSULTAS en el pie de la lista de octubre y corrige el horario.

La lista de octubre había rehecho el bloque de contacto: el WhatsApp 11-4176-4205 quedó
fuera y el horario pasó a 10-17. Se repone el número como sección CONSULTAS —con el mismo
formato que usa octubre, rótulo en negrita en su renglón y el dato debajo— y el horario
vuelve a 9:30-16:30.

El PDF sale de Excel: fuentes TrueType con WinAnsiEncoding y texto en arrays TJ con el
kerning que mete Excel. Los renglones nuevos se emiten con `Tj` liso, porque esos ajustes
son de centésimas de punto a 8 pt y no se ven; lo que sí importa es reusar el mismo Tm, la
misma fuente y el mismo cuerpo que los renglones vecinos.
"""
import re
import shutil
import sys

import pikepdf

SRC = "/root/.claude/uploads/66a49b79-0302-5de9-8277-30d625b04b95/707daacd-TENARUZ_OCTUBRE_2026.pdf"
OUT = "TENARUZ_OCTUBRE_2026.pdf"

X = 111.38          # borde izquierdo de la columna de contacto
PASO = 10.68        # interlineado del bloque
CUERPO = 8.04
HORARIO = "Lunes a viernes de 9:30 a 16:30hs."
CONSULTAS = "11-4176-4205"

shutil.copy(SRC, OUT)
pdf = pikepdf.open(OUT, allow_overwriting_input=True)
pagina = pdf.pages[3]
raw = pagina.obj["/Contents"].read_bytes().decode("latin-1")


def texto(bloque):
    partes = []
    for m in re.finditer(r"\((?:[^()\\]|\\.)*\)", bloque):
        s = m.group(0)[1:-1]
        s = re.sub(r"\\(\d{3})", lambda x: chr(int(x.group(1), 8)), re.sub(r"\\([()\\])", r"\1", s))
        partes.append(s)
    return "".join(partes)


bloques = [(m, texto(m.group(0))) for m in re.finditer(r"BT\r?\n.*?ET", raw, re.S)]


def buscar(inicio):
    hallados = [(m, t) for m, t in bloques if t.startswith(inicio)]
    assert len(hallados) == 1, f"{inicio!r}: {len(hallados)} coincidencias"
    return hallados[0]


# ─── 1. el horario ────────────────────────────────────────────────────────────
m_hor, viejo = buscar("Lunes a viernes")
nuevo_hor = re.sub(r"\[.*?\] TJ", f"({HORARIO}) Tj", m_hor.group(0), flags=re.S)
print(f"horario: {viejo!r} -> {HORARIO!r}")

# ─── 2. CONSULTAS, debajo del bloque de VENTAS ────────────────────────────────
m_mail, _ = buscar("Email:")
y_mail = float(re.search(r"1 0 0 1 [\d.]+ ([\d.]+) Tm", m_mail.group(0)).group(1))
y_rotulo = y_mail - 2 * PASO        # un renglón en blanco, igual que entre HORARIO y VENTAS
y_dato = y_rotulo - PASO

# el recorte del bloque: los renglones nuevos tienen que entrar adentro
recorte = re.search(r"q\r?\n([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re\r?\nW\* n\r?\n"
                    r"\s*/P <</MCID \d+>> BDC BT\r?\n/F3 8\.04 Tf\r?\n1 0 0 1 111\.38 306\.86",
                    raw)
assert recorte, "no encontré el recorte de la columna de contacto"
y_piso = float(recorte.group(2))
assert y_dato - 2 > y_piso, f"CONSULTAS se sale del recorte ({y_dato:.2f} vs {y_piso:.2f})"

agregado = (f"\r\nBT\r\n/F3 {CUERPO} Tf\r\n1 0 0 1 {X} {y_rotulo:.2f} Tm\r\n(CONSULTAS) Tj\r\nET"
            f"\r\nBT\r\n/F2 {CUERPO} Tf\r\n1 0 0 1 {X} {y_dato:.2f} Tm\r\n"
            f"(Whatsapp: {CONSULTAS}) Tj\r\nET")
print(f"CONSULTAS en y={y_rotulo:.2f}, WhatsApp en y={y_dato:.2f} (recorte hasta {y_piso})")

# se arma de atrás para adelante para no correr los offsets
partes = [raw[:m_hor.start()], nuevo_hor, raw[m_hor.end():m_mail.end()], agregado, raw[m_mail.end():]]
pagina.obj["/Contents"].write("".join(partes).encode("latin-1"))
pdf.save(OUT + ".tmp")
pdf.close()
shutil.move(OUT + ".tmp", OUT)
print("guardado", OUT)
