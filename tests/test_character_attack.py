import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

from character import Player


def player(**kwargs):
    values = dict(attackSpeed=1, damage=10, hp=100, cost=5)
    values.update(kwargs)
    return Player(**values)


def monster(pos, **kwargs):
    values = dict(race="monster", pos=pos, hp=10, reachedGoal=False)
    values.update(kwargs)
    return SimpleNamespace(**values)


class CharacterAttackTests(unittest.TestCase):
    def test_enter_stay_leave_and_reenter_range(self):
        character = player(attackRange=[[0, -1]])
        target = monster([0.1, -1.6])
        self.assertEqual(character.update_state([target], now=10.0), "idle")

        target.pos = [0.1, -1.4]
        self.assertEqual(character.update_state([target], now=11.0), "attack")
        self.assertEqual(character.motion_frame(16, 16), 0)
        character.update_state([target], now=11.25)
        self.assertEqual(character.motion_frame(16, 16), 4)

        target.pos = [-0.2, -0.7]
        self.assertEqual(character.update_state([target], now=11.5), "attack")
        self.assertEqual(character.motion_frame(16, 16), 8)

        target.pos = [0.6, -1.0]
        self.assertEqual(character.update_state([target], now=11.75), "idle")
        self.assertEqual(character.motion_frame(16, 16), 0)
        character.update_state([], now=11.875)
        self.assertEqual(character.motion_frame(16, 16), 2)

        target.pos = [0.0, -0.6]
        self.assertEqual(character.update_state([target], now=12.0), "attack")
        self.assertEqual(character.motion_frame(16, 16), 0)
        character.update_state([target], now=12.25)
        self.assertEqual(character.motion_frame(16, 16), 4)

    def test_only_live_monsters_that_have_not_arrived_trigger_attack(self):
        excluded = [
            monster([0, -1], race="people"),
            monster([0, -1], hp=0),
            monster([0, -1], hp=-1),
            monster([0, -1], reachedGoal=True),
        ]
        character = player()
        for target in excluded:
            with self.subTest(target=vars(target)):
                character.update_state([monster([0, -1])], now=1.0)
                self.assertEqual(character.update_state([target], now=1.25), "idle")
        self.assertEqual(character.update_state(excluded, now=2.0), "idle")
        self.assertEqual(character.update_state(excluded + [monster([0.1, -0.9])], now=2.25), "attack")

    def test_legacy_units_without_optional_status_fields_remain_supported(self):
        character = player()
        target = SimpleNamespace(race="monster", pos=[0.1, -0.9])
        self.assertFalse(character.deployed)
        self.assertEqual(character.update_state([target], now=1.0), "attack")

    def test_continuous_positions_use_tile_center_boundaries(self):
        character = player(attackRange=[[0, -1]])
        cases = [
            ([-0.5, -1.0], "attack"),
            ([-0.5001, -1.0], "idle"),
            ([0.4999, -1.0], "attack"),
            ([0.5, -1.0], "idle"),
            ([0.0, -1.5], "attack"),
            ([0.0, -1.5001], "idle"),
            ([0.0, -0.5001], "attack"),
            ([0.0, -0.5], "idle"),
        ]
        for pos, expected in cases:
            with self.subTest(pos=pos):
                self.assertEqual(character.update_state([monster(pos)], now=1.0), expected)

        character.attackRange = [[1, 0]]
        for x, expected in [(0.4999, "idle"), (0.5, "attack"), (1.4999, "attack"), (1.5, "idle")]:
            with self.subTest(x=x):
                self.assertEqual(character.update_state([monster([x, 0])], now=2.0), expected)

    def test_fractional_monsters_use_the_rotated_range_in_all_four_directions(self):
        character = player(pos=[4, -3], attackRange=[[0, -1], [1, -2]])
        targets = {
            "down": [5.2, -5.1],
            "up": [3.2, -0.9],
            "right": [6.2, -2.1],
            "left": [2.2, -3.9],
        }
        for facing in targets:
            character.direction = facing
            for target_direction, pos in targets.items():
                with self.subTest(facing=facing, target_direction=target_direction):
                    expected = "attack" if facing == target_direction else "idle"
                    self.assertEqual(character.update_state([monster(pos)], now=1.0), expected)

    def test_attack_speed_controls_complete_cycles_for_different_sheet_lengths(self):
        for speed, cycle_seconds in [(0.5, 2.0), (1.0, 1.0), (2.0, 0.5)]:
            for frame_count, expected_frames in [(16, [0, 2, 8, 14, 0]), (3, [0, 0, 1, 2, 0])]:
                with self.subTest(speed=speed, frame_count=frame_count):
                    character = player(attackSpeed=speed)
                    target = monster([0, -1])
                    for progress, expected in zip([0.0, 0.125, 0.5, 0.875, 1.0], expected_frames):
                        character.update_state([target], now=cycle_seconds * progress)
                        self.assertEqual(character.state, "attack")
                        self.assertEqual(character.motion_frame(frame_count, 99), expected)

    def test_nonpositive_attack_speed_keeps_idle_even_with_a_target(self):
        for speed in [0, -1]:
            with self.subTest(speed=speed):
                character = player(attackSpeed=speed)
                target = monster([0, -1])
                self.assertEqual(character.update_state([target], now=1.0), "idle")
                character.update_state([target], now=1.25)
                self.assertEqual(character.motion_frame(16, 16), 4)

        character = player()
        character.update_state([monster([0, -1])], now=1.0)
        character.attackSpeed = 0
        self.assertEqual(character.update_state([monster([0, -1])], now=1.25), "idle")
        self.assertEqual(character.motion_frame(16, 16), 0)

    def test_attack_animation_follows_paused_and_slowed_shared_time(self):
        characters = [player(attackSpeed=1), player(attackSpeed=2)]
        target = monster([0, -1])
        for character in characters:
            character.update_state([target], now=10.0)

        # Repeated shared time is paused; half the next increment advances half as far.
        for shared_time, expected in [
            (10.25, [4, 8]),
            (10.25, [4, 8]),
            (10.375, [6, 12]),
            (10.5, [8, 0]),
        ]:
            with self.subTest(shared_time=shared_time):
                for character in characters:
                    character.update_state([target], now=shared_time)
                self.assertEqual([character.motion_frame(16, 16) for character in characters], expected)


if __name__ == "__main__":
    unittest.main()
