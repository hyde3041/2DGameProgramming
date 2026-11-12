import copy
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from cave_scenery import scenery_plan


def strictly_overlap(first, second):
    """Independent convex SAT check; touching borders do not cover a surface."""
    for polygon in (first, second):
        for a, b in zip(polygon, (*polygon[1:], polygon[0])):
            axis = (a[1] - b[1], b[0] - a[0])
            if abs(axis[0]) + abs(axis[1]) < 1e-9:
                continue
            project = lambda points: [x * axis[0] + y * axis[1] for x, y in points]
            left, right = project(first), project(second)
            if min(max(left), max(right)) - max(min(left), min(right)) <= 1e-6:
                return False
    return True


def inside(point, polygon):
    turns = [
        (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])
        for a, b in zip(polygon, (*polygon[1:], polygon[0]))
    ]
    return min(turns) >= -1e-5 or max(turns) <= 1e-5


def portal_rectangle(cell, size):
    top_left, top_right, bottom_right, bottom_left = cell["surface_polygon"]
    # The runtime's upright portal sits at surface-local (0.5, 0.88).
    center = [
        0.12 * (top_left[i] + top_right[i]) / 2
        + 0.88 * (bottom_left[i] + bottom_right[i]) / 2
        for i in (0, 1)
    ]
    width = size * cell["perspective_scale"] * 0.94
    x, y = center[0] - width / 2, center[1] - width
    return [[x, y], [x + width, y], [x + width, y + width], [x, y + width]]


class CaveSceneryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.layouts = [
            json.loads((ROOT / "metadata/map" / f"cave-{number}.json").read_text(encoding="utf-8"))
            for number in range(78)
        ]
        cls.originals = copy.deepcopy(cls.layouts)
        cls.plans = [scenery_plan(layout) for layout in cls.layouts]

    @staticmethod
    def items(plan):
        return [*plan["walls"], *plan["props"]]

    def test_generation_preserves_every_gameplay_layout_and_is_repeatable(self):
        self.assertEqual(self.layouts, self.originals)
        for layout, plan in zip(self.layouts, self.plans):
            with self.subTest(map=layout["id"]):
                self.assertEqual(scenery_plan(copy.deepcopy(layout)), plan)

    def test_scenery_occupies_only_nonwalkable_forbidden_cells(self):
        for layout, plan in zip(self.layouts, self.plans):
            cells = {(cell["column"], cell["row"]): cell for cell in layout["cells"]}
            for item in self.items(plan):
                with self.subTest(map=layout["id"], cell=item["cell"], kind=item["kind"]):
                    host = cells[tuple(item["cell"])]
                    self.assertEqual(host["source_tile_key"], "tile_forbidden")
                    self.assertEqual(host["tileType"], 0)
                    self.assertFalse(host["walkable"])
                    self.assertGreaterEqual(len(item["footprint"]), 3)
                    for point in item["footprint"]:
                        self.assertTrue(inside(point, host["base_polygon"]), point)
                        self.assertTrue(0 <= point[0] <= 800 and 0 <= point[1] <= 600)

    def test_visible_parts_fit_the_declared_safe_footprint(self):
        for layout, plan in zip(self.layouts, self.plans):
            for item in self.items(plan):
                with self.subTest(map=layout["id"], cell=item["cell"], kind=item["kind"]):
                    points = [point for part in item["parts"] for point in part["polygon"]]
                    points.extend(point for line in item["lines"] for point in (line["start"], line["end"]))
                    if "sprite_rect" in item:
                        x, y, width, height = item["sprite_rect"]
                        points.extend(((x, y), (x + width, y),
                                       (x + width, y + height), (x, y + height)))
                    self.assertTrue(points)
                    for point in points:
                        self.assertTrue(inside(point, item["footprint"]), point)

    def test_paths_highland_faces_special_tiles_and_portals_stay_uncovered(self):
        for layout, plan in zip(self.layouts, self.plans):
            protected = []
            for cell in layout["cells"]:
                safe = (cell["source_tile_key"] == "tile_forbidden"
                        and cell["tileType"] == 0 and not cell["walkable"])
                if not safe:
                    protected.append(cell["surface_polygon"])
                    protected.extend(face["polygon"] for face in cell.get("vertical_faces", []))
                if cell["type"] in ("R", "B") or cell["source_tile_key"] in (
                    "tile_start", "tile_end", "tile_flystart"
                ):
                    protected.append(portal_rectangle(cell, layout["grid"]["cell_size"][0]))
            for item in self.items(plan):
                with self.subTest(map=layout["id"], cell=item["cell"], kind=item["kind"]):
                    for surface in protected:
                        self.assertFalse(strictly_overlap(item["footprint"], surface))

    def test_forbidden_flags_cannot_override_route_or_deployment_rights(self):
        for change in ({"walkable": True}, {"tileType": 1}, {"tileType": 2},
                       {"source_tile_key": "tile_flystart", "type": "R"},
                       {"source_tile_key": "tile_hole", "type": "~"}):
            with self.subTest(change=change):
                layout = copy.deepcopy(self.layouts[4])
                for cell in layout["cells"]:
                    if cell["source_tile_key"] == "tile_forbidden":
                        cell.update(change)
                self.assertEqual(self.items(scenery_plan(layout)), [])

    def test_reference_wide_dense_and_special_maps_receive_surroundings(self):
        for number in (4, 21, 34, 60, 61, 62, 77):
            with self.subTest(map=number):
                self.assertTrue(self.items(self.plans[number]))


if __name__ == "__main__":
    unittest.main()
