import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

import map as dungeon


def cell(rect, *, elevation=0, faces=()):
    left, top, width, height = rect
    return {
        "surface_rect": rect,
        "surface_polygon": [[left, top], [left + width, top],
                            [left + width, top + height], [left, top + height]],
        "visual_elevation": elevation,
        "vertical_faces": [{"side": "front", "polygon": polygon} for polygon in faces],
    }


class RaisedTilePickingTests(unittest.TestCase):
    def setUp(self):
        # Raised top overlaps the back row; its front face covers its own base.
        self.cells = {
            (0, 0): cell([0, 0, 40, 40]),
            (0, -1): cell([0, 25, 40, 40], elevation=15,
                          faces=[[[0, 65], [40, 65], [40, 80], [0, 80]]]),
            (1, -1): cell([40, 40, 40, 40]),
            (0, -2): cell([0, 80, 40, 40]),
        }
        self.cells_patch = patch.object(dungeon, "battle_cells", self.cells)
        self.cells_patch.start()
        self.addCleanup(self.cells_patch.stop)

    def test_raised_top_wins_over_lower_background(self):
        self.assertEqual(dungeon.cell_at(20, 30), (0, -1))
        self.assertEqual(dungeon.cell_at(20, 50), (0, -1))

    def test_visible_front_face_cannot_select_hidden_ground(self):
        # Add a lower cell deliberately under the face to exercise occlusion.
        self.cells[(1, -1)] = cell([0, 40, 80, 40])
        self.assertIsNone(dungeon.cell_at(20, 72))
        self.assertEqual(dungeon.cell_at(20, 65), (0, -1))

    def test_uncovered_flat_tiles_remain_selectable(self):
        self.assertEqual(dungeon.cell_at(20, 10), (0, 0))
        self.assertEqual(dungeon.cell_at(60, 60), (1, -1))
        self.assertEqual(dungeon.cell_at(20, 100), (0, -2))
        self.assertIsNone(dungeon.cell_at(-1, 50))
        self.assertIsNone(dungeon.cell_at(81, 80))

    def test_front_raised_face_occludes_back_raised_top(self):
        self.cells[(0, -2)] = cell([0, 45, 40, 10], elevation=15,
                                  faces=[[[0, 55], [40, 55], [40, 70], [0, 70]]])
        self.assertEqual(dungeon.cell_at(20, 50), (0, -2))
        self.assertIsNone(dungeon.cell_at(20, 60))

    def test_shared_top_edge_uses_front_right_order(self):
        self.cells[(1, -1)] = cell([40, 25, 40, 40], elevation=15)
        self.assertEqual(dungeon.cell_at(40, 45), (1, -1))

    def test_edge_on_face_has_no_click_area(self):
        self.cells[(0, -1)]["vertical_faces"] = [
            {"side": "left", "polygon": [[40, 65], [40, 80], [40, 90], [40, 75]]}
        ]
        self.assertEqual(dungeon.cell_at(40, 75), (1, -1))

    def test_flat_legacy_cells_and_bounding_box_corners(self):
        self.cells.clear()
        self.cells.update({
            (0, 0): {"surface_rect": [0, 0, 40, 40]},
            (1, 0): {"surface_rect": [40, 0, 40, 40],
                     "surface_polygon": [[45, 0], [75, 0], [80, 40], [40, 40]]},
        })
        self.assertEqual(dungeon.cell_at(20, 20), (0, 0))
        self.assertEqual(dungeon.cell_at(60, 20), (1, 0))
        self.assertIsNone(dungeon.cell_at(41, 1))
        self.assertIsNone(dungeon.cell_at(20, 40))


if __name__ == "__main__":
    unittest.main()
