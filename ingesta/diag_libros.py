import re, pathlib, html

RAW = pathlib.Path('/home/estebanggonzalez/iuris/data/raw/ccyc.html')
crudo = RAW.read_text(encoding='utf-8', errors='replace')

# texto plano muy básico: saco tags y desescapo entidades
texto = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', crudo, flags=re.S | re.I)
texto = re.sub(r'<[^>]+>', '\n', texto)
texto = html.unescape(texto)
texto = re.sub(r'[ \t\xa0]+', ' ', texto)

print('--- LIBROS ---')
for m in re.finditer(r'LIBRO\s+(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO)', texto, re.I):
    frag = ' '.join(texto[m.start():m.start()+70].split())
    print(f'{m.start():>8}  {frag!r}')

print('--- TITULO PRELIMINAR ---')
for m in re.finditer(r'T[ÍI]TULO\s+PRELIMINAR', texto, re.I):
    frag = ' '.join(texto[m.start():m.start()+70].split())
    print(f'{m.start():>8}  {frag!r}')

print('--- primeras 5 apariciones de ARTICULO 1 ---')
for i, m in enumerate(re.finditer(r'ART[ÍI]CULO\s*1\s*[°ºo]?\s*\.', texto, re.I)):
    frag = ' '.join(texto[m.start():m.start()+70].split())
    print(f'{m.start():>8}  {frag!r}')
    if i >= 4:
        break
