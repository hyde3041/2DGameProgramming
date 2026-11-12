import json
from time import monotonic

import pico2d
from pico2d import (
    SDL_BUTTON_LEFT,
    SDL_BUTTON_RIGHT,
    SDL_GetKeyboardFocus,
    SDL_KEYDOWN,
    SDL_MOUSEBUTTONDOWN,
    SDL_MOUSEBUTTONUP,
    SDL_MOUSEMOTION,
    SDL_QUIT,
    SDLK_ESCAPE,
    SDLK_q,
    clear_canvas,
    close_canvas,
    delay,
    draw_line,
    draw_rectangle,
    get_events,
    load_image,
    open_canvas,
    update_canvas,
)

import map as dungeon
from character import DEPLOYMENT_COSTS, DEPLOYMENT_TILES, Player
from user import User


WIDTH = 800
HEIGHT = 600
TIME_SCALE = 1.0  # Battle speed: 0 pauses, 2 runs at double speed.
DRAG_TIME_SCALE = 0.5  # Shared slowdown while placing or inspecting a character.
MONSTER_SPAWN_INTERVAL = 1.0  # Seconds on the shared battle clock.
CHARACTER_SCALE = 0.5
CHARACTER_FOOT_OFFSET = 0.18  # Downward shift as a fraction of the projected tile height.
CARD_SIZE = 56
CARD_SPACING = 61
CARD_FIRST_X = 218
CARD_Y = 40
DIRECTION_SIZE = 192
DIRECTION_DEAD_ZONE = 20
ASSET_DIRECTORY = dungeon.GAME_DIRECTORY / "asset"
TITLE_PATH = ASSET_DIRECTORY / "etc/title/title-screen.png"
UI_DIRECTORY = ASSET_DIRECTORY / "etc/ui"
DIRECTION_DIRECTORY = ASSET_DIRECTORY / "etc/direction"
PROFILE_DIRECTORY = ASSET_DIRECTORY / "character/player/main"
RANGE_OVERLAY_PATH = ASSET_DIRECTORY / "map/stage/main/range-overlay.png"


def draw_number(digits, number, right, y, width):
    x = right - width / 2
    for digit in reversed(str(number)):
        digits.clip_draw(int(digit) * 20, 0, 20, 32, x, y, width, width * 1.6)
        x -= width


def card_at(x, y, cards):
    y = HEIGHT - 1 - y
    for index, (_, character) in enumerate(cards):
        center = CARD_FIRST_X + CARD_SPACING * index
        if center - CARD_SIZE / 2 <= x < center + CARD_SIZE / 2 and CARD_Y - CARD_SIZE / 2 <= y < CARD_Y + CARD_SIZE / 2:
            return character
    return None


def deployed_character_at(x, y, characters):
    """Pick the frontmost visible body, then its standing tile (mouse coordinates)."""
    deployed = [character for character in characters
                if character.deployed and tuple(character.pos) in dungeon.battle_cells]
    deployed.sort(key=lambda character: dungeon.battle_cells[tuple(character.pos)]["canvas_center"][1],
                  reverse=True)
    for character in deployed:
        cell = dungeon.battle_cells[tuple(character.pos)]
        center_x, foot_y = cell["canvas_center"]
        foot_y += cell["surface_rect"][3] * CHARACTER_FOOT_OFFSET
        size = dungeon.battle_grid["cell_size"][0] * cell.get("perspective_scale", 1.0)
        if (center_x - size * .55 <= x <= center_x + size * .55
                and foot_y - size * 1.5 <= y <= foot_y + size * .08):
            return character
    pos = dungeon.cell_at(x, y)
    return next((character for character in deployed if tuple(character.pos) == pos), None)


def draw_attack_range(character, overlay, *, pos=None, direction=None):
    """Project the actual attack cells onto each tile's visible top surface."""
    renderer = open_canvas.__globals__["renderer"]
    index_type = pico2d.SDL_RenderGeometry.argtypes[4]._type_
    indices = (index_type * 6)(0, 1, 2, 0, 2, 3)

    def surface(cell):
        polygon = cell.get("surface_polygon")
        if polygon is None:
            left, top, width, height = cell["surface_rect"]
            polygon = [(left, top), (left + width, top),
                       (left + width, top + height), (left, top + height)]
        return polygon

    def paint(polygon, texture, *, restore=False):
        uvs = [(x / WIDTH, y / HEIGHT) for x, y in polygon] if restore else ((0, 0), (1, 0), (1, 1), (0, 1))
        vertices = (pico2d.SDL_Vertex * 4)(*(
            pico2d.SDL_Vertex(pico2d.SDL_FPoint(*point), pico2d.SDL_Color(255, 255, 255, 255),
                              pico2d.SDL_FPoint(*uv))
            for point, uv in zip(polygon, uvs)
        ))
        if pico2d.SDL_RenderGeometry(renderer, texture, vertices, 4, indices, 6) != 0:
            raise RuntimeError("Cannot draw the character's attack range")

    positions = character.attack_cells(pos=pos, direction=direction)
    displayed = sorted(positions & dungeon.battle_cells.keys(), key=lambda p: (-p[1], p[0]))
    for position in displayed:
        cell = dungeon.battle_cells[position]
        if cell.get("visual_elevation", 0) <= 0:
            paint(surface(cell), overlay.texture)
    # The map is baked into one PNG: restore raised surfaces over the low-plane
    # overlay in the same order as the map renderer, then mark their own range.
    for position, cell in sorted(dungeon.battle_cells.items(), key=lambda entry: (-entry[0][1], entry[0][0])):
        if cell.get("visual_elevation", 0) <= 0:
            continue
        for face in sorted(cell.get("vertical_faces", []), key=lambda face: face["side"] == "front"):
            paint(face["polygon"], dungeon.dungeon_map.texture, restore=True)
        polygon = surface(cell)
        paint(polygon, dungeon.dungeon_map.texture, restore=True)
        if position in positions:
            paint(polygon, overlay.texture)
    return displayed


def draw_battle_ui(panel, digits, cards, *, cost, defense_points, remaining_enemies, selected=None):
    for index, (portrait, character) in enumerate(cards):
        available = cost >= character.cost and not character.deployed
        portrait.opacify(1.0 if available and character is not selected else 0.5)
        portrait.draw(CARD_FIRST_X + CARD_SPACING * index, CARD_Y, CARD_SIZE, CARD_SIZE)
    panel.draw(WIDTH // 2, HEIGHT // 2)

    draw_number(digits, remaining_enemies, 388, 570, 16)
    draw_number(digits, defense_points, 488, 570, 16)
    draw_number(digits, cost, 774, 40, 17)
    for index, (_, character) in enumerate(cards):
        draw_number(digits, character.cost, 242 + CARD_SPACING * index, 58, 9)
        if character is selected:
            center = CARD_FIRST_X + CARD_SPACING * index
            draw_rectangle(center - 29, CARD_Y - 29, center + 29, CARD_Y + 29, 234, 202, 130)


def load_character_sprites(characters):
    sprites = {}
    for character in characters:
        name = character.profile.split("-", 1)[1]
        idle = json.loads(
            (dungeon.METADATA_DIRECTORY / f"character/idle/{name}.json").read_text(encoding="utf-8")
        )
        attack = json.loads(
            (dungeon.METADATA_DIRECTORY / f"character/sprites/{name}.json").read_text(encoding="utf-8")
        )
        sprite = {"pivot": idle["pivot"], "fps": idle["fps"]}
        motions = {
            "idle": idle["animations"],
            "attack": attack["directional_attack_sheets"],
        }
        for state, directions in motions.items():
            sprite[state] = {
                direction: (motion, load_image(str(dungeon.GAME_DIRECTORY / motion["file"])))
                for direction, motion in directions.items()
            }
        sprites[character.profile] = sprite
    return sprites


def draw_character(character, sprites, x, y, opacity=1.0, *, cell=None, direction=None):
    sprite = sprites[character.profile]
    direction = character.direction if direction is None else direction
    animation = {"down": "front", "up": "back", "right": "right", "left": "right"}[direction]
    motion, sheet = sprite[character.state][animation]
    frame = character.motion_frame(len(motion["frames"]), sprite["fps"])
    rect = motion["frames"][frame]["pico2d_rect"]
    width, height = rect[2:]
    pivot_x, pivot_y = sprite["pivot"]
    if direction == "left":
        pivot_x = width - pivot_x
    perspective = cell.get("perspective_scale", 1.0) if cell is not None else 1.0
    scale = CHARACTER_SCALE * dungeon.battle_grid["cell_size"][0] / 64 * perspective
    if cell is not None:
        y -= cell["surface_rect"][3] * CHARACTER_FOOT_OFFSET
    sheet.opacify(opacity)
    center_x = x + (width / 2 - pivot_x) * scale
    center_y = y + (pivot_y - height / 2) * scale
    if direction == "left":
        sheet.clip_composite_draw(*rect, 0, "h", center_x, center_y, width * scale, height * scale)
    else:
        sheet.clip_draw(*rect, center_x, center_y, width * scale, height * scale)
    sheet.opacify(1.0)


def load_monster_sprites():
    metadata = json.loads(
        (dungeon.METADATA_DIRECTORY / "character/monster-motion.json").read_text(encoding="utf-8")
    )
    sprites = {}
    for profile, motion in metadata["monsters"].items():
        sprites[profile] = {
            "frame_size": metadata["frame_size"], "columns": metadata["columns"],
            "frame_count": metadata["frame_count"], "pivot": metadata["pivot"],
            "fps": {state: motion[f"{state}_fps"] for state in ("walk", "attack")},
            "sheets": {
                state: load_image(str(dungeon.GAME_DIRECTORY / motion[f"{state}_sheet"]))
                for state in ("walk", "attack")
            },
        }
    return sprites


def monster_screen_position(monster):
    """Project a continuous logical position, keeping movement smooth between tiles."""
    grid = dungeon.battle_grid
    projection = grid["projection"]
    column, row = monster.pos[0], -monster.pos[1]
    taper = 1 / projection["back_scale"] - 1
    depth = (row + 0.5) / grid["rows"]
    perspective = 1 / (1 + taper * (1 - depth))
    x = projection["center_x"] + (column + 0.5 - grid["columns"] / 2) * grid["cell_size"][0] * perspective
    y = projection["top"] + projection["height"] * depth * perspective
    top_depth, bottom_depth = row / grid["rows"], (row + 1) / grid["rows"]
    tile_height = projection["height"] * (
        bottom_depth / (1 + taper * (1 - bottom_depth))
        - top_depth / (1 + taper * (1 - top_depth))
    )
    return x, HEIGHT - y, perspective, tile_height


def draw_monster(monster, sprites):
    sprite = sprites[monster.profile]
    sheet = sprite["sheets"][monster.state]
    frame = monster.motion_frame(sprite["frame_count"], sprite["fps"][monster.state])
    width, height = sprite["frame_size"]
    left = frame % sprite["columns"] * width
    bottom = sheet.h - (frame // sprite["columns"] + 1) * height
    pivot_x, pivot_y = sprite["pivot"]
    if monster.direction == "left":
        pivot_x = width - pivot_x
    x, y, perspective, tile_height = monster_screen_position(monster)
    scale = CHARACTER_SCALE * dungeon.battle_grid["cell_size"][0] / 64 * perspective
    x += (width / 2 - pivot_x) * scale
    y += (pivot_y - height / 2) * scale - tile_height * CHARACTER_FOOT_OFFSET
    sheet.opacify(1.0)
    if monster.direction == "left":
        sheet.clip_composite_draw(left, bottom, width, height, 0, "h", x, y, width * scale, height * scale)
    else:
        sheet.clip_draw(left, bottom, width, height, x, y, width * scale, height * scale)


def direction_selector_center(cell):
    """Place the control around the character, clear of the HUD and screen edges."""
    x, y = cell["canvas_center"]
    tile_size = dungeon.battle_grid["cell_size"][0] * cell.get("perspective_scale", 1.0)
    y += cell["surface_rect"][3] * CHARACTER_FOOT_OFFSET - tile_size * 0.55
    radius = DIRECTION_SIZE / 2
    return max(radius + 4, min(WIDTH - radius - 4, x)), max(radius + 60, min(HEIGHT - 78 - radius, y))


def direction_at(x, y, center):
    dx, dy = x - center[0], y - center[1]
    if dx * dx + dy * dy < DIRECTION_DEAD_ZONE ** 2:
        return None
    if abs(dx) >= abs(dy):
        return "right" if dx > 0 else "left"
    return "down" if dy > 0 else "up"


def draw_placement_tiles(characters, hovered, character, *, only_hovered=False):
    for pos, cell in dungeon.battle_cells.items():
        if only_hovered and pos != hovered:
            continue
        available = dungeon.can_place(pos, characters, character)
        if not available and pos != hovered:
            continue
        color = (114, 163, 146) if available else (213, 96, 89)
        if pos == hovered and available:
            color = (234, 202, 130)
        polygon = cell.get("pico2d_surface_polygon")
        if polygon is None:
            left, bottom, width, height = cell["pico2d_surface_rect"]
            polygon = [(left, bottom + height), (left + width, bottom + height),
                       (left + width, bottom), (left, bottom)]
        center_x, center_y = cell["pico2d_center"]
        for inset in ((0.92, 0.86) if pos == hovered else (0.92,)):
            points = [(center_x + (x - center_x) * inset, center_y + (y - center_y) * inset)
                      for x, y in polygon]
            for index, (x, y) in enumerate(points):
                next_x, next_y = points[(index + 1) % len(points)]
                draw_line(x, y, next_x, next_y, *color)


def main():
    user = User(hp=3, scene=0)
    user.character = [
        Player(
            profile=name, attackSpeed=1, damage=10, hp=100, cost=price,
            allowedTiles=DEPLOYMENT_TILES[name].copy(),
        )
        for name, price in DEPLOYMENT_COSTS.items()
    ]
    title_image = None
    route_image = None
    hud_panel = None
    hud_digits = None
    range_overlay = None
    cards = []
    sprites = {}
    monster_sprites = {}
    monsters = []
    pending_monsters = []
    monster_spawn_points = []
    monster_spawn_number = 0
    next_monster_spawn = 0.0
    direction_images = {}
    dragged_character = None
    inspected_character = None
    pending_pos = None
    selected_direction = None
    direction_dragging = False
    mouse_x, mouse_y = 0, 0
    visited_rooms = set()
    battle_time = 0.0
    previous_frame_time = 0.0
    open_canvas(WIDTH, HEIGHT)
    try:
        title_image = load_image(str(TITLE_PATH))
        hud_panel = load_image(str(UI_DIRECTORY / "battle-hud.png"))
        hud_digits = load_image(str(UI_DIRECTORY / "battle-hud-digits.png"))
        range_overlay = load_image(str(RANGE_OVERLAY_PATH))
        direction_images = {
            direction: load_image(str(DIRECTION_DIRECTORY / f"direction-{direction}.png"))
            for direction in ("idle", "up", "down", "left", "right")
        }
        cards = [
            (load_image(str(PROFILE_DIRECTORY / character.profile / "skill/profile/deployment-square.png")), character)
            for character in user.character
        ]
        while True:
            # Account for elapsed time before input changes the selection speed.
            if user.scene == 2:
                frame_now = monotonic()
                selecting = dragged_character is not None or inspected_character is not None
                speed = TIME_SCALE * (DRAG_TIME_SCALE if selecting else 1.0)
                delta_time = (frame_now - previous_frame_time) * speed
                previous_frame_time = frame_now
                battle_time += delta_time
                user.update_battle(battle_time)
                while pending_monsters and monster_spawn_points and battle_time >= next_monster_spawn:
                    start = monster_spawn_points[monster_spawn_number % len(monster_spawn_points)]
                    monster = dungeon.spawn_monster(pending_monsters.pop(0), start, now=next_monster_spawn)
                    if monster is not None:
                        monsters.append(monster)
                    monster_spawn_number += 1
                    next_monster_spawn += MONSTER_SPAWN_INTERVAL
                for monster in monsters:
                    monster.update(battle_time)
                monsters[:] = [monster for monster in monsters if not monster.reachedGoal and monster.hp > 0]

            for event in get_events():
                if event.type == SDL_QUIT:
                    return
                if event.type == SDL_KEYDOWN:
                    if event.key == SDLK_ESCAPE and dragged_character is not None:
                        dragged_character = None
                        pending_pos = None
                        selected_direction = None
                        direction_dragging = False
                        continue
                    if event.key == SDLK_ESCAPE and inspected_character is not None:
                        inspected_character = None
                        continue
                    if (
                        user.scene == 2
                        and event.key in (SDLK_ESCAPE, SDLK_q)
                    ):
                        dragged_character = None
                        inspected_character = None
                        pending_pos = None
                        selected_direction = None
                        direction_dragging = False
                        user.finish_battle(cleared=event.key == SDLK_q)
                        monsters.clear()
                        pending_monsters.clear()
                        monster_spawn_points.clear()
                        dungeon.clear_map()
                        continue
                    if event.key == SDLK_ESCAPE:
                        return
                if user.scene == 0 and event.type in (SDL_KEYDOWN, SDL_MOUSEBUTTONDOWN):
                    route_image = dungeon.load_route()
                    title_image = None
                    user.scene = 1
                elif (
                    user.scene == 1
                    and event.type == SDL_MOUSEBUTTONDOWN
                    and event.button == SDL_BUTTON_LEFT
                ):
                    room_number = dungeon.room_at(event.x, event.y)
                    if room_number not in dungeon.visible_rooms(visited_rooms, user.pos):
                        continue

                    room = dungeon.route_rooms[room_number]
                    if (
                        room.map_type in (dungeon.MapType.BATTLE, dungeon.MapType.BOSS)
                        and room_number not in user.pos
                    ):
                        dungeon.load_map(room.map_index, map_kind=room.map_type)
                        if not sprites:
                            sprites = load_character_sprites(user.character)
                        if not monster_sprites:
                            monster_sprites = load_monster_sprites()
                        battle_time = 0.0
                        previous_frame_time = monotonic()
                        user.begin_battle(room_number, battle_time)
                        inspected_character = None
                        monsters.clear()
                        pending_monsters = [
                            profile for profile, count in room.monsters.items() for _ in range(count)
                        ]
                        monster_spawn_points = dungeon.monster_spawns()
                        monster_spawn_number = 0
                        next_monster_spawn = battle_time
                    elif room.map_type in (
                        dungeon.MapType.START,
                        dungeon.MapType.SHOP,
                        dungeon.MapType.TREASURE,
                    ):
                        visited_rooms.add(room_number)
                elif user.scene == 2:
                    if event.type in (SDL_MOUSEMOTION, SDL_MOUSEBUTTONDOWN, SDL_MOUSEBUTTONUP):
                        mouse_x, mouse_y = event.x, event.y
                    if event.type == SDL_MOUSEBUTTONDOWN:
                        if event.button == SDL_BUTTON_RIGHT:
                            dragged_character = None
                            inspected_character = None
                            pending_pos = None
                            selected_direction = None
                            direction_dragging = False
                        elif event.button == SDL_BUTTON_LEFT and pending_pos is not None:
                            center = direction_selector_center(dungeon.battle_cells[pending_pos])
                            if (mouse_x - center[0]) ** 2 + (mouse_y - center[1]) ** 2 <= (DIRECTION_SIZE / 2) ** 2:
                                direction_dragging = True
                                selected_direction = direction_at(mouse_x, mouse_y, center)
                        elif event.button == SDL_BUTTON_LEFT and dragged_character is None:
                            character = card_at(mouse_x, mouse_y, cards)
                            if character is not None:
                                inspected_character = None
                                if user.can_deploy(character):
                                    dragged_character = character
                            else:
                                inspected_character = deployed_character_at(mouse_x, mouse_y, user.character)
                    elif event.type == SDL_MOUSEMOTION and direction_dragging:
                        center = direction_selector_center(dungeon.battle_cells[pending_pos])
                        selected_direction = direction_at(mouse_x, mouse_y, center)
                    elif event.type == SDL_MOUSEBUTTONUP and event.button == SDL_BUTTON_LEFT:
                        if pending_pos is not None:
                            if direction_dragging:
                                center = direction_selector_center(dungeon.battle_cells[pending_pos])
                                selected_direction = direction_at(mouse_x, mouse_y, center)
                                direction_dragging = False
                                if selected_direction is not None:
                                    if SDL_GetKeyboardFocus() and dungeon.can_place(pending_pos, user.character, dragged_character):
                                        if user.deploy_character(dragged_character, pending_pos, battle_time, direction=selected_direction):
                                            inspected_character = dragged_character
                                    dragged_character = None
                                    pending_pos = None
                                    selected_direction = None
                        elif dragged_character is not None:
                            pos = dungeon.cell_at(mouse_x, mouse_y)
                            if dungeon.can_place(pos, user.character, dragged_character):
                                pending_pos = pos
                                selected_direction = None
                                direction_dragging = False
                            else:
                                dragged_character = None

            if not SDL_GetKeyboardFocus():
                dragged_character = None
                inspected_character = None
                pending_pos = None
                selected_direction = None
                direction_dragging = False

            clear_canvas()
            if user.scene == 0:
                title_image.draw(WIDTH // 2, HEIGHT // 2, WIDTH, HEIGHT)
            elif user.scene == 1:
                dungeon.draw_route(route_image, visited_rooms, user.pos)
            elif user.scene == 2:
                dungeon.dungeon_map.draw(WIDTH // 2, HEIGHT // 2)
                hovered = dungeon.cell_at(mouse_x, mouse_y)
                if dragged_character is not None:
                    if pending_pos is not None and dungeon.can_place(pending_pos, user.character, dragged_character):
                        draw_attack_range(dragged_character, range_overlay, pos=pending_pos, direction=selected_direction)
                    draw_placement_tiles(
                        user.character, pending_pos if pending_pos is not None else hovered,
                        dragged_character,
                        only_hovered=pending_pos is not None,
                    )
                elif inspected_character is not None and inspected_character.deployed:
                    draw_attack_range(inspected_character, range_overlay)
                deployed = [character for character in user.character if character.deployed]
                units = [
                    (dungeon.battle_cells[tuple(character.pos)]["pico2d_center"][1], character)
                    for character in deployed
                ]
                units.extend((monster_screen_position(monster)[1], monster) for monster in monsters)
                for _, unit in sorted(units, key=lambda entry: -entry[0]):
                    if unit.race == "monster":
                        draw_monster(unit, monster_sprites)
                    else:
                        cell = dungeon.battle_cells[tuple(unit.pos)]
                        x, y = cell["pico2d_center"]
                        draw_character(unit, sprites, x, y, cell=cell)
                draw_battle_ui(
                    hud_panel, hud_digits, cards,
                    cost=user.cost,
                    defense_points=user.hp,
                    remaining_enemies=len(monsters) + len(pending_monsters),
                    selected=dragged_character or inspected_character,
                )
                if dragged_character is not None:
                    if pending_pos is not None:
                        cell = dungeon.battle_cells[pending_pos]
                        x, y = cell["pico2d_center"]
                        center_x, center_y = direction_selector_center(cell)
                        direction_images[selected_direction or "idle"].draw(
                            center_x, HEIGHT - 1 - center_y, DIRECTION_SIZE, DIRECTION_SIZE,
                        )
                    elif dungeon.can_place(hovered, user.character, dragged_character):
                        cell = dungeon.battle_cells[hovered]
                        x, y = cell["pico2d_center"]
                    else:
                        cell = None
                        x, y = mouse_x, HEIGHT - 1 - mouse_y
                    draw_character(
                        dragged_character, sprites, x, y, opacity=0.85 if pending_pos is not None else 0.65,
                        cell=cell, direction=selected_direction,
                    )
            update_canvas()
            delay(1 / 60)
    finally:
        title_image = None
        route_image = None
        hud_panel = None
        hud_digits = None
        range_overlay = None
        cards.clear()
        sprites.clear()
        monster_sprites.clear()
        monsters.clear()
        pending_monsters.clear()
        direction_images.clear()
        dungeon.clear_map()
        dungeon.route_cover = None
        close_canvas()


if __name__ == "__main__":
    main()
