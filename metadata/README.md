# 게임 데이터

프로젝트의 JSON 44개를 모았습니다.

```text
metadata/
  character/
    sprites/     정적 시트·프레임 좌표와 목록, 9개
    idle/        최신 대기 모션 좌표·시간과 목록, 9개
    direction/   배치 방향 선택 UI 정보, 1개
    skills.json  캐릭터 스킬 설계 데이터
  item/
    relics.json  유물 25종의 아이콘·시트 좌표·효과 정보
    effects.json 유물 효과의 수치와 발동 조건
  map/           맵 20종의 좌표, 전체 배치와 목록, 22개
```

JSON 안의 파일·폴더 경로는 모두 **프로젝트 루트**를 기준으로 읽습니다. 예를 들어 `asset/map/dungeon-room.png`는 `main.py`와 같은 폴더에서 찾습니다. `metadata/map/manifest.json`의 좌표 파일 경로도 프로젝트 루트 기준입니다.

이미지는 `asset/character/`, `asset/item/`, `asset/map/`에 있습니다. 현재 `main.py`는 맵 PNG를 직접 불러오며, 이 JSON 데이터를 읽는 기능은 이후 게임 기능에 연결할 예정입니다.

## 캐릭터

검사, 수호기사, 궁수, 석궁병, 성직자, 약초사, 냉기술사, 그림자 도적의 8명입니다.

- `asset/character/sprites/atlases/`: 정적 대기·공격 시트 8개
- `asset/character/sprites/frames/`: 방향별 정적 대기 1장·공격 3장의 개별 PNG, 총 96장
- `asset/character/idle/atlases/`: 최신 대기 모션 시트 24개, 정면·뒷면·오른쪽 옆면
- `asset/character/deployment/cards/`: 배치 프로필 카드 8장
- `asset/character/skills/`: 스킬 카드 8장과 아이콘 16개
- `asset/character/direction/`: 상하좌우 배치 방향 선택 UI, 256×256 PNG와 통합 시트

대기 모션은 24fps, 방향별 48프레임, 한 주기 2초입니다. 한 프레임은 320×320, 시트는 8열×6행입니다. 발 기준점은 왼쪽 위 원점에서 (160, 288)입니다. 왼쪽 옆면은 오른쪽 옆면을 좌우 반전해 사용할 수 있습니다.

## 아이템

유물 아이콘 25개는 `asset/item/`의 개별 256×256 투명 PNG입니다. `atlas.png`는 5열×5행, 1280×1280 시트이며, `overview.png`는 전체 목록 이미지입니다.

[유물 효과표](../docs/유물효과.md)에 수치·적용 대상·발동 조건을 정리했습니다. 수치는 첫 플레이테스트용 설계 값이며, 초기 구현 목표 6종과 확장 19종을 함께 보관합니다.

## 맵

`asset/map/`의 맵 20개는 모두 800×600입니다. 격자는 11열×7행, 한 칸은 64×64, 왼쪽 위 기준 시작 좌표는 (48, 76)입니다. 높은 칸의 윗면은 16픽셀 위로 올라갑니다. 적 출현 지점은 3개, 도착 지점은 2개입니다.

- `asset/map/tiles/`: 공통·테마별 지형 타일
- `asset/map/objects/`: 적 출현 지점, 도착 지점, 횃불과 창문
- `asset/map/range-overlay.png`: 한 칸 크기의 반투명 공격 범위 타일
- `asset/map/overview.png`: 맵 20종 목록 이미지

좌표의 `atlas_rect`와 `rect`는 왼쪽 위 원점이며, `pico2d_rect`와 `pico2d_center`는 왼쪽 아래 원점을 씁니다.
