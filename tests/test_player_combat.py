import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "game/code"))

from character import Player
from monster import Monster
from player_combat import ATTACK_HIT_FRAMES, PlayerCombat


def player(profile, **overrides):
    values = dict(attackSpeed=1, damage=10, hp=100, cost=5, deployed=True)
    values.update(overrides)
    return Player(profile=profile, **values)


def enemy(x, y, hp=100):
    return Monster(attackSpeed=1, damage=10, hp=hp, pos=[x, y])


def hit_time(character):
    return ATTACK_HIT_FRAMES[character.profile] / (16 * character.attackSpeed)


class PlayerCombatTests(unittest.TestCase):
    def setUp(self):
        self.combat = PlayerCombat()

    def test_melee_hits_every_live_in_range_enemy_once_on_the_strike(self):
        swordswoman = player("9-whitehair", direction="left")
        left, right = enemy(-1, 1), enemy(-1, -1)
        out_of_range = enemy(-2, 0)
        defeated = enemy(-1, 0, hp=0)
        escaped = enemy(0, 0)
        escaped.reachedGoal = True
        monsters = [left, right, out_of_range, defeated, escaped]
        impact = hit_time(swordswoman)

        self.combat.update([swordswoman], monsters, 0)
        self.combat.update([swordswoman], monsters, impact - 0.01)
        self.assertEqual([m.hp for m in monsters], [100, 100, 100, 0, 100])
        self.combat.update([swordswoman], monsters, impact)
        self.combat.update([swordswoman], monsters, impact)
        self.assertEqual([m.hp for m in monsters], [90, 90, 100, 0, 100])
        self.assertFalse(self.combat.projectiles)
        self.assertEqual({effect.pos for effect in self.combat.effects}, {(-1, 1), (-1, -1)})

        self.combat.update([swordswoman], monsters, impact + 3)
        self.assertEqual([left.hp, right.hp], [80, 80])
        self.assertEqual(len(self.combat.effects), 2)

    def test_projectile_hits_one_locked_target_on_arrival(self):
        archer = player("2-archer")
        farther = enemy(0, -2)
        target = enemy(0, -1)
        monsters = [farther, target]
        release = hit_time(archer)

        self.combat.update([archer], monsters, 0)
        self.combat.update([archer], monsters, release)
        self.combat.update([archer], monsters, release)
        shot, = self.combat.projectiles
        self.assertIs(shot.target, target)
        self.assertEqual(shot.pos, (0, 0))
        self.assertEqual([farther.hp, target.hp], [100, 100])
        self.assertFalse(self.combat.effects)

        farther.pos = [0, -0.5]  # On the flight path, but not the selected target.
        target.pos = [0, -1.5]
        self.combat.update([archer], monsters, release + 0.05)
        self.assertAlmostEqual(shot.pos[1], -0.45)
        self.assertEqual([farther.hp, target.hp], [100, 100])
        self.combat.update([archer], monsters, release + 0.20)
        self.assertEqual([farther.hp, target.hp], [100, 90])
        self.assertFalse(self.combat.projectiles)
        self.assertEqual([effect.pos for effect in self.combat.effects], [(0, -1.5)])

    def test_lost_target_cancels_projectile_without_retargeting(self):
        for loss in ("defeated", "goal", "removed"):
            with self.subTest(loss=loss):
                combat = PlayerCombat()
                crossbowman = player("3-crossbowman")
                target = enemy(0, -1)
                replacement = enemy(0, -2)
                monsters = [target, replacement]
                release = hit_time(crossbowman)
                combat.update([crossbowman], monsters, 0)
                combat.update([crossbowman], monsters, release)
                self.assertEqual(len(combat.projectiles), 1)
                if loss == "defeated":
                    target.hp = 0
                elif loss == "goal":
                    target.reachedGoal = True
                else:
                    monsters.remove(target)
                combat.update([crossbowman], monsters, release + 0.20)
                self.assertEqual(replacement.hp, 100)
                self.assertFalse(combat.projectiles)
                self.assertFalse(combat.effects)

    def test_animation_reset_allows_a_new_strike_after_redeploy(self):
        guardian = player("1-guardian", attackSpeed=2)
        target = enemy(0, -1, hp=15)
        impact = hit_time(guardian)
        self.combat.update([guardian], [target], 0)
        self.combat.update([guardian], [target], impact)
        self.assertEqual(target.hp, 5)

        guardian.reset_animation(1.0)  # Reset from a withdraw and redeploy between updates.
        self.combat.update([guardian], [target], 1.0)
        self.combat.update([guardian], [target], 1.0 + impact - 0.01)
        self.assertEqual(target.hp, 5)
        self.combat.update([guardian], [target], 1.0 + impact)
        self.assertEqual(target.hp, 0)

    def test_projectile_can_land_after_the_shooter_withdraws(self):
        archer = player("2-archer")
        target = enemy(0, -1)
        release = hit_time(archer)
        self.combat.update([archer], [target], 0)
        self.combat.update([archer], [target], release)
        archer.deployed = False
        self.combat.update([archer], [target], release + 0.20)
        self.assertEqual(target.hp, 90)
        self.combat.clear()
        self.assertFalse(self.combat.projectiles)
        self.assertFalse(self.combat.effects)


if __name__ == "__main__":
    unittest.main()
