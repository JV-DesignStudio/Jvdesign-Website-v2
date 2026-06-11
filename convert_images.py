import os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
EXCLUDE = {"logo.png", "qrcode.png"}
MIN_SIZE = 100 * 1024  # 100KB
MAX_DIM = 1600

results = []

for fname in os.listdir(ROOT):
    ext = os.path.splitext(fname)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        continue
    if fname in EXCLUDE:
        continue
    path = os.path.join(ROOT, fname)
    size = os.path.getsize(path)
    if size < MIN_SIZE:
        continue

    out_name = os.path.splitext(fname)[0] + ".webp"
    out_path = os.path.join(ROOT, out_name)

    with Image.open(path) as im:
        w, h = im.size
        if max(w, h) > MAX_DIM:
            scale = MAX_DIM / max(w, h)
            im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        if im.mode in ("P", "RGBA"):
            im = im.convert("RGBA")
        else:
            im = im.convert("RGB")
        im.save(out_path, "WEBP", quality=80, method=6)

    new_size = os.path.getsize(out_path)
    results.append((fname, size, out_name, new_size))

total_old = sum(r[1] for r in results)
total_new = sum(r[3] for r in results)

for fname, old, out, new in sorted(results, key=lambda r: -r[1]):
    print(f"{fname:45s} {old/1024:8.1f}KB -> {out:45s} {new/1024:8.1f}KB  ({100*new/old:.1f}%)")

print(f"\nTotal: {total_old/1024/1024:.1f}MB -> {total_new/1024/1024:.1f}MB  ({100*total_new/total_old:.1f}%)")
print(f"Files converted: {len(results)}")
