import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

import map as dungeon
from character import DEPLOYMENT_TILES, Player


def player(profile, **kwargs):
    kwargs.setdefault("allowedTiles", DEPLOYMENT_TILES[profile].copy())
    return Player(profile=profile, attackSpeed=1, damage=10, hp=100, cost=5, **kwargs)


class PlacementTerrainTests(unittest.TestCase):
    def setUp(self):
        cells = {
            (0, 0): {"tileType": 1},
            (1, 0): {"tileType": 2},
            (2, 0): {"tileType": 0},
            (3, 0): {"tileType": 99},
        }
        self.cells_patch = patch.object(dungeon, "battle_cells", cells)
        self.cells_patch.start()
        self.addCleanup(self.cells_patch.stop)

    def test_all_highland_roles_reject_ground_and_allow_highland(self):
        for profile in ("2-archer", "3-crossbowman", "4-cleric", "5-herbalist", "6-frost-mage"):
            with self.subTest(profile=profile):
                character = player(profile)
                self.assertFalse(dungeon.can_place((0, 0), [character], character))
                self.assertTrue(dungeon.can_place((1, 0), [character], character))

    def test_other_roles_keep_their_existing_terrain_access(self):
        for profile in ("0-swordsman", "1-guardian", "7-shadow-thief"):
            with self.subTest(profile=profile):
                character = player(profile)
                self.assertTrue(dungeon.can_place((0, 0), [character], character))
                self.assertTrue(dungeon.can_place((1, 0), [character], character))

    def test_non_deployable_and_outside_tiles_stay_invalid(self):
        for profile in ("2-archer", "0-swordsman"):
            character = player(profile)
            for pos in ((2, 0), (3, 0), (99, 99), None):
                with self.subTest(profile=profile, pos=pos):
                    self.assertFalse(dungeon.can_place(pos, [character], character))

    def test_occupied_highland_is_rejected_until_vacated(self):
        character = player("4-cleric")
        occupant = player("2-archer", deployed=True, pos=[1, 0])
        roster = [character, occupant]
        self.assertFalse(dungeon.can_place((1, 0), roster, character))
        occupant.deployed = False
        self.assertTrue(dungeon.can_place((1, 0), roster, character))

    def test_terrain_policy_is_independent_of_block_capacity_and_direction(self):
        character = player("5-herbalist", canStop=3, direction="up")
        self.assertFalse(dungeon.can_place((0, 0), [character], character))
        self.assertTrue(dungeon.can_place((1, 0), [character], character))
        self.assertEqual((character.canStop, character.direction, character.cost), (3, "up", 5))
        character.canStop = 0
        self.assertFalse(dungeon.can_place((0, 0), [character], character))
        self.assertTrue(dungeon.can_place((1, 0), [character], character))

    def test_allowed_tiles_can_change_without_changing_profile(self):
        character = player("2-archer")
        character.allowedTiles = [1]
        self.assertTrue(dungeon.can_place((0, 0), [character], character))
        self.assertFalse(dungeon.can_place((1, 0), [character], character))
        character.allowedTiles.append(2)
        self.assertTrue(dungeon.can_place((1, 0), [character], character))
        self.assertEqual(character.profile, "2-archer")

    def test_empty_allowed_tiles_disables_deployment(self):
        character = player("0-swordsman", allowedTiles=[])
        for pos in ((0, 0), (1, 0), (2, 0)):
            with self.subTest(pos=pos):
                self.assertFalse(dungeon.can_place(pos, [character], character))

    def test_blocked_or_unknown_tile_cannot_be_enabled_by_character(self):
        character = player("0-swordsman", allowedTiles=[0, 1, 2, 99])
        self.assertFalse(dungeon.can_place((2, 0), [character], character))
        self.assertFalse(dungeon.can_place((3, 0), [character], character))
        self.assertTrue(dungeon.can_place((0, 0), [character], character))
        self.assertTrue(dungeon.can_place((1, 0), [character], character))

    def test_configured_characters_do_not_share_allowed_tile_lists(self):
        first = player("2-archer")
        second = player("2-archer")
        first.allowedTiles.append(1)
        self.assertEqual(second.allowedTiles, [2])
        self.assertEqual(DEPLOYMENT_TILES["2-archer"], [2])

    def test_default_characters_do_not_share_allowed_tile_lists(self):
        stats = dict(attackSpeed=1, damage=10, hp=100, cost=5)
        first = Player(**stats)
        second = Player(**stats)
        first.allowedTiles.remove(2)
        self.assertEqual(first.allowedTiles, [1])
        self.assertEqual(second.allowedTiles, [1, 2])


if __name__ == "__main__":
    unittest.main()
