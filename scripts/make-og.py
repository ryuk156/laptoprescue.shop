# Generates public/og-image.png (1200x630). Re-run after changing the business name:
#   python3 scripts/make-og.py "laptoprescue.shop"
import sys
from PIL import Image, ImageDraw, ImageFont
name = sys.argv[1] if len(sys.argv) > 1 else "laptoprescue.shop"
W, H = 1200, 630
img = Image.new("RGB", (W, H), "#172B3D")
d = ImageDraw.Draw(img)
def font(size, bold=True):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        try: return ImageFont.truetype(p, size)
        except OSError: pass
    return ImageFont.load_default()
d.rounded_rectangle((80, 80, 152, 152), 20, fill="#B7F36B")
d.line([(100, 118), (114, 132), (136, 100)], fill="#172B3D", width=9, joint="curve")
d.text((172, 96), name, font=font(40), fill="#FFFFFF")
d.text((80, 230), "Computer Repair", font=font(86), fill="#FFFFFF")
d.text((80, 332), "Without the Hassle.", font=font(86), fill="#B7F36B")
d.text((80, 470), "Laptop & MacBook repair in London, Ontario", font=font(36, False), fill="#CBD5E1")
d.text((80, 520), "Free pickup & delivery  •  $29.99 diagnostics", font=font(30, False), fill="#CBD5E1")
img.save("public/og-image.png", optimize=True)
print("wrote public/og-image.png")
