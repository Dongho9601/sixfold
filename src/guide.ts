import { CONFIG } from "./config";

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
  tilt: Section;
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

// Authored copy only: no user-provided text is interpolated into guide markup.
export const guides: Record<GuideLanguage, GuideCopy> = {
  en: {
    title: "How to play", close: "Close gameplay guide", language: "Language", start: "Let’s play",
    intro: "Start with 100 G. Play 100 rolls. Your final Gold is your score; the personal leaderboard keeps your best 10 completed runs in this browser.",
    steps: [
      ["Place your bets", "Choose a whole-number amount, then click a number, row, column, or color. Click again to add more, up to your bankroll. The three chips recall recent bet amounts, newest first."],
      ["Roll and collect", "Press <kbd>R</kbd> or click <b>Roll dice</b>. All matching bets pay, including overlapping groups. Each roll clears your bets and uses one of your 100 rolls."],
    ],
    payoutsTitle: "Payouts", payouts: ["Number", "Column", "Row or color"],
    payoutNote: "Returns include the winning stake. A 10 G number bet returns 60 G: a 50 G gain if it was your only bet.",
    tilt: ["Read the Tilt", "The odds are hidden and unequal. <b>Tilt 1–2</b> means more even odds; <b>3–4</b> is in between; <b>5–6</b> means the odds favor fewer numbers. Tilt does not tell you which ones. Every number has at least a 2% chance. A payout changes the odds; a miss leaves them unchanged."],
    shake: ["Shake for a fresh board", "A roll that gains or loses Gold unlocks <b>Shake</b>; a break-even roll does not. Press <kbd>Space</kbd> to get new odds and clear your bets. Shake keeps your Gold, uses no rolls, and locks again until another gain or loss."],
    jackpot: ["The hidden Jackpot", "Bet only on the least likely number and hit it to receive <b>×24</b> on any board. Adding to that same number is allowed; any other bet removes eligibility. A 10 G Jackpot returns 240 G. A hit automatically refreshes the board and locks Shake, without using another roll."],
    keysTitle: "Keyboard controls", keys: ["Roll", "Shake", "Recall recent amounts, newest first", "Decrease / increase amount by 5 G", "Clear all unrolled bets", "Remove the focused target’s bet"],
    keysNote: "Shortcuts pause in text fields and open dialogs. Use Tab to move and Enter to activate a button. Space is reserved for Shake during play. ↑ / ↓ adjusts the focused amount by 5 G; the minimum is 1 G.",
    detailsTitle: "More about bets, odds, and saving",
    details: [
      ["Editing bets", "Press and hold a target or chip for half a second, or right-click it, to remove that target’s entire wager. This works with touch or a mouse. To reduce it, remove it and place a smaller amount. Draft edits spend no Gold. Recent amounts are remembered across refreshes and runs; selecting one does not place a bet."],
      ["How the odds change", "Fresh boards use random odds; Red and Black need not be equally likely. After a non-Jackpot payout, the rolled number transfers part of its probability above 2% to the other five, in random shares. The transfer rate is 4%–8% at Tilt 1, rising to 5%–10% at Tilt 6. One transfer occurs per paying roll, regardless of stake or net gain. Tilt may rise or fall."],
      ["One example", "At Tilt 2, the rate is 4.2%–8.4%. A number at 40% has 38 percentage points above the floor. Moving 6.3% of that surplus lowers it to 37.61%; the other five share the difference. Jackpot ties go to the lowest number. Once earned, Shake stays unlocked until used or the board resets."],
      ["Finishing and saving", "Losses and break-even rolls count too. Gold at roll 100 is your score, even if it is zero. Reaching zero earlier ends the run without a score. Earlier peaks do not count. The results compare your personal best; enter a name and choose Confirm & play again. Settings → Restart run discards the current run after confirmation. Both preserve your best completed score."],
      ["Your preferences", "Gold, odds, and roll count save automatically. Refreshing clears unrolled bets; your run, settings, and best 10 completed records stay in this browser’s local storage. Clearing Sixfold’s saved data removes them; they are never sent to a server. In Settings, edit your name (1–24 visible characters), Sound effects, or Reduce motion. System reduced motion is also respected. Sound and motion preferences stay in this browser. Show probabilities starts off in every run. Enabling it requires confirmation and excludes that run’s score from the leaderboard, even if you turn it off later. Your existing record stays. The setting and exclusion save with the current run."],
    ],
  },
  ko: {
    title: "게임 방법", close: "게임 안내 닫기", language: "언어", start: "시작하기",
    intro: "100 G로 시작해 주사위를 100번 굴립니다. 마지막에 남은 Gold가 점수이며, 개인 순위표에는 이 브라우저에서 완주한 게임의 상위 10개 기록이 남습니다.",
    steps: [
      ["베팅하기", "정수 금액을 정한 뒤 숫자, 가로줄, 세로줄 또는 색상을 누르세요. 다시 누르면 보유 Gold 한도 내에서 금액이 추가됩니다. 옆의 칩 세 개로 최근 베팅 금액을 불러올 수 있습니다. 가장 최근 금액이 첫 번째입니다."],
      ["굴리고 받기", "<kbd>R</kbd> 또는 <b>Roll dice</b>를 누르세요. 나온 숫자에 해당하는 모든 베팅이 적중하며, 서로 겹치는 베팅도 각각 지급됩니다. 한 번 굴릴 때마다 남은 횟수가 1 줄고 베팅판이 비워집니다."],
    ],
    payoutsTitle: "지급 배수", payouts: ["숫자", "세로줄", "가로줄 또는 색상"],
    payoutNote: "지급액에는 적중한 베팅의 원금이 포함됩니다. 숫자 하나에 10 G만 걸어 적중하면 60 G를 받아 50 G를 법니다.",
    tilt: ["Tilt 읽기", "각 숫자의 확률은 숨겨져 있으며 서로 다릅니다. <b>Tilt 1–2</b>는 비교적 고른 확률, <b>3–4</b>는 중간, <b>5–6</b>은 소수의 숫자에 확률이 집중된 상태입니다. 어떤 숫자가 유리한지는 알려주지 않습니다. 모든 숫자의 확률은 최소 2%입니다. 하나라도 적중하면 확률이 변하고, 모두 빗나가면 유지됩니다."],
    shake: ["Shake로 새 확률 받기", "굴린 결과 Gold가 늘거나 줄면 <b>Shake</b>가 열립니다. 본전이면 열리지 않습니다. <kbd>Space</kbd>를 누르면 확률이 새로 정해지고 베팅이 지워집니다. Gold와 남은 횟수는 유지되며, 다시 손익이 발생할 때까지 Shake가 잠깁니다."],
    jackpot: ["숨겨진 Jackpot", "가장 확률이 낮은 숫자 하나에만 걸어 적중하면 어떤 판에서든 <b>×24</b>를 받습니다. 같은 숫자에 금액을 더해도 되지만, 다른 곳에도 걸면 대상에서 제외됩니다. 10 G를 걸면 240 G를 받습니다. 적중 시 횟수를 추가로 쓰지 않고 확률이 새로 정해지며 Shake가 잠깁니다."],
    keysTitle: "키보드 조작", keys: ["굴리기", "새 확률 받기", "최근 베팅 금액 불러오기 · 최신순", "베팅 금액 5 G 줄이기 / 늘리기", "아직 굴리지 않은 베팅 모두 지우기", "선택한 칸의 베팅 지우기"],
    keysNote: "입력란을 편집하거나 창이 열려 있으면 단축키가 멈춥니다. Tab으로 이동하고 Enter로 버튼을 누르세요. 게임 중 Space는 Shake 전용입니다. 금액 입력란에서 ↑ / ↓로 5 G씩 조절할 수 있으며 최소 금액은 1 G입니다.",
    detailsTitle: "베팅 수정, 확률 변화, 저장 자세히 보기",
    details: [
      ["베팅 수정", "칸이나 칩을 0.5초 동안 길게 누르거나 오른쪽 클릭하면 해당 칸의 베팅 전체를 지웁니다. 터치와 마우스 모두 가능합니다. 금액을 줄이려면 지운 뒤 더 적게 거세요. 굴리기 전 수정에는 Gold가 들지 않습니다. 최근 금액은 새로고침과 새 게임 후에도 남으며, 불러오기만 해서는 베팅되지 않습니다."],
      ["확률이 바뀌는 방식", "새 판의 확률은 무작위이며 빨강과 검정의 확률이 같을 필요는 없습니다. Jackpot 외의 적중이 있으면 나온 숫자가 최소 확률 2%를 넘는 부분 중 일부를 나머지 다섯 숫자에 무작위 비율로 나눠 줍니다. 최소 확률을 초과한 부분에서 옮기는 비율은 Tilt 1에서 4%–8%, Tilt 6에서 5%–10%입니다. 베팅액이나 전체 손익과 무관하게 적중한 굴림마다 한 번만 변합니다. Tilt는 오를 수도 내릴 수도 있습니다."],
      ["계산 예시", "Tilt 2의 이동 비율은 4.2%–8.4%입니다. 확률 40%에서 최소 2%를 빼면 38%포인트가 남습니다. 그중 6.3%를 옮기면 확률은 약 37.61%가 되고, 나머지 다섯 숫자가 차이를 나눠 받습니다. 최저 확률이 같으면 더 작은 숫자가 Jackpot 대상입니다. 열린 Shake는 사용하거나 판이 초기화될 때까지 유지됩니다."],
      ["종료와 기록", "손실이나 본전인 굴림도 횟수에 포함됩니다. 100번째 굴림 후 Gold가 점수이며 0 G도 유효합니다. 그 전에 0 G가 되면 기록 없이 끝납니다. 중간 최고 잔액은 기록되지 않습니다. 결과 창에서 최고 기록과 비교한 뒤 이름을 입력하고 Confirm & play again으로 다시 시작하세요. Settings → Restart run은 확인 후 현재 게임을 포기합니다. 어느 쪽이든 완주한 최고 기록은 남습니다."],
      ["설정과 저장", "Gold, 확률, 굴린 횟수는 자동 저장됩니다. 새로고침하면 아직 굴리지 않은 베팅은 지워집니다. 게임, 설정, 완주한 상위 10개 기록은 이 브라우저의 로컬 저장소에만 남습니다. Sixfold 저장 데이터를 지우면 사라지며 서버로 전송되지 않습니다. Settings에서 이름(표시 문자 1–24개), Sound effects(효과음), Reduce motion(움직임 줄이기)을 바꿀 수 있습니다. 시스템의 움직임 줄이기 설정도 따릅니다. 소리와 움직임 설정은 이 브라우저에 저장됩니다. Show probabilities(확률 표시)는 새 게임을 시작할 때마다 꺼져 있습니다. 확인 후 켜면 나중에 다시 꺼도 해당 게임의 점수는 순위표에 등록되지 않습니다. 기존 기록은 유지됩니다. 확률 표시 상태와 점수 등록 제외 여부는 현재 게임과 함께 저장됩니다."],
    ],
  },
  ja: {
    title: "遊び方", close: "遊び方を閉じる", language: "言語", start: "始める",
    intro: "100 Gでスタートし、サイコロを100回振ります。最後に残ったGoldがスコアです。個人ランキングには、このブラウザーで完走したゲームの上位10件が残ります。",
    steps: [
      ["ベットする", "整数の金額を決め、数字・横列・縦列・色をクリックします。もう一度押すと、所持Goldの範囲で追加できます。隣の3枚のチップで最近使った金額を呼び出せます。左から新しい順です。"],
      ["振って受け取る", "<kbd>R</kbd>または<b>Roll dice</b>を押します。出た数字に当たるベットは、範囲が重なっていてもすべて払い戻されます。振るたびに残り回数が1減り、ベットが消えます。"],
    ],
    payoutsTitle: "払い戻し倍率", payouts: ["数字", "縦列", "横列・色"],
    payoutNote: "払い戻しには当たったベットの元金を含みます。数字1つに10 Gだけ賭けて当たると60 Gを受け取り、利益は50 Gです。",
    tilt: ["Tiltの見方", "各数字の確率は非公開で、均等ではありません。<b>Tilt 1–2</b>は比較的均等、<b>3–4</b>は中間、<b>5–6</b>は少数の数字に確率が偏った状態です。どの数字が有利かは分かりません。各数字の確率は最低2%です。ベットが当たると確率が変わり、すべて外れると変わりません。"],
    shake: ["Shakeで確率をリセット", "振った結果Goldが増減すると<b>Shake</b>が使えます。収支がゼロなら解除されません。<kbd>Space</kbd>で新しい確率に入れ替わり、ベットが消えます。Goldと残り回数は維持され、次に損益が出るまでShakeは再びロックされます。"],
    jackpot: ["隠れたJackpot", "最も出にくい数字1つだけに賭けて当たると、どの盤面でも<b>×24</b>です。同じ数字への追加は可能ですが、別の場所にも賭けると対象外になります。10 Gなら240 Gの払い戻しです。当たると追加の回数を使わずに確率がリセットされ、Shakeはロックされます。"],
    keysTitle: "キーボード操作", keys: ["振る", "確率をリセット", "最近の金額を呼び出す・新しい順", "金額を5 G減らす / 増やす", "まだ振っていないベットをすべて消す", "フォーカス中のマスのベットを消す"],
    keysNote: "入力欄の編集中やダイアログ表示中はショートカットが停止します。Tabで移動し、Enterでボタンを押します。プレイ中のSpaceはShake専用です。金額欄では↑ / ↓で5 Gずつ調整でき、最低金額は1 Gです。",
    detailsTitle: "ベット・確率・保存の詳細",
    details: [
      ["ベットの編集", "マスやチップを0.5秒間長押しするか右クリックすると、そのマスのベット全額を取り消します。タッチでもマウスでも操作できます。減らす場合は取り消してから少額を賭け直します。振る前の編集ではGoldを使いません。最近の金額は再読み込みや次のゲームでも残り、呼び出すだけではベットされません。"],
      ["確率の変化", "新しい盤面の確率はランダムで、赤と黒も同確率とは限りません。Jackpot以外の払い戻しがあると、出た数字の確率のうち最低2%を超える部分から一部を取り、他の5数字へランダムな比率で配分します。移動率はTilt 1で4%–8%、Tilt 6で5%–10%です。賭け金や合計の損益に関係なく、当たった回ごとに1度だけ変化します。Tiltは上がることも下がることもあります。"],
      ["計算例", "Tilt 2の移動率は4.2%–8.4%です。確率40%から最低2%を引くと38ポイントです。その6.3%を移すと約37.61%になり、差分を他の5数字が分け合います。最低確率が同じ場合、数字が小さい方がJackpotです。解除されたShakeは、使うか盤面がリセットされるまで有効です。"],
      ["終了と記録", "負けや収支ゼロの回も数えます。100回目の後のGoldがスコアで、0 Gも有効です。それより前に0 Gになると記録なしで終了します。途中の最高残高は対象外です。結果画面で自己ベストと比較し、名前を入れてConfirm & play againで再開します。Settings → Restart runでは確認後に現在のゲームを破棄します。どちらも完走済みの自己ベストは残ります。"],
      ["設定と保存", "Gold・確率・回数は自動保存されます。再読み込みすると未確定のベットは消えます。ゲーム・設定・完走した上位10件の記録は、このブラウザーのローカルストレージに保存されます。Sixfoldの保存データを削除すると失われ、サーバーには送信されません。Settingsで名前（表示文字1–24字）、Sound effects（効果音）、Reduce motion（動きを減らす）を変更できます。システムの視差効果を減らす設定にも従います。音と動きの設定はこのブラウザーに保存されます。Show probabilities（確率表示）は毎回の開始時にオフです。確認してオンにすると、後でオフに戻してもその回のスコアはランキングに登録されません。既存の記録は残ります。表示設定とランキング対象外の状態は現在のゲームとともに保存されます。"],
    ],
  },
  zh: {
    title: "玩法说明", close: "关闭玩法说明", language: "语言", start: "开始游戏",
    intro: "从100 G开始，掷骰100次。最后的Gold就是分数；个人排行榜保留当前浏览器中已完成游戏的最佳10局纪录。",
    steps: [
      ["下注", "输入整数金额，再点击数字、横行、竖列或颜色。再次点击可追加下注，但总额不能超过持有的Gold。旁边的三个筹码可调用最近使用的金额，从左到右按由新到旧排列。"],
      ["掷骰并领取返还", "按<kbd>R</kbd>或点击<b>Roll dice</b>。所有覆盖结果数字的下注都会获得返还，重叠的下注也分别计算。每次掷骰消耗一次机会，并清空本次下注。"],
    ],
    payoutsTitle: "返还倍数", payouts: ["数字", "竖列", "横行或颜色"],
    payoutNote: "返还金额包含中奖下注的本金。只在一个数字上下注10 G并命中，可获得60 G，净赚50 G。",
    tilt: ["看懂Tilt", "各数字的概率隐藏且不均等。<b>Tilt 1–2</b>表示较为均匀，<b>3–4</b>居中，<b>5–6</b>表示概率集中在少数数字上。它不会告诉你哪些数字更容易出现。每个数字的概率至少为2%。有下注命中时概率会变化；全部落空时则不变。"],
    shake: ["用Shake更换概率", "一次掷骰使Gold增加或减少后，即可解锁<b>Shake</b>；收支持平不会解锁。按<kbd>Space</kbd>可生成新概率并清空下注。Gold和剩余次数不变，随后Shake会再次锁定，直到又一次产生盈亏。"],
    jackpot: ["隐藏的Jackpot", "只押概率最低的一个数字并命中，在任何局面下都可获得<b>×24</b>返还。可向同一个数字追加金额，但押任何其他位置都会失去资格。下注10 G可获得240 G。命中后自动重置概率并锁定Shake，不额外消耗次数。"],
    keysTitle: "键盘操作", keys: ["掷骰", "更换概率", "调用最近金额，按由新到旧排列", "下注金额减少 / 增加5 G", "清空所有尚未掷骰的下注", "移除当前焦点位置的下注"],
    keysNote: "编辑输入框或打开对话框时，快捷键暂停。用Tab移动焦点，Enter激活按钮。游戏中的Space专用于Shake。在金额控件中，↑ / ↓可按5 G调整，最低为1 G。",
    detailsTitle: "下注、概率与保存的详细规则",
    details: [
      ["修改下注", "长按位置或筹码半秒，或右键点击，即可取消该位置的全部下注。触摸和鼠标操作均可。要减少金额，请先取消再以较小金额重新下注。掷骰前的修改不消耗Gold。最近金额在刷新和新一局后仍会保留；调用金额本身不会下注。"],
      ["概率如何变化", "新局面的概率随机生成，红色和黑色不一定各占一半。除Jackpot外，只要有下注命中，结果数字就会将其概率超过2%的部分按一定比例转移给其他五个数字，分配比例随机。转移比例从Tilt 1的4%–8%逐渐增加到Tilt 6的5%–10%。每次有返还的掷骰只转移一次，与下注金额及净盈亏无关。Tilt可能上升，也可能下降。"],
      ["计算示例", "Tilt 2的转移比例为4.2%–8.4%。概率40%减去最低2%，剩下38个百分点。如果转移这部分的6.3%，该数字的概率变为约37.61%，其余五个数字分享差额。最低概率并列时，数值最小的数字是Jackpot目标。Shake解锁后会一直可用，直到使用或重置局面。"],
      ["结束与纪录", "亏损或持平的掷骰也计入次数。第100次后的Gold即为得分，0 G也有效。更早归零则结束本局，不提交分数。途中的最高余额不计入纪录。结果窗口会对比个人最佳；输入名字后选择Confirm & play again重新开始。Settings → Restart run经确认后放弃当前一局。两种方式都会保留已完成局的最高纪录。"],
      ["设置与保存", "Gold、概率和已用次数会自动保存。刷新会清除尚未掷骰的下注；游戏、设置和已完成的最佳10局纪录仅保存在当前浏览器的本地存储中。删除Sixfold保存数据会清除这些内容，数据不会发送到服务器。Settings中可修改名字（1–24个可见字符）、Sound effects（音效）和Reduce motion（减少动态效果），也会遵循系统的减少动态效果设置。声音和动态效果设置保存在当前浏览器中。Show probabilities（显示概率）在每局开始时默认关闭。确认开启后，即使稍后关闭，该局分数也不会进入排行榜。已有纪录会保留。显示设置和不参与排名的状态随当前游戏保存。"],
    ],
  },
  es: {
    title: "Cómo jugar", close: "Cerrar la guía", language: "Idioma", start: "Jugar",
    intro: "Empiezas con 100 G y juegas 100 tiradas. El Gold final es tu puntuación; la clasificación personal guarda tus 10 mejores partidas completadas en este navegador.",
    steps: [
      ["Haz tus apuestas", "Elige una cantidad entera y pulsa un número, fila, columna o color. Pulsa de nuevo para añadir más, sin superar tu saldo. Las tres fichas recuperan importes recientes, del más nuevo al más antiguo."],
      ["Tira y cobra", "Pulsa <kbd>R</kbd> o <b>Roll dice</b>. Todas las apuestas que cubran el resultado pagan, aunque se solapen. Cada tirada borra las apuestas y consume una de tus 100 tiradas."],
    ],
    payoutsTitle: "Multiplicadores", payouts: ["Número", "Columna", "Fila o color"],
    payoutNote: "El pago incluye la apuesta ganadora. Apostar solo 10 G a un número y acertar devuelve 60 G: una ganancia de 50 G.",
    tilt: ["Interpreta el Tilt", "Las probabilidades están ocultas y no son iguales. <b>Tilt 1–2</b> indica mayor equilibrio; <b>3–4</b>, un punto intermedio; <b>5–6</b>, una concentración en pocos números. No revela cuáles. Cada número tiene al menos un 2% de probabilidad. Un acierto cambia las probabilidades; si ninguna apuesta gana, se mantienen."],
    shake: ["Shake: nuevas probabilidades", "Una tirada con ganancia o pérdida de Gold desbloquea <b>Shake</b>; quedar a cero de beneficio no lo desbloquea. Pulsa <kbd>Space</kbd> para renovar las probabilidades y borrar las apuestas. Conservas el Gold y las tiradas. Shake vuelve a bloquearse hasta otra ganancia o pérdida."],
    jackpot: ["El Jackpot oculto", "Apuesta solo al número menos probable y acierta para cobrar <b>×24</b> en cualquier tablero. Puedes añadir más al mismo número; cualquier otra apuesta anula la posibilidad. Con 10 G recibes 240 G. El acierto renueva automáticamente el tablero y bloquea Shake, sin consumir otra tirada."],
    keysTitle: "Controles de teclado", keys: ["Tirar", "Renovar las probabilidades", "Recuperar importes recientes, del más nuevo al más antiguo", "Reducir / aumentar el importe en 5 G", "Borrar todas las apuestas sin tirar", "Quitar la apuesta de la casilla enfocada"],
    keysNote: "Los atajos se pausan en campos de texto y diálogos abiertos. Usa Tab para moverte y Enter para activar un botón. Durante el juego, Space (espacio) se reserva para Shake. ↑ / ↓ ajusta en 5 G el importe enfocado; el mínimo es 1 G.",
    detailsTitle: "Más sobre apuestas, probabilidades y guardado",
    details: [
      ["Editar apuestas", "Mantén pulsada una casilla o ficha durante medio segundo, o haz clic derecho, para quitar toda su apuesta. Funciona con el dedo o el ratón. Para reducirla, quítala y apuesta menos. Editar antes de tirar no gasta Gold. Los importes recientes se conservan al recargar y entre partidas; elegir uno no coloca una apuesta."],
      ["Cómo cambian las probabilidades", "Cada tablero nuevo tiene probabilidades aleatorias; rojo y negro no tienen por qué ser igual de probables. Tras un pago que no sea Jackpot, el número obtenido cede parte de su probabilidad por encima del 2% a los otros cinco, en proporciones aleatorias. La tasa va del 4%–8% en Tilt 1 al 5%–10% en Tilt 6. Hay una transferencia por tirada con pago, sin importar el importe ni el beneficio neto. Tilt puede subir o bajar."],
      ["Un ejemplo", "En Tilt 2, la tasa es del 4,2%–8,4%. Un número con un 40% tiene 38 puntos porcentuales sobre el mínimo. Transferir el 6,3% de ese excedente lo deja en un 37,61%; los otros cinco se reparten la diferencia. Si hay empate en la probabilidad mínima, el Jackpot corresponde al número menor. Una vez desbloqueado, Shake sigue disponible hasta usarlo o renovar el tablero."],
      ["Terminar y guardar", "Las pérdidas y las tiradas sin beneficio también cuentan. El Gold tras la tirada 100 es la puntuación, incluso si es cero. Llegar a cero antes termina la partida sin puntuación. Los máximos intermedios no cuentan. El resultado se compara con tu récord; escribe un nombre y elige Confirm & play again. Settings → Restart run descarta la partida actual tras confirmarlo. Ambas opciones conservan tu mejor partida completada."],
      ["Tus preferencias", "El Gold, las probabilidades y las tiradas se guardan automáticamente. Recargar borra las apuestas pendientes; la partida, los ajustes y tus 10 mejores partidas completadas se conservan en el almacenamiento local de este navegador. Borrar los datos de Sixfold los elimina; no se envían a ningún servidor. En Settings puedes cambiar el nombre (1–24 caracteres visibles), Sound effects (sonido) y Reduce motion (reducir movimiento). También se respeta la preferencia del sistema. Las preferencias de sonido y movimiento se guardan en este navegador. Show probabilities empieza desactivado en cada partida. Activarlo requiere confirmación y excluye la puntuación de esa partida del ranking, aunque luego lo desactives. Tu récord anterior se conserva. El ajuste y la exclusión se guardan con la partida actual."],
    ],
  },
  fr: {
    title: "Comment jouer", close: "Fermer le guide", language: "Langue", start: "Jouer",
    intro: "Commencez avec 100 G et jouez 100 lancers. Le Gold final est votre score ; le classement personnel conserve vos 10 meilleures parties terminées dans ce navigateur.",
    steps: [
      ["Placez vos mises", "Choisissez un montant entier, puis cliquez sur un nombre, une ligne, une colonne ou une couleur. Cliquez à nouveau pour ajouter une mise, dans la limite de votre solde. Les trois jetons rappellent les montants récents, du plus récent au plus ancien."],
      ["Lancez et encaissez", "Appuyez sur <kbd>R</kbd> ou cliquez sur <b>Roll dice</b>. Toutes les mises couvrant le résultat sont payées, même si elles se chevauchent. Chaque lancer efface les mises et consomme un de vos 100 lancers."],
    ],
    payoutsTitle: "Multiplicateurs", payouts: ["Nombre", "Colonne", "Ligne ou couleur"],
    payoutNote: "Le versement inclut la mise gagnante. Miser seulement 10 G sur un nombre et gagner rapporte 60 G, soit un bénéfice de 50 G.",
    tilt: ["Comprendre le Tilt", "Les probabilités sont cachées et inégales. <b>Tilt 1–2</b> indique des chances plus équilibrées ; <b>3–4</b>, un état intermédiaire ; <b>5–6</b>, une concentration sur peu de nombres. Il ne révèle pas lesquels. Chaque nombre a au moins 2% de chances. Un paiement modifie les probabilités ; si aucune mise ne gagne, elles restent inchangées."],
    shake: ["Shake : renouveler les probabilités", "Un lancer qui fait gagner ou perdre du Gold débloque <b>Shake</b> ; un bilan nul ne le débloque pas. Appuyez sur <kbd>Space</kbd> pour renouveler les probabilités et effacer les mises. Vous gardez votre Gold et vos lancers. Shake se verrouille jusqu’au prochain gain ou à la prochaine perte."],
    jackpot: ["Le Jackpot caché", "Misez uniquement sur le nombre le moins probable et trouvez-le pour recevoir <b>×24</b>, quel que soit le plateau. Vous pouvez ajouter une mise sur ce même nombre ; toute autre mise annule l’éligibilité. Avec 10 G, vous recevez 240 G. Le Jackpot renouvelle automatiquement le plateau et verrouille Shake, sans lancer supplémentaire."],
    keysTitle: "Commandes au clavier", keys: ["Lancer", "Renouveler les probabilités", "Rappeler les montants récents, du plus récent au plus ancien", "Diminuer / augmenter le montant de 5 G", "Effacer toutes les mises non jouées", "Retirer la mise de la case sélectionnée"],
    keysNote: "Les raccourcis sont suspendus dans les champs de texte et les fenêtres ouvertes. Tab déplace le focus ; Enter active un bouton. Pendant le jeu, Space (espace) est réservé à Shake. ↑ / ↓ ajuste le montant sélectionné de 5 G ; le minimum est 1 G.",
    detailsTitle: "Détails sur les mises, les probabilités et la sauvegarde",
    details: [
      ["Modifier les mises", "Maintenez une case ou un jeton enfoncé pendant une demi-seconde, ou faites un clic droit, pour retirer toute la mise de cette case. Cela fonctionne au doigt ou à la souris. Pour la réduire, retirez-la puis misez moins. Les modifications avant le lancer ne dépensent aucun Gold. Les montants récents restent disponibles après rechargement et entre les parties ; en choisir un ne place pas de mise."],
      ["Évolution des probabilités", "Chaque nouveau plateau reçoit des probabilités aléatoires ; rouge et noir ne sont pas forcément équiprobables. Après un paiement hors Jackpot, le nombre obtenu cède une fraction de sa probabilité au-delà de 2% aux cinq autres, en parts aléatoires. Le taux va de 4%–8% au Tilt 1 à 5%–10% au Tilt 6. Il y a un transfert par lancer payant, quels que soient la mise et le gain net. Le Tilt peut monter ou descendre."],
      ["Un exemple", "Au Tilt 2, le taux est de 4,2%–8,4%. Un nombre à 40% dépasse le minimum de 38 points. Transférer 6,3% de cet excédent le ramène à 37,61% ; les cinq autres se partagent la différence. En cas d’égalité au minimum, le plus petit nombre est le Jackpot. Une fois débloqué, Shake reste disponible jusqu’à son utilisation ou au renouvellement du plateau."],
      ["Fin de partie et records", "Les pertes et les bilans nuls comptent aussi. Le Gold après le 100e lancer est le score, même à zéro. Atteindre zéro avant termine la partie sans score. Les pics intermédiaires ne comptent pas. Le résultat est comparé à votre record ; saisissez un nom puis choisissez Confirm & play again. Settings → Restart run abandonne la partie après confirmation. Les deux options conservent votre meilleur score de partie terminée."],
      ["Vos préférences", "Le Gold, les probabilités et le nombre de lancers sont sauvegardés automatiquement. Recharger efface les mises non jouées ; la partie, les réglages et vos 10 meilleures parties terminées restent dans le stockage local de ce navigateur. Effacer les données de Sixfold les supprime ; elles ne sont jamais envoyées à un serveur. Dans Settings, réglez le nom (1–24 caractères visibles), Sound effects (sons) et Reduce motion (réduire les animations). La préférence système est aussi respectée. Les préférences de son et de mouvement restent dans ce navigateur. Show probabilities est désactivé au début de chaque partie. Son activation demande confirmation et exclut le score de cette partie du classement, même si vous le désactivez ensuite. Votre record existant est conservé. Le réglage et l’exclusion sont sauvegardés avec la partie en cours."],
    ],
  },
  de: {
    title: "Spielanleitung", close: "Spielanleitung schließen", language: "Sprache", start: "Losspielen",
    intro: "Starte mit 100 G und spiele 100 Würfe. Dein letzter Goldstand ist dein Ergebnis; die persönliche Rangliste speichert deine 10 besten abgeschlossenen Durchläufe in diesem Browser.",
    steps: [
      ["Setze deinen Einsatz", "Wähle einen ganzzahligen Betrag und klicke auf eine Zahl, Reihe, Spalte oder Farbe. Erneutes Klicken erhöht den Einsatz bis zur Höhe deines Guthabens. Die drei Chips rufen zuletzt gesetzte Beträge ab, den neuesten zuerst."],
      ["Würfle und kassiere", "Drücke <kbd>R</kbd> oder klicke auf <b>Roll dice</b>. Alle zum Ergebnis passenden Einsätze zahlen aus, auch überlappende Gruppen. Jeder Wurf entfernt die Einsätze und verbraucht einen deiner 100 Würfe."],
    ],
    payoutsTitle: "Auszahlungen", payouts: ["Zahl", "Spalte", "Reihe oder Farbe"],
    payoutNote: "Die Auszahlung enthält den ursprünglichen Einsatz der gewonnenen Wette. Setzt du nur 10 G auf eine Zahl und triffst, erhältst du 60 G: ein Gewinn von 50 G.",
    tilt: ["Tilt verstehen", "Die Wahrscheinlichkeiten sind verborgen und ungleich. <b>Tilt 1–2</b> bedeutet eine gleichmäßigere Verteilung, <b>3–4</b> liegt dazwischen, <b>5–6</b> bedeutet eine Konzentration auf wenige Zahlen. Welche Zahlen das sind, verrät Tilt nicht. Jede Zahl hat mindestens 2% Chance. Eine Auszahlung verändert die Wahrscheinlichkeiten; ohne Treffer bleiben sie gleich."],
    shake: ["Shake: neue Wahrscheinlichkeiten", "Ein Wurf mit Goldgewinn oder -verlust schaltet <b>Shake</b> frei; ein ausgeglichener Wurf tut das nicht. Drücke <kbd>Space</kbd>, um neue Wahrscheinlichkeiten zu erhalten und die Einsätze zu entfernen. Gold und verbleibende Würfe bleiben erhalten. Shake wird bis zum nächsten Gewinn oder Verlust gesperrt."],
    jackpot: ["Der verborgene Jackpot", "Setze ausschließlich auf die unwahrscheinlichste Zahl und triff sie, um auf jedem Spielfeld <b>×24</b> zu erhalten. Weitere Einsätze auf dieselbe Zahl sind erlaubt; jeder andere Einsatz schließt den Jackpot aus. Bei 10 G erhältst du 240 G. Der Treffer erneuert automatisch das Spielfeld und sperrt Shake, ohne einen weiteren Wurf zu verbrauchen."],
    keysTitle: "Tastatursteuerung", keys: ["Würfeln", "Wahrscheinlichkeiten erneuern", "Letzte Beträge abrufen, den neuesten zuerst", "Betrag um 5 G senken / erhöhen", "Alle noch nicht gespielten Einsätze entfernen", "Einsatz des fokussierten Feldes entfernen"],
    keysNote: "In Textfeldern und offenen Dialogen pausieren die Kürzel. Tab wechselt den Fokus, Enter betätigt eine Schaltfläche. Im Spiel ist Space (Leertaste) für Shake reserviert. ↑ / ↓ ändert den fokussierten Betrag um 5 G; das Minimum ist 1 G.",
    detailsTitle: "Mehr zu Einsätzen, Wahrscheinlichkeiten und Speichern",
    details: [
      ["Einsätze bearbeiten", "Halte ein Feld oder einen Chip eine halbe Sekunde gedrückt oder klicke mit der rechten Maustaste, um den gesamten Einsatz dieses Feldes zu entfernen. Das funktioniert per Touch und mit der Maus. Zum Verringern entfernst du ihn und setzt einen kleineren Betrag. Bearbeiten vor dem Wurf kostet kein Gold. Letzte Beträge bleiben nach Neuladen und zwischen Durchläufen erhalten; das Abrufen allein setzt nichts."],
      ["Wie sich die Chancen ändern", "Neue Spielfelder haben zufällige Wahrscheinlichkeiten; Rot und Schwarz müssen nicht gleich wahrscheinlich sein. Nach einer Auszahlung ohne Jackpot gibt die gewürfelte Zahl einen Anteil ihrer Wahrscheinlichkeit oberhalb von 2% an die anderen fünf ab, zufällig aufgeteilt. Die Transferrate steigt von 4%–8% bei Tilt 1 auf 5%–10% bei Tilt 6. Pro Wurf mit Auszahlung gibt es genau einen Transfer, unabhängig vom Einsatz und Nettogewinn. Tilt kann steigen oder fallen."],
      ["Ein Beispiel", "Bei Tilt 2 beträgt die Rate 4,2%–8,4%. Eine Zahl mit 40% liegt 38 Prozentpunkte über dem Minimum. Werden 6,3% dieses Überschusses übertragen, bleiben etwa 37,61%; die anderen fünf teilen sich die Differenz. Bei gleicher niedrigster Wahrscheinlichkeit ist die kleinere Zahl der Jackpot. Ein freigeschaltetes Shake bleibt verfügbar, bis du es nutzt oder das Spielfeld erneuert wird."],
      ["Abschluss und Rekorde", "Verluste und ausgeglichene Würfe zählen ebenfalls. Gold nach Wurf 100 ist dein Ergebnis, auch bei null. Erreichst du vorher null, endet der Durchlauf ohne Ergebnis. Zwischenzeitliche Höchststände zählen nicht. Das Ergebnis wird mit deinem Rekord verglichen; gib einen Namen ein und wähle Confirm & play again. Settings → Restart run verwirft den aktuellen Durchlauf nach Bestätigung. Beide Wege erhalten deinen besten abgeschlossenen Durchlauf."],
      ["Deine Einstellungen", "Gold, Wahrscheinlichkeiten und Wurfzahl werden automatisch gespeichert. Neuladen entfernt noch nicht gespielte Einsätze; der Durchlauf, die Einstellungen und deine 10 besten abgeschlossenen Durchläufe bleiben im lokalen Speicher dieses Browsers. Wenn du die Sixfold-Daten löschst, gehen sie verloren; sie werden nie an einen Server gesendet. Unter Settings änderst du den Namen (1–24 sichtbare Zeichen), Sound effects (Ton) und Reduce motion (weniger Bewegung). Die Systemeinstellung für reduzierte Bewegung gilt ebenfalls. Ton und Bewegungseinstellungen bleiben in diesem Browser gespeichert. Show probabilities ist zu Beginn jedes Durchlaufs ausgeschaltet. Das Einschalten erfordert eine Bestätigung und schließt das Ergebnis dieses Durchlaufs von der Rangliste aus, auch wenn du die Anzeige später ausschaltest. Dein bisheriger Rekord bleibt erhalten. Die Anzeige und der Ranglistenausschluss werden mit dem aktuellen Durchlauf gespeichert."],
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
      <h3 class="tilt-guide" tabindex="-1">${copy.tilt[0]}</h3><p>${copy.tilt[1]}</p>
      ${section(copy.shake)}${section(copy.jackpot)}
      <h3>${copy.keysTitle}</h3>
      <dl class="guide-shortcuts">${copy.keys.map((label, index) => `<div><dt><kbd>${keys[index]}</kbd></dt><dd>${label}</dd></div>`).join("")}</dl>
      <p>${copy.keysNote}</p>
      <details class="guide-details"><summary>${copy.detailsTitle}</summary>${copy.details.map(section).join("")}</details>
    </div>`;
}
