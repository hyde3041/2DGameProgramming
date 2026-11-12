import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

from monster import Monster


def monster(route=None, **kwargs):
    kwargs.setdefault("moveSpeed", 1.0)  # Explicit speed for route-algorithm tests.
    unit = Monster(attackSpeed=1, damage=5, hp=50, **kwargs)
    if route is not None:
        unit.assign_route(route[0], route[-1], route, 0.0)
    return unit


class MonsterMovementTests(unittest.TestCase):
    def test_default_speed_is_slower_and_remains_per_monster(self):
        normal = Monster(attackSpeed=1, damage=5, hp=50)
        faster = Monster(attackSpeed=1, damage=5, hp=50, moveSpeed=1.2)
        for unit in (normal, faster):
            unit.assign_route([0, 0], [3, 0], [[0, 0], [3, 0]], 0)
            unit.update(1)
        self.assertAlmostEqual(normal.pos[0], 0.6)
        self.assertAlmostEqual(faster.pos[0], 1.2)
        faster.moveSpeed = 2
        self.assertEqual(normal.moveSpeed, 0.6)

    def test_large_delta_follows_corners_and_clamps_at_goal(self):
        unit = monster([[0, 0], [2, 0], [2, -2], [4, -2]])
        unit.update(3)
        self.assertEqual(unit.pos, [2, -1])
        self.assertEqual(unit.routeIndex, 2)
        self.assertFalse(unit.reachedGoal)
        unit.update(100)
        self.assertEqual(unit.pos, [4, -2])
        self.assertEqual(unit.routeIndex, 4)
        self.assertTrue(unit.reachedGoal)
        unit.update(200)
        self.assertEqual(unit.pos, [4, -2])

    def test_substeps_and_one_large_update_cover_same_distance(self):
        route = [[0, 0], [2, 0], [2, -3], [-4, -3]]
        whole, stepped = monster(route, moveSpeed=1.3), monster(route, moveSpeed=1.3)
        whole.update(6)
        for tick in range(1, 49):
            stepped.update(tick / 8)
        for actual, expected in zip(stepped.pos, whole.pos):
            self.assertAlmostEqual(actual, expected)
        self.assertEqual(stepped.routeIndex, whole.routeIndex)
        self.assertEqual(whole.direction, "left")

    def test_shared_time_pause_and_rewind_do_not_accumulate_movement(self):
        unit = monster([[0, 0], [10, 0]])
        unit.update(0.5)
        unit.update(0.5)
        self.assertEqual(unit.pos, [0.5, 0])
        unit.update(0)
        self.assertEqual(unit.pos, [0.5, 0])
        unit.update(0.5)
        self.assertEqual(unit.pos, [1, 0])
        unit.moveSpeed = 0
        unit.update(5)
        unit.moveSpeed = 1
        unit.update(5.5)
        self.assertEqual(unit.pos, [1.5, 0])
        unit.hp = 0
        unit.update(10)
        unit.hp = 50
        unit.update(10.5)
        self.assertEqual(unit.pos, [2, 0])

    def test_attack_stops_movement_and_resume_excludes_attack_time(self):
        unit = monster([[0, 0], [10, 0]])
        unit.update(1)
        unit.set_state("attack", now=1)
        unit.update(4)
        self.assertEqual(unit.pos, [1, 0])
        unit.set_state("walk", now=8)
        unit.update(8.5)
        self.assertEqual(unit.pos, [1.5, 0])

    def test_vertical_movement_keeps_last_side_facing(self):
        unit = monster([[0, 0], [-1, 0], [-1, -3]])
        unit.update(1.5)
        self.assertEqual(unit.direction, "left")
        unit.update(2)
        self.assertEqual(unit.direction, "left")

    def test_map_and_monsters_do_not_share_mutable_route_points(self):
        route = [[0, 0], [1, 0], [1, -1]]
        first, second = monster(route), monster(route)
        route[1][0] = 99
        first.route[1][0] = 2
        first.pos[0] = 10
        self.assertEqual(second.route, [[0, 0], [1, 0], [1, -1]])
        self.assertEqual(first.spawnPos, [0, 0])
        self.assertEqual(second.pos, [0, 0])

    def test_empty_and_inconsistent_paths_fail_before_mutating_monster(self):
        unit = monster([[0, 0], [1, 0]])
        for route in ([], [[2, 0], [1, 0]], [[0, 0], [2, 0]], [[0, 0], [float("nan"), 0], [1, 0]]):
            with self.subTest(route=route), self.assertRaises(ValueError):
                unit.assign_route([0, 0], [1, 0], route, 10)
            self.assertEqual(unit.pos, [0, 0])
            self.assertEqual(unit.route, [[0, 0], [1, 0]])
            self.assertEqual(unit.routeIndex, 1)

    def test_unassigned_and_duplicate_point_paths_are_safe(self):
        unit = monster()
        unit.update(100)
        self.assertEqual(unit.pos, [0, 0])
        self.assertFalse(unit.reachedGoal)
        unit.assign_route([2, -1], [2, -1], [[2, -1], [2, -1]], 100)
        unit.update(100)
        self.assertEqual(unit.pos, [2, -1])
        self.assertTrue(unit.reachedGoal)

    def test_recorded_teleport_skips_gap_without_walking_through_it(self):
        unit = monster()
        route = [[0, 0], [1, 0], [9, 0], [9, -1]]
        unit.assign_route(route[0], route[-1], route, 0, teleports={2})
        unit.update(0.5)
        self.assertEqual(unit.pos, [0.5, 0])
        unit.update(1)
        self.assertEqual(unit.pos, [9, 0])
        self.assertEqual(unit.routeIndex, 3)
        self.assertFalse(unit.reachedGoal)
        unit.update(1.5)
        self.assertEqual(unit.pos, [9, -0.5])
        unit.update(100)
        self.assertEqual(unit.pos, [9, -1])
        self.assertTrue(unit.reachedGoal)

    def test_teleport_only_goal_finishes_at_zero_elapsed_time(self):
        unit = monster()
        unit.assign_route([0, 0], [10, -10], [[0, 0], [10, -10]], 5, teleports=[1])
        unit.update(5)
        self.assertEqual(unit.pos, [10, -10])
        self.assertTrue(unit.reachedGoal)
        unit.update(100)
        self.assertEqual(unit.pos, [10, -10])

    def test_teleports_wait_while_attacking_dead_or_stationary(self):
        for reason in ("attack", "dead", "stationary"):
            with self.subTest(reason=reason):
                unit = monster()
                unit.assign_route([0, 0], [10, 0], [[0, 0], [10, 0]], 0, teleports=[1])
                if reason == "attack":
                    unit.set_state("attack", now=0)
                elif reason == "dead":
                    unit.hp = 0
                else:
                    unit.moveSpeed = 0
                unit.update(10)
                self.assertEqual(unit.pos, [0, 0])
                self.assertFalse(unit.reachedGoal)
                unit.set_state("walk", now=10)
                unit.hp = 50
                unit.moveSpeed = 1
                unit.update(10)
                self.assertEqual(unit.pos, [10, 0])
                self.assertTrue(unit.reachedGoal)

    def test_teleport_indices_are_copied_and_validated_before_assignment(self):
        unit = monster()
        route = [[0, 0], [2, 0], [3, 0]]
        indices = {1}
        unit.assign_route(route[0], route[-1], route, 0, teleports=indices)
        indices.add(2)
        self.assertEqual(unit.teleports, {1})
        for invalid in ({0}, {3}, {-1}, {1.5}, {True}):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                unit.assign_route(route[0], route[-1], route, 10, teleports=invalid)
            self.assertEqual(unit.teleports, {1})
            self.assertEqual(unit.pos, [0, 0])
        unit.assign_route(route[0], route[-1], route, 10)
        self.assertEqual(unit.teleports, set())


if __name__ == "__main__":
    unittest.main()
