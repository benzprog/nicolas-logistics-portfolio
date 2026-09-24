"""Compara dos listas de precios TENARUZ y dice qué cambió de un mes al otro.

    python3 comparar.py LISTA_MES_ANTERIOR.pdf LISTA_MES_NUEVO.pdf

Informa altas, bajas y, producto por producto, los campos que cambiaron. El pie de la
última página queda pegado al último producto —es una limitación del recorte por columnas—
así que ese renglón se informa aparte y el pie conviene mirarlo con `pdftotext -layout`.
"""
import sys

from lista import leer

CAMPOS = ["seccion", "desc", "bulto", "precio", "x500", "iva", "stock"]


def main(ruta_a, ruta_b):
    a, b = leer(ruta_a), leer(ruta_b)
    A = {f["codigo"]: f for f in a}
    B = {f["codigo"]: f for f in b}
    print(f"{len(a)} productos -> {len(b)}")

    bajas = sorted(set(A) - set(B))
    altas = sorted(set(B) - set(A))
    if bajas:
        print("\nSOLO EN LA PRIMERA:")
        for c in bajas:
            print("   ", c[:90])
    if altas:
        print("\nSOLO EN LA SEGUNDA:")
        for c in altas:
            print("   ", c[:90])

    print("\nCAMBIOS:")
    n = 0
    for c in [f["codigo"] for f in a if f["codigo"] in B]:
        difs = [(k, A[c][k], B[c][k]) for k in CAMPOS if A[c][k] != B[c][k]]
        if difs:
            n += 1
            print(f"\n  {c}  ({A[c]['desc'][:50]})")
            for k, x, y in difs:
                print(f"      {k:8} {x!r} -> {y!r}")
    print(f"\n{n} productos con cambios de {len(A)}")

    # control independiente: si las sumas coinciden, no se movió ningún precio
    import re

    def total(filas, col):
        return sum(float(m.group(1).replace(".", "").replace(",", "."))
                   for f in filas for m in [re.search(r"USD\s*([\d.,]+)", f[col])] if m)
    for col in ("precio", "x500"):
        print(f"Σ {col}: {total(a, col):.2f} -> {total(b, col):.2f}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
