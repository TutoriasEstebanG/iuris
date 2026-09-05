import re, pathlib

RAW = pathlib.Path('/home/estebanggonzalez/iuris/data/raw/ccyc.html')
crudo = RAW.read_bytes()

# --- A) encoding ---
m = re.search(rb'charset=["\']?([\w-]+)', crudo[:4000], re.I)
enc = m.group(1).decode('ascii', 'ignore') if m else 'cp1252'
print(f'charset declarado: {enc}')
try:
    texto = crudo.decode(enc)
except (UnicodeDecodeError, LookupError):
    print('  fallo, uso cp1252')
    texto = crudo.decode('cp1252', errors='replace')

# quitar tags
texto = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', texto, flags=re.S | re.I)
texto = re.sub(r'<[^>]+>', '\n', texto)
import html as _h
texto = _h.unescape(texto)
texto = re.sub(r'[ \t\xa0]+', ' ', texto)

print('prueba encoding:', repr(texto[9949:10010]))

# --- B) cortar indice ---
inicio = texto.find('TITULO PRELIMINAR')
assert inicio > 0, 'no encontre TITULO PRELIMINAR'
cuerpo = texto[inicio:]
print(f'cuerpo arranca en offset {inicio}, largo {len(cuerpo)}')

# --- C) encabezados de libro (case sensitive, sin re.I) ---
RE_LIBRO = re.compile(
    r'\bLIBRO\s+(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO)\b'
    r'(?=[^a-záéíóúñ]{0,80}?TITULO\s+[IVX])'
)
RE_PRELIM = re.compile(r'\bTITULO\s+PRELIMINAR\b')
RE_ART = re.compile(r'\bARTICULO\s+(\d{1,4})\s*(?:[°ºo]\s*)?\.?\s*-', re.I)

print('\n--- encabezados de LIBRO detectados ---')
libros = list(RE_LIBRO.finditer(cuerpo))
for mm in libros:
    print(f'{mm.start():>8}  {mm.group(1):<8} {" ".join(cuerpo[mm.start():mm.start()+55].split())!r}')
print(f'total: {len(libros)}  (esperado 6)')

# --- construir marcas ordenadas ---
marcas = [(mm.start(), mm.group(1)) for mm in libros]
marcas += [(mm.start(), 'PRELIMINAR') for mm in RE_PRELIM.finditer(cuerpo)]
marcas.sort()

def libro_de(pos):
    actual = None
    for off, nom in marcas:
        if off <= pos:
            actual = nom
        else:
            break
    return actual

arts = []
vistos = set()
for mm in RE_ART.finditer(cuerpo):
    n = int(mm.group(1))
    if n in vistos:
        continue
    vistos.add(n)
    arts.append({'art': n, 'libro': libro_de(mm.start()), 'pos': mm.start()})

print(f'\nartículos únicos: {len(arts)}')

from collections import Counter
print('\n--- conteo por libro ---')
for k, v in Counter(a['libro'] for a in arts).items():
    print(f'  {k}: {v}')

huerfanos = [a['art'] for a in arts if not a['libro']]
print(f'\nsin libro: {len(huerfanos)} -> {huerfanos[:40]}')

ESPERADO = {
    1: 'PRELIMINAR', 387: 'PRIMERO', 638: 'SEGUNDO', 1091: 'TERCERO',
    1757: 'TERCERO', 1882: 'CUARTO', 2277: 'QUINTO', 2532: 'SEXTO',
}
print('\n  art  detectado        esperado')
print('-' * 46)
idx = {a['art']: a['libro'] for a in arts}
ok = 0
for n, esp in sorted(ESPERADO.items()):
    det = idx.get(n)
    marca = 'OK' if det == esp else 'MAL'
    ok += det == esp
    print(f'{n:>5}  {str(det):<16} {esp:<10} {marca}')
print(f'\nCorrectos: {ok}/{len(ESPERADO)}')

# --- huecos en la numeración ---
nums = sorted(a['art'] for a in arts)
faltan = sorted(set(range(1, 2672)) - set(nums))
print(f'\nfaltantes ({len(faltan)}): {faltan}')
sobran = [n for n in nums if n > 2671]
print(f'fuera de rango: {sobran}')

# contexto de cada faltante: busco el artículo anterior y miro qué sigue
pos = {a['art']: a['pos'] for a in arts}
for n in faltan:
    prev = max((k for k in pos if k < n), default=None)
    if prev is None:
        continue
    p = pos[prev]
    print(f'\n=== falta {n}, artículo previo {prev} @ {p} ===')
    print(' '.join(cuerpo[p:p+700].split()))
