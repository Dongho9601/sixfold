import { CONFIG } from "./config";
import { guideImages } from "./guide-images";
import type { GuideLanguage } from "./guide";

type Slide = readonly [title: string, explanation: string, continuation: string];
type CoverageExample = readonly [label: string, caption: string];
interface SlideCopy {
  previous: string;
  next: string;
  rules: string;
  slides: string;
  items: readonly Slide[];
  captions: readonly string[];
  coverage: readonly CoverageExample[];
  coverageLabel: string;
  enlarge: string;
}

const stake = 10;
const singleReturn = stake * CONFIG.multipliers.number;
const groupReturn = stake * CONFIG.multipliers.row;
const columnReturn = stake * CONFIG.multipliers.column;
const jackpotReturn = stake * CONFIG.multipliers.jackpot;
const combinedReturn = singleReturn + groupReturn;
const combinedGold = Number(CONFIG.startingGold) - stake * 2 + combinedReturn;

// Each picture and its localized explanation describe a specific game state.
// Examples are fixed teaching states, never the player's current or hidden odds.
export const slideGuides: Record<GuideLanguage, SlideCopy> = {
  en: {
    previous: "Back", next: "Next", rules: "Full rules", slides: "Back to slides", coverageLabel: "Choose a bet example", enlarge: "View full size",
    items: [
      ["Gold and rolls", `Bankroll is your Gold (G); Rolls remaining is turns left. Start with ${CONFIG.startingGold} G and ${CONFIG.rollsPerRun} rolls.`, `Each roll uses one turn. Finish ${CONFIG.rollsPerRun} rolls to score your remaining Gold; 0 G earlier ends the run without a record.`],
      ["Read Tilt", "Odds are hidden. Tilt 1 is nearly even; Tilt 6 concentrates chances on fewer numbers.", "Brighter squares mean higher chances, sorted highest to lowest. They do not identify numbers. After a roll: ▲ more uneven; ▼ less; − unchanged."],
      ["Place a bet", `Set Bet amount to ${stake} G, then tap 3 to bet on that result. Tap again to add ${stake} G.`, "On the table is your total bet, limited by Bankroll. Hold half a second or right-click to remove a bet. On phones, tap the amount for the keypad."],
      ["Choose a bet", "Choose an example. Outlines mark winning numbers. Columns cover two numbers; rows cover Odds or Evens. Colors follow the cells, not odd/even.", "Payouts include your stake; a miss pays 0 G. More numbers may not improve your chance, because their odds differ."],
      ["Roll and collect", `${stake} G on 3 + ${stake} G on Odds: rolling 3 pays ${singleReturn} + ${groupReturn} = ${combinedReturn} G. Bankroll: ${CONFIG.startingGold} − ${stake * 2} + ${combinedReturn} = ${combinedGold} G.`, "Roll dice deducts stakes, uses one turn and clears bets. Ordinary hits shift chance away from the rolled number, even with a net loss; all misses leave odds unchanged."],
      ["Use Shake", "BOARD NET is this board’s total payouts minus stakes. −10 G then +50 G gives +40 G.", "A net gain or loss unlocks Shake. It replaces odds, clears bets and resets BOARD NET, costing no Gold or turn. It stays unlocked until used or a Jackpot."],
      ["Jackpot: one number only", `Bet only on the least likely number and hit it for ×${CONFIG.multipliers.jackpot}. Its identity is hidden; here we assume 3.`, `${stake} G would pay ${jackpotReturn} G. Betting anywhere else cancels eligibility. Jackpot replaces the odds and resets BOARD NET and Shake.`],
      ["Finish and save a score", `Gold after ${CONFIG.rollsPerRun} rolls is your score. Personal records stores this browser’s best ${CONFIG.leaderboardLimit} eligible completed runs.`, "Settings → Show probabilities reveals the odds but excludes that run from records, even if hidden again. A new run can qualify again."],
    ],
    captions: [
      `${CONFIG.startingGold} G, ${CONFIG.rollsPerRun} rolls, no bets.`,
      "Tilt 1: nearly even. Tilt 6: strong bias.",
      `${stake} G on Number 3; On the table: ${stake} G.`,
      "",
      `Rolled 3: Bankroll ${combinedGold} G; BOARD NET +${combinedReturn - stake * 2} G.`,
      "BOARD NET +40 G; Shake unlocked.",
      `Example: ${stake} G on 3 alone.`,
      "Finished: 150 G and 0 rolls remaining.",
    ],
    coverage: [
      ["Number 3", `3 wins. ${stake} G × ${CONFIG.multipliers.number} = ${singleReturn} G payout.`],
      ["Middle column", `3 or 4 wins. ${stake} G × ${CONFIG.multipliers.column} = ${columnReturn} G payout.`],
      ["Odds row", `1, 3 or 5 wins. ${stake} G × ${CONFIG.multipliers.row} = ${groupReturn} G payout.`],
      ["Red", `1, 4 or 5 wins. ${stake} G × ${CONFIG.multipliers.color} = ${groupReturn} G payout.`],
    ],
  },
  ko: {
    previous: "이전", next: "다음", rules: "전체 규칙", slides: "슬라이드로 돌아가기", coverageLabel: "베팅 예시 선택", enlarge: "원본 크기로 보기",
    items: [
      ["Gold와 남은 횟수", `Bankroll은 보유 Gold(G), Rolls remaining은 남은 횟수입니다. ${CONFIG.startingGold} G와 ${CONFIG.rollsPerRun}회로 시작합니다.`, `굴릴 때마다 1회를 씁니다. ${CONFIG.rollsPerRun}회를 마치면 남은 Gold가 점수이며, 그 전에 0 G가 되면 기록 없이 끝납니다.`],
      ["Tilt 읽기", "확률은 숨겨져 있습니다. Tilt 1은 거의 균등하고, Tilt 6은 소수의 숫자에 확률이 쏠린 상태입니다.", "사각형은 높은 확률부터 낮은 확률 순이며 밝을수록 확률이 높습니다. 숫자를 가리키지는 않습니다. 직전 굴림 후 ▲는 쏠림 증가, ▼는 감소, −는 변화 없음입니다."],
      ["베팅하기", `Bet amount를 ${stake} G로 정하고 3을 누르면 결과 3에 베팅합니다. 다시 누르면 ${stake} G가 추가됩니다.`, "On the table은 전체 베팅액이며 Bankroll을 넘을 수 없습니다. 반초 동안 길게 누르거나 오른쪽 클릭하면 베팅을 지웁니다. 휴대폰에서는 금액을 누르면 키패드가 열립니다."],
      ["베팅 종류 고르기", "예시를 고르세요. 테두리는 적중하는 숫자입니다. 세로줄은 숫자 두 개, 가로줄은 Odds(홀수) 또는 Evens(짝수)입니다. 색상은 홀짝이 아닌 칸의 색상을 따릅니다.", "지급액에는 원금이 포함되며, 빗나가면 0 G입니다. 숫자마다 확률이 달라 더 많이 포함한다고 적중 확률이 높지는 않습니다."],
      ["굴리고 지급받기", `3과 Odds에 ${stake} G씩 걸고 3이 나오면 ${singleReturn} + ${groupReturn} = ${combinedReturn} G를 받습니다. Bankroll: ${CONFIG.startingGold} − ${stake * 2} + ${combinedReturn} = ${combinedGold} G.`, "Roll dice는 베팅액을 차감하고 1회를 쓰며 베팅을 지웁니다. 일반 베팅이 적중하면 전체로 손해여도 나온 숫자의 확률 일부가 다른 숫자로 옮겨갑니다. 모두 빗나가면 그대로입니다."],
      ["Shake 사용하기", "BOARD NET은 현재 보드의 누적 지급액에서 베팅액을 뺀 값입니다. −10 G 뒤 +50 G면 +40 G입니다.", "순이익이나 순손실이 나면 Shake가 열립니다. Gold와 횟수를 쓰지 않고 확률을 바꾸며 베팅과 BOARD NET을 초기화합니다. 사용하거나 Jackpot이 나올 때까지 열려 있습니다."],
      ["Jackpot: 숫자 하나에만", `확률이 가장 낮은 숫자 하나에만 걸고 적중하면 ×${CONFIG.multipliers.jackpot}입니다. 대상은 숨겨져 있으며, 여기서는 3이라고 가정합니다.`, `${stake} G를 걸면 ${jackpotReturn} G를 받습니다. 다른 곳에도 걸면 자격이 사라집니다. Jackpot은 확률을 새로 뽑고 BOARD NET과 Shake를 초기화합니다.`],
      ["완주하고 점수 남기기", `${CONFIG.rollsPerRun}회 후 남은 Gold가 점수입니다. Personal records는 이 브라우저에서 기록 대상인 완료 게임 상위 ${CONFIG.leaderboardLimit}개를 보관합니다.`, "Settings → Show probabilities를 켜면 확률이 보이지만 해당 게임은 기록에서 제외됩니다. 다시 꺼도 마찬가지입니다. 새 게임은 다시 기록 대상이 됩니다."],
    ],
    captions: [`${CONFIG.startingGold} G, 남은 ${CONFIG.rollsPerRun}회, 베팅 없음.`, "Tilt 1: 거의 균등. Tilt 6: 강한 쏠림.", `숫자 3에 ${stake} G; On the table: ${stake} G.`, "", `결과 3: Bankroll ${combinedGold} G; BOARD NET +${combinedReturn - stake * 2} G.`, "BOARD NET +40 G; Shake 사용 가능.", `예시: 3에만 ${stake} G 베팅.`, "완료: 150 G, 남은 횟수 0."],
    coverage: [["숫자 3", `3에 적중. ${stake} G × ${CONFIG.multipliers.number} = ${singleReturn} G 지급.`], ["가운데 세로줄", `3 또는 4에 적중. ${stake} G × ${CONFIG.multipliers.column} = ${columnReturn} G 지급.`], ["Odds · 홀수줄", `1, 3, 5에 적중. ${stake} G × ${CONFIG.multipliers.row} = ${groupReturn} G 지급.`], ["Red · 빨강", `1, 4, 5에 적중. ${stake} G × ${CONFIG.multipliers.color} = ${groupReturn} G 지급.`]],
  },
  ja: {
    previous: "戻る", next: "次へ", rules: "全ルール", slides: "スライドに戻る", coverageLabel: "ベットの例を選ぶ", enlarge: "原寸で見る",
    items: [
      ["Goldと残り回数", `Bankrollは手持ちのGold（G）、Rolls remainingは残り回数です。${CONFIG.startingGold} Gと${CONFIG.rollsPerRun}回で始まります。`, `振るたびに1回分を使います。${CONFIG.rollsPerRun}回後のGoldがスコアで、それより前に0 Gになると記録なしで終了します。`],
      ["Tiltを読む", "確率は隠されています。Tilt 1はほぼ均等、Tilt 6は少数の数字に確率が集中しています。", "四角は確率の高い順で、明るいほど高確率です。数字は特定できません。直前のロール後、▲は偏り増加、▼は減少、−は変化なしです。"],
      ["ベットする", `Bet amountを${stake} Gにして3を押すと、結果3に賭けます。もう一度押すと${stake} G追加します。`, "On the tableは全ベットの合計で、Bankrollを超えて賭けられません。半秒長押し、または右クリックで削除します。スマートフォンでは金額を押すとテンキーが開きます。"],
      ["ベットを選ぶ", "例を選んでください。枠は当たりになる数字です。縦列は2つの数字、横列はOdds（奇数）かEvens（偶数）です。色は奇偶ではなくマスの色に従います。", "払い戻しは元金を含み、外れは0 Gです。数字ごとに確率が違うため、多くの数字を含めても当たりやすいとは限りません。"],
      ["振って払い戻しを受ける", `3とOddsに${stake} Gずつ賭け、3が出ると${singleReturn} + ${groupReturn} = ${combinedReturn} Gを受け取ります。Bankroll：${CONFIG.startingGold} − ${stake * 2} + ${combinedReturn} = ${combinedGold} G。`, "Roll diceは賭け金を引き、1回分を使い、ベットを消します。通常の当たりは全体で損失でも、出た数字の確率の一部を他へ移します。すべて外れると確率は変わりません。"],
      ["Shakeを使う", "BOARD NETは現在の盤面の総払い戻し−賭け金です。−10 Gの後に+50 Gなら+40 Gです。", "純利益か純損失が出るとShakeが使えます。Goldも回数も使わず、確率を新しくし、ベットとBOARD NETをリセットします。使うかJackpotが出るまで利用できます。"],
      ["Jackpotは1つの数字だけ", `最も出にくい数字だけに賭けて当たると×${CONFIG.multipliers.jackpot}です。対象は隠されており、ここでは3と仮定します。`, `${stake} Gなら${jackpotReturn} Gを受け取ります。別の場所にも賭けると対象外です。Jackpotは確率を新しくし、BOARD NETとShakeをリセットします。`],
      ["完走してスコアを残す", `${CONFIG.rollsPerRun}回後のGoldがスコアです。Personal recordsは、このブラウザーで完走した記録対象ゲームの上位${CONFIG.leaderboardLimit}件を保存します。`, "Settings → Show probabilitiesで確率を表示すると、そのゲームは後で隠しても記録対象外です。新しいゲームでは再び記録対象になります。"],
    ],
    captions: [`${CONFIG.startingGold} G、残り${CONFIG.rollsPerRun}回、ベットなし。`, "Tilt 1：ほぼ均等。Tilt 6：強い偏り。", `数字3に${stake} G。On the table：${stake} G。`, "", `結果3：Bankroll ${combinedGold} G、BOARD NET +${combinedReturn - stake * 2} G。`, "BOARD NET +40 G、Shake利用可能。", `例：3だけに${stake} G。`, "終了：150 G、残り0回。"],
    coverage: [["数字3", `3が当たり。${stake} G × ${CONFIG.multipliers.number} = ${singleReturn} G払い戻し。`], ["中央の縦列", `3か4が当たり。${stake} G × ${CONFIG.multipliers.column} = ${columnReturn} G払い戻し。`], ["Odds・奇数列", `1、3、5が当たり。${stake} G × ${CONFIG.multipliers.row} = ${groupReturn} G払い戻し。`], ["Red・赤", `1、4、5が当たり。${stake} G × ${CONFIG.multipliers.color} = ${groupReturn} G払い戻し。`]],
  },
  zh: {
    previous: "上一步", next: "下一步", rules: "完整规则", slides: "返回幻灯片", coverageLabel: "选择下注示例", enlarge: "查看原图",
    items: [
      ["Gold与剩余次数", `Bankroll是现有Gold（G），Rolls remaining是剩余次数。每局以${CONFIG.startingGold} G和${CONFIG.rollsPerRun}次开始。`, `每掷一次消耗一次机会。掷满${CONFIG.rollsPerRun}次后，剩余Gold就是得分；提前归零则结束，不留纪录。`],
      ["读懂Tilt", "概率是隐藏的。Tilt 1接近均匀，Tilt 6集中于少数数字。", "方块按概率从高到低排列，越亮概率越高，但无法识别数字。上次掷骰后，▲表示偏向增大，▼表示减小，−表示不变。"],
      ["下注", `将Bet amount设为${stake} G，点击3就押结果3。再点一次追加${stake} G。`, "On the table是总下注额，不能超过Bankroll。长按半秒或右键可删除一注；手机上点击金额可打开数字键盘。"],
      ["选择下注类型", "选择示例，边框标出中奖数字。列覆盖两个数字，行覆盖Odds（奇数）或Evens（偶数）。颜色按格子颜色，不按奇偶。", "返还包含本金，未中返还0 G。各数字概率不同，覆盖更多数字不一定更容易中奖。"],
      ["掷骰并领取返还", `3和Odds各押${stake} G，掷出3返还${singleReturn} + ${groupReturn} = ${combinedReturn} G。Bankroll：${CONFIG.startingGold} − ${stake * 2} + ${combinedReturn} = ${combinedGold} G。`, "Roll dice扣除下注额、消耗一次并清空下注。普通下注命中后，结果数字的一部分概率会转给其他数字，即使整体亏损也一样。全部未中则概率不变。"],
      ["使用Shake", "BOARD NET是当前棋盘的累计返还减下注额。先−10 G，再+50 G，合计+40 G。", "净赚或净亏会解锁Shake。它不消耗Gold或次数，可更换概率、清空下注并将BOARD NET归零。解锁后持续可用，直到使用或出现Jackpot。"],
      ["Jackpot：只押一个数字", `只押概率最低的数字并命中，返还×${CONFIG.multipliers.jackpot}。目标是隐藏的，这里假设为3。`, `${stake} G返还${jackpotReturn} G。任何其他下注都会取消资格。Jackpot重新生成概率，并重置BOARD NET和Shake。`],
      ["完成并留下得分", `掷满${CONFIG.rollsPerRun}次后，剩余Gold就是得分。Personal records保留本浏览器中有资格且完成的最佳${CONFIG.leaderboardLimit}局。`, "Settings → Show probabilities可显示概率，但本局不计入纪录，即使之后关闭也一样。新一局可重新获得资格。"],
    ],
    captions: [`${CONFIG.startingGold} G，剩余${CONFIG.rollsPerRun}次，尚未下注。`, "Tilt 1：接近均匀。Tilt 6：高度偏向。", `数字3押${stake} G；On the table：${stake} G。`, "", `掷出3：Bankroll ${combinedGold} G；BOARD NET +${combinedReturn - stake * 2} G。`, "BOARD NET +40 G；Shake已解锁。", `示例：只在3上押${stake} G。`, "完成：150 G，剩余0次。"],
    coverage: [["数字3", `3中奖。${stake} G × ${CONFIG.multipliers.number} = ${singleReturn} G返还。`], ["中间列", `3或4中奖。${stake} G × ${CONFIG.multipliers.column} = ${columnReturn} G返还。`], ["Odds · 奇数行", `1、3、5中奖。${stake} G × ${CONFIG.multipliers.row} = ${groupReturn} G返还。`], ["Red · 红色", `1、4、5中奖。${stake} G × ${CONFIG.multipliers.color} = ${groupReturn} G返还。`]],
  },
  es: {
    previous: "Atrás", next: "Siguiente", rules: "Reglas completas", slides: "Volver a las diapositivas", coverageLabel: "Elige un ejemplo de apuesta", enlarge: "Ver a tamaño completo",
    items: [
      ["Gold y tiradas", `Bankroll es tu Gold (G); Rolls remaining son los turnos restantes. Empiezas con ${CONFIG.startingGold} G y ${CONFIG.rollsPerRun} tiradas.`, `Cada tirada consume un turno. Tras ${CONFIG.rollsPerRun}, el Gold restante es tu puntuación; llegar antes a 0 G termina sin récord.`],
      ["Lee Tilt", "Las probabilidades están ocultas. Tilt 1 es casi uniforme; Tilt 6 concentra las posibilidades en pocos números.", "Los cuadrados van de mayor a menor probabilidad; más claro significa más probable. No identifican números. Tras una tirada: ▲ más desigualdad; ▼ menos; − sin cambio."],
      ["Apuesta", `Fija Bet amount en ${stake} G y toca 3 para apostar a ese resultado. Cada toque añade ${stake} G.`, "On the table es el total apostado, limitado por Bankroll. Mantén medio segundo o haz clic derecho para quitar una apuesta. En el móvil, toca el importe para abrir el teclado."],
      ["Elige una apuesta", "Elige un ejemplo; los contornos marcan los números ganadores. Las columnas cubren dos números; las filas, Odds (impares) o Evens (pares). Los colores siguen las casillas, no la paridad.", "El pago incluye la apuesta; un fallo paga 0 G. Cubrir más números no siempre mejora tus posibilidades: sus probabilidades difieren."],
      ["Tira y cobra", `${stake} G al 3 + ${stake} G a Odds: si sale 3, cobras ${singleReturn} + ${groupReturn} = ${combinedReturn} G. Bankroll: ${CONFIG.startingGold} − ${stake * 2} + ${combinedReturn} = ${combinedGold} G.`, "Roll dice descuenta las apuestas, consume un turno y las borra. Un acierto ordinario transfiere probabilidad del número salido a otros, incluso con pérdida neta; si todo falla, nada cambia."],
      ["Usa Shake", "BOARD NET suma pagos menos apuestas del tablero actual. −10 G seguido de +50 G da +40 G.", "Una ganancia o pérdida neta desbloquea Shake. Renueva las probabilidades, borra apuestas y reinicia BOARD NET sin gastar Gold ni turnos. Sigue disponible hasta usarlo o conseguir un Jackpot."],
      ["Jackpot: un solo número", `Apuesta solo al número menos probable y acierta para cobrar ×${CONFIG.multipliers.jackpot}. Está oculto; aquí suponemos que es 3.`, `${stake} G pagaría ${jackpotReturn} G. Apostar en otro lugar anula la opción. Jackpot renueva las probabilidades y reinicia BOARD NET y Shake.`],
      ["Termina y guarda tu puntuación", `Tu Gold tras ${CONFIG.rollsPerRun} tiradas es la puntuación. Personal records guarda las mejores ${CONFIG.leaderboardLimit} partidas completas elegibles de este navegador.`, "Settings → Show probabilities revela las probabilidades, pero excluye esa partida de los récords aunque luego las ocultes. Una nueva partida puede volver a contar."],
    ],
    captions: [`${CONFIG.startingGold} G, ${CONFIG.rollsPerRun} tiradas, sin apuestas.`, "Tilt 1: casi uniforme. Tilt 6: fuerte sesgo.", `${stake} G al número 3; On the table: ${stake} G.`, "", `Salió 3: Bankroll ${combinedGold} G; BOARD NET +${combinedReturn - stake * 2} G.`, "BOARD NET +40 G; Shake disponible.", `Ejemplo: ${stake} G solo al 3.`, "Final: 150 G y 0 tiradas restantes."],
    coverage: [["Número 3", `Gana 3. ${stake} G × ${CONFIG.multipliers.number} = ${singleReturn} G de pago.`], ["Columna central", `Gana 3 o 4. ${stake} G × ${CONFIG.multipliers.column} = ${columnReturn} G de pago.`], ["Fila Odds", `Gana 1, 3 o 5. ${stake} G × ${CONFIG.multipliers.row} = ${groupReturn} G de pago.`], ["Red · rojo", `Gana 1, 4 o 5. ${stake} G × ${CONFIG.multipliers.color} = ${groupReturn} G de pago.`]],
  },
  fr: {
    previous: "Retour", next: "Suivant", rules: "Règles complètes", slides: "Revenir aux diapositives", coverageLabel: "Choisir un exemple de mise", enlarge: "Voir en taille réelle",
    items: [
      ["Gold et lancers", `Bankroll est votre Gold (G) ; Rolls remaining compte les tours restants. Départ : ${CONFIG.startingGold} G et ${CONFIG.rollsPerRun} lancers.`, `Chaque lancer consomme un tour. Après ${CONFIG.rollsPerRun}, le Gold restant est votre score ; atteindre 0 G avant termine sans record.`],
      ["Lisez Tilt", "Les probabilités sont cachées. Tilt 1 est presque uniforme ; Tilt 6 concentre les chances sur peu de nombres.", "Les carrés vont de la plus forte à la plus faible chance ; plus clair signifie plus probable. Ils n’identifient pas les nombres. Après un lancer : ▲ plus d’inégalité ; ▼ moins ; − aucun changement."],
      ["Misez", `Réglez Bet amount sur ${stake} G, puis appuyez sur 3 pour miser sur ce résultat. Chaque appui ajoute ${stake} G.`, "On the table totalise les mises, sans dépasser Bankroll. Maintenez une demi-seconde ou faites un clic droit pour retirer une mise. Sur téléphone, le montant ouvre le pavé numérique."],
      ["Choisissez une mise", "Choisissez un exemple ; les contours marquent les nombres gagnants. Les colonnes couvrent deux nombres ; les lignes, Odds (impairs) ou Evens (pairs). Les couleurs suivent les cases, pas la parité.", "Le paiement inclut la mise ; un échec paie 0 G. Couvrir plus de nombres n’améliore pas forcément vos chances : leurs probabilités diffèrent."],
      ["Lancez et encaissez", `${stake} G sur 3 + ${stake} G sur Odds : un 3 paie ${singleReturn} + ${groupReturn} = ${combinedReturn} G. Bankroll : ${CONFIG.startingGold} − ${stake * 2} + ${combinedReturn} = ${combinedGold} G.`, "Roll dice déduit les mises, consomme un tour et les efface. Une mise ordinaire gagnante transfère une partie de la probabilité du nombre sorti aux autres, même avec une perte nette ; si tout échoue, rien ne change."],
      ["Utilisez Shake", "BOARD NET cumule paiements moins mises du plateau actuel. −10 G puis +50 G donnent +40 G.", "Un gain ou une perte nette débloque Shake. Il renouvelle les probabilités, efface les mises et remet BOARD NET à zéro sans coûter de Gold ni de tour. Il reste disponible jusqu’à son utilisation ou un Jackpot."],
      ["Jackpot : un seul nombre", `Misez uniquement sur le nombre le moins probable et touchez-le pour ×${CONFIG.multipliers.jackpot}. Il est caché ; ici, nous supposons que c’est 3.`, `${stake} G rapporterait ${jackpotReturn} G. Miser ailleurs annule l’éligibilité. Jackpot renouvelle les probabilités et réinitialise BOARD NET et Shake.`],
      ["Terminez et gardez votre score", `Votre Gold après ${CONFIG.rollsPerRun} lancers est votre score. Personal records garde les ${CONFIG.leaderboardLimit} meilleures parties terminées admissibles de ce navigateur.`, "Settings → Show probabilities révèle les chances, mais exclut cette partie des records, même après les avoir masquées. Une nouvelle partie peut compter à nouveau."],
    ],
    captions: [`${CONFIG.startingGold} G, ${CONFIG.rollsPerRun} lancers, aucune mise.`, "Tilt 1 : presque uniforme. Tilt 6 : fort biais.", `${stake} G sur le nombre 3 ; On the table : ${stake} G.`, "", `Résultat 3 : Bankroll ${combinedGold} G ; BOARD NET +${combinedReturn - stake * 2} G.`, "BOARD NET +40 G ; Shake disponible.", `Exemple : ${stake} G sur 3 seul.`, "Fin : 150 G et 0 lancer restant."],
    coverage: [["Nombre 3", `3 gagne. ${stake} G × ${CONFIG.multipliers.number} = ${singleReturn} G versés.`], ["Colonne centrale", `3 ou 4 gagne. ${stake} G × ${CONFIG.multipliers.column} = ${columnReturn} G versés.`], ["Ligne Odds", `1, 3 ou 5 gagne. ${stake} G × ${CONFIG.multipliers.row} = ${groupReturn} G versés.`], ["Red · rouge", `1, 4 ou 5 gagne. ${stake} G × ${CONFIG.multipliers.color} = ${groupReturn} G versés.`]],
  },
  de: {
    previous: "Zurück", next: "Weiter", rules: "Alle Regeln", slides: "Zurück zu den Folien", coverageLabel: "Wähle ein Einsatzbeispiel", enlarge: "In voller Größe ansehen",
    items: [
      ["Gold und Würfe", `Bankroll ist dein Gold (G); Rolls remaining zählt die übrigen Züge. Start: ${CONFIG.startingGold} G und ${CONFIG.rollsPerRun} Würfe.`, `Jeder Wurf verbraucht einen Zug. Nach ${CONFIG.rollsPerRun} zählt dein übriges Gold als Ergebnis; 0 G vorher beendet den Durchlauf ohne Rekord.`],
      ["Lies Tilt", "Die Chancen sind verborgen. Tilt 1 ist fast gleichmäßig; Tilt 6 konzentriert die Chancen auf wenige Zahlen.", "Die Quadrate sind nach abnehmender Chance sortiert; heller bedeutet wahrscheinlicher. Sie verraten keine Zahlen. Nach einem Wurf: ▲ ungleichmäßiger; ▼ gleichmäßiger; − unverändert."],
      ["Setze einen Einsatz", `Stelle Bet amount auf ${stake} G und tippe auf 3, um auf dieses Ergebnis zu setzen. Jedes weitere Tippen fügt ${stake} G hinzu.`, "On the table zählt alle Einsätze, begrenzt durch Bankroll. Eine halbe Sekunde halten oder rechts klicken entfernt einen Einsatz. Auf dem Handy öffnet der Betrag die Zahlentastatur."],
      ["Wähle einen Einsatz", "Wähle ein Beispiel; Umrandungen markieren Gewinnzahlen. Spalten decken zwei Zahlen ab; Reihen decken Odds (ungerade) oder Evens (gerade) ab. Farben folgen den Feldern, nicht gerade/ungerade.", "Auszahlungen enthalten den Einsatz; ein Fehlschlag zahlt 0 G. Mehr Zahlen bedeuten nicht immer bessere Chancen, da ihre Wahrscheinlichkeiten verschieden sind."],
      ["Würfle und kassiere", `${stake} G auf 3 + ${stake} G auf Odds: Eine 3 zahlt ${singleReturn} + ${groupReturn} = ${combinedReturn} G. Bankroll: ${CONFIG.startingGold} − ${stake * 2} + ${combinedReturn} = ${combinedGold} G.`, "Roll dice zieht Einsätze ab, verbraucht einen Zug und löscht die Einsätze. Ein gewöhnlicher Treffer verlagert Chance von der gewürfelten Zahl zu anderen, auch bei Nettoverlust; verlieren alle Einsätze, bleiben die Chancen gleich."],
      ["Nutze Shake", "BOARD NET summiert Auszahlungen minus Einsätze des aktuellen Spielfelds. −10 G, dann +50 G ergibt +40 G.", "Nettogewinn oder Verlust schaltet Shake frei. Es ersetzt die Chancen, löscht Einsätze und setzt BOARD NET zurück, ohne Gold oder Würfe zu kosten. Es bleibt bis zur Nutzung oder einem Jackpot verfügbar."],
      ["Jackpot: nur eine Zahl", `Setze nur auf die unwahrscheinlichste Zahl und triff sie für ×${CONFIG.multipliers.jackpot}. Sie bleibt verborgen; hier nehmen wir 3 an.`, `${stake} G würde ${jackpotReturn} G auszahlen. Ein Einsatz anderswo schließt den Jackpot aus. Jackpot erneuert die Chancen und setzt BOARD NET und Shake zurück.`],
      ["Beende den Lauf für einen Rekord", `Gold nach ${CONFIG.rollsPerRun} Würfen ist dein Ergebnis. Personal records speichert die besten ${CONFIG.leaderboardLimit} berechtigten abgeschlossenen Durchläufe dieses Browsers.`, "Settings → Show probabilities zeigt die Chancen, schließt aber diesen Durchlauf von Rekorden aus, auch nach dem Verbergen. Ein neuer Durchlauf kann wieder zählen."],
    ],
    captions: [`${CONFIG.startingGold} G, ${CONFIG.rollsPerRun} Würfe, keine Einsätze.`, "Tilt 1: fast gleichmäßig. Tilt 6: starke Konzentration.", `${stake} G auf Zahl 3; On the table: ${stake} G.`, "", `Gewürfelt: 3. Bankroll ${combinedGold} G; BOARD NET +${combinedReturn - stake * 2} G.`, "BOARD NET +40 G; Shake verfügbar.", `Beispiel: ${stake} G nur auf 3.`, "Beendet: 150 G und 0 übrige Würfe."],
    coverage: [["Zahl 3", `3 gewinnt. ${stake} G × ${CONFIG.multipliers.number} = ${singleReturn} G Auszahlung.`], ["Mittlere Spalte", `3 oder 4 gewinnt. ${stake} G × ${CONFIG.multipliers.column} = ${columnReturn} G Auszahlung.`], ["Odds-Reihe", `1, 3 oder 5 gewinnt. ${stake} G × ${CONFIG.multipliers.row} = ${groupReturn} G Auszahlung.`], ["Red · rot", `1, 4 oder 5 gewinnt. ${stake} G × ${CONFIG.multipliers.color} = ${groupReturn} G Auszahlung.`]],
  },
};

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const imageUrl = (name: string) => `${import.meta.env.BASE_URL}guide/${name}.jpg`;
const coverageImages = ["coverage-number", "coverage-column", "coverage-odds", "coverage-red"] as const;

function screenshot(name: string, alt: string, enlarge: string, responsive = true): string {
  const desktop = `${name}${responsive ? "-desktop" : ""}` as keyof typeof guideImages;
  const mobile = `${name}-mobile` as keyof typeof guideImages;
  const { width, height } = guideImages[desktop];
  return `<a class="guide-screenshot ${responsive ? "" : "guide-tilt-screenshot"} ${name === "complete" ? "guide-completion-screenshot" : ""}" href="${imageUrl(desktop)}" target="_blank" rel="noopener" aria-label="${escape(enlarge)}: ${escape(alt)}">
    <picture>${responsive ? `<source media="(max-width: 650px)" srcset="${imageUrl(mobile)}" width="${guideImages[mobile].width}" height="${guideImages[mobile].height}">` : ""}<img class="guide-illustration" src="${imageUrl(desktop)}" width="${width}" height="${height}" alt="${escape(alt)}" loading="lazy" decoding="async"></picture>
    <span class="guide-image-action">${escape(enlarge)}</span>
  </a>`;
}

function illustration(index: number, language: GuideLanguage, example = 0): string {
  const copy = slideGuides[language];
  const caption = index === 3 ? copy.coverage[example][1] : copy.captions[index];
  if (index === 1) return `<div class="guide-tilt-examples">${screenshot("tilt-even", `${copy.items[index][0]}: Tilt 1. ${caption}`, copy.enlarge, false)}${screenshot("tilt-biased", `${copy.items[index][0]}: Tilt 6. ${caption}`, copy.enlarge, false)}</div>`;
  const name = ["start", "", "bet", coverageImages[example], "settlement", "shake", "jackpot", "complete"][index];
  return screenshot(name, caption, copy.enlarge);
}

export function guideExample(language: GuideLanguage, example: number): string {
  return illustration(3, language, example);
}

export function guideSlides(language: GuideLanguage): string {
  const copy = slideGuides[language];
  return copy.items.map(([title, explanation, continuation], index) => `
    <section class="guide-slide" data-guide-slide="${index}" role="group" aria-labelledby="guide-heading-${index}" hidden>
      <h3 id="guide-heading-${index}" ${index === 1 ? 'class="tilt-guide"' : ""} tabindex="-1">${title}</h3>
      <div class="guide-slide-copy"><p>${escape(explanation)}</p>
      <figure class="guide-figure">
        ${index === 3 ? `<div class="guide-examples" role="group" aria-label="${escape(copy.coverageLabel)}">${copy.coverage.map(([label], example) => `<button type="button" data-guide-example="${example}" aria-pressed="${example === 0}" aria-controls="guide-coverage-image guide-coverage-caption">${escape(label)}</button>`).join("")}</div><div id="guide-coverage-image">${illustration(index, language)}</div>` : illustration(index, language)}
        <figcaption ${index === 3 ? 'id="guide-coverage-caption" aria-live="polite" aria-atomic="true"' : ""}>${escape(index === 3 ? copy.coverage[0][1] : copy.captions[index])}</figcaption>
      </figure>
      <p>${escape(continuation)}</p></div>
    </section>`).join("");
}
