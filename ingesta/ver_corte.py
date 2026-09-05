import sys, pathlib, re
sys.path.insert(0, '.')
from main import limpiar, P
crudo = pathlib.Path('../data/raw/ccyc.html').read_bytes()
t = limpiar(crudo)

m = re.search(r"ART[ÍI]CULO\s+1[°º]?\s*[.\-—]", t, re.I)
print(f'corte actual en offset {m.start()}')
print(f'contexto: {t[m.start()-100:m.start()+80]!r}')

pre = t.find('TITULO PRELIMINAR')
print(f'\nTITULO PRELIMINAR en offset {pre}')
print(f'corte {"CORRECTO" if m.start() >= pre else "DEMASIADO TEMPRANO"}')

print('\n--- lineas que matchean P["libro"] en TODO el texto ---')
for i, l in enumerate(t.split('\n')):
    mm = P['libro'].match(l)
    if mm:
        print(f'[{i}] {l!r}  -> num={mm.group(1)!r} rot={mm.group(2)!r}')
