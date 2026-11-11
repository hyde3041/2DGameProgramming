# 궁수 머리 반동·석궁병 들기 연결

궁수의 최신 머리카락 모양·포니테일 반응은 [추가 보완 기록](archer-hair-follow.md)을 따른다. 석궁병은 이 문서의 들기 보완 상태를 유지한다.

사용자 요청에 맞춰 궁수의 공격 중 머리 움직임을 조금 늘리고, 석궁병이 낮춘 자세에서 바로 조준 자세로 바뀌던 구간에 실제 중간 그림을 추가했다. 두 캐릭터 모두 앞·뒤·옆 16프레임·16FPS·1초, 07 발사 후 기존 Idle 복귀를 유지한다.

## 궁수

기존 v2·arm-edit 상체와 머리·몸·팔·활·머리카락·장비 원본을 그대로 사용한다. 목 기준점을 고정하고 머리에 최대 1.3도의 추가 회전만 적용한다. 준비하면서 조금 기울이고, 발사 반동에 늦게 반응한 뒤 14~15에 추가 회전을 0으로 돌린다. 머리 크기와 위치를 별도로 맞추거나 새 그림으로 교체하지 않는다.

- 설정: [archer-head-motion.json](archer-head-motion.json)
- 제작기: `tools/archer-attack-v2-renderer.js`, `tools/build_archer_attack_v2.mjs`
- 실제 적용: `game/asset/character/player/main/2-archer/<front|back|side>/attack-sheet.png`

## 석궁병

원래 Idle·Aim·Fire·Recover 그림을 보존하고, 기존 그림을 내장 `image_gen`으로 편집해 방향별 들기 중간 자세 3장씩 추가했다. 중간 자세의 몸통·양팔·석궁은 연결된 그림이다. 고정된 2배 아틀라스 등록만 사용하며 캐릭터나 무기를 방향별로 늘이거나 찌그러뜨리지 않는다. 원래 머리·발과 상체 수정 마스크 밖 픽셀은 그대로 복사한다. 뒷면의 무기 원근과 돌출 길이는 별도 가이드로 보완했다.

- 00 Idle → 01 약간 들기 → 02 중간 → 03 조준 직전 → 04~06 Aim → 07~08 Fire → 09~10 Aim → 11~13 중간 자세를 역순으로 내려오기 → 14~15 Idle.
- 자세 사이를 반투명하게 겹치지 않는다. 중간 그림 9장이 실제로 서로 다른 동작이다.
- 원본·중간 그림: `game/asset/character/player/icon/layers/crossbowman/<방향>/attack/lift/`
- [전체 프롬프트와 생성 결과 경로](crossbowman-lift-sources.json), [등록 값·적용 마스크](crossbowman-lift.json)
- 제작기: `tools/prepare_crossbowman_lift.mjs`, `tools/prepare_crossbowman_connected.mjs`, `tools/build_crossbowman_connected.mjs`
- 실제 적용: `game/asset/character/player/main/3-crossbowman/<front|back|side>/attack-sheet.png`

```text
node tools/build_archer_attack.mjs --apply
node tools/prepare_crossbowman_lift.mjs
node tools/prepare_crossbowman_connected.mjs
node tools/build_crossbowman_attack.mjs --apply
```

## 검증

- 기존 이미지·Python 코드 등 1,116개 파일의 SHA-256 보존. 바뀐 기존 PNG는 두 캐릭터 공격 시트 6개다. 검사 공격과 24개 Idle 시트도 보존한다.
- 각 시트 1280×1280·투명 배경, 16장 모두 서로 다름. 원래 발 RGBA와 공격 00의 Idle 00 일치를 확인했다.
- 궁수는 이전·현재 머리 영역 밖의 변경 0, 목 결합점 오차 0, 추가 회전 최대 1.3도다. 머리 변환 행렬은 배율 1이다.
- 석궁병 중간 그림은 원래 머리 및 편집 마스크 밖 픽셀이 원본과 같다. 모든 출력의 배율은 1, 행렬 면적 오차는 2.3×10⁻¹⁶ 이하다.
- 실제 pico2d/SDL에서 세 캐릭터×세 방향의 16장 출력·Idle 복귀, main의 선택·공격·종료를 확인했다. 단위 검사 10개 통과.

수정 전 리소스·제작기·설정·검증 결과는 저장소 옆 `.git-pull-backups/ranged-attack-motion-20261106/`에 보관한다.

- [앞·뒤·옆 새 모션](../../../game/asset/character/player/icon/preview/ranged-attacks-motion-fixed.gif)
- [수정 전후 비교](../../../game/asset/character/player/icon/preview/ranged-attacks-before-after.gif)
- [석궁 들기 단계](../../../game/asset/character/player/icon/preview/crossbowman-lift-stages.png)
- ZIP: `.build/deliverables/ranged-attack-motion-fixed.zip`

## 최신: 날아가는 화살·볼트 제거

사용자 요청에 따라 두 현행 제작기의 별도 발사체 그리기만 제거했다. 원본 발사체 PNG는 보관하며 활·석궁과 발사 반동·머리 움직임은 유지한다. runtime 메타데이터의 `projectile_visual`은 false다. 16프레임·16FPS·1초와 07 발사 동작 시점도 유지한다.

수정 전과 비교해 발사체 영역 밖의 게임 픽셀 변경은 여섯 방향 모두 0이다. 발사체를 제외한 실제 그리기 호출·좌표·행렬도 같다. 기존 파일 1,156개의 SHA-256을 보존했고, 실제 pico2d에서 재생과 Idle 복귀를 확인했다. 수정 전 리소스와 검증은 `.git-pull-backups/ranged-no-projectiles-20261107/`에 있다. [현재 재생](../../../game/asset/character/player/icon/preview/ranged-attacks-no-projectiles.gif), ZIP은 `.build/deliverables/ranged-attacks-no-projectiles.zip`이다.
