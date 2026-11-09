# 던전 원정대

게임공학과 **2023184009 김연준**의 2D 게임 프로그래밍 프로젝트입니다.

던전을 탐험하며 동료를 모집하고 강화해 최종 보스를 쓰러뜨리는 **타워 디펜스 형식의 로그라이크 게임**을 기획합니다. Python과 pico2d로 개발할 예정입니다.

## 제출 자료

- **발표 동영상:** [YouTube에서 보기](https://www.youtube.com/watch?v=OwTFQGSFT5A)
- **발표 PPT:** [6장 발표 자료 다운로드](docs/발표_PPT_던전원정대_김연준.pptx)
- **기획서 PPT:** [스프라이트를 포함한 24장 상세 기획서 다운로드](docs/기획서_PPT_던전원정대_김연준.pptx)
- [텍스트 기획서](docs/기획서.md)
- [발표 대본](docs/발표대본.txt)

## 게임 소개

처음에는 동료 3명으로 탐험을 시작합니다. 근접·원거리·힐러·특수 직업군을 조합해 최대 6명으로 파티를 편성하고, 배치 비용을 사용해 던전의 칸에 배치합니다. 기본 공격과 회복은 자동으로, 스킬은 플레이어가 직접 사용합니다.

일반 스테이지를 클리어하면 **동료 모집 / 기존 동료 강화 / 유물 획득 중 하나**를 선택합니다. 강화를 통해 새로운 스킬을 해금하고, 파티와 유물의 조합을 발전시켜 던전 최심부의 보스에 도전합니다.

## 목표 범위

| 항목 | 초기 개발 목표 |
| --- | --- |
| 동료 | 4개 직업군, 8명 / 전투 편성 최대 6명 |
| 스킬 | 동료당 2개, 총 16종 / 강화로 두 번째 스킬 해금 |
| 성장 | 동료 모집, 동료·스킬 강화, 유물 6종 |
| 전투 | 일반 스테이지 4개와 최종 보스전 1개 |
| 몬스터와 맵 | 일반 몬스터 2종, 보스 1종, 전투 맵 3종 |

현재는 **맵에서 캐릭터의 배치 위치와 방향을 고르고 대기·공격을 재생하는 단계**입니다. `game/code/main.py`에서 800×600 던전 맵과 캐릭터를 표시합니다. **1은 궁수, 2는 석궁병, 3은 검사, 4는 수호기사이며 스페이스바로 공격**합니다. 맵의 배치 가능한 칸을 클릭한 뒤 화살표를 누르면 해당 방향으로 배치를 확정합니다. `IdleSprite`와 공통 `AttackSprite`는 실제 경과 시간으로 프레임을 갱신합니다. 적·피해 판정·보상은 이후 개발할 예정입니다.

## 실행 방법

VS Code에서 pico2d가 설치된 Python 환경을 선택하고 `game/code/main.py`를 실행합니다. **1·2·3·4**로 캐릭터를 고르고 맵 칸을 클릭한 뒤 **화살표 클릭**으로 방향을 정해 배치를 확정합니다. **방향키**로 미리 보고 **Enter** 또는 선택기 중앙으로 확정할 수도 있습니다. **우클릭·Esc**는 배치 취소이며, 선택기가 닫혀 있을 때 **Esc**로 종료합니다. **스페이스바**로 현재 방향의 공격을 재생합니다. 왼쪽 방향은 옆면 시트의 좌우 반전을 사용합니다.

```powershell
python -m pip install -r requirements.txt
python game/code/main.py
```

맵은 `game/asset/map/stage/main/dungeon-room.png`입니다. 코드가 프로젝트와 `game` 폴더의 위치를 계산하므로 실행 터미널의 현재 폴더와 관계없이 리소스를 찾습니다.

## 제작한 이미지

![캐릭터 디자인 시안](game/asset/character/character-overview.png)

![던전 배경 시안](game/asset/map/stage/main/dungeon-room.png)

- [캐릭터 8명](metadata/README.md#캐릭터): 방향별 대기 시트 24개와 공격 시트 24개
- 원본 통합 시트 8개와 개별 프레임 96장은 `asset/character/icon/source/`에 보관
- 8명 모두 앞·뒤·옆 대기를 방향별 16프레임·16FPS·1초 반복으로 통일. 4열×4행의 1280×1280 시트, 프레임 320×320
- 궁수 앞·뒤·옆 공격은 사용자가 제공한 3개 시트를 적용하며 각 16프레임·16FPS·1초로 재생합니다. 1254×1254 원본을 전체 동일 배율로 1280×1280에 맞추고 검은 배경을 투명하게 처리했습니다. 왼쪽은 옆면 반전을 사용합니다. [현재 시트 미리보기](game/asset/character/icon/preview/archer-user-three-directions.gif), [현재 입력과 변환 설정](metadata/character/attack/archer-import.json)
- 석궁병 앞·뒤·옆 공격은 몸통·양팔·석궁이 연결된 기존 원본 자세로 비율을 유지하도록 수정, 각 16프레임·16FPS·1초. 작은 반동과 발사 후 복귀. [실제 시트 미리보기](game/asset/character/icon/preview/crossbowman-attack-no-projectile.mp4), [원본과 검증 기록](metadata/character/attack/crossbowman-connected.md)
- 검사 앞·뒤·옆 공격: 기존 분리 스프라이트를 다시 자르지 않고 사용하는 각 16개 자세·16FPS·1초. 어깨축을 위로 맞추고, 온전한 팔·손·원본 검을 함께 회전하며 어깨 연결부·검날 윤곽·망토를 보완. 손목은 고정하며 이펙트 없이 들어 올린 뒤 타격할 때만 검기·잔상을 표시. 뒤쪽은 선택한 동작과 어깨 보완을 유지하고 머리와 겹친 검만 뒤로 가림. 정면·옆면 시트는 보존. [3방향 재생](game/asset/character/icon/preview/swordsman-attack-depth-fixed.mp4), [뒷방향 GIF](game/asset/character/icon/preview/swordsman-attack-depth-fixed-back.gif), [어깨 위치](game/asset/character/icon/preview/swordsman-shoulder-pivots.png), [기존 레이어·검증 기록](metadata/character/attack/swordsman-motion.md)
- `python tools/export_attack_sheets.py archer`, `crossbowman` 또는 `swordsman`으로 방향별 시트 3개를 `.build/deliverables/`의 ZIP으로 묶음. 원본 PNG를 확대·축소하지 않고 그대로 보관
- 8명 모두 원본의 신체 비율과 위치로 복원. 보이는 원본과 가려진 연결부의 보완 그림은 `asset/character/icon/layers/<캐릭터>/<방향>/aligned/`에 보관
- 8명 모두 몸통·팔·머리·머리카락·옷자락의 움직임에 시차를 적용. 팔은 어깨에 붙어 움직이고, 무기는 손을 따라가며 발은 고정. 재생 중 늘이기 없이 이동·회전만 사용
- 배치 프로필 카드 8종, 스킬 프로필 카드 8종과 스킬 아이콘 16종, 상하좌우 배치 방향 선택 UI
- [유물 아이콘과 효과 25종](metadata/README.md#아이템): 256×256 투명 PNG, 통합 시트와 [효과표](docs/유물효과.md)
- [규격을 통일한 맵 20종](metadata/README.md#맵): 800×600·11×7칸 배경, 층별 좌표와 이동 경로, 도착 지점 2개
- [한 칸 크기의 반투명 공격 범위 타일](game/asset/map/stage/main/range-overlay.png): 64×64
- [탐험 지도용 타일 5종](game/asset/map/field/icon/): 전투 방·기본 방·좌우 연결선·상하 연결선·빈 배경, 모두 64×64
- [이미지와 데이터 규격](metadata/README.md)

## 폴더

```text
game/code/main.py          던전 맵·캐릭터 선택, 스페이스바 공격과 종료 처리
game/code/idle_sprite.py   경과 시간 기반 Idle 재생, 방향과 발 기준점 유지
game/code/attack_sprite.py 공격을 한 번 재생한 뒤 Idle로 복귀하는 공통 재생기
game/code/archer_sprite.py 궁수 데이터 연결
game/code/crossbowman_sprite.py 석궁병 데이터 연결
game/code/swordsman_sprite.py 검사 데이터 연결
game/code/guardian_sprite.py 수호기사 데이터 연결
tests/                     대기·공격 시간, 방향, 복귀와 그리기 기준점 검증
requirements.txt           실행에 필요한 Python 패키지
game/asset/
  character/
    icon/                  원본 프레임·통합 시트와 캐릭터별 분리 원본
    main/                  캐릭터별 idle·attack 시트, 스킬 아이콘과 프로필
  item/                    유물 아이콘 25종과 통합 시트
  etc/                     방향 선택 UI와 타이틀 그림
  map/
    field/                 탐험 지도와 화면 시안
      icon/                64×64 탐험 지도 타일 5종
    stage/
      icon/                지형 타일과 목표 지점 오브젝트
      main/                전투 맵 20종과 범위 표시 타일
metadata/                  캐릭터·아이템·맵 JSON, 공격 좌표·연결점과 제작 프롬프트
tools/                     레이어 정렬, Idle·공격 시트 제작과 ZIP 내보내기
docs/                      발표 PPT, 상세 기획서 PPT, 대본
```

JSON 파일은 [metadata 폴더](metadata/README.md)에 종류별로 모았습니다. JSON의 `asset/...` 이미지 경로는 `game/` 기준이고, `metadata/...` 데이터 경로는 저장소 루트 기준입니다.

새 캐릭터는 처음부터 부위별 원본을 저장하고, 조립 및 움직임을 확인하는 제작 규칙을 [프로젝트 지침](AGENTS.md)에 기록했습니다.

공격력, 회복량, 배치 비용, 스킬 재사용 시간과 유물 수치는 전투 구현 후 조정합니다. 6주 개발 계획은 개발 순서를 설명하는 상대 일정이며 실제 수업 일정에 맞춰 조정합니다.

궁수 머리 반동·석궁병 들기 보완: [앞·뒤·옆 재생](game/asset/character/icon/preview/ranged-attacks-motion-fixed.gif), [수정 전후](game/asset/character/icon/preview/ranged-attacks-before-after.gif), [제작·검증 기록](metadata/character/attack/ranged-motion.md).

궁수 머리카락 반응: [수정 전후](game/asset/character/icon/preview/archer-hair-follow-before-after.gif), [앞·뒤·옆](game/asset/character/icon/preview/archer-attack-hair-follow.gif), [편집·검증 기록](metadata/character/attack/archer-hair-follow.md).

현재 궁수·석궁병 공격은 날아가는 화살·볼트를 제외한 [캐릭터 동작만 표시](game/asset/character/icon/preview/ranged-attacks-no-projectiles.gif)합니다.

수호기사 방패 밀기: [손끝·중앙 손잡이 연결 수정 재생](game/asset/character/icon/preview/guardian-center-handle.gif), [제작·검증 기록](metadata/character/attack/guardian-motion.md). 원본 크기의 팔을 어깨에 연결하고 방패 중앙 손잡이를 잡도록 맞췄습니다. 팔은 방패 뒤에 둡니다. 수호기사 대기·공격은 같은 부위와 순서로 만들며 각각 16프레임·16FPS·1초입니다. 게임에서 **4 → 스페이스바**로 확인합니다.
