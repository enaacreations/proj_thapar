# The Thapar Hostel mark: a residence block — flat roof slab, a grid of rooms,
# one shared doorway. The repeated windows are what say "hostel" rather than
# "house"; a lone pitched roof reads as a generic home button.

def _rect(x, y, w, h, r):
    return (f"M{x + r} {y} H{x + w - r} A{r} {r} 0 0 1 {x + w} {y + r} "
            f"V{y + h - r} A{r} {r} 0 0 1 {x + w - r} {y + h} "
            f"H{x + r} A{r} {r} 0 0 1 {x} {y + h - r} "
            f"V{y + r} A{r} {r} 0 0 1 {x + r} {y} Z")

# Knock-outs are wound the same way as the body; fill-rule="evenodd" is what
# punches them through, so winding direction doesn't matter here.
ROOF = _rect(252, 216, 520, 56, 18)
# Runs up behind the slab so its top corner radii do not notch the join.
BODY = _rect(292, 254, 440, 546, 26)

WINDOWS = [_rect(x, y, 88, 88, 18)
           for y in (332, 456)
           for x in (348, 468, 588)]

# Doorway: an arch that meets the ground line, so the block sits on it.
DOOR = ("M468 664 A44 44 0 0 1 556 664 V800 H468 Z")

BLOCK = " ".join([BODY, DOOR] + WINDOWS)


def mark(fill: str) -> str:
    """Roof slab plus the block; windows and door are cut out of the block."""
    return (f'<path d="{ROOF}" fill="{fill}"/>'
            f'<path d="{BLOCK}" fill="{fill}" fill-rule="evenodd"/>')
