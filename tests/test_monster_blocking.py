import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

from character import Player
from monster import Monster, update_monsters


def character(**kwargs):
    values = dict(attackSpeed=1, damage=10, hp=100, cost=5,
                  pos=[1, 0], deployed=True, canStop=1)
    values.update(kwargs)
    return Player(**values)


def monster(*, route=None, teleports=(), **kwargs):
    values = dict(attackSpeed=2, damage=5, hp=50, moveSpeed=1, attackRange=[])
    values.update(kwargs)
    unit = Monster(**values)
    route = [[0, 0], [5, 0]] if route is None else route
    unit.assign_route(route[0], route[-1], route, 0, teleports=teleports)
    return unit


class MonsterBlockingTests(unittest.TestCase):
    def test_capacity_zero_one_and_two_allow_the_excess_to_pass(self):
        for capacity in [0, 1, 2]:
            with self.subTest(capacity=capacity):
                blocker = character(canStop=capacity)
                units = [monster() for _ in range(3)]
                update_monsters(units, [blocker], 1.0)
                held = [unit for unit in units if unit.blockedBy is blocker]
                passing = [unit for unit in units if unit.blockedBy is None]
                self.assertEqual(len(held), capacity)
                self.assertEqual(len(passing), 3 - capacity)
                for unit in held:
                    self.assertEqual(unit.state, "attack")
                    self.assertAlmostEqual(unit.pos[0], 0.55)
                    self.assertEqual(unit.pos[1], 0)
                for unit in passing:
                    self.assertEqual(unit.state, "walk")
                    self.assertEqual(unit.pos, [1.0, 0.0])

    def test_undeployed_dead_and_zero_capacity_characters_do_not_block(self):
        for overrides in [dict(deployed=False), dict(hp=0), dict(hp=-1), dict(canStop=0)]:
            with self.subTest(overrides=overrides):
                unit = monster()
                update_monsters([unit], [character(**overrides)], 2.0)
                self.assertIsNone(unit.blockedBy)
                self.assertEqual(unit.state, "walk")
                self.assertEqual(unit.pos, [2.0, 0.0])

    def test_existing_relationship_wins_after_monster_order_changes(self):
        blocker = character()
        first, passing = monster(), monster()
        update_monsters([first, passing], [blocker], 1.0)
        self.assertIs(first.blockedBy, blocker)
        update_monsters([passing, first], [blocker], 1.25)
        self.assertIs(first.blockedBy, blocker)
        self.assertIsNone(passing.blockedBy)
        self.assertAlmostEqual(first.pos[0], 0.55)
        self.assertEqual(passing.pos, [1.25, 0.0])

    def test_identical_characters_have_independent_slots_and_stable_identity(self):
        first_blocker, second_blocker = character(), character()
        first, second = monster(), monster()
        update_monsters([first, second], [first_blocker, second_blocker], 1.0)
        self.assertEqual({id(first.blockedBy), id(second.blockedBy)},
                         {id(first_blocker), id(second_blocker)})
        owners = [first.blockedBy, second.blockedBy]
        update_monsters([second, first], [second_blocker, first_blocker], 1.25)
        self.assertIs(first.blockedBy, owners[0])
        self.assertIs(second.blockedBy, owners[1])

    def test_removing_a_character_does_not_preserve_an_equal_objects_relationship(self):
        original, replacement = character(), character()
        unit = monster()
        update_monsters([unit], [original], 1.0)
        self.assertIs(unit.blockedBy, original)
        update_monsters([unit], [replacement], 1.0)
        self.assertIs(unit.blockedBy, replacement)

    def test_defeated_or_arrived_monster_releases_slot_for_another_monster(self):
        for change in ["death", "arrival"]:
            with self.subTest(change=change):
                blocker = character()
                first, second = monster(), monster()
                update_monsters([first, second], [blocker], 1.0)
                if change == "death":
                    first.hp = 0
                else:
                    first.reachedGoal = True
                update_monsters([second, first], [blocker], 1.0)
                self.assertIsNone(first.blockedBy)
                self.assertEqual(first.state, "walk")
                self.assertIs(second.blockedBy, blocker)
                self.assertEqual(second.state, "attack")

    def test_released_monster_resumes_route_without_accumulating_stopped_time(self):
        for reason in ["death", "withdrawal", "removal", "movement", "capacity"]:
            with self.subTest(reason=reason):
                blocker = character()
                unit = monster()
                update_monsters([unit], [blocker], 1.0)
                stopped_at = unit.pos.copy()
                original_route = [point.copy() for point in unit.route]
                update_monsters([unit], [blocker], 10.0)
                self.assertEqual(unit.pos, stopped_at)

                blockers = [blocker]
                if reason == "death":
                    blocker.hp = 0
                elif reason == "withdrawal":
                    blocker.deployed = False
                elif reason == "removal":
                    blockers = []
                elif reason == "movement":
                    blocker.pos = [5, 0]
                else:
                    blocker.canStop = 0
                update_monsters([unit], blockers, 20.0)
                self.assertIsNone(unit.blockedBy)
                self.assertEqual(unit.state, "walk")
                self.assertEqual(unit.pos, stopped_at)
                update_monsters([unit], blockers, 20.25)
                self.assertAlmostEqual(unit.pos[0], stopped_at[0] + 0.25)
                self.assertEqual(unit.route, original_route)
                self.assertEqual(unit.routeIndex, 1)
                self.assertFalse(unit.reachedGoal)

    def test_lowering_capacity_releases_only_excess_existing_monsters(self):
        blocker = character(canStop=2)
        units = [monster(), monster()]
        update_monsters(units, [blocker], 1.0)
        blocker.canStop = 1
        update_monsters(units, [blocker], 2.0)
        held = [unit for unit in units if unit.blockedBy is blocker]
        released = [unit for unit in units if unit.blockedBy is None]
        self.assertEqual(len(held), 1)
        self.assertEqual(len(released), 1)
        self.assertEqual(released[0].state, "walk")
        update_monsters(units, [blocker], 2.25)
        self.assertAlmostEqual(held[0].pos[0], 0.55)
        self.assertAlmostEqual(released[0].pos[0], 0.8)

    def test_large_step_cannot_skip_the_first_blocker(self):
        unit = monster(route=[[0, 0], [10, 0]])
        near = character(pos=[4, 0])
        far = character(pos=[7, 0])
        unit.update(100.0, blockers=[far, near])
        self.assertIs(unit.blockedBy, near)
        self.assertAlmostEqual(unit.pos[0], 3.55)
        self.assertEqual(unit.pos[1], 0)
        self.assertEqual(unit.state, "attack")
        self.assertFalse(unit.reachedGoal)

    def test_swept_contact_follows_each_route_segment_around_corners(self):
        route = [[0, 0], [2, 0], [2, 3]]
        unit = monster(route=route)
        off_route = character(pos=[1, 1])
        on_route = character(pos=[2, 2])
        update_monsters([unit], [off_route, on_route], 10.0)
        self.assertIs(unit.blockedBy, on_route)
        self.assertEqual(unit.pos[0], 2)
        self.assertAlmostEqual(unit.pos[1], 1.55)
        self.assertEqual(unit.routeIndex, 2)
        self.assertEqual(unit.route, route)

    def test_block_contact_uses_a_square_including_its_corner(self):
        unit = monster(route=[[0, 0], [2, 2]])
        blocker = character(pos=[1, 1])
        update_monsters([unit], [blocker], 10.0)
        self.assertIs(unit.blockedBy, blocker)
        self.assertAlmostEqual(unit.pos[0], 0.55)
        self.assertAlmostEqual(unit.pos[1], 0.55)

    def test_teleport_ignores_intermediate_characters_but_checks_destination(self):
        route = [[0, 0], [4, 0], [8, 0]]
        middle = character(pos=[2, 0])
        unit = monster(route=route, teleports=[1])
        update_monsters([unit], [middle], 0.0)
        self.assertIsNone(unit.blockedBy)
        self.assertEqual(unit.pos, [4, 0])
        update_monsters([unit], [middle], 1.0)
        self.assertEqual(unit.pos, [5.0, 0.0])

        unit = monster(route=route, teleports=[1])
        destination = character(pos=[4, 0])
        update_monsters([unit], [middle, destination], 0.0)
        self.assertIs(unit.blockedBy, destination)
        self.assertEqual(unit.pos, [4, 0])
        self.assertEqual(unit.state, "attack")

    def test_reset_or_new_route_clears_block_relationship(self):
        for operation in ["reset", "route"]:
            with self.subTest(operation=operation):
                unit = monster()
                blocker = character()
                update_monsters([unit], [blocker], 1.0)
                if operation == "reset":
                    unit.reset_animation(2.0)
                else:
                    unit.assign_route([3, 0], [5, 0], [[3, 0], [5, 0]], 2.0)
                self.assertIsNone(unit.blockedBy)
                self.assertEqual(unit.state, "walk")

    def test_blocked_attack_frames_advance_pause_and_slow_on_shared_time(self):
        blocker = character()
        unit = monster(attackSpeed=2)
        update_monsters([unit], [blocker], 1.0)
        stopped_at = unit.pos.copy()
        for now, frame in [(1.0, 0), (1.125, 4), (1.125, 4), (1.1875, 6), (1.25, 8), (1.5, 0)]:
            with self.subTest(now=now):
                update_monsters([unit], [blocker], now)
                self.assertIs(unit.blockedBy, blocker)
                self.assertEqual(unit.state, "attack")
                self.assertEqual(unit.pos, stopped_at)
                self.assertEqual(unit.motion_frame(16, 16), frame)


if __name__ == "__main__":
    unittest.main()
