import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

from monster import Monster


def monster():
    return Monster(attackSpeed=2, damage=5, hp=50)


class MonsterSpawnFrameTests(unittest.TestCase):
    def test_spawn_phase_covers_first_middle_and_last_frame(self):
        for phase, expected in ((0.0, 0), (0.25, 4), (0.9999, 15)):
            with self.subTest(phase=phase), patch("monster.random.random", return_value=phase):
                unit = monster()
                self.assertEqual(unit.motion_frame(16, 16), expected)
                unit.assign_route([0, 0], [2, 0], [[0, 0], [2, 0]], 10)
                self.assertEqual(unit.motion_frame(16, 16), expected)
                for count in (1, 7, 16):
                    frame = unit.motion_frame(count, 13)
                    self.assertGreaterEqual(frame, 0)
                    self.assertLess(frame, count)

    def test_each_monster_draws_once_and_keeps_its_own_phase(self):
        with patch("monster.random.random", side_effect=(0.25, 0.75)) as random_phase:
            first, second = monster(), monster()
            for unit in (first, second):
                unit.reset_animation(0)
            self.assertEqual((first.motion_frame(16, 16), second.motion_frame(16, 16)), (4, 12))
            for _ in range(10):
                self.assertEqual(first.motion_frame(16, 16), 4)
                self.assertEqual(second.motion_frame(16, 16), 12)
            first.reset_animation(8)
            first.assign_route([0, 0], [2, 0], [[0, 0], [2, 0]], 9)
            self.assertEqual(first.motion_frame(16, 16), 4)
            self.assertEqual(second.motion_frame(16, 16), 12)
            self.assertEqual(random_phase.call_count, 2)

    def test_walk_frames_advance_wrap_and_pause_on_shared_clock(self):
        with patch("monster.random.random", return_value=0.75):
            unit = monster()
        unit.reset_animation(10)
        for now, expected in ((10, 12), (10.125, 14), (10.25, 0), (10.25, 0), (10.5, 4)):
            unit.sync_animation_time(now)
            self.assertEqual(unit.motion_frame(16, 16), expected)
        unit.sync_animation_time(0)
        self.assertEqual(unit.motion_frame(16, 16), 12)

    def test_attack_starts_at_zero_and_is_not_shifted_by_walk_phase(self):
        with patch("monster.random.random", return_value=0.75) as random_phase:
            unit = monster()
            unit.reset_animation(0)
            unit.set_state("attack", now=1)
            self.assertEqual(unit.motion_frame(16, 11), 0)
            unit.set_state("attack", now=1.25)
            self.assertEqual(unit.motion_frame(16, 11), 8)
            unit.set_state("walk", now=2)
            self.assertEqual(unit.motion_frame(16, 11), 12)
            random_phase.assert_called_once_with()

    def test_different_animation_phases_do_not_change_movement(self):
        with patch("monster.random.random", side_effect=(0.0, 0.5)):
            first, second = monster(), monster()
        route = [[0, 0], [1, 0], [1, -3]]
        for unit in (first, second):
            unit.assign_route(route[0], route[-1], route, 0)
        for now in (0.25, 1, 2, 5):
            for unit in (first, second):
                unit.update(now)
            self.assertEqual(first.pos, second.pos)
            self.assertEqual(first.routeIndex, second.routeIndex)
            self.assertEqual(first.route, second.route)
            self.assertEqual((second.motion_frame(16, 16) - first.motion_frame(16, 16)) % 16, 8)


if __name__ == "__main__":
    unittest.main()
