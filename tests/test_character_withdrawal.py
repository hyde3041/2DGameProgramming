import sys
import unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

from character import Player
from user import User


def player(**kwargs):
    values = dict(attackSpeed=1, damage=10, hp=100, cost=5)
    values.update(kwargs)
    return Player(**values)


class CharacterWithdrawalTests(unittest.TestCase):
    def setUp(self):
        self.character = player()
        self.user = User(hp=3)
        self.user.character = [self.character]
        self.user.begin_battle(1, 0.0)

    def test_withdrawal_removes_deployment_and_resets_motion_without_refund_or_healing(self):
        self.assertEqual(self.character.redeployDelay, 10.0)
        self.assertTrue(self.user.deploy_character(self.character, [3, -2], 1.0, direction="up"))
        self.character.hp = 37
        self.character.update_state([SimpleNamespace(race="monster", pos=[3, -1])], now=1.25)
        self.assertEqual(self.character.state, "attack")
        self.assertTrue(self.user.withdraw_character(self.character, 2.0))
        self.assertFalse(self.character.deployed)
        self.assertEqual([member for member in self.user.character if member.deployed], [])
        self.assertIs(self.user.character[0], self.character)
        self.assertEqual(self.character.state, "idle")
        self.assertEqual(self.character.direction, "down")
        self.assertEqual(self.character.motion_frame(16, 16), 0)
        self.assertEqual(self.character.redeploy_remaining(), 10.0)
        self.assertEqual((self.user.cost, self.user.hp, self.character.hp), (25, 3, 37))

    def test_undeployed_external_and_nonbattle_withdrawals_are_rejected(self):
        self.assertFalse(self.user.withdraw_character(self.character, 1.0))
        self.assertEqual(self.character.redeploy_remaining(1.0), 0)
        self.assertEqual(self.user.cost, 30)

        self.user.deploy_character(self.character, [3, -2], 1.0, direction="up")
        external = replace(self.character)
        self.assertEqual(external, self.character)
        self.assertIsNot(external, self.character)
        self.assertFalse(self.user.withdraw_character(external, 2.0))
        self.assertTrue(external.deployed)
        self.assertTrue(self.character.deployed)
        self.assertEqual(self.character.direction, "up")
        self.assertEqual(self.user.cost, 25)

        self.user.scene = 1
        self.assertFalse(self.user.withdraw_character(self.character, 2.0))
        self.assertTrue(self.character.deployed)
        self.assertEqual(self.character.direction, "up")
        self.assertEqual(self.character.redeploy_remaining(2.0), 0)
        self.assertEqual(self.user.cost, 25)

    def test_countdown_uses_shared_battle_time_including_pause_and_slow_updates(self):
        self.user.deploy_character(self.character, [0, 0], 1.0)
        self.user.withdraw_character(self.character, 2.0)
        for now, remaining in [(2.25, 9.75), (2.25, 9.75), (2.375, 9.625), (3.0, 9.0)]:
            with self.subTest(now=now):
                self.user.update_battle(now)
                self.assertEqual(self.character.redeploy_remaining(), remaining)
                self.assertFalse(self.user.can_deploy(self.character))
        self.assertEqual(self.character.redeploy_remaining(12.0), 0)
        self.assertTrue(self.user.can_deploy(self.character, now=12.0))
        self.assertEqual(self.character.redeploy_remaining(), 9.0)
        self.assertFalse(self.user.can_deploy(self.character))

    def test_redeployment_is_unchanged_until_exact_ready_time_then_spends_cost(self):
        self.user.deploy_character(self.character, [3, -2], 1.0, direction="up")
        self.user.withdraw_character(self.character, 2.0)
        before = (self.character.pos.copy(), self.character.direction, self.character.deployed,
                  self.character.hp, self.user.cost)
        for now in [2.0, 11.999]:
            with self.subTest(now=now):
                self.assertFalse(self.user.can_deploy(self.character, now=now))
                self.assertFalse(self.user.deploy_character(self.character, [5, -1], now, direction="left"))
                self.assertEqual((self.character.pos, self.character.direction, self.character.deployed,
                                  self.character.hp, self.user.cost), before)
        # Explicit deployment time works even when no intermediate frame synchronized the clock.
        self.assertTrue(self.user.deploy_character(self.character, [5, -1], 12.0, direction="left"))
        self.assertEqual((self.character.pos, self.character.direction, self.character.deployed),
                         ([5, -1], "left", True))
        self.assertEqual(self.user.cost, 20)
        self.assertEqual(self.character.redeploy_remaining(), 0)
        self.assertEqual(self.character.state, "idle")

    def test_each_character_keeps_its_own_delay_and_ready_time(self):
        self.character.redeployDelay = 3.0
        other = player(redeployDelay=8.0)
        self.user.character.append(other)
        self.user.deploy_character(self.character, [0, 0], 0.0)
        self.user.deploy_character(other, [1, 0], 0.0)
        self.user.withdraw_character(self.character, 1.0)
        self.user.withdraw_character(other, 2.0)
        self.assertEqual(self.character.redeploy_remaining(4.0), 0)
        self.assertEqual(other.redeploy_remaining(4.0), 6.0)
        self.assertTrue(self.user.can_deploy(self.character, now=4.0))
        self.assertFalse(self.user.can_deploy(other, now=4.0))
        self.assertTrue(self.user.can_deploy(other, now=10.0))

    def test_zero_or_negative_delay_allows_immediate_redeployment(self):
        for delay in [0.0, -2.0]:
            with self.subTest(delay=delay):
                unit = player(redeployDelay=delay)
                user = User(hp=3)
                user.character = [unit]
                user.begin_battle(1, 0.0)
                user.deploy_character(unit, [0, 0], 0.0)
                self.assertTrue(user.withdraw_character(unit, 1.0))
                self.assertEqual(unit.redeploy_remaining(), 0)
                self.assertTrue(user.can_deploy(unit))
                self.assertTrue(user.deploy_character(unit, [1, 0], 1.0))
                self.assertEqual(user.cost, 20)

    def test_repeated_withdrawals_restart_delay_only_after_successful_redeployment(self):
        self.user.deploy_character(self.character, [0, 0], 0.0)
        self.assertTrue(self.user.withdraw_character(self.character, 1.0))
        self.assertFalse(self.user.withdraw_character(self.character, 3.0))
        self.assertEqual(self.character.redeploy_remaining(11.0), 0)
        self.assertTrue(self.user.deploy_character(self.character, [1, 0], 11.0))
        self.assertTrue(self.user.withdraw_character(self.character, 12.0))
        self.assertEqual(self.character.redeploy_remaining(), 10.0)
        self.assertFalse(self.user.can_deploy(self.character, now=21.999))
        self.assertTrue(self.user.can_deploy(self.character, now=22.0))
        self.assertEqual(self.user.cost, 20)

    def test_finishing_and_starting_battles_clear_redeployment_wait(self):
        self.user.deploy_character(self.character, [0, 0], 0.0)
        self.user.withdraw_character(self.character, 2.0)
        self.user.finish_battle(cleared=False)
        self.assertEqual(self.character.redeploy_remaining(), 0)
        self.assertFalse(self.character.deployed)
        self.assertFalse(self.user.can_deploy(self.character))
        self.user.begin_battle(2, 100.0)
        self.assertEqual(self.user.cost, 30)
        self.assertEqual(self.character.redeploy_remaining(), 0)
        self.assertTrue(self.user.can_deploy(self.character))

        self.user.deploy_character(self.character, [0, 0], 100.0)
        self.user.withdraw_character(self.character, 101.0)
        self.user.begin_battle(3, 105.0)
        self.assertEqual(self.user.cost, 30)
        self.assertFalse(self.character.deployed)
        self.assertEqual(self.character.redeploy_remaining(), 0)
        self.assertTrue(self.user.can_deploy(self.character))


if __name__ == "__main__":
    unittest.main()
