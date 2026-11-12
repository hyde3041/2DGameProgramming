"""Import the public PRTS.Map rogue_4 layouts; output to .build for review."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
import json
import math
from pathlib import Path
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
AREA_URL = "https://map.ark-nights.com/areas/rogue_4"
INDEX_URL = "https://map.ark-nights.com/data/zone_partitions/rogue_4.json"
DATA_URL = "https://map.ark-nights.com/data/levels/"
BACK_SCALE = 0.86
DEPTH_RATIO = 0.82
ELEVATION_RATIO = 0.25


def project_point(column, row, grid):
    """Project a point on the shared flat board, with rows receding from the viewer."""
    projection = grid["projection"]
    depth = row / grid["rows"]
    perspective = 1 / (1 + (1 / projection["back_scale"] - 1) * (1 - depth))
    x = projection["center_x"] + (column - grid["columns"] / 2) * grid["cell_size"][0] * perspective
    y = projection["top"] + projection["height"] * depth * perspective
    return [round(x, 4), round(y, 4)], perspective


def polygon_bounds(points):
    left = math.floor(min(x for x, _ in points))
    top = math.floor(min(y for _, y in points))
    return [left, top, math.ceil(max(x for x, _ in points)) - left,
            math.ceil(max(y for _, y in points)) - top]


def apply_elevation(layout):
    """Raise deployable highland by one uniform world height, preserving logical data."""
    grid = layout["grid"]
    grid["elevation_pixels"] = grid["cell_size"][0] * ELEVATION_RATIO
    canvas_height = layout["canvas"]["height"]
    cells = {(cell["column"], cell["row"]): cell for cell in layout["cells"]}
    for (column, row), cell in cells.items():
        corners = ((column, row), (column + 1, row),
                   (column + 1, row + 1), (column, row + 1))
        projected = [project_point(x, y, grid) for x, y in corners]
        base = [point for point, _ in projected]
        center, perspective = project_point(column + 0.5, row + 0.5, grid)
        elevation = grid["elevation_pixels"] if cell["tileType"] == 2 else 0
        surface = [[point[0], round(point[1] - elevation * scale, 4)]
                   for point, scale in projected]
        surface_center = [center[0], round(center[1] - elevation * perspective, 4)]
        bounds = polygon_bounds(surface)
        left, top, width, height = bounds
        cell.update({
            "base_polygon": base,
            "base_canvas_center": center,
            "pico2d_base_center": [center[0], round(canvas_height - center[1], 4)],
            "base_rect": polygon_bounds(base),
            "surface_polygon": surface,
            "pico2d_surface_polygon": [[x, round(canvas_height - y, 4)] for x, y in surface],
            "surface_rect": bounds,
            "pico2d_surface_rect": [left, canvas_height - top - height, width, height],
            "draw_rect": polygon_bounds([*base, *surface]),
            "canvas_center": surface_center,
            "pico2d_center": [surface_center[0], round(canvas_height - surface_center[1], 4)],
            "visual_elevation": round(elevation * perspective, 4),
            "vertical_faces": [],
        })
    for (column, row), cell in cells.items():
        if cell["tileType"] != 2:
            continue
        for side, neighbor, edge in (
            ("left", (column - 1, row), (0, 3)),
            ("right", (column + 1, row), (1, 2)),
            ("front", (column, row + 1), (3, 2)),
        ):
            if cells.get(neighbor, {}).get("tileType") == 2:
                continue
            first, second = sorted(edge, key=lambda index: tuple(cell["base_polygon"][index]))
            face = [cell["surface_polygon"][first], cell["surface_polygon"][second],
                    cell["base_polygon"][second], cell["base_polygon"][first]]
            area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(face, (*face[1:], face[0])))
            if abs(area) > 1e-7:
                cell["vertical_faces"].append({"side": side, "polygon": face})
    layout["visual_terrain_heights"] = 2
    layout["art_version"] = 9
    return layout


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def download(url, destination):
    with urllib.request.urlopen(url, timeout=45) as response:
        data = response.read()
    json.loads(data)
    destination.write_bytes(data)


def convert_map(number, stage_id, entry, aliases, cache):
    path = cache / "levels" / Path(entry["data_path"]).name
    level = read_json(path)
    data = level["mapData"]
    rows, columns = len(data["map"]), len(data["map"][0])
    assert all(len(row) == columns for row in data["map"])
    size = min(64, 720 // columns, int(400 / (rows * DEPTH_RATIO)))
    height = rows * size * DEPTH_RATIO
    grid = {
        "columns": columns, "rows": rows,
        "cell_size": [size, size], "elevation_pixels": 0,
        "coordinate_system": "row 0 at top, column 0 at left",
        "projection": {
            "type": "oblique_perspective", "back_scale": BACK_SCALE, "depth_ratio": DEPTH_RATIO,
            "center_x": 400, "top": round(310 - height / 2, 4),
            "width": columns * size, "height": round(height, 4),
        },
    }
    grid["projection"]["board_polygon"] = [
        project_point(x, y, grid)[0] for x, y in ((0, 0), (columns, 0), (columns, rows), (0, rows))
    ]
    grid["origin"] = grid["projection"]["board_polygon"][0]
    category = "battle" if stage_id.startswith("ro4_n_") else "boss" if stage_id.startswith("ro4_b_") else "special"
    tier = int(stage_id.split("_")[2]) if category == "battle" else 7 if category == "boss" else 3
    cells, entrances, goals = [], [], []
    disallowed = {(p["col"], rows - 1 - p["row"]) for p in level.get("tilesDisallowToLocate") or []}
    for row, indices in enumerate(data["map"]):
        for column, index in enumerate(indices):
            tile = data["tiles"][index]
            key = tile["tileKey"]
            high = tile["heightType"] == "HIGHLAND"
            buildable = tile["buildableType"] != "NONE" and (column, row) not in disallowed
            walkable = tile["passableMask"] == "ALL"
            kind = "H" if high and buildable else "#" if high else "." if buildable else "_"
            if key in ("tile_start", "tile_flystart"):
                kind = "R"
                entrances.append([column, row])
            elif key == "tile_end":
                kind = "B"
                goals.append([column, row])
            elif key == "tile_hole":
                kind = "~"
            elif key in ("tile_telin", "tile_telout"):
                kind = "T"
            polygon = [project_point(x, y, grid)[0] for x, y in (
                (column, row), (column + 1, row), (column + 1, row + 1), (column, row + 1)
            )]
            center, perspective = project_point(column + 0.5, row + 0.5, grid)
            left = math.floor(min(p[0] for p in polygon))
            top = math.floor(min(p[1] for p in polygon))
            width = math.ceil(max(p[0] for p in polygon)) - left
            cell_height = math.ceil(max(p[1] for p in polygon)) - top
            bounds = [left, top, width, cell_height]
            cells.append({
                "id": f"{column},{row}", "column": column, "row": row,
                "type": kind, "floor": 2 if high else 1, "height_level": int(high),
                "walkable": walkable,
                "tileType": (2 if high else 1) if buildable else 0,
                "visual_elevation": 0, "perspective_scale": round(perspective, 8),
                "base_rect": bounds, "surface_rect": bounds, "draw_rect": bounds,
                "surface_polygon": polygon,
                "pico2d_surface_polygon": [[x, round(600 - y, 4)] for x, y in polygon],
                "canvas_center": center,
                "pico2d_center": [center[0], round(600 - center[1], 4)],
                "pico2d_surface_rect": [left, 600 - top - cell_height, width, cell_height],
                "source_tile_key": key, "source_tile_index": index,
                "buildable_type": tile["buildableType"], "passable_mask": tile["passableMask"],
                "source_blackboard": tile.get("blackboard"),
            })

    def position(point):
        return [point["col"], rows - 1 - point["row"]]

    routes = []
    for index, route in enumerate(level["routes"]):
        if route["motionMode"] == "E_NUM":
            continue
        # Preserve waits and teleport operations, not an invented shortest path.
        checkpoints = []
        for checkpoint in route.get("checkpoints") or []:
            step = {"type": checkpoint["type"], "time": checkpoint["time"]}
            if checkpoint["type"] in ("MOVE", "APPEAR_AT_POS"):
                step["position"] = position(checkpoint["position"])
                step["reach_offset"] = checkpoint.get("reachOffset")
            checkpoints.append(step)
        routes.append({
            "source_index": index, "motion_mode": route["motionMode"],
            "start": position(route["startPosition"]), "end": position(route["endPosition"]),
            "checkpoints": checkpoints, "allow_diagonal_move": route["allowDiagonalMove"],
            "spawn_offset": route["spawnOffset"],
        })
    predefines = []
    for token in (level.get("predefines") or {}).get("tokenInsts", []):
        predefines.append({
            "id": token["inst"]["characterKey"], "position": position(token["position"]),
            "hidden": token["hidden"], "alias": token.get("alias"),
        })
    result = {
        "id": f"cave-{number}", "number": number, "name": stage_id,
        "file": f"asset/map/stage/main/cave/cave-{number}.png",
        "category": category, "tier": tier, "canvas": {"width": 800, "height": 600},
        "grid": grid, "game_grid_calibrated": True, "terrain_heights": 2, "visual_terrain_heights": 1,
        "goal_points": len(goals), "enemy_entrances": len(entrances),
        "entrances": entrances, "goals": goals, "cells": cells, "routes": routes,
        "source_predefines": predefines,
        "coordinates": "top-left row/column for tiles and routes; pico2d fields use bottom-left pixels",
        "shared_tiles": "asset/map/stage/icon/common", "art_version": 8,
        "source": {
            "area": AREA_URL, "stage_id": stage_id,
            "stage_url": f"https://map.ark-nights.com/map/{stage_id}",
            "data_url": DATA_URL + entry["data_path"], "sha256": sha256(path.read_bytes()).hexdigest(),
            "aliases": aliases, "source_route_rows": "bottom-up; converted above to top-down",
            "scope": "static tile topology, placement flags, entrances/goals and route checkpoints",
            "special_mechanics": "recorded as tile keys/predefines; effects and source enemies are not simulated",
        },
    }
    apply_elevation(result)
    manifest_entry = {
        k: result[k] for k in ("id", "number", "name", "file", "category", "tier")
    }
    manifest_entry.update({
        "metadata": f"metadata/map/cave-{number}.json", "columns": columns, "rows": rows,
        "cell_size": [size, size], "source_stage": stage_id,
        "source_url": result["source"]["stage_url"],
    })
    layout = {
        "id": result["id"], "number": number, "source_stage": stage_id,
        "grid": ["".join(cell["type"] for cell in cells[r * columns:(r + 1) * columns]) for r in range(rows)],
    }
    return result, manifest_entry, layout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=ROOT / ".build/rogue4-source")
    parser.add_argument("--output", type=Path, default=ROOT / ".build/raised-maps")
    parser.add_argument("--fetch", action="store_true", help="refresh public source files")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    (args.cache / "levels").mkdir(exist_ok=True)
    args.output.mkdir(parents=True, exist_ok=True)
    if args.fetch:
        download(INDEX_URL, args.cache / "area.json")
    area = read_json(args.cache / "area.json")
    levels = {key: value for zone in area["zones"] for key, value in zone["levels"].items()}
    normal = [(key, value) for key, value in levels.items() if value["difficulty"] == "NORMAL"]
    assert len({v["data_path"] for _, v in normal}) == len(normal)
    if args.fetch:
        def fetch(pair):
            path = pair[1]["data_path"]
            download(DATA_URL + path, args.cache / "levels" / Path(path).name)
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(fetch, normal))
    entries, layouts = [], []
    for number, (stage_id, entry) in enumerate(normal):
        aliases = [key for key, value in levels.items() if value["data_path"] == entry["data_path"]]
        metadata, manifest, layout = convert_map(number, stage_id, entry, aliases, args.cache)
        write_json(args.output / f"cave-{number}.json", metadata)
        entries.append(manifest)
        layouts.append(layout)
    write_json(args.output / "manifest.json", {
        "version": 9, "map_count": len(entries), "canvas": {"width": 800, "height": 600},
        "source_url": AREA_URL, "source_index_url": INDEX_URL,
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "source_entry_count": len(levels), "categories": dict(Counter(e["category"] for e in entries)),
        "creation": "PRTS.Map rogue_4 layouts with the project's cave art, oblique view and single-height raised platforms",
        "projection": {"back_scale": BACK_SCALE, "depth_ratio": DEPTH_RATIO,
                       "elevation_ratio": ELEVATION_RATIO, "visual_terrain_heights": 2},
        "maps": entries,
    })
    write_json(args.output / "layouts.json", {
        "version": 9, "source_url": AREA_URL,
        "legend": {".": "deployable ground", "H": "deployable highland", "#": "blocked highland",
                   "_": "non-deployable lowland", "~": "hole", "R": "entrance", "B": "goal", "T": "teleport"},
        "maps": layouts,
    })
    print(f"Imported {len(entries)} maps: {dict(Counter(e['category'] for e in entries))}")


if __name__ == "__main__":
    main()
