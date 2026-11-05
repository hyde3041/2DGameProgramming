import unittest
from unittest.mock import Mock, patch

from idle_sprite import IdleSprite


class IdleSpriteTests(unittest.TestCase):
    def setUp(self):
        self.loader = patch("idle_sprite.load_image", side_effect=lambda _: Mock()).start()
        self.addCleanup(patch.stopall)

    def test_same_wall_clock_time_at_different_update_rates(self):
        for rate in (30, 60, 144):
            sprite = IdleSprite("archer", 100, 80)
            for _ in range(rate):
                sprite.update(1 / rate)
            self.assertEqual(sprite.frame, 0)
            sprite.update(0.25)
            self.assertEqual(sprite.frame, 4)
            self.assertAlmostEqual(sprite.cycle_seconds, 1.0)

    def test_long_frame_skips_preserve_phase(self):
        sprite = IdleSprite("archer", 100, 80)
        sprite.update(10 + 7 / 16)
        self.assertEqual(sprite.frame, 7)
        before = sprite.frame
        for _ in range(100):
            sprite.draw()
        self.assertEqual(sprite.frame, before)

    def test_facing_change_reuses_phase_and_keeps_foot_anchor(self):
        sprite = IdleSprite("archer", 100, 80, scale=0.5)
        sprite.update(0.25)
        for direction in ("front", "back", "side", "front"):
            sprite.set_direction(direction)
            sprite.draw()
            self.assertEqual(sprite.frame, 4)
            args = sprite._images[sprite.direction].clip_draw.call_args.args
            self.assertEqual(args[4:], (100.0, 144.0, 160.0, 160.0))
            self.assertEqual(args[:4], (0, 640, 320, 320))
        self.assertEqual(self.loader.call_count, 3)

    def test_every_character_has_playable_three_direction_sheets(self):
        for character in (
            "swordsman", "guardian", "archer", "crossbowman",
            "cleric", "herbalist", "frost-mage", "shadow-thief",
        ):
            sprite = IdleSprite(character, 0, 0)
            for direction in ("front", "back", "side"):
                sprite.set_direction(direction)
                expected_count = 16
                self.assertEqual(sprite.frame_count, expected_count)
                self.assertEqual(sprite.fps, expected_count)
                sprite.update((expected_count - 1) / sprite.fps)
                sprite.draw()
                args = sprite._images[sprite.direction].clip_draw.call_args.args
                self.assertEqual(args[:4], (960, 0, 320, 320))
                sprite.update(1 / sprite.fps)
                self.assertEqual(sprite.frame, 0)


if __name__ == "__main__":
    unittest.main()
