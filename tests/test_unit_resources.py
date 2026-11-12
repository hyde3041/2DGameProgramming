import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

from character import Player
from monster import Monster
from user import User


def player(**kwargs):
    values = dict(attackSpeed=1, damage=10, hp=100, cost=5)
    values.update(kwargs)
    return Player(**values)


def monster(**kwargs):
    values = dict(attackSpeed=1, damage=5, hp=50)
    values.update(kwargs)
    return Monster(**values)


class UnitResourceTests(unittest.TestCase):
    def test_max_hp_captures_initial_health_and_stays_independent(self):
        for factory in [player, monster]:
            with self.subTest(unit=factory.__name__):
                unit = factory(hp=60)
                self.assertEqual(unit.maxHp, 60)
                unit.hp = 17
                self.assertEqual(unit.maxHp, 60)
                self.assertEqual(factory(hp=80).maxHp, 80)
                explicit = factory(hp=25, maxHp=120)
                self.assertEqual((explicit.hp, explicit.maxHp), (25, 120))
                self.assertEqual(factory(hp=25, maxHp=0).maxHp, 0)
                negative = factory(hp=-2)
                self.assertEqual((negative.hp, negative.maxHp), (-2, 0))

    def test_first_mp_update_does_not_charge_time_before_initialization(self):
        unit = player(deployed=True)
        self.assertEqual((unit.mp, unit.maxMp, unit.mpRegen), (0.0, 100.0, 1.0))
        unit.update_mp(100.0)
        self.assertEqual(unit.mp, 0.0)
        unit.update_mp(100.25)
        self.assertEqual(unit.mp, 0.25)

    def test_user_updates_mp_continuously_with_shared_pause_and_slow_time(self):
        unit = player()
        user = User()
        user.character = [unit]
        user.begin_battle(1, 10.0)
        self.assertTrue(user.deploy_character(unit, [0, 0], 11.0))
        for now, expected in [(11.25, 0.25), (11.25, 0.25), (11.375, 0.375), (12.0, 1.0)]:
            with self.subTest(now=now):
                user.update_battle(now)
                self.assertEqual(unit.mp, expected)
        unit.update_mp(5.0)
        self.assertEqual(unit.mp, 1.0)
        unit.update_mp(5.25)
        self.assertEqual(unit.mp, 1.25)

    def test_mp_is_clamped_and_negative_regeneration_does_not_drain_it(self):
        unit = player(deployed=True, mp=95.0, mpRegen=10.0)
        unit.reset_animation(0.0)
        for now, expected in [(0.25, 97.5), (0.5, 100.0), (100.0, 100.0)]:
            unit.update_mp(now)
            self.assertEqual(unit.mp, expected)

        for values, expected in [
            (dict(mp=-5.0, mpRegen=0.0), 0.0),
            (dict(mp=10.0, mpRegen=-2.0), 10.0),
            (dict(mp=10.0, maxMp=0.0), 0.0),
            (dict(mp=10.0, maxMp=-5.0), 0.0),
        ]:
            with self.subTest(values=values):
                unit = player(deployed=True, **values)
                unit.reset_animation(0.0)
                unit.update_mp(1.0)
                self.assertEqual(unit.mp, expected)

    def test_inactive_and_dead_characters_do_not_charge_or_save_elapsed_time(self):
        unit = player(mp=7.0, mpRegen=2.0)
        unit.reset_animation(0.0)
        unit.update_mp(10.0)
        self.assertEqual(unit.mp, 7.0)
        unit.deployed = True
        unit.update_mp(11.0)
        self.assertEqual(unit.mp, 9.0)
        unit.hp = 0
        unit.update_mp(20.0)
        self.assertEqual(unit.mp, 9.0)
        unit.hp = 50
        unit.update_mp(20.5)
        self.assertEqual(unit.mp, 10.0)
        unit.hp = -1
        unit.update_mp(30.0)
        self.assertEqual(unit.mp, 10.0)

    def test_withdrawal_settles_charge_and_redeployment_preserves_only_earned_mp(self):
        unit = player()
        user = User()
        user.character = [unit]
        user.begin_battle(1, 0.0)
        user.update_battle(10.0)
        self.assertEqual(unit.mp, 0.0)
        self.assertTrue(user.deploy_character(unit, [0, 0], 10.0))
        user.update_battle(11.0)
        self.assertEqual(unit.mp, 1.0)
        self.assertTrue(user.withdraw_character(unit, 11.75))
        self.assertEqual(unit.mp, 1.75)
        user.update_battle(30.0)
        self.assertEqual(unit.mp, 1.75)
        self.assertTrue(user.deploy_character(unit, [1, 0], 30.0))
        user.update_battle(30.25)
        self.assertEqual(unit.mp, 2.0)

        self.assertTrue(user.withdraw_character(unit, 30.5))
        self.assertEqual(unit.mp, 2.25)
        # No updates during this second wait: deployment still discards all waiting time.
        self.assertTrue(user.deploy_character(unit, [2, 0], 100.0))
        self.assertEqual(unit.mp, 2.25)
        user.update_battle(100.25)
        self.assertEqual(unit.mp, 2.5)

    def test_animation_reset_preserves_mp_but_restarts_its_clock(self):
        unit = player(deployed=True, mp=7.0)
        unit.reset_animation(10.0)
        unit.update_mp(10.5)
        self.assertEqual(unit.mp, 7.5)
        unit.reset_animation(100.0)
        self.assertEqual(unit.mp, 7.5)
        unit.update_mp(100.5)
        self.assertEqual(unit.mp, 8.0)

    def test_battle_start_and_finish_clear_mp_without_changing_hp_capacity(self):
        unit = player(mp=55.0)
        user = User()
        user.character = [unit]
        user.begin_battle(1, 0.0)
        self.assertEqual(unit.mp, 0.0)
        user.deploy_character(unit, [0, 0], 0.0)
        user.update_battle(5.0)
        self.assertEqual(unit.mp, 5.0)
        unit.hp = 37
        user.finish_battle(cleared=False)
        self.assertEqual(unit.mp, 0.0)
        self.assertEqual((unit.hp, unit.maxHp), (37, 100))
        user.update_battle(100.0)
        self.assertEqual(unit.mp, 0.0)
        unit.mp = 30.0
        user.begin_battle(2, 200.0)
        self.assertEqual(unit.mp, 0.0)
        self.assertEqual((unit.hp, unit.maxHp), (37, 100))
        user.update_battle(205.0)
        self.assertEqual(unit.mp, 0.0)
        user.deploy_character(unit, [0, 0], 205.0)
        user.update_battle(206.0)
        self.assertEqual(unit.mp, 1.0)

    def test_regeneration_rate_and_mp_are_independent_per_character(self):
        slow, fast = player(mpRegen=0.5), player(mpRegen=3.0)
        user = User()
        user.character = [slow, fast]
        user.begin_battle(1, 0.0)
        user.deploy_character(slow, [0, 0], 0.0)
        user.deploy_character(fast, [1, 0], 0.0)
        user.update_battle(2.0)
        self.assertEqual((slow.mp, fast.mp), (1.0, 6.0))
        slow.mp = 0.25
        user.update_battle(3.0)
        self.assertEqual((slow.mp, fast.mp), (0.75, 9.0))


if __name__ == "__main__":
    unittest.main()
