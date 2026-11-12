# 게임 데이터

프로젝트의 JSON 데이터를 모았습니다.

```text
metadata/
  character/
    sprites/     정적 시트·프레임 좌표와 목록, 9개
    idle/        최신 대기 모션 좌표·시간과 목록, 캐릭터별 레이어 설정, 17개
    attack/      궁수·석궁병·검사 16프레임 공격 좌표·시간, 원본과 제작 기록
    layers/      8명×3방향의 새 분리 원본·연결점·배치·원본 기준점과 목록, 11개
    direction/   배치 방향 선택 UI 정보, 1개
    skills.json  캐릭터 스킬 설계 데이터
  item/
    relics.json  유물 25종의 아이콘·시트 좌표·효과 정보
    effects.json 유물 효과의 수치와 발동 조건
  map/           전투·보스·특수 맵 78개의 좌표, 원본 출처, 배치와 목록
```

JSON의 `asset/...` 이미지 경로는 **`game/` 폴더**를 기준으로 읽습니다. 예를 들어 `asset/map/stage/main/cave/cave-0.png`의 실제 위치는 `game/asset/map/stage/main/cave/cave-0.png`입니다. `metadata/...` 데이터 경로는 저장소 루트 기준입니다.

이미지는 `game/asset/character/`, `game/asset/item/`, `game/asset/map/`에 있습니다. `game/code/main.py`는 맵 PNG를 불러오고, `IdleSprite`와 `ArcherSprite`는 대기·공격 JSON의 좌표와 시간을 읽습니다. 아래 `asset/...` 표기는 `game/`에 대한 상대 경로입니다.

## 캐릭터

플레이어 이미지와 분리 원본은 `asset/character/player/`에, 몬스터 걷기·공격 시트와 분리 원본은 `asset/character/monster/`에 둡니다. 몬스터 시트 경로와 재생 설정은 [monster-motion.json](character/monster-motion.json)에 있습니다.

검사, 수호기사, 궁수, 석궁병, 성직자, 약초사, 냉기술사, 그림자 도적의 8명입니다.

- `asset/character/player/main/<번호>-<캐릭터명>/skill/icon/`: 캐릭터별 스킬 아이콘 2개씩, 총 16개
- `asset/etc/direction/`: 상하좌우 배치 방향 선택 UI, 256×256 PNG와 통합 시트
- `asset/character/player/main/<번호>-<캐릭터명>/front/`: 정면 대기·공격 시트 2개
- `asset/character/player/main/<번호>-<캐릭터명>/back/`: 뒷면 대기·공격 시트 2개
- `asset/character/player/main/<번호>-<캐릭터명>/side/`: 오른쪽 측면 대기·공격 시트 2개
- `asset/character/player/main/<번호>-<캐릭터명>/skill/profile/deployment.png`: 배치 프로필 카드
- `asset/character/player/main/<번호>-<캐릭터명>/skill/profile/skill-card.png`: 스킬 프로필 카드
- `asset/character/player/icon/source/<캐릭터명>/`: 원본 개별 프레임과 정적 통합 시트 보관

각 방향 폴더에는 `idle-sheet.png`와 `attack-sheet.png`만 보관합니다. **궁수·석궁병·검사 공격은 각 방향 16프레임·16FPS·1초, 4열×4행의 1280×1280 PNG**입니다. 다른 5명의 공격은 기존 3프레임·960×320 시트를 유지합니다. 한 프레임은 모두 320×320입니다. `metadata/character/sprites/` JSON의 `directional_attack_sheets`에 방향별 공격 시트 경로와 좌표·시간을 정리했습니다. [궁수 제작 기록](character/attack/README.md), [석궁병 제작 기록](character/attack/crossbowman-connected.md), [검사 제작 기록](character/attack/swordsman.md)에 재생 데이터와 원본을 기록합니다.

전체 동료 목록 그림은 `asset/character/player/character-overview.png`, 검사 소개 그림은 `asset/character/player/main/0-swordsman/skill/profile/cover.png`입니다.

배치할 칸을 고르면 `asset/etc/direction/direction-idle.png`를 192×192로 표시합니다. 화살표 또는 중앙을 누르고 당기는 방향에 따라 `direction-up/down/left/right.png`로 바뀌며, 버튼을 놓을 때 방향과 코스트를 확정합니다. 중앙 20픽셀 안에서는 확정하지 않습니다. 우클릭·Esc·창 포커스 이탈은 선택을 취소합니다. 선택 중에는 절반 속도를 유지하고 기존에 설정한 전투 속도로 복귀합니다.

각 `Player.direction`은 `down/up/left/right` 중 하나입니다. 정면·뒷면·측면 시트를 연결하고 왼쪽은 측면을 좌우 반전합니다. 대기와 공격은 각 메타데이터의 실제 프레임 수를 사용합니다. `attackRange`는 아래를 향하는 원본 좌표를 유지하고 `attack_cells()`에서 현재 방향으로 회전한 칸을 계산합니다.

8명 모두 방향별 16프레임·16FPS, 한 주기 1초입니다. 시트는 4열×4행의 1280×1280, 프레임은 기존과 같은 320×320입니다. 총 24개 시트에 384프레임을 저장합니다. 발 기준점은 왼쪽 위 원점에서 (160, 288)입니다. 메타데이터에서 `right` 방향으로 기록된 이미지는 `side/`에 있습니다. 전체 목록의 시간 설정은 `manifest.json`의 `timing_by_character`와 각 캐릭터 JSON을 확인합니다.

8명 모두 원본 스프라이트의 비율과 위치를 기준으로 다시 정렬했습니다. 보이는 얼굴·머리·몸통·팔·다리·의상·장비는 원본 픽셀과 좌표를 유지합니다. 재작화된 부위는 머리와 팔 아래에 가려진 목·어깨 등 연결부를 완성하는 데 사용합니다. 이전 재작화 과정에서 달라진 얼굴 크기, 발 간격, 무기 위치를 그대로 사용하지 않습니다.

현재 원본은 `asset/character/player/icon/layers/<캐릭터>/<방향>/aligned/`입니다. 부위별 완성 원본 PNG와 `visible/`(원본 표면), `hidden/`(가려진 부분)을 함께 저장합니다. 실제 재생은 JSON의 `idle_order` 순서로 숨은 부분을 먼저 그리고 원본 표면을 그립니다. 임의 순서로 완성 PNG를 겹치지 않습니다. 부위 PNG는 320×320이며 기준점은 (160, 288)입니다. 원본과 공격 시트, 이전 재작화 원본은 보존합니다.

`metadata/character/layers/reference-alignment.json`에는 원본의 목·허리·어깨·손 좌표와 무기 영역을 기록합니다. `layers/<캐릭터>.json`에는 부위 파일, 완성 원본, 가려진 부분, 그리는 순서, 검사 결과를 기록합니다. 24방향 모두 원본 표면의 RGBA 픽셀과 좌표가 보존되는지 확인했습니다.

**8명 모두 새 대기를 적용했습니다.** 8명 모두 최신 요청에 맞춰 16프레임·16FPS로 통일했습니다. 한 주기는 1초입니다. 몸통은 작게 이동·회전하고 머리와 팔은 시차를 두어 반응합니다. 팔은 각 어깨를 회전축으로 사용하여 떨어지지 않습니다. 활·검·지팡이·물약 등은 잡고 있는 손과 같은 변환을 사용하고, 방패는 방패를 잡는 팔을 따릅니다. 머리카락과 옷자락은 추가 지연을 사용합니다. 발 레이어는 고정합니다. 사각형 영역을 얼려 옷자락이나 무기를 잘라내지 않습니다.

재생 중 모든 부위는 크기 변화 없이 이동·회전만 사용합니다. 0초의 자세는 원본 좌표이고 1초의 자세와 이어집니다. 121개 시점에서 어깨·목 연결, 손과 무기의 연결, 단위 크기와 발 고정을 검사합니다. 최종 합성에서 검 등이 신발 앞을 지나갈 수 있으므로 발 고정은 다리 레이어 단독 출력과 변환도 함께 확인합니다.

제공된 `Amiya_(Medic).webm`, `Amiya_(Medic)_Skin_1.webm`을 프레임별로 확인하고 몸통·팔·머리·옷자락이 차례로 반응하는 방식을 참고했습니다. 해당 캐릭터의 디자인을 게임 리소스로 사용하지 않았습니다.

원본 정렬은 Node.js와 `sharp`가 있는 환경에서 `node tools/align_character_layers.mjs <검사 폴더> [캐릭터 ID]`로 재생성합니다. 시트는 `sharp`, `playwright`, Chrome이 있는 환경에서 `node tools/build_archer_idle.mjs <출력 폴더> [캐릭터 ID]`로 생성합니다. 캐릭터 ID를 생략하면 궁수입니다. 이 도구는 각 레이어 설정의 실제 프레임 수와 FPS를 읽습니다. 현재 8명 모두 16개 시점의 서로 다른 동작을 새로 렌더링하며, 기존 게임 시트를 자동으로 덮어쓰지 않습니다.

`idle_sprite.py`와 `attack_sprite.py`는 JSON의 실제 FPS와 프레임 수를 사용합니다. `update(delta_time)`만 시간을 진행시키며, `draw()`는 현재 프레임을 `clip_draw()`로 표시합니다. 렌더링 횟수가 달라도 같은 경과 시간에는 같은 프레임을 표시합니다. `main.py`는 맵의 높은 칸 중심 (208, 444)에 선택한 캐릭터를 표시합니다. 1은 궁수, 2는 석궁병, 3은 검사입니다.

현재 프로젝트에는 Walk·Run과 충돌 판정이 아직 없습니다. 궁수·석궁병·검사의 공격 시트 총 9개를 16프레임으로 교체했고, 원본 개별 공격 프레임과 다른 5명의 공격 15개는 보존했습니다. 스페이스바로 공격을 한 번 재생한 뒤 Idle로 돌아갑니다. 화살·볼트·베기는 공격 그림의 연출이며 실제 피해 계산은 아직 없습니다.

## 아이템

유물 아이콘 파일에는 0부터 24까지 번호를 붙입니다. 유물 아이콘 25개는 `asset/item/`의 개별 256×256 투명 PNG입니다. `atlas.png`는 5열×5행, 1280×1280 시트이며, `overview.png`는 전체 목록 이미지입니다.

[유물 효과표](../docs/유물효과.md)에 수치·적용 대상·발동 조건을 정리했습니다. 수치는 첫 플레이테스트용 설계 값이며, 초기 구현 목표 6종과 확장 19종을 함께 보관합니다.

## 맵

`asset/map/field/`에는 탐험 지도와 화면 시안을, `asset/map/stage/main/`에는 전투 맵을, `asset/map/stage/icon/`에는 지형 타일과 오브젝트를 모았습니다.

`asset/map/field/icon/`의 탐험 지도 타일은 모두 여백 없는 64×64입니다. 전투 방(`battle-room.png`), 기본 방(`basic-room.png`), 좌우 연결선(`path-horizontal.png`), 상하 연결선(`path-vertical.png`), 빈 배경(`empty.png`)의 5종이며, 연결선은 타일 끝까지 이어집니다.

`asset/map/stage/main/cave/`의 맵은 [PRTS.Map rogue_4](https://map.ark-nights.com/areas/rogue_4)의 공개 타일 데이터를 기존 광산 타일 그림으로 재구성한 `cave-0.png`~`cave-77.png`입니다. 일반 43개, 보스 21개, 특수 14개이며 모두 800×600입니다. 동일한 원본 파일을 공유하는 긴급 난이도 49개는 중복 생성하지 않고 각 맵의 `source.aliases`에 기록합니다.

원본의 행·열 수, 지상·고지대, 배치 가능 여부, 출입구와 순간이동 위치를 유지합니다. 칸 크기와 시작 좌표는 화면과 HUD 여백에 맞춰 맵별로 계산하며 `grid`에 저장합니다. 캐릭터의 논리 좌표는 `(column, -row)`입니다.

전투 맵 78개는 승인한 [비스듬한 시점 시안](map/reference/oblique-flat-approved.png)을 기준으로 표시합니다. 뒤쪽 폭은 앞쪽의 0.86배, 깊이는 기본 칸 크기의 0.82배이며 `grid.projection`에 저장합니다. 지상·고지대·막힌 칸의 윗면은 같은 평면에 놓고 내부 단차는 없앴습니다. 고지대는 밝은 타일로 구분하고 논리적인 `height_level`과 배치 속성은 유지합니다. 포털은 바닥에 눕히지 않고 세워 그립니다.

`cells.surface_polygon`은 화면의 기울어진 네 꼭짓점이고 `pico2d_surface_polygon`은 같은 좌표를 왼쪽 아래 원점으로 변환한 값입니다. 클릭 판정과 배치 테두리는 이 다각형을 사용합니다. 캐릭터의 발은 `pico2d_center`에서 화면상 칸 높이의 18%만큼 아래에 놓고, 드래그 배치 미리보기에도 같은 위치를 사용합니다. `perspective_scale`에 따라 원근 크기만 조절하여 신체 비율을 유지합니다. `surface_rect`는 다각형을 포함하는 사각형이며 클릭 판정의 빠른 제외에 사용합니다.

`manifest.json`이 맵 선택 목록입니다. 약도의 전투방 12개는 일반 맵 43개에서, 보스방은 보스 맵 21개에서 선택합니다. 특수 맵 14개는 데이터와 이미지로 보관하며 일반 전투방에서는 추첨하지 않습니다. 몬스터 종류와 수는 현재 게임의 임시 설정이며 원작의 적 편성을 가져오지 않습니다.

각 JSON의 `source`에는 원본 페이지·데이터 URL과 SHA-256을 기록했습니다. `routes`는 원본의 이동·대기·순간이동 체크포인트를 위쪽 원점 좌표로 변환한 데이터이며 설치물용 더미 경로는 제외합니다. 원작의 특수 타일 효과와 설치물은 `source_tile_key`, `source_blackboard`, `source_predefines`에 기록하고, 실제 효과·적 이동은 아직 구현하지 않았습니다.

다시 생성하려면 `python tools/import_rogue4_maps.py --fetch`로 공개 데이터를 받아 `.build/oblique-maps/`에 좌표를 만들고, `python tools/render_cave_maps.py .build/oblique-maps --overview`로 PNG를 만듭니다. 이미 받은 데이터를 사용할 때는 `--fetch`를 생략합니다. 실제 적용 전에 기존 이미지와 JSON을 백업합니다. 2026-11-12 교체 전 20개 맵은 `.build/backups/maps-before-rogue4-20261112-102930/`, 시점 변경 전 78개 맵은 `.build/backups/maps-before-oblique-20261112-110006/`에 보관했습니다.

- `asset/map/stage/icon/`: 공통·테마별 지형 타일
- `asset/map/stage/icon/objects/`: 적 출현 지점, 도착 지점, 횃불과 창문
- `asset/map/stage/main/range-overlay.png`: 한 칸 크기의 반투명 공격 범위 타일
- `asset/map/stage/main/overview.png`: 맵 78개 목록 이미지

좌표의 `atlas_rect`와 `rect`는 왼쪽 위 원점이며, `pico2d_rect`와 `pico2d_center`는 왼쪽 아래 원점을 씁니다.
