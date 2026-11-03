# 배치 중 공격 범위를 표시하는 반투명 타일

기존 던전 배경과 방향 선택 UI에 맞춘 주황색 범위 표시 이미지입니다. 사선이 들어간 기본형과 단색형을 제공합니다. SVG 도형을 PNG로 내보냈으며 배경과 내부 채움에 실제 알파 투명도가 들어 있습니다.

| 파일 | 용도 |
| --- | --- |
| `png/attack-range.png` | 기본 사선 타일, 128 × 128 |
| `png/attack-range-plain.png` | 단순한 단색 타일, 128 × 128 |
| `png-2x/` | 같은 타일의 256 × 256 이미지 |
| `svg/` | 색과 투명도를 바꿀 수 있는 원본 |
| `preview.png` | 던전 바닥에 겹쳐 본 확대 예시 |
| `preview-full.png` | 같은 예시의 전체 맵 |

- 기본 채움 불투명도: 22%. 테두리는 더 선명하게 표시합니다.
- 이미지의 중심이 칸의 중심입니다. 기본 이미지 기준점은 (64, 64)입니다.
- PNG 안에 투명도가 적용되어 있으므로 그대로 그리면 됩니다.
- 실제 칸의 가로·세로 크기에 맞춰 이미지 크기를 지정하면 됩니다.
- 그리기 순서: 맵, 공격 범위 타일, 캐릭터, 방향 선택 UI.
- 미리보기의 범위 모양은 이미지 확인을 위한 예시이며 실제 캐릭터 능력치가 아닙니다.

## pico2d에서 사용

```python
from pico2d import load_image

range_tile = load_image('assets/ui/attack-range-v1/png/attack-range.png')


def draw_attack_range(cells, cell_width, cell_height):
    # cells에는 게임에서 계산한 각 칸의 화면 중심 좌표를 넣습니다.
    # pico2d 화면 좌표는 왼쪽 아래가 (0, 0)입니다.
    for center_x, center_y in cells:
        range_tile.draw(center_x, center_y, cell_width, cell_height)


# 기존 draw 단계에서 맵 다음, 캐릭터 이전에 호출합니다.
# draw_attack_range([(400, 300), (480, 300)], 80, 80)
```

예시 함수는 전달받은 칸을 표시합니다. 실제 공격 범위 계산과 방향 회전, 맵의 높낮이·장애물 규칙은 전투 구현 시 처리합니다.
