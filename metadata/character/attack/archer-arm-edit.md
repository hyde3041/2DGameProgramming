# 궁수 공격 팔 두께 수정

**현행 적용 버전이다.** 2026-11-06 사용자가 이 버전을 선호하여 고정 부위 실험 이전의 시트·설정·미리보기로 복원했다.

2026-11-06 사용자 지적에 따라 조준 자세에서 두꺼워지는 팔을 수정했다. 재생 코드의 상체 배율은 원래부터 0.44로 일정했다. 기존 상체 자세 그림의 팔뚝·장갑·팔꿈치 볼륨 차이가 원인이었다.

내장 image_gen으로 기존 앞·뒤·옆 상체 아틀라스의 팔 두께를 국소 편집했다. [실행한 프롬프트](archer-arm-edit-prompt.txt)는 약 25% 가는 팔 윤곽을 요청한다. 새 캐릭터나 전신을 생성하지 않았다. 편집 결과 전체를 게임에 사용하지 않고, 원래 부위 그림의 팔 주변 마스크 안에만 반영했다. 활을 잡는 손 중심 부근과 팔 마스크 밖의 RGBA는 원래 픽셀을 유지한다. 어깨·손 좌표를 기준으로 하므로 전체 상체·머리·활을 확대하거나 재생 중 팔을 늘이지 않는다.

## 파일과 재생성

- 편집 원본·마스크·적용 부위: `game/asset/character/icon/layers/archer/<방향>/attack/arm-edit/`
- [원본 아틀라스와 관절 좌표](archer-arm-edit-sources.json), [적용된 부위와 마스크](archer-arm-proportions.json)
- 게임: `game/asset/character/main/2-archer/<방향>/attack-sheet.png`
- [전후 비교](../../../game/asset/character/icon/preview/archer-arm-comparison.mp4): 왼쪽 수정 전, 오른쪽 수정 후. 실제 16장 시트를 같은 시간에 재생한다.
- [수정본 미리보기](../../../game/asset/character/icon/preview/archer-attack-arm-fixed.mp4)
- ZIP: `.build/deliverables/archer-attack-16frames-arm-fixed.zip`

재생성은 다음 순서이다. 편집 아틀라스는 이미 프로젝트에 저장되어 있으므로 이미지 생성 도구를 다시 호출할 필요가 없다.

```text
node tools/clean_archer_attack_parts.mjs
node tools/prepare_archer_arm_edit.mjs
node tools/build_archer_attack_v2.mjs --apply
python tools/export_attack_sheets.py archer
```

단순 좌표 압축으로 시험한 그림은 경계 품질 문제로 적용하지 않았다. 그 시험 도구와 출력은 저장소 옆 `.git-pull-backups/archer-arm-proportion-20261106/rejected/`로 옮겼다.

## 확인

- 앞·뒤·옆 각 16프레임·16FPS·1초, 320×320 프레임과 1280×1280 시트 규격 유지.
- 45개 수정 부위에서 팔 마스크 밖 RGBA 일치, 각 자세의 활을 잡는 손 중심 9×9 영역 일치 확인.
- 머리·얼굴과 발 픽셀, Idle 00 시작 자세 유지. 떠 있는 불필요한 조각이 다시 생기지 않았는지 검사.
- 실제 pico2d/SDL에서 궁수·석궁병의 총 6방향 각각 16장 출력, 1초 후 Idle 복귀, 실제 main에서 선택·공격·종료 확인.
- 해시로 Idle 24개, 다른 공격 21개, 원본 이미지·궁수 기존 분리 부위 275개 보존 확인.
- MP4 디코딩·재생, ZIP에 포함된 PNG와 실제 게임 PNG 일치 확인.

원본 백업과 검사 결과는 저장소 옆 `.git-pull-backups/archer-arm-proportion-20261106/`에 보관한다.

최신 머리 움직임 보완은 기존 arm-edit 그림을 유지하며 목 축에 추가 회전만 적용한다. [설정·적용·검증](ranged-motion.md)을 참고한다.
