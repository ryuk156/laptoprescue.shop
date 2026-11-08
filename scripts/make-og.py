# Generates public/og-image.png (1200x630) from brand/logo-full.png.
# Re-run after changing the business name:  python3 scripts/make-og.py "business name"
import sys
from PIL import Image, ImageDraw, ImageFont
name = sys.argv[1] if len(sys.argv) > 1 else "laptoprescue.shop"
W, H = 1200, 630
CHAR, TAN, BG = (71, 70, 66), (195, 170, 131), (245, 243, 239)
img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
def font(size, bold=True):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        try: return ImageFont.truetype(p, size)
        except OSError: pass
    return ImageFont.load_default()
logo = Image.open("brand/logo-full.png").convert("RGBA")
lw = 380; lh = round(logo.height * lw / logo.width)
logo = logo.resize((lw, lh), Image.LANCZOS)
img.paste(logo, (90, (H - lh) // 2), logo)
x = 520
d.rectangle((x, 205, x + 90, 211), fill=TAN)
d.text((x, 240), name, font=font(60), fill=CHAR)
d.text((x, 332), "Laptop & MacBook repair", font=font(40, False), fill=CHAR)
d.text((x, 392), "London, Ontario", font=font(40, False), fill=CHAR)
d.text((x, 470), "Free pickup & delivery  \u2022  $29.99 diagnostics", font=font(26, False), fill=(110, 108, 100))
img.save("public/og-image.png", optimize=True)
print("wrote public/og-image.png")
