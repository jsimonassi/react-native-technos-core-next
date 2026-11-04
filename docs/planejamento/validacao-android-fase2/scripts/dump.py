import json, sys

path = sys.argv[1]
for line in open(path, encoding="utf-8"):
	line = line.strip()
	if not line:
		continue
	o = json.loads(line)
	if o.get("type") != "packet":
		print("HDR", {k: v for k, v in o.items() if k != "type"})
		continue
	h = o["hex"]
	ch = o["characteristic"][4:8]
	if h.startswith("FEEA") and len(h) >= 10:
		body = h[8:]
		cmd = body[:2]
		pay = body[2:]
		print(f'{o["atMs"]:>8} {o["dir"]:<4} {ch} cmd={cmd} {pay[:80]}{"…" if len(pay) > 80 else ""} ({len(pay)//2}B)')
	else:
		print(f'{o["atMs"]:>8} {o["dir"]:<4} {ch} raw={h[:80]}')
