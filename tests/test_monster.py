import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

from character import Player
from monster import Monster


class MonsterTests(unittest.TestCase):
    def setUp(self):
        phase = patch("monster.random.random", return_value=0.0)
        phase.start()
        self.addCleanup(phase.stop)

    def test_player_recognizes_monster_in_its_facing_range(self):
        character = Player(attackSpeed=1, damage=10, hp=100, cost=5, direction="right", pos=[3, -2])
        monster = Monster(attackSpeed=1, damage=5, hp=50, pos=[4.0, -2.0])
        self.assertEqual(character.update_state([monster], now=0), "attack")
        monster.pos = [2.0, -2.0]
        self.assertEqual(character.update_state([monster], now=1), "idle")

    def test_motion_uses_battle_time_and_only_restarts_on_transition(self):
        monster = Monster(attackSpeed=2, damage=5, hp=50)
        monster.reset_animation(10)
        monster.sync_animation_time(10.25)
        self.assertEqual(monster.motion_frame(16, 16), 4)
        monster.set_state("attack", now=10.25)
        self.assertEqual(monster.motion_frame(16, 16), 0)
        monster.set_state("attack", now=10.375)
        self.assertEqual(monster.motion_frame(16, 16), 4)
        monster.sync_animation_time(10.75)
        self.assertEqual(monster.motion_frame(16, 16), 0)
        monster.set_state("walk", now=10.875)
        self.assertEqual(monster.motion_frame(16, 16), 0)
        monster.sync_animation_time(11)
        self.assertEqual(monster.motion_frame(16, 16), 2)
        monster.sync_animation_time(0)
        self.assertEqual(monster.motion_frame(16, 16), 0)

    def test_monsters_keep_independent_position_and_range(self):
        first = Monster(attackSpeed=1, damage=5, hp=50)
        second = Monster(attackSpeed=1, damage=5, hp=50)
        first.pos[0] = 3.5
        first.attackRange[1][1] = -2
        self.assertEqual(second.pos, [0.0, 0.0])
        self.assertEqual(second.attackRange, [[0, 0], [0, -1]])

    def test_unsupported_motion_does_not_change_state_or_clock(self):
        monster = Monster(attackSpeed=1, damage=5, hp=50)
        monster.reset_animation(0)
        monster.sync_animation_time(0.25)
        with self.assertRaises(ValueError):
            monster.set_state("idle", now=5)
        self.assertEqual(monster.state, "walk")
        self.assertEqual(monster.motion_frame(16, 16), 4)


if __name__ == "__main__":
    unittest.main()
