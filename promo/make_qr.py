#!/usr/bin/env python3
"""Generate the download QR code for Prodrome (points to the GitHub release)."""
import os, segno
from PIL import Image, ImageDraw

URL = "https://github.com/Ljupcho1982/prodrome/releases/latest"
here = os.path.dirname(os.path.abspath(__file__))

# High error-correction so a centered logo/quiet zone is fine.
qr = segno.make(URL, error="h")

# 1) Plain scannable PNG (dark navy on white) — the safe, universal one.
plain = os.path.join(here, "qr-download.png")
qr.save(plain, scale=16, border=4, dark="#0b1020", light="#ffffff")

# 2) A branded card: white rounded QR panel on the app's dark gradient with a label.
scale = 16
qr_png = os.path.join(here, "_qr_tmp.png")
qr.save(qr_png, scale=scale, border=2, dark="#0b1020", light="#ffffff")
qimg = Image.open(qr_png).convert("RGBA")
qs = qimg.size[0]

W = qs + 220
H = qs + 340
card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(card)
# gradient bg
top, bot = (0x1a, 0x24, 0x50), (0x0b, 0x10, 0x20)
for y in range(H):
    t = y / (H - 1)
    d.line([(0, y), (W, y)], fill=(int(top[0] + (bot[0]-top[0])*t),
                                    int(top[1] + (bot[1]-top[1])*t),
                                    int(top[2] + (bot[2]-top[2])*t), 255))
# white rounded panel behind QR
pad = 28
panel = [110 - pad, 150 - pad, 110 + qs + pad, 150 + qs + pad]
d.rounded_rectangle(panel, radius=40, fill=(255, 255, 255, 255))
card.alpha_composite(qimg, (110, 150))

def font(path, size):
    from PIL import ImageFont
    return ImageFont.truetype(path, size)
BOLD = "C:/Windows/Fonts/segoeuib.ttf"
REG = "C:/Windows/Fonts/segoeui.ttf"
def center_text(draw, y, text, fnt, fill):
    w = draw.textlength(text, font=fnt)
    draw.text(((W - w) / 2, y), text, font=fnt, fill=fill)
center_text(d, 54, "Scan to install Prodrome", font(BOLD, 46), (0xe8, 0xec, 0xff, 255))
center_text(d, H - 130, "github.com/Ljupcho1982/prodrome", font(REG, 30), (0x97, 0xa2, 0xcf, 255))
center_text(d, H - 88, "Free · Open source · Android", font(REG, 30), (0x3d, 0xdc, 0x97, 255))

branded = os.path.join(here, "qr-download-card.png")
card.convert("RGB").save(branded, "PNG")
os.remove(qr_png)
print("wrote", plain)
print("wrote", branded)
