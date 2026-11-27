# Builds "Notelet Arrows": → ← ↔ ⟶ ⟵ ⟷ ⇒ ⇐ ⇔ ⟹ ⟸ ⟺ ≤ ≥ ≠ drawn as JetBrains Mono's ligatures.
#
#   pip install fonttools brotli
#   # JetBrainsMono-2.304.zip from https://github.com/JetBrains/JetBrainsMono/releases, unzipped
#   python3 tools/build-arrow-font.py fonts/ttf/JetBrainsMono-Regular.ttf extension/fonts/notelet-arrows-regular.woff2 Regular
#   python3 tools/build-arrow-font.py fonts/ttf/JetBrainsMono-Bold.ttf extension/fonts/notelet-arrows-bold.woff2 Bold
#
# A code point added here also goes in the unicode-range of "Notelet Arrows" in notes.css.
import sys
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

# Space on each side of a glyph, so it sits in text like a letter rather than in a code cell.
SIDE_BEARING = 80
CELL = 600
# code point: the ligature glyphs drawn for it, as (glyph, whether it is mirrored). A second glyph
# is drawn one cell further right, over the first.
ARROWS = {
    0x2192: [("hyphen_greater.liga", False)],
    0x2190: [("less_hyphen.liga", False)],
    0x2194: [("less_hyphen_greater.liga", False)],
    0x27F6: [("hyphen_hyphen_greater.liga", False)],
    0x27F5: [("less_hyphen_hyphen.liga", False)],
    # JetBrains Mono has no "<-->", so ⟷ is ⟵ and ⟶ with their shafts overlapping.
    0x27F7: [("less_hyphen_hyphen.liga", False), ("hyphen_hyphen_greater.liga", False)],
    # JetBrains Mono has no short left double arrow, so ⇐ is ⇒ mirrored.
    0x21D2: [("equal_greater.liga", False)],
    0x21D0: [("equal_greater.liga", True)],
    0x21D4: [("less_equal_greater.liga", False)],
    0x27F9: [("equal_equal_greater.liga", False)],
    0x27F8: [("less_equal_equal.liga", False)],
    0x27FA: [("less_equal_equal_greater.liga", False)],
    0x2264: [("less_equal.liga", False)],
    0x2265: [("greater_equal.liga", False)],
    0x2260: [("exclam_equal.liga", False)],
}
FAMILY = "Notelet Arrows"


def build(source, target, style):
    font = TTFont(source)
    glyf, hmtx = font["glyf"], font["hmtx"]
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    # The characters' own glyphs are replaced by their ligature drawing, moved right so it starts
    # just after the glyph's origin instead of reaching back over the characters before it.
    for code_point, parts in ARROWS.items():
        pen = TTGlyphPen(glyph_set)
        for index, (ligature, mirrored) in enumerate(parts):
            draw_part(glyf, glyph_set[ligature], pen, mirrored=mirrored, offset=index * CELL)
        glyph = pen.glyph()
        glyph.recalcBounds(glyf)
        # JetBrains Mono has no glyphs for some of these (⟸ ⟹ ⟺), so those get new ones.
        name = cmap.get(code_point, f"uni{code_point:04X}")
        glyf[name] = glyph
        hmtx[name] = (glyph.xMax + SIDE_BEARING, SIDE_BEARING)
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap[code_point] = name
    font.setGlyphOrder(list(glyf.glyphOrder))

    options = Options()
    options.layout_features = []
    options.hinting = False
    options.name_IDs = ["*"]
    options.flavor = "woff2"
    subsetter = Subsetter(options)
    subsetter.populate(unicodes=list(ARROWS))
    subsetter.subset(font)

    for record in font["name"].names:
        if record.nameID in (1, 16):
            record.string = FAMILY
        elif record.nameID in (4,):
            record.string = f"{FAMILY} {style}"
        elif record.nameID in (6,):
            record.string = f"NoteletArrows-{style}"
    font.flavor = "woff2"
    font.save(target)


def draw_part(glyf, ligature, pen, mirrored, offset):
    source = glyf[ligature.name]
    source.recalcBounds(glyf)
    if mirrored:
        # Flipping reverses the outline's direction, so it is reversed back to stay filled.
        ligature.draw(TransformPen(ReverseContourPen(pen), (-1, 0, 0, 1, source.xMax + SIDE_BEARING + offset, 0)))
    else:
        ligature.draw(TransformPen(pen, (1, 0, 0, 1, SIDE_BEARING - source.xMin + offset, 0)))


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2], sys.argv[3])
