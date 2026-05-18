#!/usr/bin/env python3
"""
render_can.py
─────────────
Generates 115 frames of the TEANMUR paint can animation.
Output : public/frames/frame_0001.jpg → frame_0115.jpg  (1280 × 668 px)

Animation phases (matches marks.js frameStart values):
  1–20   : can fully assembled, static
  21–40  : lid ring + lid rise (0 → -85 px)
  41–60  : handle also rises  (0 → -40 px extra)
  61–90  : body illuminates (glow peaks at frame 75)
  91–115 : everything eases back to assembled position
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, math, sys

# ─── Output ──────────────────────────────────────────────────────────────────
W, H         = 1280, 668
TOTAL        = 115
OUT_DIR      = os.path.join(os.path.dirname(__file__), 'public', 'frames')
os.makedirs(OUT_DIR, exist_ok=True)

# ─── Can geometry (no animation offset) ──────────────────────────────────────
CX, CY       = W // 2, H // 2 + 14   # canvas centre, slightly lower than midpoint
BODY_RX      = 152                    # half-width of cylinder body
BODY_H       = 348                    # total height of body
EL_H         = 38                     # ellipse minor axis (perspective)

BODY_T       = CY - BODY_H // 2      # body top Y
BODY_B       = CY + BODY_H // 2      # body bottom Y

RING_RX      = BODY_RX + 7           # gold ring is slightly wider
RING_THICK   = 26                     # ring height
LID_RX       = RING_RX + 3           # lid slightly wider still
LID_THICK    = 10

BAND_H       = 52                     # decorative bottom band height
BAND_T       = BODY_B - BAND_H       # band top Y

# ─── Colour palette ───────────────────────────────────────────────────────────
BG           = (8,  8,  10)
BODY_DARK    = (15, 15, 17)
BODY_BASE    = (26, 26, 30)
BODY_HIGH    = (68, 68, 78)          # metallic highlight stripe

GOLD_DRK     = (75,  54, 10)
GOLD_MID     = (179, 143, 52)
GOLD_BRT     = (238, 203, 108)
GOLD_SPEC    = (255, 240, 180)       # specular peak

HANDLE_DRK   = (35, 35, 40)
HANDLE_MID   = (72, 72, 84)

BAND_CLR     = (12, 12, 14)
BAND_EDGE    = (44, 44, 50)

TEXT_GOLD    = (210, 172, 68)
TEXT_SUB     = (160, 130, 50)

# ─── Easing ───────────────────────────────────────────────────────────────────
def ease_io(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def ease_out(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 2

def frame_t(frame, s, e):
    if frame <= s: return 0.0
    if frame >= e: return 1.0
    return ease_io((frame - s) / (e - s))

# ─── Per-frame animation values ───────────────────────────────────────────────
def get_state(f):
    LID_DY     = -88.0
    HANDLE_EXT = -40.0

    if 1 <= f <= 20:
        return 0.0, 0.0, 0.0

    elif 21 <= f <= 40:
        t = frame_t(f, 21, 40)
        return LID_DY * t, 0.0, 0.0

    elif 41 <= f <= 60:
        t = frame_t(f, 41, 60)
        return LID_DY, HANDLE_EXT * t, 0.0

    elif 61 <= f <= 90:
        t_up   = frame_t(f, 61, 75)
        t_down = 1 - frame_t(f, 75, 90)
        glow   = min(t_up, t_down) * 2
        return LID_DY, HANDLE_EXT, glow

    elif 91 <= f <= 115:
        t = frame_t(f, 91, 115)
        return LID_DY * (1 - t), HANDLE_EXT * (1 - t), 0.0

    return 0.0, 0.0, 0.0

# ─── Draw helpers ─────────────────────────────────────────────────────────────

def lerp_colour(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

def draw_gradient_rect(arr, x0, x1, y0, y1, left_c, mid_c, right_c, alpha=1.0):
    """Horizontal gradient fill into numpy array [H,W,3], y0..y1, x0..x1."""
    ys = slice(max(0, y0), min(arr.shape[0], y1))
    for x in range(max(0, x0), min(arr.shape[1], x1)):
        t = (x - x0) / max(1, x1 - x0 - 1)
        if t < 0.5:
            c = lerp_colour(left_c, mid_c, t * 2)
        else:
            c = lerp_colour(mid_c, right_c, (t - 0.5) * 2)
        if alpha < 1.0:
            old = arr[ys, x].astype(float)
            arr[ys, x] = (old * (1 - alpha) + np.array(c) * alpha).astype(np.uint8)
        else:
            arr[ys, x] = c

def metal_body_col(x, body_x0, body_x1, glow=0.0):
    """Returns the metallic body colour for pixel column x."""
    t = (x - body_x0) / max(1, body_x1 - body_x0 - 1)
    # cylindrical shading: cos curve, highlight slightly left of centre
    angle  = (t - 0.45) * math.pi * 0.82
    shade  = max(0.0, math.cos(angle)) ** 0.55
    # thin specular stripe
    spec   = max(0.0, 1 - abs(t - 0.38) * 22) * 0.35
    total  = min(1.0, shade * 0.90 + spec + glow * 0.35)
    r = int(BODY_DARK[0] + total * (BODY_HIGH[0] - BODY_DARK[0]))
    g = int(BODY_DARK[1] + total * (BODY_HIGH[1] - BODY_DARK[1]))
    b = int(BODY_DARK[2] + total * (BODY_HIGH[2] - BODY_DARK[2]))
    return (r, g, b)

def gold_col(x, x0, x1):
    """Metallic gold colour for column x within [x0, x1]."""
    t     = (x - x0) / max(1, x1 - x0 - 1)
    angle = (t - 0.42) * math.pi * 0.80
    shade = max(0.0, math.cos(angle)) ** 0.50
    spec  = max(0.0, 1 - abs(t - 0.40) * 18) * 0.45
    total = min(1.0, shade * 0.85 + spec)
    if total < 0.5:
        c = lerp_colour(GOLD_DRK, GOLD_MID, total * 2)
    else:
        c = lerp_colour(GOLD_MID, GOLD_SPEC, (total - 0.5) * 2)
    return c

# ─── Component drawing functions ──────────────────────────────────────────────

def draw_body(arr, dy_lid, glow):
    """Draw the main cylinder body (not affected by lid animation)."""
    x0, x1 = CX - BODY_RX, CX + BODY_RX
    y0, y1 = BODY_T, BODY_B

    for x in range(max(0, x0), min(arr.shape[1], x1)):
        c = metal_body_col(x, x0, x1, glow)
        arr[max(0,y0):min(arr.shape[0],y1), x] = c

    # Bottom ellipse cap
    img_tmp = Image.fromarray(arr, 'RGB')
    d = ImageDraw.Draw(img_tmp)
    d.ellipse([x0, BODY_B - EL_H, x1, BODY_B + EL_H], fill=BODY_DARK)
    arr[:] = np.array(img_tmp)

    # Bottom band
    img_tmp = Image.fromarray(arr, 'RGB')
    d = ImageDraw.Draw(img_tmp)
    for bx in range(x0, x1):
        t    = (bx - x0) / max(1, x1 - x0 - 1)
        edge = max(0.0, 1 - abs(t - 0.5) * 2.2)
        bc   = lerp_colour(BAND_CLR, BAND_EDGE, edge * 0.5)
        d.line([(bx, BAND_T), (bx, BODY_B)], fill=bc)
    # Bottom band top edge line (slight relief)
    d.line([(x0, BAND_T), (x1, BAND_T)], fill=BAND_EDGE, width=2)
    # Bottom band ellipse (rounded bottom edge)
    d.ellipse([x0, BODY_B - EL_H//2, x1, BODY_B + EL_H//2], fill=BAND_CLR)
    arr[:] = np.array(img_tmp)

def draw_top_ellipse(arr, body_top_y, glow):
    """Dark metallic top cap on the body (not lid — just the visible top of body)."""
    x0, x1 = CX - BODY_RX, CX + BODY_RX
    img_tmp = Image.fromarray(arr, 'RGB')
    d = ImageDraw.Draw(img_tmp)
    c_bright = lerp_colour(BODY_BASE, BODY_HIGH, 0.25 + glow * 0.2)
    d.ellipse([x0, body_top_y - EL_H, x1, body_top_y + EL_H], fill=c_bright)
    arr[:] = np.array(img_tmp)

def draw_gold_ring(arr, ring_top_y, dy):
    """Gold metallic ring (lid collar)."""
    x0, x1 = CX - RING_RX, CX + RING_RX
    yt, yb  = ring_top_y + int(dy), ring_top_y + RING_THICK + int(dy)

    for x in range(max(0, x0), min(arr.shape[1], x1)):
        c = gold_col(x, x0, x1)
        arr[max(0,yt):min(arr.shape[0],yb), x] = c

    img_tmp = Image.fromarray(arr, 'RGB')
    d = ImageDraw.Draw(img_tmp)
    # Top ellipse of ring (bright gold face)
    d.ellipse([x0, yt - EL_H + 6, x1, yt + EL_H - 6], fill=GOLD_MID)
    # Highlight line on ring top
    hi = lerp_colour(GOLD_MID, GOLD_SPEC, 0.7)
    d.ellipse([x0+8, yt - EL_H + 8, x1-8, yt + EL_H - 8], fill=hi)
    arr[:] = np.array(img_tmp)

def draw_lid(arr, lid_top_y, dy):
    """Lid disc on top of the ring."""
    x0, x1 = CX - LID_RX, CX + LID_RX
    yt      = lid_top_y + int(dy)

    img_tmp = Image.fromarray(arr, 'RGB')
    d = ImageDraw.Draw(img_tmp)
    # Lid top face
    d.ellipse([x0, yt - EL_H//2, x1, yt + EL_H//2], fill=GOLD_MID)
    # Lid highlight
    hi_x0 = x0 + int((x1 - x0) * 0.12)
    hi_x1 = x0 + int((x1 - x0) * 0.68)
    d.ellipse([hi_x0, yt - EL_H//3, hi_x1, yt + EL_H//3],
              fill=lerp_colour(GOLD_MID, GOLD_SPEC, 0.75))
    arr[:] = np.array(img_tmp)

def draw_handle(arr, body_top_y, lid_dy, handle_dy):
    """Metal handle arc above the lid."""
    total_dy = int(lid_dy + handle_dy)

    # Connection points (where handle meets the lid ring)
    conn_y   = body_top_y - EL_H + 4 + int(lid_dy)
    left_cx  = CX - RING_RX + 18
    right_cx = CX + RING_RX - 18

    # Arc peak
    peak_y   = conn_y - 95 + total_dy + int(lid_dy) - int(lid_dy)
    # More accurately:
    peak_y   = body_top_y - EL_H - 90 + int(lid_dy) + int(handle_dy)

    img_tmp  = Image.fromarray(arr, 'RGB')
    d        = ImageDraw.Draw(img_tmp)

    # Draw arc as polyline with many points
    n_pts  = 50
    pts    = []
    for i in range(n_pts + 1):
        t     = i / n_pts
        # Parabola: y = peak + (conn_y - peak) * (2t-1)^2
        para  = (2 * t - 1) ** 2
        x_pt  = left_cx + t * (right_cx - left_cx)
        y_pt  = peak_y  + (conn_y - peak_y) * para
        pts.append((x_pt, y_pt))

    # Draw handle bar (thick, dark metallic)
    d.line(pts, fill=HANDLE_MID, width=10)
    d.line(pts, fill=HANDLE_DRK, width=6)

    # Connection studs
    stud_r = 9
    for sx, sy in [(left_cx, conn_y), (right_cx, conn_y)]:
        d.ellipse([sx - stud_r, sy - stud_r, sx + stud_r, sy + stud_r],
                  fill=GOLD_DRK, outline=GOLD_MID, width=2)

    arr[:] = np.array(img_tmp)

def draw_text(img_pil, body_top_y):
    """Draw TEANMUR text + subtitle onto PIL image."""
    d = ImageDraw.Draw(img_pil)

    # Find a usable font; fall back to PIL default if nothing found
    font_paths = [
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
        '/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf',
    ]
    font_main = None
    font_sub  = None
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font_main = ImageFont.truetype(fp, 52)
                font_sub  = ImageFont.truetype(fp, 20)
                font_tiny = ImageFont.truetype(fp, 14)
                break
            except:
                pass

    # Text vertical centre on body: between BAND_T and body_top_y
    text_cy = (BAND_T + body_top_y) // 2 + 10

    # TEANMUR
    main_text = 'TEANMUR'
    if font_main:
        bb = d.textbbox((0, 0), main_text, font=font_main)
        tw = bb[2] - bb[0]
        tx = CX - tw // 2
        ty = text_cy - 60
        # Slight drop shadow
        d.text((tx + 2, ty + 2), main_text, fill=(0, 0, 0, 80), font=font_main)
        d.text((tx, ty), main_text, fill=TEXT_GOLD, font=font_main)

    # Subtitle
    sub_text = 'PREMIUM INDUSTRIAL PAINT'
    if font_sub:
        bb2 = d.textbbox((0, 0), sub_text, font=font_sub)
        sw  = bb2[2] - bb2[0]
        d.text((CX - sw // 2, text_cy - 4), sub_text, fill=TEXT_SUB, font=font_sub)

    # Third line
    tiny_text = '20 Litros  |  Professional Grade'
    if font_sub:
        bb3 = d.textbbox((0, 0), tiny_text, font=font_sub)
        tw3 = bb3[2] - bb3[0]
        d.text((CX - tw3 // 2, text_cy + 24), tiny_text, fill=TEXT_SUB, font=font_sub)

# ─── Main render loop ─────────────────────────────────────────────────────────

def render_frame(frame_n):
    lid_dy, handle_dy, glow = get_state(frame_n)

    arr = np.full((H, W, 3), BG, dtype=np.uint8)

    body_top_y  = BODY_T
    ring_top_y  = BODY_T - RING_THICK   # ring sits on top of body

    # 1. Body (static)
    draw_body(arr, lid_dy, glow)

    # 2. Top cap of body
    draw_top_ellipse(arr, body_top_y, glow)

    # 3. Gold ring (moves with lid)
    draw_gold_ring(arr, ring_top_y, lid_dy)

    # 4. Lid disc
    draw_lid(arr, ring_top_y - EL_H + 2, lid_dy)

    # 5. Handle
    draw_handle(arr, body_top_y, lid_dy, handle_dy)

    # 6. Text (on body — draw onto PIL image)
    img = Image.fromarray(arr, 'RGB')
    draw_text(img, body_top_y)

    return img

if __name__ == '__main__':
    print(f'Rendering {TOTAL} frames → {OUT_DIR}')

    for i in range(1, TOTAL + 1):
        img  = render_frame(i)
        path = os.path.join(OUT_DIR, f'frame_{i:04d}.jpg')
        img.save(path, 'JPEG', quality=92, optimize=True)
        if i % 10 == 0 or i == 1 or i == TOTAL:
            print(f'  frame {i:03d}/{TOTAL}  lid_dy={get_state(i)[0]:+.0f}  glow={get_state(i)[2]:.2f}')

    print('Done.')
