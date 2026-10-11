import { CONFIG, TILT_LABELS } from "./config";

type Section = readonly [heading: string, body: string];
interface GuideCopy {
  title: string;
  close: string;
  language: string;
  intro: string;
  start: string;
  steps: readonly [Section, Section];
  payoutsTitle: string;
  payouts: readonly [string, string, string];
  payoutNote: string;
  boardNet: Section;
  tilt: Section;
  tiltHint: string;
  shake: Section;
  jackpot: Section;
  keysTitle: string;
  keys: readonly [string, string, string, string, string, string];
  keysNote: string;
  detailsTitle: string;
  details: readonly Section[];
}

export const guideLanguages = [
  ["en", "English"], ["ko", "한국어"], ["ja", "日本語"], ["zh", "中文（简体）"],
  ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"],
] as const;
export type GuideLanguage = typeof guideLanguages[number][0];

export function resolveGuideLanguage(languages: readonly string[]): GuideLanguage {
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0];
    if (guideLanguages.some(([code]) => code === base)) return base as GuideLanguage;
  }
  return "en";
}

const percent = (probability: number, language: GuideLanguage = "en") =>
  `${(probability * 100).toLocaleString(language, { maximumFractionDigits: 2 })}%`;
const rateRange = (level: number, language: GuideLanguage = "en") => {
  const { min, max } = CONFIG.transferRates[level - 1];
  return `${percent(min, language)}–${percent(max, language)}`;
};
const highestTilt = CONFIG.transferRates.length;
const exampleRate = (CONFIG.transferRates[1].min + CONFIG.transferRates[1].max) / 2;
const exampleAfter = .4 - (.4 - CONFIG.probabilityFloor) * exampleRate;
const tiltLabels = TILT_LABELS.map((label, index) => `${index + 1}: ${label}`).join("; ");
const numberReturn = 10 * CONFIG.multipliers.number;
const jackpotReturn = 10 * CONFIG.multipliers.jackpot;

// Authored copy only: no user-provided text is interpolated into guide markup.
export const guides: Record<GuideLanguage, GuideCopy> = {
  en: {
    title: "How to play", close: "Close gameplay guide", language: "Language", start: "Let’s play",
    intro: `Start with ${CONFIG.startingGold} G. Your Gold after ${CONFIG.rollsPerRun} rolls is your score. Reach 0 G earlier and the run ends without a score.`,
    steps: [
      ["Place bets", `Choose a whole-number <b>Bet amount</b> of at least ${CONFIG.minimumWager} G, then click or tap a number, row, column, or color. Each click adds that amount. Total bets cannot exceed your Gold.`],
      ["Roll", "Click <b>Roll dice</b> or press <kbd>R</kbd>. Your total stake is deducted, then every bet covering the result pays—including overlapping bets. Each roll uses one turn and clears the bets."],
    ],
    payoutsTitle: "Payouts", payouts: ["Number", "Column", "Row or color"],
    payoutNote: `Payouts include the winning stake. A single 10 G number bet returns ${numberReturn} G on a hit: ${numberReturn - 10} G profit.`,
    tilt: ["Read the board", "The die has hidden, uneven odds. <b>Tilt 1</b> is nearly even; <b>Tilt 6</b> concentrates the odds on fewer numbers. ▲ means more bias after the last roll; ▼ means less; - means no change. Tilt does not identify the favored numbers. Any winning bet changes the odds, even on a break-even roll. If every bet misses, the odds stay the same."],
    tiltHint: "The six squares show chances from highest to lowest in three shades, with brighter squares meaning higher chances. They hide the numbers and exact odds.",
    shake: ["Shake", "A net gain or loss unlocks <b>Shake</b>; a break-even roll does not. Click Shake or press <kbd>Space</kbd> to replace the odds and clear your bets, keeping your Gold and rolls. It stays unlocked until you use it or hit a Jackpot."],
    jackpot: ["Hidden Jackpot", `Bet only on the <b>least likely number</b> and hit it for <b>×${CONFIG.multipliers.jackpot}</b>: 10 G returns ${jackpotReturn} G. Adding to that number is fine; betting anywhere else cancels eligibility. If chances tie, the lowest number qualifies. A Jackpot replaces the board automatically.`],
    boardNet: ["BOARD NET", "Your total payouts minus bets on the current board. A 10 G loss followed by a 50 G profit shows +40 G. Shake, Jackpot, and a new run reset it to zero."],
    keysTitle: "Keyboard controls", keys: ["Roll", "Shake", "Select recent amounts, newest first", "Decrease / increase amount by 5 G", "Clear all bets", "Remove the focused bet"],
    keysNote: "Tab moves focus; Enter activates a button. ↑ / ↓ changes the amount by 5 G. Game shortcuts pause while typing or using a dialog.",
    detailsTitle: "Bet controls, odds, and records",
    details: [
      ["Bet controls", "Rows cover odd or even numbers; columns cover the two numbers beneath them. Recent-amount chips select an amount without placing a bet. Press and hold a bet or its chip for half a second, or right-click, to remove it; then place a smaller bet if needed. On a phone, tap Bet amount for the keypad. 10%, 20%, and 30% use your current Gold, rounded down with a minimum of 1 G. Done applies the amount; × cancels."],
      ["How odds change", `Fresh boards give each number at least ${percent(CONFIG.probabilityFloor)} chance; Red and Black can have different odds. After a win other than Jackpot, the rolled number gives part of its probability above that minimum to the other five, in random shares. The transfer rate ranges from ${rateRange(1)} at Tilt 1 to ${rateRange(highestTilt)} at Tilt ${highestTilt}. It happens once per paying roll, regardless of stake or net profit. Tilt can rise or fall. The displayed levels are ${tiltLabels}.`],
      ["Transfer example", `At Tilt 2, the transfer rate is ${rateRange(2)}. If a number has 40% chance and the rate is ${percent(exampleRate)}, its new chance is 40% − (40% − ${percent(CONFIG.probabilityFloor)}) × ${percent(exampleRate)} = ${percent(exampleAfter)}. The other five numbers share the difference.`],
      ["Scores and records", `Your Gold after roll ${CONFIG.rollsPerRun} is the score, including 0 G. Earlier peaks do not count. The personal leaderboard keeps the best ${CONFIG.leaderboardLimit} eligible completed runs in this browser. At the result screen, enter a name and choose Confirm & play again. Settings → Restart run discards the current run after confirmation and keeps your records. <b>Show probabilities</b> reveals the odds after confirmation and excludes the current run from records, even if you hide them later. Each new run starts with odds hidden and record eligibility restored.`],
      ["Settings and saving", "Your progress, BOARD NET, records, and preferences save automatically in this browser. Refreshing clears bets you have not rolled. Clearing the site’s saved data removes your progress; saves do not sync across browsers or devices. Settings lets you change your name (1–24 visible characters), Sound effects, Reduce motion, and Swap Roll and Shake on mobile. System reduced motion is also respected."],
    ],
  },
  ko: {
    title: "게임 방법", close: "게임 안내 닫기", language: "언어", start: "시작하기",
    intro: `${CONFIG.startingGold} G로 시작합니다. ${CONFIG.rollsPerRun}번째 굴림 후 남은 Gold가 점수입니다. 그 전에 0 G가 되면 점수 없이 끝납니다.`,
    steps: [
      ["베팅하기", `<b>Bet amount</b>에서 최소 ${CONFIG.minimumWager} G의 정수 금액을 정한 뒤 숫자, 가로줄, 세로줄 또는 색상을 누르세요. 누를 때마다 그 금액이 추가됩니다. 전체 베팅액은 보유 Gold를 넘을 수 없습니다.`],
      ["굴리기", "<b>Roll dice</b> 또는 <kbd>R</kbd>을 누르세요. 전체 베팅액을 차감한 뒤 나온 숫자를 포함하는 모든 베팅에 지급합니다. 서로 겹치는 베팅도 각각 받습니다. 한 번 굴리면 횟수가 1 줄고 베팅이 지워집니다."],
    ],
    payoutsTitle: "지급 배수", payouts: ["숫자", "세로줄", "가로줄 또는 색상"],
    payoutNote: `지급액에는 적중한 베팅의 원금이 포함됩니다. 숫자 하나에 10 G만 걸어 적중하면 ${numberReturn} G를 받아 ${numberReturn - 10} G를 법니다.`,
    tilt: ["보드 읽기", "주사위의 확률은 고르지 않으며 숨겨져 있습니다. <b>Tilt 1</b>은 거의 고른 분포이고, <b>Tilt 6</b>은 소수의 숫자에 확률이 집중된 상태입니다. ▲는 직전 굴림 후 편향 증가, ▼는 감소, -는 변화 없음을 뜻합니다. 유리한 숫자는 알려 주지 않습니다. 하나라도 적중하면 전체 손익이 본전이어도 확률이 변합니다. 모두 빗나가면 그대로입니다."],
    tiltHint: "사각형 여섯 개는 확률이 높은 순서대로 세 가지 명암을 보여 주며, 밝을수록 확률이 높습니다. 숫자와 정확한 확률은 숨겨져 있습니다.",
    shake: ["Shake", "순이익이나 순손실이 생기면 <b>Shake</b>가 열리며, 본전이면 열리지 않습니다. Shake나 <kbd>Space</kbd>를 누르면 Gold와 남은 횟수를 유지하며 확률을 새로 정하고 베팅을 지웁니다. 사용하거나 Jackpot에 적중하면 다시 잠깁니다."],
    jackpot: ["숨겨진 Jackpot", `<b>가장 확률이 낮은 숫자</b> 하나에만 걸어 적중하면 <b>×${CONFIG.multipliers.jackpot}</b>를 받습니다. 10 G를 걸면 ${jackpotReturn} G입니다. 같은 숫자에 더 걸어도 되지만, 다른 곳에도 걸면 대상에서 제외됩니다. 최저 확률이 같으면 더 작은 숫자가 대상입니다. Jackpot은 보드를 자동 교체합니다.`],
    boardNet: ["BOARD NET", "현재 보드의 누적 지급액에서 베팅액을 뺀 순손익입니다. 10 G를 잃고 50 G를 벌면 +40 G입니다. Shake, Jackpot, 새 게임은 이 수치를 0으로 되돌립니다."],
    keysTitle: "키보드 조작", keys: ["굴리기", "Shake", "최근 금액 선택 · 최신순", "금액 5 G 줄이기 / 늘리기", "베팅 모두 지우기", "포커스된 칸의 베팅 지우기"],
    keysNote: "Tab으로 이동하고 Enter로 버튼을 누릅니다. 금액 입력란에서 ↑ / ↓로 5 G씩 조절합니다. 입력 중이거나 창이 열려 있으면 게임 단축키가 멈춥니다.",
    detailsTitle: "베팅 조작, 확률, 기록 자세히 보기",
    details: [
      ["베팅 조작", "가로줄은 홀수 또는 짝수, 세로줄은 그 아래의 숫자 두 개를 포함합니다. 최근 금액 칩은 금액만 선택하며 베팅하지 않습니다. 베팅한 칸이나 그 칩을 0.5초 동안 길게 누르거나 오른쪽 클릭하면 해당 베팅을 지웁니다. 줄이려면 지운 뒤 더 적게 거세요. 휴대폰에서는 Bet amount를 눌러 숫자 키패드를 엽니다. 10%, 20%, 30%는 현재 Gold 기준이며 정수로 내림하고 최소 1 G입니다. Done은 적용, ×는 취소입니다."],
      ["확률 변화", `새 보드에서 모든 숫자는 최소 ${percent(CONFIG.probabilityFloor, "ko")}의 확률을 가지며, 빨강과 검정의 확률은 다를 수 있습니다. Jackpot 외의 적중이 있으면 나온 숫자가 최소 확률을 넘는 부분 중 일부를 나머지 다섯 숫자에 무작위로 나눠 줍니다. 이동 비율은 Tilt 1의 ${rateRange(1, "ko")}부터 Tilt ${highestTilt}의 ${rateRange(highestTilt, "ko")}까지입니다. 베팅액이나 전체 손익과 무관하게 적중한 굴림마다 한 번만 이동하며, Tilt는 오를 수도 내릴 수도 있습니다. 화면의 단계별 이름은 ${tiltLabels}입니다.`],
      ["계산 예시", `Tilt 2의 이동 비율은 ${rateRange(2, "ko")}입니다. 한 숫자의 확률이 40%이고 이동 비율이 ${percent(exampleRate, "ko")}라면 새 확률은 40% − (40% − ${percent(CONFIG.probabilityFloor, "ko")}) × ${percent(exampleRate, "ko")} = ${percent(exampleAfter, "ko")}입니다. 나머지 다섯 숫자가 차이를 나눠 받습니다.`],
      ["점수와 기록", `${CONFIG.rollsPerRun}번째 굴림 후 Gold가 점수이며 0 G도 유효합니다. 중간 최고 잔액은 기록되지 않습니다. 개인 순위표에는 이 브라우저에서 완주한 등록 가능한 상위 ${CONFIG.leaderboardLimit}개 기록이 남습니다. 결과 창에서 이름을 입력하고 Confirm & play again으로 다시 시작하세요. Settings → Restart run은 확인 후 현재 게임을 포기하며 기존 기록을 유지합니다. <b>Show probabilities</b>를 확인 후 켜면 확률을 보여 주지만, 나중에 다시 꺼도 해당 게임은 기록에서 제외됩니다. 새 게임에서는 확률이 숨겨지고 다시 기록을 등록할 수 있습니다.`],
      ["설정과 저장", "굴린 결과, BOARD NET, 기록, 설정은 이 브라우저에 자동 저장됩니다. 새로고침하면 아직 굴리지 않은 베팅이 지워집니다. 사이트 저장 데이터를 지우면 진행 상황이 사라지며, 다른 브라우저나 기기와 동기화되지 않습니다. Settings에서 이름(표시 문자 1–24개), Sound effects(효과음), Reduce motion(움직임 줄이기), Swap Roll and Shake on mobile(모바일 버튼 위치 교환)을 바꿀 수 있습니다. 시스템의 움직임 줄이기 설정도 따릅니다."],
    ],
  },
  ja: {
    title: "遊び方", close: "遊び方を閉じる", language: "言語", start: "始める",
    intro: `${CONFIG.startingGold} Gで始めます。${CONFIG.rollsPerRun}回目の後に残ったGoldがスコアです。それより前に0 Gになると、スコアを残さず終了します。`,
    steps: [
      ["ベットする", `<b>Bet amount</b>で${CONFIG.minimumWager} G以上の整数を選び、数字・横列・縦列・色を押します。押すたびにその金額を追加します。ベットの合計は所持Gold以内にしてください。`],
      ["振る", "<b>Roll dice</b>または<kbd>R</kbd>を押します。ベットの合計を引いた後、出た数字を含むベットすべてに払い戻します。範囲が重なるベットもそれぞれ対象です。1回振ると残り回数が1減り、ベットが消えます。"],
    ],
    payoutsTitle: "払い戻し倍率", payouts: ["数字", "縦列", "横列・色"],
    payoutNote: `払い戻しには当たったベットの元金を含みます。数字1つに10 Gだけ賭けて当たると${numberReturn} Gを受け取り、利益は${numberReturn - 10} Gです。`,
    tilt: ["ボードの見方", "サイコロの確率は均等ではなく、隠されています。<b>Tilt 1</b>はほぼ均等で、<b>Tilt 6</b>は少数の数字に確率が集中した状態です。▲は直前のロールで偏りが増加、▼は減少、-は変化なしを示します。有利な数字は分かりません。1つでもベットが当たると、収支がゼロでも確率が変わります。すべて外れると変わりません。"],
    tiltHint: "6つの四角は確率の高い順に3段階の濃淡で表示され、明るいほど高確率です。数字と正確な確率は隠されています。",
    shake: ["Shake", "収支がプラスかマイナスになると<b>Shake</b>が解除され、収支ゼロでは解除されません。Shakeまたは<kbd>Space</kbd>で確率を入れ替え、ベットを消します。Goldと残り回数は維持されます。使うかJackpotに当たるまで解除状態が続きます。"],
    jackpot: ["隠れたJackpot", `<b>最も出にくい数字</b>1つだけに賭けて当たると<b>×${CONFIG.multipliers.jackpot}</b>です。10 Gなら${jackpotReturn} Gを受け取ります。同じ数字への追加は可能ですが、別の場所にも賭けると対象外です。最低確率が同じなら小さい数字が対象です。Jackpotはボードを自動で入れ替えます。`],
    boardNet: ["BOARD NET", "現在のボードでの累計払い戻しからベットを引いた収支です。10 Gを失った後に50 Gの利益を得ると+40 Gになります。Shake、Jackpot、新しいゲームで0に戻ります。"],
    keysTitle: "キーボード操作", keys: ["振る", "Shake", "最近の金額を選択・新しい順", "金額を5 G減らす / 増やす", "全ベットを消す", "フォーカスしたベットを消す"],
    keysNote: "Tabで移動し、Enterでボタンを押します。金額欄では↑ / ↓で5 Gずつ調整します。入力中やダイアログ表示中はゲームのショートカットが停止します。",
    detailsTitle: "ベット操作・確率・記録の詳細",
    details: [
      ["ベット操作", "横列は奇数か偶数、縦列はその下の2つの数字を含みます。最近の金額チップは金額を選ぶだけで、ベットしません。ベットした場所やそのチップを0.5秒長押しするか右クリックすると、そのベットを消します。減らすには消してから少額を賭け直します。スマートフォンではBet amountで数字キーパッドを開きます。10%、20%、30%は現在のGoldを基準に小数点以下を切り捨て、最低1 Gです。Doneで適用、×でキャンセルします。"],
      ["確率の変化", `新しいボードでは各数字の確率は最低${percent(CONFIG.probabilityFloor, "ja")}で、赤と黒の確率は異なる場合があります。Jackpot以外で当たると、出た数字は最低確率を超える部分の一部を他の5つにランダムに分けます。移動率はTilt 1の${rateRange(1, "ja")}からTilt ${highestTilt}の${rateRange(highestTilt, "ja")}までです。金額や収支にかかわらず、払い戻しのあるロールにつき1回移動します。Tiltは上がることも下がることもあります。各段階の表示名は${tiltLabels}です。`],
      ["計算例", `Tilt 2の移動率は${rateRange(2, "ja")}です。ある数字の確率が40%、移動率が${percent(exampleRate, "ja")}なら、新しい確率は40% − (40% − ${percent(CONFIG.probabilityFloor, "ja")}) × ${percent(exampleRate, "ja")} = ${percent(exampleAfter, "ja")}です。他の5つが差を分け合います。`],
      ["スコアと記録", `${CONFIG.rollsPerRun}回目の後のGoldがスコアで、0 Gも有効です。途中の最高残高は記録しません。個人ランキングは、このブラウザーで完走した記録対象ゲームの上位${CONFIG.leaderboardLimit}件を保存します。結果画面で名前を入力し、Confirm & play againで再開します。Settings → Restart runは確認後に現在のゲームを破棄し、記録は残します。<b>Show probabilities</b>を確認後にオンにすると確率を表示しますが、後でオフにしてもそのゲームは記録対象外です。新しいゲームでは確率が隠され、記録対象に戻ります。`],
      ["設定と保存", "確定したゲーム状態、BOARD NET、記録、設定はこのブラウザーに自動保存します。再読み込みはまだ振っていないベットを消します。サイトの保存データを削除すると進行状況が失われ、別のブラウザーや端末とは同期しません。Settingsで名前（表示文字1～24文字）、Sound effects（効果音）、Reduce motion（動きを減らす）、Swap Roll and Shake on mobile（モバイルのボタン位置を交換）を変更できます。システムの動きを減らす設定にも従います。"],
    ],
  },
  zh: {
    title: "玩法说明", close: "关闭玩法说明", language: "语言", start: "开始游戏",
    intro: `以${CONFIG.startingGold} G开始。第${CONFIG.rollsPerRun}次掷骰后剩余的Gold就是得分。提前归零则本局结束，不计分。`,
    steps: [
      ["下注", `在<b>Bet amount</b>选择至少${CONFIG.minimumWager} G的整数金额，再点击数字、行、列或颜色。每次点击都会追加该金额。总下注额不能超过现有Gold。`],
      ["掷骰", "点击<b>Roll dice</b>或按<kbd>R</kbd>。先扣除总下注额，再为包含结果数字的所有下注返还，覆盖范围重叠的下注也分别支付。每次掷骰消耗一次机会，并清空下注。"],
    ],
    payoutsTitle: "返还倍数", payouts: ["数字", "列", "行或颜色"],
    payoutNote: `返还包含中奖下注的本金。只向一个数字下注10 G，命中后收到${numberReturn} G，净赚${numberReturn - 10} G。`,
    tilt: ["读懂局面", "骰子的概率并不均等，而且隐藏着。<b>Tilt 1</b>表示接近均匀，<b>Tilt 6</b>表示概率集中在少数数字上。▲表示上次掷骰后偏向增大，▼表示减小，-表示没有变化。Tilt不会指出哪些数字更有利。只要有下注命中，即使总盈亏为零，概率也会变化。全部未中则保持不变。"],
    tiltHint: "六个方块按概率从高到低排列，以三种明暗显示，越亮表示概率越高。数字和准确概率仍然隐藏。",
    shake: ["Shake", "净盈利或净亏损会解锁<b>Shake</b>，盈亏持平则不会。点击Shake或按<kbd>Space</kbd>可更换概率并清空下注，保留Gold和剩余次数。解锁状态持续到使用或命中Jackpot，随后再次锁定。"],
    jackpot: ["隐藏的Jackpot", `只向<b>概率最低的数字</b>下注并命中，可获得<b>×${CONFIG.multipliers.jackpot}</b>：下注10 G返还${jackpotReturn} G。可以向同一数字追加，但向其他位置下注会取消资格。最低概率并列时，数值最小的数字符合条件。Jackpot会自动更换局面。`],
    boardNet: ["BOARD NET", "当前局面的累计返还减去下注额。先亏10 G，再净赚50 G，显示+40 G。Shake、Jackpot或新一局会将其归零。"],
    keysTitle: "键盘操作", keys: ["掷骰", "Shake", "选择最近金额，最新优先", "金额减少 / 增加5 G", "清除全部下注", "移除当前焦点位置的下注"],
    keysNote: "Tab移动焦点，Enter激活按钮。在金额栏中，↑ / ↓每次调整5 G。输入文字或打开对话框时，游戏快捷键暂停。",
    detailsTitle: "下注操作、概率与纪录详情",
    details: [
      ["下注操作", "行覆盖奇数或偶数，列覆盖其下的两个数字。最近金额筹码仅选择金额，不会下注。长按下注位置或其筹码半秒，或右键点击，可移除该位置的下注；要减少金额，请移除后以较小金额重新下注。在手机上点击Bet amount可打开数字键盘。10%、20%、30%按当前Gold计算，向下取整且最低1 G。Done应用金额，×取消。"],
      ["概率变化", `新局面中每个数字的概率至少为${percent(CONFIG.probabilityFloor, "zh")}；红色和黑色的概率可以不同。除Jackpot外，只要有下注命中，掷出的数字就把超过最低概率的部分按一定比例随机分给其他五个数字。转移比例从Tilt 1的${rateRange(1, "zh")}到Tilt ${highestTilt}的${rateRange(highestTilt, "zh")}。每次有返还的掷骰只转移一次，与下注金额或净盈亏无关。Tilt可以升高或降低。各级显示名称为${tiltLabels}。`],
      ["计算示例", `Tilt 2的转移比例为${rateRange(2, "zh")}。某数字的概率为40%，转移比例为${percent(exampleRate, "zh")}时，新概率为40% − (40% − ${percent(CONFIG.probabilityFloor, "zh")}) × ${percent(exampleRate, "zh")} = ${percent(exampleAfter, "zh")}。其他五个数字分享差额。`],
      ["得分与纪录", `第${CONFIG.rollsPerRun}次后的Gold即为得分，0 G也有效。途中最高余额不计入纪录。个人排行榜保存当前浏览器中符合资格并完成整局的最佳${CONFIG.leaderboardLimit}个纪录。在结果页输入名字，选择Confirm & play again重新开始。Settings → Restart run经确认后放弃当前一局，保留已有纪录。确认开启<b>Show probabilities</b>会显示概率，同时取消本局的纪录资格，即使稍后关闭也一样。每个新局都隐藏概率并恢复纪录资格。`],
      ["设置与保存", "已结算的游戏状态、BOARD NET、纪录和设置自动保存在当前浏览器。刷新会清除尚未掷骰的下注。删除网站保存的数据会移除进度；不同浏览器或设备之间不互相同步。Settings可修改名字（1–24个可见字符）、Sound effects（音效）、Reduce motion（减少动态效果）和Swap Roll and Shake on mobile（交换手机按钮位置）。也会遵循系统的减少动态效果设置。"],
    ],
  },
  es: {
    title: "Cómo jugar", close: "Cerrar la guía", language: "Idioma", start: "Jugar",
    intro: `Empieza con ${CONFIG.startingGold} G. Tu Gold tras ${CONFIG.rollsPerRun} tiradas es tu puntuación. Si llegas a 0 G antes, la partida acaba sin puntuación.`,
    steps: [
      ["Apuesta", `Elige un <b>Bet amount</b> entero de al menos ${CONFIG.minimumWager} G y pulsa un número, fila, columna o color. Cada pulsación añade esa cantidad. El total no puede superar tu Gold.`],
      ["Tira", "Pulsa <b>Roll dice</b> o <kbd>R</kbd>. Se descuenta el total apostado y se pagan todas las apuestas que cubran el resultado, aunque se solapen. Cada tirada consume un turno y borra las apuestas."],
    ],
    payoutsTitle: "Pagos", payouts: ["Número", "Columna", "Fila o color"],
    payoutNote: `El pago incluye la apuesta ganadora. Una única apuesta de 10 G a un número devuelve ${numberReturn} G al acertar: ${numberReturn - 10} G de beneficio.`,
    tilt: ["Lee el tablero", "El dado tiene probabilidades desiguales y ocultas. <b>Tilt 1</b> es casi uniforme; <b>Tilt 6</b> concentra las probabilidades en pocos números. ▲ indica más sesgo tras la última tirada; ▼, menos; -, ningún cambio. Tilt no identifica los números favorecidos. Cualquier acierto cambia las probabilidades, incluso con beneficio neto cero. Si todas las apuestas fallan, se mantienen."],
    tiltHint: "Los seis cuadrados ordenan las probabilidades de mayor a menor en tres tonos; los más luminosos indican mayor probabilidad. Ocultan los números y las probabilidades exactas.",
    shake: ["Shake", "Una ganancia o pérdida neta desbloquea <b>Shake</b>; una tirada sin ganancia ni pérdida no lo hace. Pulsa Shake o <kbd>Space</kbd> para renovar las probabilidades y borrar las apuestas, conservando el Gold y las tiradas. Sigue disponible hasta usarlo o acertar un Jackpot."],
    jackpot: ["Jackpot oculto", `Apuesta solo al <b>número menos probable</b> y acierta para cobrar <b>×${CONFIG.multipliers.jackpot}</b>: 10 G devuelven ${jackpotReturn} G. Puedes añadir más al mismo número; apostar en otro lugar anula la opción. Si hay empate, corresponde al número menor. El Jackpot renueva automáticamente el tablero.`],
    boardNet: ["BOARD NET", "Pagos acumulados menos apuestas en el tablero actual. Perder 10 G y después ganar 50 G de beneficio muestra +40 G. Shake, Jackpot y una partida nueva lo ponen a cero."],
    keysTitle: "Controles de teclado", keys: ["Tirar", "Shake", "Seleccionar importes recientes, el más nuevo primero", "Reducir / aumentar el importe en 5 G", "Borrar todas las apuestas", "Quitar la apuesta enfocada"],
    keysNote: "Tab mueve el foco; Enter activa un botón. ↑ / ↓ ajusta el importe en 5 G. Los atajos se pausan al escribir o usar un diálogo.",
    detailsTitle: "Apuestas, probabilidades y récords",
    details: [
      ["Controles de apuesta", "Las filas cubren impares o pares; las columnas, los dos números de debajo. Las fichas de importes recientes seleccionan una cantidad sin apostar. Mantén una apuesta o su ficha pulsada medio segundo, o haz clic derecho, para quitarla; después puedes apostar menos. En el móvil, pulsa Bet amount para abrir el teclado numérico. 10%, 20% y 30% usan tu Gold actual, redondeando hacia abajo con un mínimo de 1 G. Done aplica el importe; × cancela."],
      ["Cómo cambian las probabilidades", `Cada número de un tablero nuevo tiene al menos ${percent(CONFIG.probabilityFloor, "es")} de probabilidad; rojo y negro pueden tener probabilidades distintas. Tras un acierto que no sea Jackpot, el número obtenido reparte entre los otros cinco una parte de su probabilidad por encima del mínimo, en proporciones aleatorias. La tasa va del ${rateRange(1, "es")} en Tilt 1 al ${rateRange(highestTilt, "es")} en Tilt ${highestTilt}. Ocurre una vez por tirada con pago, independientemente de la apuesta o del beneficio neto. Tilt puede subir o bajar. Los niveles mostrados son ${tiltLabels}.`],
      ["Ejemplo de transferencia", `En Tilt 2, la tasa es ${rateRange(2, "es")}. Si un número tiene un 40% de probabilidad y la tasa es ${percent(exampleRate, "es")}, su nueva probabilidad es 40% − (40% − ${percent(CONFIG.probabilityFloor, "es")}) × ${percent(exampleRate, "es")} = ${percent(exampleAfter, "es")}. Los otros cinco se reparten la diferencia.`],
      ["Puntuaciones y récords", `El Gold tras la tirada ${CONFIG.rollsPerRun} es tu puntuación, incluso con 0 G. Los máximos intermedios no cuentan. La clasificación personal guarda las ${CONFIG.leaderboardLimit} mejores partidas completadas y aptas para récords en este navegador. En el resultado, escribe un nombre y elige Confirm & play again. Settings → Restart run descarta la partida tras confirmar y conserva los récords. <b>Show probabilities</b> revela las probabilidades tras confirmar y excluye la partida actual de los récords, aunque las ocultes después. Cada partida nueva empieza con probabilidades ocultas y vuelve a ser apta para récords.`],
      ["Ajustes y guardado", "La partida liquidada, BOARD NET, los récords y las preferencias se guardan automáticamente en este navegador. Recargar borra las apuestas aún no jugadas. Borrar los datos del sitio elimina el progreso; no se sincroniza entre navegadores o dispositivos. Settings permite cambiar el nombre (1–24 caracteres visibles), Sound effects (sonidos), Reduce motion (reducir animaciones) y Swap Roll and Shake on mobile (intercambiar botones en el móvil). También se respeta la preferencia de movimiento reducido del sistema."],
    ],
  },
  fr: {
    title: "Comment jouer", close: "Fermer le guide", language: "Langue", start: "Jouer",
    intro: `Commencez avec ${CONFIG.startingGold} G. Votre Gold après ${CONFIG.rollsPerRun} lancers est votre score. Si vous atteignez 0 G avant, la partie se termine sans score.`,
    steps: [
      ["Misez", `Choisissez un <b>Bet amount</b> entier d’au moins ${CONFIG.minimumWager} G, puis appuyez sur un nombre, une ligne, une colonne ou une couleur. Chaque pression ajoute ce montant. Le total ne peut pas dépasser votre Gold.`],
      ["Lancez", "Appuyez sur <b>Roll dice</b> ou <kbd>R</kbd>. Le total misé est déduit, puis chaque mise couvrant le résultat est payée, même si les groupes se chevauchent. Chaque lancer consomme un tour et efface les mises."],
    ],
    payoutsTitle: "Paiements", payouts: ["Nombre", "Colonne", "Ligne ou couleur"],
    payoutNote: `Le paiement inclut la mise gagnante. Une seule mise de 10 G sur un nombre rapporte ${numberReturn} G si elle gagne : ${numberReturn - 10} G de bénéfice.`,
    tilt: ["Lire le plateau", "Le dé a des probabilités inégales et cachées. <b>Tilt 1</b> est presque uniforme ; <b>Tilt 6</b> concentre les chances sur peu de nombres. ▲ indique un biais accru après le dernier lancer ; ▼, un biais réduit ; -, aucun changement. Tilt ne révèle pas les nombres favorisés. Toute mise gagnante modifie les probabilités, même si le bilan est nul. Si toutes les mises perdent, elles restent identiques."],
    tiltHint: "Les six carrés classent les chances de la plus élevée à la plus faible en trois teintes ; les plus lumineux indiquent les chances les plus élevées. Les nombres et les probabilités exactes restent cachés.",
    shake: ["Shake", "Un gain ou une perte nette débloque <b>Shake</b> ; un bilan nul ne le débloque pas. Appuyez sur Shake ou <kbd>Space</kbd> pour renouveler les probabilités et effacer les mises, en gardant le Gold et les lancers. Shake reste disponible jusqu’à son utilisation ou à un Jackpot."],
    jackpot: ["Jackpot caché", `Misez uniquement sur le <b>nombre le moins probable</b> et trouvez-le pour recevoir <b>×${CONFIG.multipliers.jackpot}</b> : 10 G rapportent ${jackpotReturn} G. Vous pouvez ajouter à ce même nombre ; toute autre mise annule l’éligibilité. En cas d’égalité, le plus petit nombre est retenu. Le Jackpot renouvelle automatiquement le plateau.`],
    boardNet: ["BOARD NET", "Le total des paiements moins les mises sur le plateau actuel. Perdre 10 G puis gagner 50 G de bénéfice affiche +40 G. Shake, Jackpot et une nouvelle partie remettent ce total à zéro."],
    keysTitle: "Commandes au clavier", keys: ["Lancer", "Shake", "Choisir les montants récents, du plus récent au plus ancien", "Diminuer / augmenter le montant de 5 G", "Effacer toutes les mises", "Retirer la mise ayant le focus"],
    keysNote: "Tab déplace le focus ; Enter active un bouton. ↑ / ↓ ajuste le montant de 5 G. Les raccourcis sont suspendus pendant la saisie ou dans une fenêtre ouverte.",
    detailsTitle: "Mises, probabilités et records",
    details: [
      ["Commandes de mise", "Les lignes couvrent les nombres impairs ou pairs ; les colonnes, les deux nombres placés dessous. Les jetons de montants récents choisissent un montant sans miser. Maintenez une mise ou son jeton pendant une demi-seconde, ou faites un clic droit, pour la retirer ; vous pouvez ensuite miser moins. Sur téléphone, Bet amount ouvre le pavé numérique. 10%, 20% et 30% utilisent votre Gold actuel, arrondi à l’entier inférieur avec un minimum de 1 G. Done applique le montant ; × annule."],
      ["Évolution des probabilités", `Chaque nombre d’un nouveau plateau a au moins ${percent(CONFIG.probabilityFloor, "fr")} de chances ; rouge et noir peuvent avoir des probabilités différentes. Après un gain hors Jackpot, le nombre obtenu cède aux cinq autres une partie de sa probabilité au-dessus du minimum, répartie au hasard. Le taux va de ${rateRange(1, "fr")} au Tilt 1 à ${rateRange(highestTilt, "fr")} au Tilt ${highestTilt}. Il y a un transfert par lancer payant, quels que soient la mise et le bénéfice net. Tilt peut monter ou descendre. Les niveaux affichés sont ${tiltLabels}.`],
      ["Exemple de transfert", `Au Tilt 2, le taux est de ${rateRange(2, "fr")}. Si un nombre a 40% de chances et que le taux est de ${percent(exampleRate, "fr")}, sa nouvelle probabilité est 40% − (40% − ${percent(CONFIG.probabilityFloor, "fr")}) × ${percent(exampleRate, "fr")} = ${percent(exampleAfter, "fr")}. Les cinq autres se partagent la différence.`],
      ["Scores et records", `Le Gold après le lancer ${CONFIG.rollsPerRun} est votre score, même à 0 G. Les pics intermédiaires ne comptent pas. Le classement personnel garde les ${CONFIG.leaderboardLimit} meilleures parties terminées et admissibles aux records dans ce navigateur. Sur l’écran de résultat, saisissez un nom et choisissez Confirm & play again. Settings → Restart run abandonne la partie après confirmation et conserve les records. <b>Show probabilities</b> révèle les probabilités après confirmation et exclut la partie actuelle des records, même si vous les masquez ensuite. Chaque nouvelle partie commence avec les probabilités cachées et redevient admissible aux records.`],
      ["Réglages et sauvegarde", "Votre progression, BOARD NET, les records et les préférences sont sauvegardés automatiquement dans ce navigateur. Recharger efface les mises non jouées. Effacer les données du site supprime la progression ; aucune synchronisation n’existe entre navigateurs ou appareils. Settings permet de modifier le nom (1–24 caractères visibles), Sound effects (sons), Reduce motion (réduire les animations) et Swap Roll and Shake on mobile (inverser les boutons sur mobile). La préférence système de réduction des animations est aussi respectée."],
    ],
  },
  de: {
    title: "Spielanleitung", close: "Spielanleitung schließen", language: "Sprache", start: "Losspielen",
    intro: `Beginne mit ${CONFIG.startingGold} G. Dein Gold nach ${CONFIG.rollsPerRun} Würfen ist dein Ergebnis. Erreichst du vorher 0 G, endet der Durchlauf ohne Ergebnis.`,
    steps: [
      ["Setze Einsätze", `Wähle unter <b>Bet amount</b> einen ganzzahligen Betrag von mindestens ${CONFIG.minimumWager} G und tippe auf eine Zahl, Reihe, Spalte oder Farbe. Jedes Tippen fügt diesen Betrag hinzu. Alle Einsätze zusammen dürfen dein Gold nicht übersteigen.`],
      ["Würfle", "Klicke auf <b>Roll dice</b> oder drücke <kbd>R</kbd>. Der Gesamteinsatz wird abgezogen, dann zahlen alle Einsätze aus, die das Ergebnis abdecken—auch überlappende Gruppen. Jeder Wurf verbraucht einen Zug und entfernt die Einsätze."],
    ],
    payoutsTitle: "Auszahlungen", payouts: ["Zahl", "Spalte", "Reihe oder Farbe"],
    payoutNote: `Die Auszahlung enthält den gewonnenen Einsatz. Ein einzelner Einsatz von 10 G auf eine Zahl zahlt bei einem Treffer ${numberReturn} G aus: ${numberReturn - 10} G Gewinn.`,
    tilt: ["Das Spielfeld lesen", "Der Würfel hat ungleiche, verborgene Wahrscheinlichkeiten. <b>Tilt 1</b> ist fast gleichmäßig; <b>Tilt 6</b> konzentriert die Chancen auf wenige Zahlen. ▲ bedeutet mehr Verzerrung nach dem letzten Wurf; ▼ weniger; - keine Änderung. Tilt verrät die bevorzugten Zahlen nicht. Jeder Treffer verändert die Chancen, auch bei einem ausgeglichenen Wurf. Verfehlen alle Einsätze, bleiben die Chancen gleich."],
    tiltHint: "Die sechs Quadrate zeigen die Chancen absteigend in drei Helligkeitsstufen; hellere Quadrate bedeuten höhere Chancen. Zahlen und genaue Wahrscheinlichkeiten bleiben verborgen.",
    shake: ["Shake", "Nettogewinn oder -verlust schaltet <b>Shake</b> frei; ein ausgeglichener Wurf tut das nicht. Klicke auf Shake oder drücke <kbd>Space</kbd>, um die Chancen zu erneuern und die Einsätze zu entfernen. Gold und Würfe bleiben erhalten. Shake bleibt bis zur Nutzung oder einem Jackpot verfügbar."],
    jackpot: ["Verborgener Jackpot", `Setze nur auf die <b>unwahrscheinlichste Zahl</b> und triff sie für <b>×${CONFIG.multipliers.jackpot}</b>: 10 G zahlen ${jackpotReturn} G aus. Weitere Einsätze auf dieselbe Zahl sind erlaubt; jeder andere Einsatz schließt den Jackpot aus. Bei gleichen niedrigsten Chancen gilt die kleinere Zahl. Ein Jackpot erneuert das Spielfeld automatisch.`],
    boardNet: ["BOARD NET", "Alle Auszahlungen minus Einsätze auf dem aktuellen Spielfeld. Nach 10 G Verlust und 50 G Gewinn steht dort +40 G. Shake, Jackpot und ein neuer Durchlauf setzen den Wert auf null."],
    keysTitle: "Tastatursteuerung", keys: ["Würfeln", "Shake", "Letzte Beträge wählen, den neuesten zuerst", "Betrag um 5 G senken / erhöhen", "Alle Einsätze entfernen", "Fokussierten Einsatz entfernen"],
    keysNote: "Tab bewegt den Fokus; Enter betätigt einen Button. ↑ / ↓ ändert den Betrag um 5 G. Beim Tippen und in offenen Dialogen pausieren die Spielkürzel.",
    detailsTitle: "Einsätze, Chancen und Rekorde",
    details: [
      ["Einsätze bedienen", "Reihen decken ungerade oder gerade Zahlen ab; Spalten die beiden Zahlen darunter. Chips mit letzten Beträgen wählen nur den Betrag. Halte einen Einsatz oder seinen Chip eine halbe Sekunde gedrückt oder klicke mit der rechten Maustaste, um ihn zu entfernen; danach kannst du weniger setzen. Auf dem Handy öffnet Bet amount den Ziffernblock. 10%, 20% und 30% nutzen dein aktuelles Gold, auf ganze Gold abgerundet und mit mindestens 1 G. Done übernimmt den Betrag; × bricht ab."],
      ["Wie sich Chancen ändern", `Auf neuen Spielfeldern hat jede Zahl mindestens ${percent(CONFIG.probabilityFloor, "de")} Chance; Rot und Schwarz können unterschiedliche Chancen haben. Nach einem Treffer ohne Jackpot gibt die gewürfelte Zahl einen Anteil ihrer Wahrscheinlichkeit über dem Minimum zufällig an die anderen fünf ab. Die Rate reicht von ${rateRange(1, "de")} bei Tilt 1 bis ${rateRange(highestTilt, "de")} bei Tilt ${highestTilt}. Pro Wurf mit Auszahlung gibt es einen Transfer, unabhängig von Einsatz und Nettogewinn. Tilt kann steigen oder fallen. Die angezeigten Stufen sind ${tiltLabels}.`],
      ["Transferbeispiel", `Bei Tilt 2 beträgt die Rate ${rateRange(2, "de")}. Hat eine Zahl 40% Chance und die Rate beträgt ${percent(exampleRate, "de")}, ist ihre neue Chance 40% − (40% − ${percent(CONFIG.probabilityFloor, "de")}) × ${percent(exampleRate, "de")} = ${percent(exampleAfter, "de")}. Die anderen fünf teilen sich die Differenz.`],
      ["Ergebnisse und Rekorde", `Dein Gold nach Wurf ${CONFIG.rollsPerRun} ist das Ergebnis, auch bei 0 G. Zwischenzeitliche Höchststände zählen nicht. Die persönliche Rangliste speichert die ${CONFIG.leaderboardLimit} besten abgeschlossenen, rekordberechtigten Durchläufe in diesem Browser. Gib im Ergebnisfenster einen Namen ein und wähle Confirm & play again. Settings → Restart run verwirft den Durchlauf nach Bestätigung und erhält die Rekorde. <b>Show probabilities</b> zeigt nach Bestätigung die Chancen und schließt den aktuellen Durchlauf von Rekorden aus, auch wenn du sie später ausblendest. Jeder neue Durchlauf beginnt mit verborgenen Chancen und ist wieder rekordberechtigt.`],
      ["Einstellungen und Speichern", "Dein Spielstand, BOARD NET, Rekorde und Einstellungen werden automatisch in diesem Browser gespeichert. Neuladen entfernt noch nicht gewürfelte Einsätze. Das Löschen der Websitedaten entfernt den Fortschritt; Browser und Geräte synchronisieren sich nicht. Unter Settings änderst du den Namen (1–24 sichtbare Zeichen), Sound effects (Ton), Reduce motion (weniger Bewegung) und Swap Roll and Shake on mobile (mobile Buttons tauschen). Die Systemeinstellung für reduzierte Bewegung gilt ebenfalls."],
    ],
  },
};

export function guideBody(language: GuideLanguage): string {
  const copy = guides[language];
  const section = ([heading, body]: Section) => `<h3>${heading}</h3><p>${body}</p>`;
  const keys = ["R", "Space", "1 / 2 / 3", "W / E", "Q / Esc", "Delete / Backspace"];
  const multipliers = [CONFIG.multipliers.number, CONFIG.multipliers.column, CONFIG.multipliers.row];
  return `
    <p id="welcome-intro" class="dialog-intro">${copy.intro}</p>
    <ol class="welcome-steps">${copy.steps.map(step => `<li>${section(step)}</li>`).join("")}</ol>
    <div class="guide-odds">
      <h3>${copy.payoutsTitle}</h3>
      <dl class="guide-payouts">${copy.payouts.map((label, index) => `<div><dt>${label}</dt><dd>×${multipliers[index]}</dd></div>`).join("")}</dl>
      <p>${copy.payoutNote}</p>
      <h3 class="tilt-guide" tabindex="-1">${copy.tilt[0]}</h3><p>${copy.tilt[1]} ${copy.tiltHint}</p>
      ${section(copy.shake)}${section(copy.jackpot)}${section(copy.boardNet)}
      <h3>${copy.keysTitle}</h3>
      <dl class="guide-shortcuts">${copy.keys.map((label, index) => `<div><dt><kbd>${keys[index]}</kbd></dt><dd>${label}</dd></div>`).join("")}</dl>
      <p>${copy.keysNote}</p>
      <details class="guide-details"><summary>${copy.detailsTitle}</summary>${copy.details.map(section).join("")}</details>
    </div>`;
}
