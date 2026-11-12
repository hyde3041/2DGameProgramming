import copy
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

from character import Player


class AttackRangePreviewTests(unittest.TestCase):
    def setUp(self):
        self.character = Player(
            attackSpeed=1, damage=10, hp=100, cost=5,
            pos=[9, -8], direction="left",
            attackRange=[[0, 0], [0, -1], [1, -2], [0, -1]],
        )

    def test_four_preview_facings_rotate_asymmetric_range_without_mutation(self):
        before = copy.deepcopy(vars(self.character))
        original_pos = self.character.pos
        original_range = self.character.attackRange
        preview_pos = [4, -3]
        expected = {
            "down": {(4, -3), (4, -4), (5, -5)},
            "up": {(4, -3), (4, -2), (3, -1)},
            "right": {(4, -3), (5, -3), (6, -2)},
            "left": {(4, -3), (3, -3), (2, -4)},
        }
        for direction, cells in expected.items():
            with self.subTest(direction=direction):
                self.assertEqual(self.character.attack_cells(pos=preview_pos, direction=direction), cells)
                self.assertEqual(vars(self.character), before)
                self.assertIs(self.character.pos, original_pos)
                self.assertIs(self.character.attackRange, original_range)
                self.assertEqual(preview_pos, [4, -3])

    def test_tuple_origin_and_current_direction_are_supported(self):
        self.assertEqual(
            self.character.attack_cells(pos=(0, 0)),
            {(0, 0), (-1, 0), (-2, -1)},
        )

    def test_facing_only_override_uses_current_position(self):
        self.assertEqual(
            self.character.attack_cells(direction="right"),
            {(9, -8), (10, -8), (11, -7)},
        )
        self.assertEqual(self.character.direction, "left")

    def test_default_query_remains_independent_of_earlier_previews(self):
        expected = {(9, -8), (8, -8), (7, -9)}
        self.assertEqual(self.character.attack_cells(), expected)
        result = self.character.attack_cells(pos=(0, 0), direction="up")
        result.clear()
        self.assertEqual(self.character.attack_cells(), expected)

    def test_combat_keeps_actual_position_and_direction_after_preview(self):
        self.character.attack_cells(pos=(2, -2), direction="right")
        preview_target = SimpleNamespace(race="monster", pos=[3, -2])
        actual_target = SimpleNamespace(race="monster", pos=[8, -8])
        self.assertEqual(self.character.update_state([preview_target], now=1), "idle")
        self.assertEqual(self.character.update_state([actual_target], now=2), "attack")
        self.assertEqual((self.character.pos, self.character.direction), ([9, -8], "left"))


if __name__ == "__main__":
    unittest.main()
