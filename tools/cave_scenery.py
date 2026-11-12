"""Layout-aware, decorative mine enclosures; never changes gameplay geometry."""


def _point(cell, u, v):
    a, b, c, d = cell["base_polygon"]
    return tuple((1 - v) * ((1 - u) * a[i] + u * b[i])
                 + v * ((1 - u) * d[i] + u * c[i]) for i in (0, 1))


def _cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _hull(points):
    points = sorted(set(tuple(p) for p in points))
    lower, upper = [], []
    for result, sequence in ((lower, points), (upper, reversed(points))):
        for point in sequence:
            while len(result) >= 2 and _cross(result[-2], result[-1], point) <= 0:
                result.pop()
            result.append(point)
    return lower[:-1] + upper[:-1]


def _inside(point, polygon):
    signs = [_cross(a, b, point) for a, b in zip(polygon, (*polygon[1:], polygon[0]))]
    return min(signs) >= -1e-7 or max(signs) <= 1e-7


def _overlap(first, second):
    """Convex polygons overlap only when their intersection has positive area."""
    for polygon in (first, second):
        for a, b in zip(polygon, (*polygon[1:], polygon[0])):
            axis = (a[1] - b[1], b[0] - a[0])
            if abs(axis[0]) + abs(axis[1]) < 1e-8:
                continue
            left = [x * axis[0] + y * axis[1] for x, y in first]
            right = [x * axis[0] + y * axis[1] for x, y in second]
            if max(left) <= min(right) + 1e-7 or max(right) <= min(left) + 1e-7:
                return False
    return True


def _safe(cell):
    return (cell.get("source_tile_key") == "tile_forbidden"
            and cell["tileType"] == 0 and not cell["walkable"])


def _quad(item, polygon, color):
    item["parts"].append({"polygon": polygon, "color": color})


def _line(item, start, end, color):
    item["lines"].append({"start": start, "end": end, "color": color})


def _box(item, base, height, color=(91, 102, 119, 255), cell=None):
    top = [(x, y - height) for x, y in base]
    if cell is not None:
        # At the shared tile boundary the upright face follows that boundary's
        # tiny perspective slant. Adjacent segments then meet without gaps while
        # the complete silhouette stays within the forbidden cell.
        a, b, c, d = cell["base_polygon"]
        aligned = []
        for x, y in top:
            fraction = (y - a[1]) / (d[1] - a[1])
            left = a[0] + (d[0] - a[0]) * fraction
            right = b[0] + (c[0] - b[0]) * fraction
            aligned.append((min(right, max(left, x)), y))
        top = aligned
    for a, b, shade in ((0, 3, (56, 65, 80, 255)),
                         (1, 2, (66, 75, 89, 255)),
                         (3, 2, (76, 84, 99, 255))):
        _quad(item, [top[a], top[b], base[b], base[a]], shade)
    _quad(item, top, color)
    for a, b in zip(top, (*top[1:], top[0])):
        _line(item, a, b, (138, 144, 152, 210))
    _line(item, base[3], base[2], (28, 35, 46, 220))
    return top


def _rectangle(cell, u0, v0, u1, v1):
    return [_point(cell, u, v) for u, v in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]


def _finish(item):
    points = [p for part in item["parts"] for p in part["polygon"]]
    points += [line[key] for line in item["lines"] for key in ("start", "end")]
    if "sprite_rect" in item:
        x, y, width, height = item["sprite_rect"]
        points += [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]
    item["footprint"] = _hull(points)
    return item


def _wall(cell, side, neighbor, nominal):
    item = {"cell": [cell["column"], cell["row"]], "kind": "wall",
            "side": side, "parts": [], "lines": []}
    high_below = side == "south" and neighbor["tileType"] == 2
    limits = {"north": (0, .42, 1, .62),
              "south": (0, .43 if high_below else .76, 1, .64 if high_below else .98),
              "west": (.07, .42, .29, .99),
              "east": (.71, .42, .93, .99)}[side]
    base = _rectangle(cell, *limits)
    height = nominal * cell["perspective_scale"] * .30
    top = _box(item, base, height, (113, 121, 136, 255), cell)
    # A single inset amber strip, kept sparse along each run.
    if side in ("north", "south") and (cell["column"] + cell["row"]) % 3 == 0:
        a, b = base[3], base[2]
        def panel(t, h):
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - height * h)
        _quad(item, [panel(.32, .76), panel(.68, .76), panel(.68, .30), panel(.32, .30)],
              (202, 152, 82, 255))
        _line(item, panel(.37, .55), panel(.63, .55), (255, 218, 142, 255))
    # Selected wall sections include a shallow grated ledge, instead of rubble.
    if side == "north" and (cell["column"] + cell["row"]) % 2 == 0:
        grating = _rectangle(cell, .10, .68, .90, .93)
        _quad(item, grating, (43, 52, 65, 255))
        for fraction in (.18, .34, .50, .66, .82):
            _line(item, _point(cell, fraction, .69), _point(cell, fraction, .92),
                  (91, 101, 114, 220))
        for fraction in (.71, .81, .91):
            _line(item, _point(cell, .11, fraction), _point(cell, .89, fraction),
                  (72, 82, 97, 230))
    if side in ("north", "south") and cell["column"] % 3 == 0:
        # A broad structural pier breaks up a long retaining wall, without
        # scattering a separate post into each tile or crossing the route.
        u0, v0, _, v1 = limits
        pier = _rectangle(cell, u0, v0 + .02, u0 + .15, v1)
        _box(item, pier, height * 1.06, (137, 142, 151, 255), cell)
    return _finish(item)


def _prop(cell, kind, nominal):
    item = {"cell": [cell["column"], cell["row"]], "kind": kind,
            "parts": [], "lines": []}
    scale = cell["perspective_scale"]
    if kind == "utility":
        base = _rectangle(cell, .25, .46, .75, .84)
        top = _box(item, base, nominal * scale * .20, (111, 119, 130, 255))
        left, right = base[3], base[2]
        for fraction in (.07, .11, .15):
            start = (left[0] * .78 + right[0] * .22, left[1] - nominal * scale * fraction)
            end = (left[0] * .22 + right[0] * .78, right[1] - nominal * scale * fraction)
            _line(item, start, end, (235, 185, 106, 255))
    else:
        outer = [_point(cell, u, v) for u, v in ((.13, .48), (.34, .24), (.77, .37),
                                                (.90, .73), (.66, .90), (.20, .83))]
        center = _point(cell, .49, .53)
        colors = ((92, 108, 130, 255), (100, 116, 138, 255), (73, 88, 111, 255),
                  (53, 66, 88, 255), (61, 75, 97, 255), (77, 93, 117, 255))
        for a, b, color in zip(outer, (*outer[1:], outer[0]), colors):
            _quad(item, [a, b, center, center], color)
    # An optional sprite uses this deliberately conservative cell-contained box.
    center = _point(cell, .50, .53)
    width, height = nominal * scale * .86, nominal * scale * .68
    item["sprite"] = kind + ("-2" if (cell["column"] + cell["row"]) % 2 else "")
    item["sprite_rect"] = [center[0] - width / 2, center[1] - height / 2, width, height]
    return _finish(item)


def scenery_plan(layout):
    """Return deterministic, safe decoration geometry without mutating a layout."""
    cells = {(c["column"], c["row"]): c for c in layout["cells"]}
    safe = {pos: cell for pos, cell in cells.items() if _safe(cell)}
    nominal = layout["grid"]["cell_size"][0]
    protected = []
    for cell in cells.values():
        if _safe(cell):
            continue
        protected.extend((cell["base_polygon"], cell["surface_polygon"]))
        protected.extend(face["polygon"] for face in cell.get("vertical_faces", []))
        if cell["type"] in ("R", "B"):
            width = nominal * cell["perspective_scale"] * .94
            top_left, top_right, bottom_right, bottom_left = cell["surface_polygon"]
            x = sum(p[0] for p in (top_left, top_right)) * .06 + sum(p[0] for p in (bottom_left, bottom_right)) * .44
            y = sum(p[1] for p in (top_left, top_right)) * .06 + sum(p[1] for p in (bottom_left, bottom_right)) * .44
            protected.append([(x - width / 2, y - width), (x + width / 2, y - width),
                              (x + width / 2, y), (x - width / 2, y)])

    def valid(item, cell):
        polygon = item["footprint"]
        return (all(_inside(point, cell["base_polygon"]) for point in polygon)
                and not any(_overlap(polygon, other) for other in protected))

    walls, props = [], []
    directions = (("north", 0, -1), ("south", 0, 1), ("west", -1, 0), ("east", 1, 0))
    for (column, row), cell in sorted(safe.items(), key=lambda pair: (pair[0][1], pair[0][0])):
        neighbors = [(side, cells.get((column + dx, row + dy))) for side, dx, dy in directions]
        adjacent = [(side, neighbor) for side, neighbor in neighbors
                    if neighbor is not None and not _safe(neighbor)]
        cell_walls = []
        for side, neighbor in adjacent:
            item = _wall(cell, side, neighbor, nominal)
            if valid(item, cell):
                cell_walls.append(item)
        walls.extend(cell_walls)
        # Leave most dead space calm. Equipment is sparse; larger rock planes link
        # neighboring wall segments where an intact blocked footprint is available.
        choose = (column * 11 + row * 17 + layout["number"]) % 7
        if (not adjacent and choose in (0, 2, 3, 4)) or choose == 0:
            kind = "utility" if choose == 0 else "rock"
            item = _prop(cell, kind, nominal)
            if valid(item, cell) and not any(_overlap(item["footprint"], wall["footprint"]) for wall in cell_walls):
                props.append(item)
    return {"walls": walls, "props": props,
            "counts": {"walls": len(walls), "rocks": sum(p["kind"] == "rock" for p in props),
                       "utilities": sum(p["kind"] == "utility" for p in props)}}


def draw_scenery(painter, layout, plan=None):
    """Draw only on forbidden terrain, before playable floors and portal sprites."""
    plan = scenery_plan(layout) if plan is None else plan
    for item in sorted([*plan["walls"], *plan["props"]], key=lambda d: max(p[1] for p in d["footprint"])):
        if item.get("sprite") in painter.images:
            picture = painter.images[item["sprite"]]
            x, y, width, height = item["sprite_rect"]
            scale = min(width / picture.w, height / picture.h)
            draw_width, draw_height = picture.w * scale, picture.h * scale
            painter.image(item["sprite"], [x + (width - draw_width) / 2,
                                          y + (height - draw_height) / 2,
                                          draw_width, draw_height])
            continue
        for part in item["parts"]:
            painter.quad(part["polygon"], part["color"])
        for line in item["lines"]:
            painter.line(line["start"], line["end"], line["color"])
    return plan["counts"]
