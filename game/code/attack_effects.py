"""Draw flying attacks and compact hit flashes on the Pico2D battle canvas."""

from math import atan2, cos, dist, pi, sin

import pico2d


PROJECTILE_COLORS = {
    "2-archer": (247, 213, 135),
    "3-crossbowman": (165, 211, 255),
    "4-cleric": (105, 237, 204),
    "5-herbalist": (180, 235, 116),
    "6-frost-mage": (117, 212, 255),
}
MELEE_COLORS = {
    "0-swordsman": (143, 205, 255),
    "1-guardian": (246, 192, 110),
    "7-shadow-thief": (191, 149, 255),
    "9-whitehair": (239, 105, 129),
}
DIRECTION_VECTORS = {"down": (0, -1), "up": (0, 1), "left": (-1, 0), "right": (1, 0)}
OUTLINE = (26, 33, 44)
HIGHLIGHT = (255, 250, 230)


def _shape_drawer(renderer, x, y, size, angle=0):
    """Map small convex polygons from effect-local coordinates to the canvas."""
    horizontal = cos(angle) * size
    vertical = sin(angle) * size
    canvas_y = pico2d.get_canvas_height() - 1 - y
    index_type = pico2d.SDL_RenderGeometry.argtypes[4]._type_

    def polygon(points, color, alpha=255):
        vertices = (pico2d.SDL_Vertex * len(points))(*(
            pico2d.SDL_Vertex(
                pico2d.SDL_FPoint(x + px * horizontal - py * vertical,
                                 canvas_y - px * vertical - py * horizontal),
                pico2d.SDL_Color(*color, alpha), pico2d.SDL_FPoint(0, 0),
            )
            for px, py in points
        ))
        indices = [index for i in range(1, len(points) - 1) for index in (0, i, i + 1)]
        pico2d.SDL_RenderGeometry(renderer, None, vertices, len(vertices),
                                  (index_type * len(indices))(*indices), len(indices))

    return polygon


def _draw_projectile(renderer, shot, now, position_on_map, monster_position):
    x, y, scale = position_on_map(shot.pos)
    _, source_y, source_scale = position_on_map(shot.source_pos, elevated=True)
    _, ground_y, _ = position_on_map(shot.source_pos)
    target_x, target_y, target_scale = monster_position(shot.target)
    travelled = dist(shot.source_pos, shot.pos)
    remaining = dist(shot.pos, shot.target.pos)
    progress = travelled / (travelled + remaining) if travelled + remaining else 0.0
    # Start near the firing unit's hand on its own terrain level, then approach the target.
    launch_height = source_y - ground_y + 39 * source_scale
    y += (1 - progress) * launch_height + progress * 36 * target_scale
    aim_x = target_x - x
    aim_y = target_y + 36 * target_scale - y
    angle = atan2(aim_y, aim_x) if aim_x or aim_y else atan2(shot.heading[1], shot.heading[0])
    size = max(0.6, scale)
    color = PROJECTILE_COLORS[shot.profile]
    if shot.profile == "5-herbalist":
        y += 16 * size * sin(pi * progress)
        angle += now * 9
    draw = _shape_drawer(renderer, x, y, size, angle)

    if shot.profile in ("2-archer", "3-crossbowman"):
        # Different shafts and fletching make a thin arrow and a short, heavy bolt.
        bolt = shot.profile == "3-crossbowman"
        rear, front, width = (-12, 11, 2.5) if bolt else (-16, 12, 1.7)
        draw(((rear, -width), (7, -width), (7, width), (rear, width)), OUTLINE)
        draw(((rear + 1, -1), (7, -1), (7, 1), (rear + 1, 1)), color)
        draw(((rear, 4), (rear + 7, 1), (rear + 6, -3), (rear - 1, -4)), color)
        draw(((4, -4.5), (front, 0), (4, 4.5)), OUTLINE)
        draw(((5, -2.5), (front - 1.5, 0), (5, 2.5)), HIGHLIGHT)
    elif shot.profile == "4-cleric":
        draw(((-16, 0), (-3, -4), (4, 0), (-3, 4)), color, 115)
        draw(((-6, -2), (-2, -6), (3, -6), (7, -1), (4, 5), (-2, 6)), OUTLINE)
        draw(((-4, -1), (-1, -4), (3, -4), (5, 0), (3, 4), (-1, 4)), color)
        draw(((-1, 0), (1, -2), (3, 0), (1, 2)), HIGHLIGHT)
    elif shot.profile == "5-herbalist":
        draw(((-8, -4), (-6, -7), (2, -7), (6, -3), (6, 3), (1, 7), (-7, 6)), OUTLINE)
        draw(((-6, -3), (-4, -5), (1, -5), (4, -2), (4, 2), (0, 5), (-5, 4)), color)
        draw(((4, -3.5), (10, -3.5), (10, 3.5), (4, 3.5)), OUTLINE)
        draw(((6, -2), (9, -2), (9, 2), (6, 2)), (225, 176, 112))
        draw(((-6, -1), (-3, 1), (1, 1), (-2, 3), (-5, 3)), HIGHLIGHT, 230)
    else:  # Frost shard
        draw(((-17, 0), (-6, -4), (5, 0), (-6, 4)), color, 130)
        draw(((-9, -3), (0, -5), (12, 0), (-1, 5), (-8, 3)), OUTLINE)
        draw(((-7, -2), (0, -3.5), (10, 0), (-1, 3.5), (-6, 2)), color)
        draw(((-6, 2), (-1, 3.5), (10, 0), (-3, 0)), (226, 255, 255))


def _draw_hit(renderer, effect, progress, position_on_map):
    x, y, scale = position_on_map(effect.pos)
    size = max(0.6, scale) * (0.8 + progress * 0.38)
    alpha = round(255 * (1 - progress))
    if effect.profile in PROJECTILE_COLORS:
        color = PROJECTILE_COLORS[effect.profile]
        draw = _shape_drawer(renderer, x, y + 36 * scale, size, pi / 8)
        draw(((-8, 0), (0, -5), (8, 0), (0, 5)), color, alpha)
        draw(((-4, 0), (0, -3), (4, 0), (0, 3)), HIGHLIGHT, alpha)
        return

    color = MELEE_COLORS.get(effect.profile, HIGHLIGHT)
    dx, dy = DIRECTION_VECTORS[effect.direction]
    ahead_x, ahead_y, _ = position_on_map((effect.pos[0] + dx * 0.15, effect.pos[1] + dy * 0.15))
    angle = atan2(ahead_y - y, ahead_x - x)
    draw = _shape_drawer(renderer, x, y + 32 * scale, size, angle)
    if effect.profile == "1-guardian":
        draw(((-11, 0), (0, -8), (12, 0), (0, 8)), color, alpha)
        draw(((-5, 0), (0, -4), (6, 0), (0, 4)), HIGHLIGHT, alpha)
    elif effect.profile == "7-shadow-thief":
        draw(((-17, -3), (3, -4), (15, 1), (-5, 3)), color, alpha)
        draw(((-11, 0), (4, -2), (13, 1), (-3, 2)), HIGHLIGHT, alpha)
    else:
        # A small contact cut supplements the weapon arcs already in the sprites.
        draw(((-13, 8), (-4, -4), (14, -5), (6, 3), (-3, 9)), color, alpha)
        draw(((-9, 4), (-3, -1), (10, -4), (5, 0)), HIGHLIGHT, alpha)


def draw_attack_effects(projectiles, effects, now, *, position_on_map, monster_position):
    """Paint active attacks at logical tile positions using the shared battle time."""
    if not projectiles and not effects:
        return
    renderer = pico2d.open_canvas.__globals__["renderer"]
    pico2d.SDL_SetRenderDrawBlendMode(renderer, pico2d.SDL_BLENDMODE_BLEND)
    for projectile in projectiles:
        _draw_projectile(renderer, projectile, now, position_on_map, monster_position)
    for effect in effects:
        progress = (now - effect.started_at) / effect.duration
        if 0 <= progress < 1:
            _draw_hit(renderer, effect, progress, position_on_map)
