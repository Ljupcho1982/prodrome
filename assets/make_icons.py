#!/usr/bin/env python3
"""Generate Prodrome PNG icons with stdlib only (zlib + struct). No Pillow."""
import zlib, struct, os

def png(width, height, pixels):
    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        return c + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff)
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0
        row = pixels[y]
        for (r, g, b, a) in row:
            raw += bytes((r, g, b, a))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

def lerp(a, b, t):
    return int(a + (b - a) * t)

def build(size):
    W = H = size
    # gradient background (top #1a2450 -> bottom #0b1020), rounded corners
    top = (0x1a, 0x24, 0x50)
    bot = (0x0b, 0x10, 0x20)
    accent = (0x6d, 0x8b, 0xff)
    green = (0x3d, 0xdc, 0x97)
    r = size * 0.22  # corner radius
    cx, cy = W / 2, H / 2
    px = []
    for y in range(H):
        t = y / (H - 1)
        bg = (lerp(top[0], bot[0], t), lerp(top[1], bot[1], t), lerp(top[2], bot[2], t))
        row = []
        for x in range(W):
            # rounded-corner alpha
            a = 255
            for (ox, oy) in ((r, r), (W - r, r), (r, H - r), (W - r, H - r)):
                inx = (x < r and ox == r) or (x > W - r and ox == W - r)
                iny = (y < r and oy == r) or (y > H - r and oy == H - r)
                if inx and iny:
                    d = ((x - ox) ** 2 + (y - oy) ** 2) ** 0.5
                    if d > r:
                        a = 0
            # two left-pointing triangles (rewind glyph), centered
            col = bg
            tri_w = size * 0.26
            tri_h = size * 0.30
            gap = size * 0.02
            def in_tri(tipx):
                # triangle with tip at (tipx, cy), base of width tri_w to the right
                bx = tipx + tri_w
                if x < tipx or x > bx:
                    return False
                frac = (x - tipx) / tri_w  # 0 at tip ->1 at base
                half = (tri_h / 2) * frac
                return cy - half <= y <= cy + half
            t1 = cx - gap - tri_w
            t2 = cx + gap
            if in_tri(t1) or in_tri(t2):
                col = (0xe8, 0xec, 0xff)
            # small accent dot bottom-right of glyph
            if ((x - (cx + size * 0.02)) ** 2 + (y - (cy + size * 0.24)) ** 2) ** 0.5 < size * 0.035:
                col = green
            row.append((col[0], col[1], col[2], a))
        px.append(row)
    return png(W, H, px)

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "www", "icons")
os.makedirs(out, exist_ok=True)
for s in (192, 512):
    data = build(s)
    with open(os.path.join(out, f"icon-{s}.png"), "wb") as f:
        f.write(data)
    print(f"wrote icon-{s}.png ({len(data)} bytes)")
# a 1024 master for Capacitor asset generation
with open(os.path.join(here, "icon-source.png"), "wb") as f:
    f.write(build(1024))
print("wrote assets/icon-source.png (1024)")
