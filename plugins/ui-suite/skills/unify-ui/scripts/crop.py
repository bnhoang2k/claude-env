#!/usr/bin/env python3
"""Crop a region out of a PNG: crop.py <in.png> <x> <y> <width> <height> <out.png>

x and y are the top-left corner of the region, in pixels. x comes before y.
Needs Pillow (pip package "Pillow"). When it is missing, print one line,
"needs Pillow: python3 -m pip install Pillow", and exit 3 with no traceback.
Exit 2 is a usage error, a region that does not fit the image, or a file that cannot be read or
written. Each prints one line, never a traceback.
"""
import sys


def main(argv):
    if len(argv) != 7:
        print("usage: crop.py <in.png> <x> <y> <width> <height> <out.png>")
        return 2
    try:
        from PIL import Image
    except ImportError:
        print("needs Pillow: python3 -m pip install Pillow")
        return 3
    src, out = argv[1], argv[6]
    try:
        x, y, w, h = (int(float(v)) for v in argv[2:6])
    except (ValueError, OverflowError):
        print("usage: crop.py <in.png> <x> <y> <width> <height> <out.png> (numbers for x y width height)")
        return 2
    try:
        with Image.open(src) as im:
            if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > im.width or y + h > im.height:
                print("region %d,%d %dx%d does not fit the %dx%d image" % (x, y, w, h, im.width, im.height))
                return 2
            im.crop((x, y, x + w, y + h)).save(out)
    except (OSError, ValueError) as e:
        # Missing or unreadable input, a folder that is not there, or an output name Pillow has no format for.
        print("cannot crop %s to %s: %s" % (src, out, e))
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
