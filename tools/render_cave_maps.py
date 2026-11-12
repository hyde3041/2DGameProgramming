"""Render imported battle layouts with the project's existing cave tiles.

Run with the project's Pico2D Python environment. All generated files stay in
the input directory; applying them to the game is a separate step.
"""

import argparse
import ctypes
import json
import math
from pathlib import Path
import struct
import zlib

import pico2d


ROOT = Path(__file__).resolve().parents[1]
TILES = ROOT / "game/asset/map/stage/icon"
WIDTH, HEIGHT = 800, 600


def open_renderer(width, height):
    pico2d.open_canvas(width, height)
    globals_ = pico2d.open_canvas.__globals__
    pico2d.SDL_HideWindow(globals_["window"])
    renderer = globals_["renderer"]
    pico2d.SDL_SetRenderDrawBlendMode(renderer, pico2d.SDL_BLENDMODE_BLEND)
    return renderer


def save_png(renderer, path, width=WIDTH, height=HEIGHT):
    pixels = (ctypes.c_ubyte * (width * height * 4))()
    if pico2d.SDL_RenderReadPixels(
        renderer, None, pico2d.SDL_PIXELFORMAT_RGBA32, pixels, width * 4
    ) != 0:
        raise RuntimeError(f"Cannot read rendered map: {path}")

    def chunk(tag, content):
        checksum = zlib.crc32(tag + content) & 0xFFFFFFFF
        return struct.pack("!I", len(content)) + tag + content + struct.pack("!I", checksum)

    data = bytes(pixels)
    stride = width * 4
    scanlines = b"".join(b"\0" + data[y * stride:(y + 1) * stride] for y in range(height))
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack("!2I5B", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(scanlines, 6))
        + chunk(b"IEND", b"")
    )


class CaveRenderer:
    def __init__(self, renderer):
        self.renderer = renderer
        self.images = {
            name: pico2d.load_image(str(TILES / "common" / f"{name}.png"))
            for name in ("ground-a", "ground-b", "high-top", "wall-top")
        }
        self.images.update({
            name: pico2d.load_image(str(TILES / "objects" / f"{name}.png"))
            for name in ("entrance", "goal")
        })
        for picture in self.images.values():
            pico2d.SDL_SetTextureScaleMode(picture.texture, pico2d.SDL_ScaleModeLinear)

    def rectangle(self, rect, color, *, filled=True):
        pico2d.SDL_SetRenderDrawColor(self.renderer, *color)
        area = pico2d.SDL_Rect(*(int(value) for value in rect))
        draw = pico2d.SDL_RenderFillRect if filled else pico2d.SDL_RenderDrawRect
        draw(self.renderer, area)

    def line(self, start, end, color):
        pico2d.SDL_SetRenderDrawColor(self.renderer, *color)
        pico2d.SDL_RenderDrawLine(self.renderer, *(int(value) for value in (*start, *end)))

    def image(self, name, rect, tint=(255, 255, 255)):
        texture = self.images[name].texture
        pico2d.SDL_SetTextureColorMod(texture, *tint)
        pico2d.SDL_RenderCopy(
            self.renderer, texture, None, pico2d.SDL_Rect(*(int(value) for value in rect))
        )
        pico2d.SDL_SetTextureColorMod(texture, 255, 255, 255)

    def quad(self, points, color=(255, 255, 255, 255), texture=None):
        vertices = (pico2d.SDL_Vertex * 4)(*(
            pico2d.SDL_Vertex(
                pico2d.SDL_FPoint(*point), pico2d.SDL_Color(*color), pico2d.SDL_FPoint(*uv)
            )
            for point, uv in zip(points, ((0, 0), (1, 0), (1, 1), (0, 1)))
        ))
        index_type = pico2d.SDL_RenderGeometry.argtypes[4]._type_
        indices = (index_type * 6)(0, 1, 2, 0, 2, 3)
        if pico2d.SDL_RenderGeometry(self.renderer, texture, vertices, 4, indices, 6) != 0:
            raise RuntimeError(f"Cannot render projected map tile: {pico2d.SDL_GetError()!r}")

    @staticmethod
    def point(cell, u, v):
        """Interpolate a local tile position on its supplied projected surface."""
        top_left, top_right, bottom_right, bottom_left = cell["surface_polygon"]
        return tuple(
            (1 - v) * ((1 - u) * top_left[axis] + u * top_right[axis])
            + v * ((1 - u) * bottom_left[axis] + u * bottom_right[axis])
            for axis in (0, 1)
        )

    def surface_line(self, cell, start, end, color):
        self.line(self.point(cell, *start), self.point(cell, *end), color)

    def ring(self, cell, radius, color):
        points = [
            self.point(cell, 0.5 + math.cos(i * math.tau / 32) * radius,
                       0.5 + math.sin(i * math.tau / 32) * radius)
            for i in range(33)
        ]
        for first, second in zip(points, points[1:]):
            self.line(first, second, color)

    def draw_cell(self, cell):
        key = cell.get("source_tile_key", "")
        polygon = cell["surface_polygon"]
        ground = "ground-a" if (cell["column"] + cell["row"]) % 2 == 0 else "ground-b"

        if key == "tile_hole" or cell["type"] == "~":
            self.quad(polygon, (9, 15, 19, 255))
            self.surface_line(cell, (0.03, 0.03), (0.97, 0.03), (4, 8, 11, 255))
            self.surface_line(cell, (0.03, 0.97), (0.97, 0.97), (45, 56, 61, 255))
            return

        wall = (
            key == "tile_forbidden"
            or cell["type"] == "#"
            or (key == "tile_fence_bound" and not cell["walkable"] and not cell["deployable"])
        )
        if wall:
            self.quad(polygon, (91, 106, 117, 255), self.images["wall-top"].texture)
            return

        # Logical highland affects deployment, but every painted top shares one plane.
        if cell.get("height_level", 0) > 0 or cell["type"] == "H":
            self.quad(polygon, (204, 212, 216, 255), self.images["high-top"].texture)
        else:
            self.quad(polygon, (198, 209, 216, 255), self.images[ground].texture)

        portal = key in ("tile_start", "tile_end") or cell["type"] in ("R", "B")
        teleport = "telin" in key or "telout" in key or "teleport" in key
        if not cell["deployable"] and not portal and not teleport:
            corners = ((0.12, 0.12), (0.88, 0.12), (0.88, 0.88), (0.12, 0.88))
            for first, second in zip(corners, (*corners[1:], corners[0])):
                self.surface_line(cell, first, second, (56, 67, 74, 130))
            color = (180, 165, 130, 130)
            for offset in (0, 0.16):
                self.surface_line(cell, (0.12 + offset, 0.88), (0.2 + offset, 0.8), color)

        if teleport:
            entering = "telin" in key or "entrance" in key
            color = (104, 217, 222, 230) if entering else (188, 145, 232, 230)
            for radius in (0.33, 0.25):
                self.ring(cell, radius, color)
            corners = ((0.44, 0.5), (0.5, 0.44), (0.56, 0.5), (0.5, 0.56))
            for first, second in zip(corners, (*corners[1:], corners[0])):
                self.surface_line(cell, first, second, color)
        elif key == "tile_fence_bound":
            # This boundary can accept units even though ground enemies cannot cross.
            for v in (0.12, 0.88):
                self.surface_line(cell, (0.12, v), (0.88, v), (166, 181, 188, 210))
        elif not portal and key not in ("", "tile_road", "tile_wall", "tile_fence", "tile_floor"):
            # A small inlaid mark retains special terrain locations without labels.
            color = (151, 174, 179, 100)
            if any(name in key for name in ("toxic", "infection", "smog", "pollution")):
                color = (137, 170, 130, 150)
            elif "volcano" in key:
                color = (214, 147, 93, 160)
            self.surface_line(cell, (0.2, 0.8), (0.8, 0.8), color)

    def draw_portal(self, cell, nominal_size):
        key = cell.get("source_tile_key", "")
        if key not in ("tile_start", "tile_end") and cell["type"] not in ("R", "B"):
            return
        name = "entrance" if key == "tile_start" or cell["type"] == "R" else "goal"
        width = nominal_size * cell["perspective_scale"] * 0.94
        center_x, bottom = self.point(cell, 0.5, 0.88)
        # Billboards stay upright; their feet sit on the same surface as units.
        self.image(name, [center_x - width / 2, bottom - width, width, width])

    def render(self, layout):
        if layout["canvas"] != {"width": WIDTH, "height": HEIGHT}:
            raise ValueError("Battle maps must use an 800x600 canvas")
        cells = sorted(layout["cells"], key=lambda c: (c["row"], c["column"]))
        self.rectangle([0, 0, WIDTH, HEIGHT], (18, 24, 30, 255))
        board = layout["grid"]["projection"]["board_polygon"]
        top_left, top_right, bottom_right, bottom_left = board
        self.quad([(x + 3, y + 9) for x, y in board], (9, 14, 19, 255))
        self.quad(board, (39, 47, 55, 255))
        # Only the outside rim has thickness. There are no vertical tile faces.
        self.quad([bottom_left, bottom_right, (bottom_right[0], bottom_right[1] + 7),
                   (bottom_left[0], bottom_left[1] + 7)], (40, 49, 57, 255))
        for cell in cells:
            self.draw_cell(cell)
        for first, second in zip(board, (*board[1:], board[0])):
            self.line(first, second, (69, 79, 88, 255))
        for cell in cells:
            self.draw_portal(cell, layout["grid"]["cell_size"][0])


def render_overview(paths, output):
    columns, thumb_width, thumb_height = 6, 160, 120
    width = columns * thumb_width
    height = math.ceil(len(paths) / columns) * thumb_height
    renderer = open_renderer(width, height)
    images = []
    try:
        pico2d.SDL_SetRenderDrawColor(renderer, 18, 24, 30, 255)
        pico2d.SDL_RenderClear(renderer)
        for index, path in enumerate(paths):
            picture = pico2d.load_image(str(path))
            images.append(picture)
            rect = pico2d.SDL_Rect(index % columns * thumb_width, index // columns * thumb_height, thumb_width, thumb_height)
            pico2d.SDL_RenderCopy(renderer, picture.texture, None, rect)
        save_png(renderer, output, width, height)
    finally:
        images.clear()
        pico2d.close_canvas()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=ROOT / ".build/oblique-maps")
    parser.add_argument("--overview", action="store_true", help="Also render an overview.png contact sheet")
    args = parser.parse_args()
    directory = args.directory.resolve()
    layouts = sorted(directory.glob("cave-[0-9]*.json"), key=lambda p: int(p.stem.split("-")[1]))
    if not layouts:
        parser.error(f"No cave-N.json layouts found in {directory}")
    renderer = open_renderer(WIDTH, HEIGHT)
    painter = None
    outputs = []
    try:
        painter = CaveRenderer(renderer)
        for path in layouts:
            layout = json.loads(path.read_text(encoding="utf-8"))
            painter.render(layout)
            output = path.with_suffix(".png")
            save_png(renderer, output)
            outputs.append(output)
        print(f"Rendered {len(outputs)} maps into {directory}")
    finally:
        if painter is not None:
            painter.images.clear()
        pico2d.close_canvas()
    if args.overview:
        render_overview(outputs, directory / "overview.png")
        print(f"Overview: {directory / 'overview.png'}")


if __name__ == "__main__":
    main()
