const safeStringify = (value) => {
  if (!value) return "null";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "null";
  }
};

export function buildGeminiBowlingOcrPrompt({ previousResult = null, retryAttempt = 1 } = {}) {
  const previousResultJson = safeStringify(previousResult);

  return `너는 볼링 점수판 OCR 전용 parser다.

반드시 JSON만 반환한다.
설명, markdown, 코드블록 출력 금지.

이 이미지는 전체 점수판이 아니라 한 선수의 점수 행만 crop한 이미지다.
가장 선명하고 크게 보이는 한 명의 점수 행만 분석한다.
다른 선수 점수는 존재하지 않는 것으로 처리한다.

분석 대상:
- 위쪽 프레임별 투구 기호
- 아래쪽 프레임별 누적 점수
- 오른쪽 또는 하단의 최종 점수(finalScore)

허용 문자:
- X
- /
- -
- 0~9

핵심 분석 순서:
1. 위쪽 프레임 투구 기호를 읽는다.
2. 아래쪽 cumulativeScores를 읽는다.
3. finalScore를 읽는다.
4. cumulativeScores와 finalScore로 rolls를 반드시 검산한다.
5. finalScore와 다르면 rolls를 재검토한다.
6. 특히 10프레임 보너스 투구 누락 여부를 반드시 확인한다.
7. 4, 6, 8, 9 숫자는 누적 점수 차이로 교차 검증한다.

볼링 규칙:
- frame은 1~10
- rolls는 실제 투구값 배열
- 1~9프레임 합산은 10 초과 불가
- X는 단독 프레임만 허용
- /는 두번째 투구에서만 허용
- 첫 투구가 X면 두번째 투구 없음
- 10프레임은 최대 3구 가능
- 10프레임 보너스 투구를 절대 누락하지 마라
- 불가능한 조합은 가장 가까운 볼링 규칙으로 수정
- 확실하지 않으면 null 사용

누적 점수 검산 예시:
- 이전 누적 56, 현재 누적 76, 현재 마크가 6 / 이고 다음 첫구가 X이면 현재 프레임 점수는 20이므로 6 /가 맞다.
- 이전 누적 56, 현재 누적 76인데 6 6으로 읽으면 12점이라 틀렸다.
- 9프레임 누적 192, finalScore 222인데 10프레임이 X X로 보이면 X X X일 가능성이 높다.
- 1프레임 9/ 후 2프레임 누적점수가 40이면 2프레임은 9/가 아니라 X일 가능성이 높다.
- X 표시가 삼각형/화살표/검은 리본처럼 보일 수 있다. 같은 모양이 반복되고 누적점수가 30씩 증가하면 X로 판단한다.
- X와 9/가 헷갈리면 cumulativeScores를 우선한다.
- 8, 6, 9 숫자가 헷갈리면 점수 차이로 역산한다.

재분석 조건:
previous_result_json:
${previousResultJson}

retry_attempt:
${retryAttempt || 1}

previous_result_json이 존재하면 이전 분석 결과가 틀렸을 가능성이 있다.
이전 결과를 그대로 반복하지 말고 다음 항목을 다시 검토한다.
- 프레임 기호
- cumulativeScores
- finalScore

중요:
- 투구 기호만 보고 판단하지 마라.
- 반드시 cumulativeScores와 교차 검증한다.
- cumulativeScores와 맞지 않는 프레임은 다시 추론한다.
- 한 선수 행 crop 안에 다른 선수 행이 약간 섞여 있어도 가장 아래쪽 또는 가장 크게 보이는 선택 대상 행의 누적점수를 우선한다.
- finalScore와 맞지 않으면 10프레임 보너스 투구를 재검토한다.
- cumulativeScores 배열에는 화면 아래의 누적 점수 10개를 반드시 왼쪽부터 숫자로 넣는다.
- finalScore에는 마지막에 보이는 최종 점수를 넣는다.

반환 형식:
{
  "rolls": ["X", "9", "/", "8", "1"],
  "frames": [
    {
      "frame": 1,
      "rolls": ["X"],
      "confidence": 0.98
    }
  ],
  "cumulativeScores": [20, 40, 56, 76, 106, 134, 153, 162, 192, 222],
  "finalScore": 222,
  "confidence": 0.92,
  "notes": "10프레임 재검토"
}

중요 반환 규칙:
- rolls는 전체 게임 투구값을 순서대로 펼친 배열이다.
- frames는 1~10프레임별 투구값 배열이다.
- rolls와 frames가 서로 모순되면 cumulativeScores와 finalScore에 맞는 값을 선택한다.
- null을 사용해야 할 경우 rolls에는 넣지 말고 해당 frame.rolls에만 null을 사용한다.
- JSON 객체 외의 텍스트를 절대 출력하지 않는다.`;
}
