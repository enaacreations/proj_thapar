#!/usr/bin/env python3
"""Render the UniLiv icon set from one SVG mark (see mark.py)."""
import os, subprocess
from mark import mark

OUT = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Brand gradient, straight from apps/mobile/src/theme/tokens.ts
G1, G2, G3 = "#FF9A3D", "#F2603C", "#C2459A"

def grad(x2, y2, gid="g"):
    return (f'<linearGradient id="{gid}" x1="0" y1="0" x2="{x2}" y2="{y2}" '
            f'gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{G1}"/>'
            f'<stop offset="0.52" stop-color="{G2}"/>'
            f'<stop offset="1" stop-color="{G3}"/></linearGradient>')

def svg(body, w=1024, h=1024, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}"><defs>{defs}</defs>{body}</svg>')

def scaled(fill, k, cx=512, cy=512):
    """Scale the mark about the tile centre — for the Android safe zone."""
    return (f'<g transform="translate({cx - cx * k},{cy - cy * k}) '
            f'scale({k})">{mark(fill)}</g>')

PLATE = f'<rect width="1024" height="1024" fill="url(#g)"/>'
G1024 = grad(1024, 1024)
SAFE = 0.78          # keeps the mark inside Android's circular mask

FILES = {
    # Full-bleed icon: no transparency, no rounded corners — each OS masks it.
    "icon": (svg(PLATE + mark("#FFFFFF"), defs=G1024), 1024, 1024),
    "android-icon-background": (svg(PLATE, defs=G1024), 1024, 1024),
    "android-icon-foreground": (svg(scaled("#FFFFFF", SAFE)), 1024, 1024),
    # Themed-icon layer: silhouette only, the OS recolours it.
    "android-icon-monochrome": (svg(scaled("#000000", SAFE)), 1024, 1024),
    # Splash sits on the surface colour, so the mark itself carries the gradient.
    "splash-icon": (svg(scaled("url(#g)", 0.74), defs=G1024), 1024, 1024),
    "favicon": (svg(f'<rect width="1024" height="1024" rx="180" fill="url(#g)"/>'
                    + mark("#FFFFFF"), defs=G1024), 48, 48),
    # Play listing icon must be exactly 512x512.
    "play-icon-512": (svg(PLATE + mark("#FFFFFF"), defs=G1024), 512, 512),
}

# Play feature graphic: 1024x500, no transparency. Keep the mark and the type
# on their own columns — Play crops the edges on some surfaces.
FEATURE = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
<defs>{grad(1024, 500)}</defs>
<rect width="1024" height="500" fill="url(#g)"/>
<g opacity="0.09" transform="translate(742,44) scale(0.60)">{mark("#FFFFFF")}</g>
<g transform="translate(-46,-34) scale(0.36)">{mark("#FFFFFF")}</g>
<text x="286" y="238" fill="#FFFFFF" font-size="72" font-weight="700" letter-spacing="-1.6"
      font-family="Hanken Grotesk, DM Sans, Helvetica Neue, Arial, sans-serif">UniLiv</text>
<text x="290" y="300" fill="#FFFFFF" fill-opacity="0.94" font-size="31" font-weight="500" letter-spacing="-0.2"
      font-family="DM Sans, Helvetica Neue, Arial, sans-serif">Rent, mess, laundry and repairs — in one app</text>
</svg>'''
FILES["play-feature-graphic"] = (FEATURE, 1024, 500)


def render(name, source, w, h):
    with open(os.path.join(OUT, f"{name}.svg"), "w") as fh:
        fh.write(source)
    html = os.path.join(OUT, f"{name}.html")
    with open(html, "w") as fh:
        fh.write('<html><head><style>html,body{margin:0;padding:0;'
                 'background:transparent}svg{display:block}</style></head>'
                 f'<body>{source}</body></html>')
    subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
         "--default-background-color=00000000", f"--window-size={w},{h}",
         f"--screenshot={os.path.join(OUT, name + '.png')}", f"file://{html}"],
        check=True, capture_output=True)
    os.remove(html)
    print(f"  {name}.png  {w}x{h}")


if __name__ == "__main__":
    print("rendering icon set:")
    for name, (source, w, h) in FILES.items():
        render(name, source, w, h)
