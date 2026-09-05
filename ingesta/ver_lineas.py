import sys, pathlib
sys.path.insert(0, '.')
from main import limpiar
crudo = pathlib.Path('../data/raw/ccyc.html').read_bytes()
t = limpiar(crudo)
lineas = t.split('\n')
print(f'total lineas: {len(lineas)}')
print(f'largo medio: {sum(len(l) for l in lineas)//len(lineas)}')
print(f'lineas >300 chars: {sum(1 for l in lineas if len(l)>300)}')
print('\n--- lineas que contienen LIBRO PRIMERO ---')
for i, l in enumerate(lineas):
    if 'LIBRO PRIMERO' in l.upper():
        print(f'[{i}] len={len(l)}  {l[:200]!r}')
