import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

import map as dungeon


class MonsterRouteTests(unittest.TestCase):
    def setUp(self):
        for name, value in (
            ("battle_cells", {}), ("battle_grid", {}), ("battle_entrances", []),
            ("battle_goals", []), ("_monster_routes", {}), ("_monster_portals", {}),
            ("dungeon_map", None), ("map_type", dungeon.MapType.START), ("map_index", 0),
        ):
            patcher = patch.object(dungeon, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def terrain(self, walkable, goals, entrances=()):
        dungeon.battle_cells.update({pos: {"walkable": True, "tileType": 0} for pos in walkable})
        dungeon.battle_goals[:] = goals
        dungeon.battle_entrances[:] = entrances

    def test_nearest_means_traversable_distance_not_straight_distance(self):
        self.terrain(
            [(0, 0), (0, -1), (0, -2), (0, -3), (1, -3), (2, -3), (2, -2), (2, -1), (2, 0)],
            [(2, 0), (0, -3)],
        )
        dungeon.battle_cells[(1, 0)] = {"walkable": False, "tileType": 1}
        start, goal, route = dungeon.monster_route((0, 0))
        self.assertEqual(start, (0, 0))
        self.assertEqual(goal, (0, -3))
        self.assertEqual(route, [(0, 0), (0, -1), (0, -2), (0, -3)])

    def test_unreachable_spawn_does_not_cross_wall_or_use_deployment_type(self):
        self.terrain([(0, 0), (2, 0)], [(2, 0)], [(0, 0)])
        dungeon.battle_cells[(1, 0)] = {"walkable": False, "tileType": 1}
        self.assertIsNone(dungeon.monster_route((0, 0)))
        self.assertIsNone(dungeon.monster_route((1, 0)))
        self.assertIsNone(dungeon.monster_route((99, 0)))
        self.assertEqual(dungeon.monster_spawns(), [])
        self.assertIsNone(dungeon.monster_route())

    def test_each_monster_receives_a_copy_of_the_cached_fixed_route(self):
        self.terrain([(0, 0), (1, 0), (2, 0)], [(2, 0)], [(0, 0)])
        first = dungeon.monster_route((0, 0))
        first[2].clear()
        dungeon.battle_cells[(1, 0)]["walkable"] = False
        second = dungeon.monster_route((0, 0))
        self.assertEqual(second[2], [(0, 0), (1, 0), (2, 0)])
        self.assertIsNot(first[2], second[2])

    def test_default_spawn_uses_only_reachable_entrances(self):
        self.terrain([(0, 0), (1, 0), (2, 0), (5, 0)], [(2, 0)], [(5, 0), (0, 0)])
        self.assertEqual(dungeon.monster_spawns(), [(0, 0)])
        self.assertEqual(dungeon.monster_route()[0], (0, 0))

    def test_recorded_portal_is_a_jump_and_counts_no_walking_distance(self):
        self.terrain([(0, 0), (1, 0), (0, -1), (0, -2), (0, -3), (9, 0), (10, 0)],
                     [(0, -3), (10, 0)], [(0, 0)])
        dungeon._monster_portals[(1, 0)] = {(9, 0)}
        start, goal, route = dungeon.monster_route((0, 0))
        self.assertEqual(goal, (10, 0))
        self.assertEqual(route, [(0, 0), (1, 0), (9, 0), (10, 0)])
        self.assertEqual(dungeon.monster_teleports(route), {2})
        self.assertEqual(dungeon.monster_teleports(list(reversed(route))), set())

    def test_factory_passes_independent_fixed_plan_to_each_monster(self):
        self.terrain([(0, 0), (1, 0), (9, 0), (10, 0)], [(10, 0)], [(0, 0)])
        dungeon._monster_portals[(1, 0)] = {(9, 0)}
        first = dungeon.spawn_monster("goblin-scout", now=5)
        second = dungeon.spawn_monster("armored-skeleton", now=5)
        self.assertEqual(first.pos, [0, 0])
        self.assertEqual(first.goalPos, [10, 0])
        self.assertEqual(first.teleports, {2})
        first.route.clear()
        self.assertEqual(len(second.route), 4)
        self.assertEqual(len(dungeon.monster_route((0, 0))[2]), 4)
        self.assertIsNone(dungeon.spawn_monster("goblin-scout", (99, 99), now=5))

    def test_load_converts_row_coordinates_and_clear_discards_old_routes(self):
        layout = {
            "grid": {"columns": 3, "rows": 2},
            "cells": [{"column": x, "row": 1, "walkable": True, "tileType": 0} for x in range(3)],
            "entrances": [[0, 1]], "goals": [[2, 1]],
        }
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "game").mkdir()
            (root / "layout.json").write_text(json.dumps(layout), encoding="utf-8")
            with patch.object(dungeon, "GAME_DIRECTORY", root / "game"), patch.object(
                dungeon, "MAP_MANIFEST", {0: {"file": "map.png", "metadata": "layout.json"}}
            ), patch.object(dungeon, "load_image", return_value=object()):
                dungeon.load_map(0)
                self.assertEqual(dungeon.battle_entrances, [(0, -1)])
                self.assertEqual(dungeon.battle_goals, [(2, -1)])
                self.assertEqual(dungeon.monster_route((0, -1))[2], [(0, -1), (1, -1), (2, -1)])
                self.assertIn((0, -1), dungeon._monster_routes)
                dungeon.clear_map()
                self.assertEqual(dungeon.battle_entrances, [])
                self.assertEqual(dungeon.battle_goals, [])
                self.assertEqual(dungeon._monster_routes, {})
                self.assertEqual(dungeon._monster_portals, {})
                self.assertIsNone(dungeon.monster_route())
                layout["cells"][1]["walkable"] = False
                (root / "layout.json").write_text(json.dumps(layout), encoding="utf-8")
                dungeon.load_map(0)
                self.assertIsNone(dungeon.monster_route((0, -1)))

    def test_load_extracts_only_recorded_walk_portals_and_fallback_starts(self):
        layout = {
            "grid": {"columns": 6, "rows": 2},
            "cells": [{"column": x, "row": 1, "walkable": True, "tileType": 0} for x in (0, 1, 4, 5)],
            "entrances": [], "goals": [[5, 1]],
            "routes": [
                {"motion_mode": "WALK", "start": [0, 1], "end": [5, 1], "checkpoints": [
                    {"type": "MOVE", "position": [1, 1]}, {"type": "DISAPPEAR"},
                    {"type": "WAIT_FOR_SECONDS", "time": 3}, {"type": "APPEAR_AT_POS", "position": [4, 1]},
                ]},
                {"motion_mode": "FLY", "start": [5, 1], "end": [0, 1], "checkpoints": [
                    {"type": "DISAPPEAR"}, {"type": "APPEAR_AT_POS", "position": [0, 1]},
                ]},
            ],
        }
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "game").mkdir()
            (root / "layout.json").write_text(json.dumps(layout), encoding="utf-8")
            with patch.object(dungeon, "GAME_DIRECTORY", root / "game"), patch.object(
                dungeon, "MAP_MANIFEST", {0: {"file": "map.png", "metadata": "layout.json"}}
            ), patch.object(dungeon, "load_image", return_value=object()):
                dungeon.load_map(0)
        self.assertEqual(dungeon.battle_entrances, [(0, -1)])
        self.assertEqual(dungeon._monster_portals, {(1, -1): {(4, -1)}})
        self.assertEqual(dungeon.monster_route((0, -1))[2], [(0, -1), (1, -1), (4, -1), (5, -1)])


if __name__ == "__main__":
    unittest.main()
