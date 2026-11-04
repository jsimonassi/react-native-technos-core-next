import sys
a = [l for l in open(sys.argv[1], encoding="utf-8").read().splitlines() if l.strip()]
b = [l for l in open(sys.argv[2], encoding="utf-8").read().splitlines() if l.strip()]
pa, pb = a[1:], b[1:]
print(f"{sys.argv[1].split('/')[-1]}: {len(pa)} pacotes; {sys.argv[2].split('/')[-1]}: {len(pb)}; header igual={a[0]==b[0]}; prefixo por linha={pb[:len(pa)]==pa}")
