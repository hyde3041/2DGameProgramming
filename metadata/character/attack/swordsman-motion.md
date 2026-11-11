# 검사 공격 — 검날과 어깨 윤곽 정리

최신 빨간 원 위치의 보완은 [어깨 아래 연결면 수정 기록](swordsman-armpit.md)을 따른다. 기존 동작은 유지하며 별도 숨은 보완 레이어만 추가했다.

현재 공격은 기존에 분리된 온전한 팔을 사용한다. 사용자 요청에 따라 검날에 섞인 옷·신발 모양의 잔여 조각과 거친 어깨 끝을 **내장 image_gen으로 편집하고, 제한된 마스크 안에만 적용**했다. 기존 캐릭터 전체를 교체하거나 팔을 위팔·아래팔로 다시 나누지 않는다.

## 실제 이미지 수정 범위

원래 `attack/motion/arm.png`와 `aligned/visible/weapon.png`는 그대로 보관한다. 적용한 복사본은 방향별 `game/asset/character/player/icon/layers/swordsman/<front|back|side>/attack/cleanup/`의 `arm.png`, `weapon.png`, `blade.png`다. `arm-mask.png`·`weapon-mask.png`는 변경을 허용한 범위다.

- 검: 손잡이에서 16px 이내는 보호하고, 검날 중심부를 보존하면서 가장자리와 끝에 붙은 잔여 조각을 정리한다. 검의 파란색 장식·손잡이·손은 유지한다.
- 어깨: 어깨축 반경 13px 안에서만 편집하며 가장자리 2px는 부드럽게 섞는다. 들쭉날쭉한 끝을 닫힌 둥근 소매·갑옷 윤곽으로 보완한다. 손·손목·흰 소맷단과 팔 아래쪽은 원본 그대로다.
- 마스크 밖의 원본 RGBA는 정확히 보존한다. 어깨축·손잡이·검 기준점과 프레임별 회전·이동 데이터도 수정 전과 같다.
- 얼굴·머리·몸통·다리·발은 생성 결과로 교체하지 않는다. 입력 아틀라스 아래쪽의 캐릭터 그림은 디자인 참고용이다.

| 방향 | 어깨 변경 픽셀 | 검 변경 픽셀 |
| --- | ---: | ---: |
| 앞 | 162 | 568 |
| 뒤 | 131 | 324 |
| 옆 | 197 | 680 |

이미지 편집은 **built-in image_gen 모드**를 사용했다. [정확한 전체 프롬프트와 생성 원본 경로](swordsman-edge-cleanup-sources.json), [등록 좌표](swordsman-edge-cleanup-registration.json), [마스크·보호 범위·적용 경로](swordsman-edge-cleanup.json)를 저장했다. 생성 아틀라스와 입력 아틀라스는 `game/asset/character/player/icon/layers/swordsman/attack/cleanup/source/`에 보관한다.

## 움직임과 그리기 순서

앞·뒤·옆 각각 **16프레임·16FPS·1초**, 4열×4행의 1280×1280 RGBA PNG다. 한 칸은 320×320, 발 기준점은 (160, 288)이다.

- 00~07: 팔과 검을 함께 반시계 방향으로 들어 올린다. 손목의 추가 회전은 전 구간 0도다.
- 08: 머리 위 전환. 00~08에는 검기·잔상이 없다.
- 09~11: 내려치기와 후속 움직임. 타격 중심은 10번이다.
- 12~15: 복귀. 효과는 13번까지 사라지고, 공격 완료 후 기존 Idle로 돌아간다.

뒷방향은 **사용자가 첨부한 `swordsman-attack-cape-fixed-back.gif`의 동작을 그대로 선택하고 어깨만 수정한 버전**이다. 첨부 파일과 저장된 GIF의 SHA-256이 일치함을 확인했다. 뒤쪽의 팔 회전·몸통·이동·가림 순서·검기·잔상·16프레임 타이밍을 해당 버전과 일치시켰다. 정면·옆면의 공격과 이펙트 PNG 36개는 이번 수정 전과 같다.

어깨축은 앞 (140,215), 뒤 (182,212), 옆 (149,216)이다. 사용자가 선택한 GIF처럼 세 방향 모두 머리 다음에 팔·검을 그린다. 뒤쪽의 기존 소매 그림을 (-3,-6)px 안쪽으로 겹치고 팔과 같이 회전시키는 `shoulder_socket`을 어깨 주변에 추가했다. 반경 13px의 바깥 2px를 감쇠하며, 팔을 자르거나 늘이지 않는다. 팔 각도 2~8도에서 이 층을 서서히 표시하므로 정지 자세는 보존한다. 어깨의 안쪽 층과 몸통 반경 6px의 작은 겹침은 유지하되 바깥 2px를 부드럽게 감쇠한다. 팔·손·검은 같은 행렬로 움직이며 발은 고정한다. 검기·잔상은 공격 시트에 이미 포함돼 있으므로 중복 표시하지 않는다.

망토는 기존 방향별 `aligned/cloth-hem.png` 전체 레이어를 몸통 뒤에 추가했다. 공격용 몸통 그림에서 빠져 있던 가려진 망토 영역을 원본 분리 레이어로 복원하며, 몸통과 같은 행렬로 움직인다. 망토·검·팔 PNG를 다시 자르거나 새로 그리지 않았다. 이번 회전 방향 수정에서도 기존 검·팔 정리 이미지, 어깨축과 몸통 움직임은 보존했다.

공격 00의 정지 자세는 기존 Idle 00을 기반으로 하되, 정리 마스크 안에서만 수정한 부분을 표시한다. 대기 시트 파일과 다른 캐릭터의 애니메이션은 보존한다.

## 재생성

```text
node tools/prepare_swordsman_edge_cleanup.mjs --apply
node tools/prepare_swordsman_motion.mjs
node tools/build_swordsman_attack.mjs --apply
python tools/export_attack_sheets.py swordsman
```

뒷방향만 수정·적용할 때는 `node tools/build_swordsman_attack.mjs --apply --back-only`를 사용한다. 이 옵션은 정면·옆면의 게임 시트와 효과 원본을 덮어쓰지 않고 미리보기에서도 해당 게임 PNG를 그대로 읽는다.

편집한 아틀라스를 다시 생성할 필요는 없다. 첫 단계는 저장된 결과를 원본에 등록하고 마스크 안에만 반영한다. `prepare_swordsman_motion.mjs`는 정리 복사본을 연결하고 기존 관절 좌표를 유지한다. Python의 `load_image()`·`clip_draw()`·`update(delta_time)` 구조는 유지한다. 게임에서는 **3: 검사, 스페이스바: 공격**이다.

- [3방향 재생](../../../game/asset/character/player/icon/preview/swordsman-attack-depth-fixed.mp4)
- [뒷방향 공격 GIF](../../../game/asset/character/player/icon/preview/swordsman-attack-depth-fixed-back.gif)
- [타격 회전 수정 전후](../../../game/asset/character/player/icon/preview/swordsman-armpit-fixed-comparison.png)
- [어깨·망토 수정 전후](../../../game/asset/character/player/icon/preview/swordsman-cape-join-comparison.png)
- [검·어깨 수정 전후](../../../game/asset/character/player/icon/preview/swordsman-edge-clean-comparison.png)
- ZIP: `.build/deliverables/swordsman-attack-16frames-depth-fixed.zip`
- [실제 게임 표시 크기](../../../game/asset/character/player/icon/preview/swordsman-cape-fixed-game-scale.png)

## 검증

- 여섯 정리 이미지의 변경 마스크 밖 RGBA 일치, 손·손잡이 반경 7px 보존, 원본 파일 SHA-256 보존을 확인했다.
- 어깨축·손잡이·검 기준점·프레임별 동작은 수정 전과 일치한다. 세 방향 모두 캐릭터 그림 16장이 서로 다르며 손목 회전은 0도다.
- 어깨 결합 오차는 2×10⁻¹³px 이하, 팔 길이 오차는 10⁻¹³px 이하이고, 팔과 검의 변환 행렬은 같다. 원본 검 기준점을 유지하며 실제 검끝의 오염 윤곽을 정리했다.
- 00~08 효과의 모든 알파는 0이며 효과가 셀 가장자리에서 잘리지 않는다. 공격 00은 정리 마스크 밖에서 원래 Idle 00과 일치한다.
- Idle 24개·다른 공격 21개·원본 소스 104개·기존 aligned 87개·Python 코드 7개를 포함한 276개 파일을 보존했다.
- 실제 pico2d/SDL에서 세 캐릭터×세 방향의 16장 출력·Idle 복귀, main의 캐릭터 전환·공격·종료를 확인했다. 30·60·144회 업데이트에서도 검사 공격은 1초에 끝난다. 단위 검사 10개 통과.
- MP4 재생, GIF 24장·1.5초, ZIP CRC와 실제 게임 PNG 일치를 확인했다.
- 이번 어깨·망토 수정에서는 기존 원본과 정리 이미지·Python 코드 등 300개 파일을 보존했다. 공격 중 별도로 그린 망토의 알파 영역과 최종 캐릭터를 비교해 세 방향 모두 망토 누락 픽셀 0, 셀 가장자리 잘림 0을 확인했다. 어깨의 부드러운 겹침도 반경 6px 안에 제한된다.
- 뒷방향 수정에서는 정면·옆면 PNG 36개를 포함해 336개 파일을 보존했다. 뒤쪽 타격 09~11의 검날 방향과 검기 픽셀을 검사해 화면 아래쪽 효과 픽셀 0을 확인했다. 망토 누락 0, 16프레임·16FPS, Idle 복귀와 단위 검사 10개도 통과했다.

앞선 어깨축 보완 단계에서는 선택한 GIF의 프레임별 회전·몸통·이동 값과 뒤쪽 검기 16장의 RGBA가 일치한다. 수정 픽셀은 어깨축에서 최대 12.96px 이내이며, 그 밖의 최종 공격 픽셀은 선택한 원본과 모두 같다. 01~02의 소매와 몸통은 보완 전 알파 연결이 끊어졌지만 보완 후 연결되며, 이동 프레임 15장 모두 연결 검사를 통과했다. 00·10·14·15는 최종 픽셀까지 원본과 같다. 기존 원본·정면·옆면·Idle·Python 코드 등 336개 파일의 SHA-256을 보존했다.

최신 어깨 아래 보완의 수정 전 시트·설정·제작기와 검증은 저장소 옆 `.git-pull-backups/swordsman-armpit-gap-20261106/`에 보관한다. 앞선 어깨축 보완 기록은 `.git-pull-backups/swordsman-shoulder-only-20261106/`다. 사용자가 선택한 동작 원본은 `.git-pull-backups/swordsman-back-direction-20261106/before/`에 있으며, 이전 안쪽 베기는 `.git-pull-backups/swordsman-back-inward-20261106/`, 회전 변경은 `.git-pull-backups/swordsman-back-outward-20261106/`, 어깨·망토 수정은 `.git-pull-backups/swordsman-cape-join-20261106/`, 검·어깨 정리는 `.git-pull-backups/swordsman-edge-cleanup-20261106/`에 남아 있다.

## 최신 추가: 검만 머리 뒤로 표시

후면의 `weapon`을 머리보다 먼저 그린다. 팔·어깨·손을 보존하기 위해 `weapon_behind_head_only`에서 기존 깊이 렌더를 같이 만들고, 시트 제작기의 원시 RGBA 처리에서 실제 머리 알파 안에만 새 깊이를 반영한다. 머리 밖 픽셀은 기존 렌더 그대로 복사한다. 별도 PNG를 자르거나 다시 그리지 않는다.

수정 전과 비교해 05·06·07·08에서만 각각 105·639·677·406개 픽셀이 바뀌고, 머리 밖 변경은 0이다. 나머지 12프레임, 기존 소스·어깨 보완 레이어·후면 효과·정면·옆면·Python 등 354개 파일은 그대로다. 프레임별 이동·회전 값과 손목 0도, 16FPS·1초를 유지한다. 검증·수정 전 자료는 `.git-pull-backups/swordsman-sword-behind-head-20261106/`에 저장한다.

- [완성된 세 캐릭터의 앞·뒤·옆 공격](../../../game/asset/character/player/icon/preview/completed-attacks-all-directions-depth-fixed.gif)
- [8명 전체 대기 모션](../../../game/asset/character/player/icon/preview/party-idle-current-8.gif)
