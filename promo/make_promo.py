#!/usr/bin/env python3
"""
Render Prodrome promo scenes (1080x1920) and composite an animated frame
sequence (crossfades + subtle Ken-Burns motion). ffmpeg turns frames -> mp4.
Pillow only. No emoji fonts (glyphs are drawn as vectors) so it renders anywhere.
"""
import os, math
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES = os.path.join(HERE, "frames")
os.makedirs(FRAMES, exist_ok=True)
W, H = 1080, 1920

# palette
BG_TOP, BG_BOT = (26, 36, 80), (11, 16, 32)
TXT = (232, 236, 255)
MUTED = (151, 162, 207)
ACCENT = (109, 139, 255)
GREEN = (61, 220, 151)
DANGER = (255, 93, 108)
WARN = (255, 192, 77)

def F(path, size):
    return ImageFont.truetype(path, size)
BOLD = "C:/Windows/Fonts/segoeuib.ttf"
SEMI = "C:/Windows/Fonts/seguisb.ttf"
REG = "C:/Windows/Fonts/segoeui.ttf"
LIGHT = "C:/Windows/Fonts/segoeuil.ttf"

def gradient():
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    # radial-ish vertical gradient
    for y in range(H):
        t = (y / (H - 1)) ** 1.1
        d.line([(0, y), (W, y)], fill=(
            int(BG_TOP[0] + (BG_BOT[0]-BG_TOP[0])*t),
            int(BG_TOP[1] + (BG_BOT[1]-BG_TOP[1])*t),
            int(BG_TOP[2] + (BG_BOT[2]-BG_TOP[2])*t)))
    return img

def wrap(draw, text, fnt, maxw):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=fnt) <= maxw:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def center_block(img, y, text, fnt, fill, maxw=920, line_gap=14, glow=False):
    d = ImageDraw.Draw(img)
    lines = wrap(d, text, fnt, maxw)
    asc, desc = fnt.getmetrics()
    lh = asc + desc + line_gap
    for i, ln in enumerate(lines):
        w = d.textlength(ln, font=fnt)
        x = (W - w) / 2
        yy = y + i*lh
        if glow:
            d.text((x, yy), ln, font=fnt, fill=fill)
        d.text((x, yy), ln, font=fnt, fill=fill)
    return y + len(lines)*lh

def rewind_glyph(img, cx, cy, size, color=TXT, dot=GREEN):
    d = ImageDraw.Draw(img)
    tw, th, gap = size*0.42, size*0.5, size*0.06
    def tri(tipx):
        d.polygon([(tipx, cy), (tipx+tw, cy-th/2), (tipx+tw, cy+th/2)], fill=color)
    tri(cx - gap - tw)
    tri(cx + gap)
    d.ellipse([cx-size*0.06, cy+size*0.42, cx+size*0.06, cy+size*0.42+size*0.12], fill=dot)

def rounded(d, box, r, fill):
    d.rounded_rectangle(box, radius=r, fill=fill)

def warn_triangle(d, cx, cy, s, color=(255,255,255)):
    d.polygon([(cx, cy-s), (cx-s*0.9, cy+s*0.7), (cx+s*0.9, cy+s*0.7)], fill=color)
    # exclamation
    d.rectangle([cx-s*0.09, cy-s*0.35, cx+s*0.09, cy+s*0.18], fill=(216,58,72))
    d.ellipse([cx-s*0.11, cy+s*0.30, cx+s*0.11, cy+s*0.52], fill=(216,58,72))

def diverging_bars(img, top, rows):
    """rows: list of (label, drift, up_is_bad_color). Draw from center line."""
    d = ImageDraw.Draw(img)
    midx = W//2
    bar_h = 66
    gap = 42
    maxlen = 300
    fnt = F(SEMI, 40)
    valf = F(BOLD, 40)
    y = top
    d.line([(midx, top-20), (midx, top + len(rows)*(bar_h+gap))], fill=(58,71,111), width=2)
    for (label, drift) in rows:
        up = drift >= 0
        length = min(1.0, abs(drift)/4.0) * maxlen
        color = DANGER if up else ACCENT
        if up:
            box = [midx, y, midx+length, y+bar_h]
        else:
            box = [midx-length, y, midx, y+bar_h]
        rounded(d, box, 14, color)
        # label left
        d.text((90, y+bar_h/2 - fnt.getmetrics()[0]/2 - 4), label, font=fnt, fill=TXT)
        # value right
        arrow = "\u25B2" if up else "\u25BC"
        vs = f"{abs(drift):.1f}\u03c3"
        d.text((W-230, y+bar_h/2 - valf.getmetrics()[0]/2 - 4), vs, font=valf, fill=color)
        # small triangle arrow
        ax, ay, s = W-250, y+bar_h/2, 16
        if up:
            d.polygon([(ax, ay-s), (ax-s*0.8, ay+s*0.6), (ax+s*0.8, ay+s*0.6)], fill=color)
        else:
            d.polygon([(ax, ay+s), (ax-s*0.8, ay-s*0.6), (ax+s*0.8, ay-s*0.6)], fill=color)
        y += bar_h + gap

def fingerprint_bars(img, top, rows):
    d = ImageDraw.Draw(img)
    fnt = F(SEMI, 40)
    pf = F(REG, 34)
    x0, x1 = 110, W-110
    bar_h = 30
    gap = 74
    y = top
    for (label, pct, color) in rows:
        d.text((x0, y-52), label, font=fnt, fill=TXT)
        d.text((x1 - pf.getlength(f"{pct}%"), y-50), f"{pct}%", font=pf, fill=MUTED)
        rounded(d, [x0, y, x1, y+bar_h], 15, (14, 21, 48))
        w = (x1-x0) * pct/100.0
        rounded(d, [x0, y, x0+w, y+bar_h], 15, color)
        y += gap

# ---- scenes -------------------------------------------------------------
def scene_brand():
    img = gradient()
    rewind_glyph(img, W/2, 640, 300)
    center_block(img, 820, "Prodrome", F(BOLD, 150), TXT)
    center_block(img, 1010, "a flight recorder for your body", F(LIGHT, 56), MUTED)
    center_block(img, 1180, "the health app that runs your tape backwards", F(REG, 40), ACCENT)
    return img

def scene_problem():
    img = gradient()
    center_block(img, 700, "Every health app asks you to", F(SEMI, 62), MUTED)
    center_block(img, 800, "predict your body.", F(BOLD, 92), TXT)
    center_block(img, 1040, "But the warning signs happen hours before you feel a thing — and by then that data is gone.", F(REG, 48), MUTED, maxw=880)
    return img

def scene_button():
    img = gradient()
    center_block(img, 470, "So Prodrome flips it.", F(SEMI, 60), MUTED)
    center_block(img, 590, "Press ONE button when you feel bad.", F(BOLD, 70), TXT, maxw=940)
    # big danger button
    d = ImageDraw.Draw(img)
    bx0, by0, bx1, by1 = 190, 900, W-190, 1210
    rounded(d, [bx0, by0, bx1, by1], 48, (216, 58, 72))
    warn_triangle(d, W/2, 1000, 70)
    center_block(img, 1070, "Now", F(BOLD, 90), (255,255,255))
    center_block(img, 1300, "That's the whole job. No logging. No guessing.", F(REG, 46), MUTED, maxw=900)
    return img

def scene_rewind():
    img = gradient()
    center_block(img, 300, "Then it rewinds the tape.", F(BOLD, 78), TXT)
    center_block(img, 430, "what drifted from YOUR normal in the 24h before", F(REG, 42), MUTED, maxw=900)
    diverging_bars(img, 640, [
        ("Speech rate", -2.8),
        ("Sleep", -2.5),
        ("Pauses", 2.4),
        ("Heart rate", 2.2),
    ])
    return img

def scene_fingerprint():
    img = gradient()
    center_block(img, 300, "And learns your", F(SEMI, 58), MUTED)
    center_block(img, 380, "early-warning fingerprint", F(BOLD, 84), TXT)
    fingerprint_bars(img, 760, [
        ("Speech rate", 100, ACCENT),
        ("Sleep", 100, ACCENT),
        ("Heart rate", 100, DANGER),
        ("Pauses", 80, DANGER),
    ])
    center_block(img, 1180, "\u201c2 of your 3 warning signs are active today.\u201d", F(SEMI, 46), GREEN, maxw=900)
    center_block(img, 1300, "A heads-up. Not a diagnosis.", F(REG, 42), MUTED)
    return img

def scene_privacy():
    img = gradient()
    d = ImageDraw.Draw(img)
    # lock
    cx, cy = W/2, 700
    rounded(d, [cx-90, cy-30, cx+90, cy+150], 30, ACCENT)
    d.arc([cx-64, cy-150, cx+64, cy+20], start=180, end=360, fill=ACCENT, width=28)
    d.ellipse([cx-18, cy+40, cx+18, cy+76], fill=(11,16,32))
    d.rectangle([cx-9, cy+60, cx+9, cy+110], fill=(11,16,32))
    center_block(img, 940, "100% on your phone.", F(BOLD, 84), TXT)
    center_block(img, 1070, "No account. No cloud. Nothing ever leaves.", F(REG, 50), MUTED, maxw=920)
    center_block(img, 1230, "Even the voice note never leaves — only pitch, pace & pauses are kept.", F(REG, 40), MUTED, maxw=880)
    return img

def scene_cta():
    img = gradient()
    center_block(img, 210, "Download free", F(BOLD, 96), TXT)
    center_block(img, 340, "open source · Android", F(REG, 46), GREEN)
    # QR on white panel
    qr = Image.open(os.path.join(HERE, "qr-download.png")).convert("RGB")
    qs = 640
    qr = qr.resize((qs, qs), Image.NEAREST)
    d = ImageDraw.Draw(img)
    px, py = (W-qs)//2, 520
    rounded(d, [px-40, py-40, px+qs+40, py+qs+40], 44, (255,255,255))
    img.paste(qr, (px, py))
    center_block(img, py+qs+90, "github.com/Ljupcho1982/prodrome", F(SEMI, 44), TXT)
    center_block(img, py+qs+170, "Scan it. Rewind your body.", F(LIGHT, 48), MUTED)
    return img

SCENES = [scene_brand, scene_problem, scene_button, scene_rewind,
          scene_fingerprint, scene_privacy, scene_cta]

# ---- timeline / compositing --------------------------------------------
FPS = 30
HOLD = [2.6, 3.0, 3.2, 3.4, 3.6, 3.2, 4.2]   # seconds each scene is the focus
XF = 0.55                                     # crossfade seconds

def kenburns(scene_img, prog):
    # slow zoom 1.0 -> 1.06 with a slight upward pan
    z = 1.0 + 0.06 * prog
    cw, ch = int(W/z), int(H/z)
    x = (W - cw)//2
    y = int((H - ch) * (0.6 - 0.2*prog))
    return scene_img.crop((x, y, x+cw, y+ch)).resize((W, H), Image.BILINEAR)

def render():
    imgs = [s().convert("RGB") for s in SCENES]
    frame = 0
    n = len(imgs)
    for i in range(n):
        hold_frames = int(HOLD[i]*FPS)
        xf_frames = int(XF*FPS) if i < n-1 else 0
        total = hold_frames + xf_frames
        for f in range(total):
            prog = (f)/(max(1,(HOLD[i]+XF)*FPS))
            base = kenburns(imgs[i], min(1.0, prog))
            if i < n-1 and f >= hold_frames:
                # crossfade into next
                a = (f - hold_frames)/max(1, xf_frames)
                nxt = kenburns(imgs[i+1], 0.0)
                base = Image.blend(base, nxt, a)
            # global fade in/out
            fade = None
            if i == 0 and f < 12:
                fade = f/12
            if i == n-1 and f > total-18:
                fade = (total-f)/18
            if fade is not None:
                base = Image.blend(Image.new("RGB",(W,H),(0,0,0)), base, max(0,min(1,fade)))
            base.save(os.path.join(FRAMES, f"f{frame:05d}.png"))
            frame += 1
    print(f"rendered {frame} frames ({frame/FPS:.1f}s)")

if __name__ == "__main__":
    render()
