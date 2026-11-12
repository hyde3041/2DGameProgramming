import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

from character import Player
from user import User


def player(**kwargs):
    return Player(attackSpeed=1, damage=10, hp=100, cost=5, **kwargs)


class DirectionModelTests(unittest.TestCase):
    def setUp(self):
        self.character = player()
        self.user = User(hp=3)
        self.user.character = [self.character]
        self.user.begin_battle(1, 0.0)
        self.user.cost = 12

    def test_direction_belongs_to_each_character(self):
        other = player(direction="left")
        self.character.direction = "up"
        self.assertEqual(other.direction, "left")
        self.assertEqual(player().direction, "down")

    def test_all_facings_rotate_asymmetric_range_without_mutating_it(self):
        self.character.pos = [4, -3]
        self.character.attackRange = [[0, 0], [0, -1], [1, -2]]
        expected = {
            "down": {(4, -3), (4, -4), (5, -5)},
            "up": {(4, -3), (4, -2), (3, -1)},
            "right": {(4, -3), (5, -3), (6, -2)},
            "left": {(4, -3), (3, -3), (2, -4)},
        }
        for direction, cells in expected.items():
            with self.subTest(direction=direction):
                self.character.direction = direction
                self.assertEqual(self.character.attack_cells(), cells)
                self.assertEqual(self.character.attackRange, [[0, 0], [0, -1], [1, -2]])

    def test_only_monster_in_facing_range_triggers_attack(self):
        self.character.pos = [4, -3]
        self.character.direction = "right"
        self.assertEqual(self.character.update_state([
            SimpleNamespace(race="monster", pos=[4, -4]),
            SimpleNamespace(race="people", pos=[5, -3]),
        ], now=1.0), "idle")
        target = SimpleNamespace(race="monster", pos=[5, -3])
        self.assertEqual(self.character.update_state([target], now=2.0), "attack")
        self.assertEqual(self.character.motion_frame(16, 16, now=2.25), 4)
        self.character.direction = "up"
        self.assertEqual(self.character.update_state([target], now=2.5), "idle")

    def test_confirmation_commits_direction_and_spends_once(self):
        position = [3, -2]
        self.assertTrue(self.user.deploy_character(self.character, position, 1.0, direction="left"))
        position[0] = 9
        self.assertEqual(self.character.pos, [3, -2])
        self.assertEqual(self.character.direction, "left")
        self.assertTrue(self.character.deployed)
        self.assertEqual(self.user.cost, 7)
        self.assertFalse(self.user.deploy_character(self.character, [2, -1], 2.0, direction="up"))
        self.assertEqual((self.character.pos, self.character.direction, self.user.cost), ([3, -2], "left", 7))

    def test_invalid_confirmation_does_not_change_character_or_cost(self):
        self.character.direction = "right"
        self.assertFalse(self.user.deploy_character(self.character, [3, -2], 1.0, direction="diagonal"))
        self.assertEqual((self.character.pos, self.character.direction, self.character.deployed, self.user.cost),
                         ([0, 0], "right", False, 12))
        self.user.cost = 4
        self.assertFalse(self.user.deploy_character(self.character, [3, -2], 1.0, direction="up"))
        self.assertEqual((self.character.pos, self.character.direction, self.character.deployed, self.user.cost),
                         ([0, 0], "right", False, 4))

    def test_occupied_cell_rejection_preserves_direction_and_cost(self):
        other = player(pos=[3, -2], deployed=True)
        self.user.character.append(other)
        self.assertFalse(self.user.deploy_character(self.character, [3, -2], 1.0, direction="right"))
        self.assertEqual(self.character.direction, "down")
        self.assertEqual(self.user.cost, 12)
        self.assertFalse(self.character.deployed)

    def test_selection_without_confirmation_reserves_nothing(self):
        self.assertTrue(self.user.can_deploy(self.character))
        self.user.update_battle(0.5)
        self.assertEqual((self.user.cost, self.character.direction, self.character.deployed), (12, "down", False))

    def test_battle_lifecycle_resets_direction(self):
        self.user.deploy_character(self.character, [3, -2], 1.0, direction="up")
        self.user.finish_battle(cleared=False)
        self.assertEqual((self.character.direction, self.character.deployed), ("down", False))
        self.character.direction = "left"
        self.user.begin_battle(2, 2.0)
        self.assertEqual((self.character.direction, self.character.deployed), ("down", False))

    def test_legacy_deployment_defaults_to_down(self):
        self.assertTrue(self.user.deploy_character(self.character, [3, -2], 1.0))
        self.assertEqual(self.character.direction, "down")


if __name__ == "__main__":
    unittest.main()
