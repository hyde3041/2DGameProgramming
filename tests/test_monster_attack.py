import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

from character import Player
from monster import Monster, update_monsters


def character(**kwargs):
    values = dict(attackSpeed=1, damage=10, hp=100, cost=5,
                  pos=[1, 0], deployed=True, canStop=0)
    values.update(kwargs)
    return Player(**values)


def monster(**kwargs):
    values = dict(attackSpeed=1, damage=5, hp=50, moveSpeed=1)
    values.update(kwargs)
    unit = Monster(**values)
    unit.assign_route([0, 0], [10, 0], [[0, 0], [10, 0]], 0)
    return unit


class MonsterAttackTests(unittest.TestCase):
    def test_attack_range_anchors_fractional_positions_and_rotates_in_four_directions(self):
        unit = monster(attackRange=[[0, 0], [0, -1], [1, -2]])
        unit.pos = [4.49, -3.49]
        expected = {
            "down": {(4, -3), (4, -4), (5, -5)},
            "up": {(4, -3), (4, -2), (3, -1)},
            "right": {(4, -3), (5, -3), (6, -2)},
            "left": {(4, -3), (3, -3), (2, -4)},
        }
        for direction, cells in expected.items():
            with self.subTest(direction=direction):
                unit.direction = direction
                self.assertEqual(unit.attack_cells(), cells)
        unit.attackRange = [[0, 0]]
        for pos, cell in [([0.4999, -0.5], (0, 0)), ([0.5, -0.5001], (1, -1))]:
            unit.pos = pos
            self.assertEqual(unit.attack_cells(), {cell})

    def test_only_living_deployed_people_in_range_trigger_attack(self):
        for reason in ["undeployed", "dead", "monster", "outside"]:
            with self.subTest(reason=reason):
                unit = monster()
                target = character()
                if reason == "undeployed":
                    target.deployed = False
                elif reason == "dead":
                    target.hp = 0
                elif reason == "monster":
                    target.race = "monster"
                else:
                    target.pos = [-1, 0]
                unit.try_attack([target], now=0)
                self.assertEqual(unit.state, "walk")
                unit.try_attack([target, character()], now=0)
                self.assertEqual(unit.state, "attack")

        for reason in ["dead", "arrived", "blocked", "zero_speed", "negative_speed"]:
            with self.subTest(monster_status=reason):
                unit = monster()
                if reason == "dead":
                    unit.hp = 0
                elif reason == "arrived":
                    unit.reachedGoal = True
                elif reason == "blocked":
                    unit.blockedBy = character(canStop=1)
                else:
                    unit.attackSpeed = 0 if reason == "zero_speed" else -1
                unit.try_attack([character()], now=0)
                self.assertEqual(unit.state, "walk")

    def test_attack_ends_then_walks_for_delay_before_starting_again(self):
        unit = monster()
        target = character()
        self.assertEqual(unit.attackDelay, 1.0)
        for now, state, x in [
            (0.0, "attack", 0.0),
            (0.5, "attack", 0.0),
            (1.0, "walk", 0.0),
            (1.25, "walk", 0.25),
            (1.75, "walk", 0.75),
            (2.0, "attack", 1.0),
            (2.5, "attack", 1.0),
            (3.0, "walk", 1.0),
        ]:
            with self.subTest(now=now):
                update_monsters([unit], [target], now)
                self.assertEqual(unit.state, state)
                self.assertAlmostEqual(unit.pos[0], x)
                self.assertIsNone(unit.blockedBy)

    def test_attack_speed_sets_duration_and_only_time_after_its_end_moves(self):
        for speed, duration in [(0.5, 2.0), (1.0, 1.0), (2.0, 0.5)]:
            with self.subTest(speed=speed):
                unit = monster(attackSpeed=speed, attackDelay=0.5)
                target = character()
                unit.try_attack([target], now=0)
                unit.update(duration / 2)
                self.assertEqual(unit.state, "attack")
                self.assertEqual(unit.motion_frame(16, 16), 8)
                self.assertEqual(unit.pos, [0, 0])
                unit.update(duration + 0.25)
                self.assertEqual(unit.state, "walk")
                self.assertAlmostEqual(unit.pos[0], 0.25)
                unit.try_attack([target], now=duration + 0.25)
                self.assertEqual(unit.state, "walk")
                unit.update(duration + 0.5)
                unit.try_attack([target], now=duration + 0.5)
                self.assertEqual(unit.state, "attack")
                self.assertEqual(unit.motion_frame(16, 16), 0)
                self.assertAlmostEqual(unit.pos[0], 0.5)

    def test_lost_target_does_not_interrupt_the_current_attack_or_restart_it(self):
        for reason in ["death", "outside", "withdrawal"]:
            with self.subTest(reason=reason):
                unit = monster()
                target = character()
                update_monsters([unit], [target], 0.0)
                if reason == "death":
                    target.hp = 0
                elif reason == "outside":
                    target.pos = [8, 0]
                else:
                    target.deployed = False
                update_monsters([unit], [target], 0.5)
                self.assertEqual(unit.state, "attack")
                self.assertEqual(unit.motion_frame(16, 16), 8)
                self.assertEqual(unit.pos, [0, 0])
                update_monsters([unit], [target], 1.25)
                self.assertEqual(unit.state, "walk")
                self.assertAlmostEqual(unit.pos[0], 0.25)
                update_monsters([unit], [target], 2.0)
                self.assertEqual(unit.state, "walk")
                self.assertAlmostEqual(unit.pos[0], 1.0)

    def test_targets_outside_the_ground_blocker_list_can_still_be_attacked(self):
        unit = monster()
        elevated_target = character(pos=[0, 0], canStop=1, allowedTiles=[2])
        update_monsters([unit], [elevated_target], 0.0, blockers=[])
        self.assertEqual(unit.state, "attack")
        self.assertIsNone(unit.blockedBy)
        update_monsters([unit], [elevated_target], 1.25, blockers=[])
        self.assertEqual(unit.state, "walk")
        self.assertAlmostEqual(unit.pos[0], 0.25)
        self.assertIsNone(unit.blockedBy)

    def test_blocking_during_cooldown_ignores_delay_and_release_waits_again(self):
        unit = monster(attackRange=[[0, 0], [0, -1], [0, 1]])
        target = character(canStop=1)
        update_monsters([unit], [target], 0.0, blockers=[])
        update_monsters([unit], [target], 1.25, blockers=[])
        self.assertEqual(unit.state, "walk")
        update_monsters([unit], [target], 1.75)
        self.assertIs(unit.blockedBy, target)
        self.assertEqual(unit.state, "attack")
        stopped_at = unit.pos.copy()
        update_monsters([unit], [target], 4.0)
        self.assertIs(unit.blockedBy, target)
        self.assertEqual(unit.state, "attack")
        self.assertEqual(unit.pos, stopped_at)

        update_monsters([unit], [target], 5.0, blockers=[])
        self.assertIsNone(unit.blockedBy)
        self.assertEqual(unit.state, "walk")
        self.assertEqual(unit.pos, stopped_at)
        update_monsters([unit], [target], 5.25, blockers=[])
        self.assertEqual(unit.state, "walk")
        self.assertAlmostEqual(unit.pos[0], stopped_at[0] + 0.25)
        update_monsters([unit], [target], 6.0, blockers=[])
        self.assertEqual(unit.state, "attack")
        self.assertIsNone(unit.blockedBy)

    def test_contact_during_free_attack_changes_to_continuous_blocked_attack(self):
        unit = monster()
        target = character()
        update_monsters([unit], [target], 0.0)
        blocker = character(pos=[0, 0], canStop=1)
        update_monsters([unit], [target, blocker], 0.25, blockers=[blocker])
        self.assertIs(unit.blockedBy, blocker)
        update_monsters([unit], [target, blocker], 2.0, blockers=[blocker])
        self.assertIs(unit.blockedBy, blocker)
        self.assertEqual(unit.state, "attack")
        self.assertEqual(unit.pos, [0, 0])

    def test_shared_time_pause_and_slow_progress_do_not_restart_attack(self):
        unit = monster(attackSpeed=2)
        target = character()
        update_monsters([unit], [target], 0.0)
        for now, frame in [(0.125, 4), (0.125, 4), (0.1875, 6), (0.25, 8)]:
            with self.subTest(now=now):
                update_monsters([unit], [target], now)
                self.assertEqual(unit.state, "attack")
                self.assertEqual(unit.motion_frame(16, 16), frame)
                self.assertEqual(unit.pos, [0, 0])
        update_monsters([unit], [target], 0.75)
        self.assertEqual(unit.state, "walk")
        self.assertAlmostEqual(unit.pos[0], 0.25)

    def test_reset_and_route_assignment_clear_previous_attack_and_cooldown_timers(self):
        for operation in ["reset", "route"]:
            with self.subTest(operation=operation):
                unit = monster(attackDelay=100)
                target = character()
                unit.try_attack([target], now=0.0)
                unit.update(1.0)
                if operation == "reset":
                    unit.reset_animation(10.0)
                else:
                    unit.assign_route([0, 0], [10, 0], [[0, 0], [10, 0]], 10.0)
                self.assertEqual(unit.state, "walk")
                unit.try_attack([target], now=10.0)
                self.assertEqual(unit.state, "attack")
                unit.update(10.5)
                self.assertEqual(unit.state, "attack")
                self.assertEqual(unit.motion_frame(16, 16), 8)
                unit.update(11.0)
                self.assertEqual(unit.state, "walk")


if __name__ == "__main__":
    unittest.main()
