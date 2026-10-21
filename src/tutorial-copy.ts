import type { GuideLanguage } from "./guide";

type Lesson = "number" | "coverage" | "shake" | "jackpot" | "complete";
interface TutorialCopy {
  label: string;
  rollTitle: string;
  ready: string;
  skip: string;
  replay: string;
  start: string;
  return: string;
  practice: string;
  working: string;
  lessons: Record<Lesson, readonly [string, string]>;
}

export const tutorialCopy: Record<GuideLanguage, TutorialCopy> = {
  en: {
    label: "Tutorial", rollTitle: "Now roll the die", ready: "{stake} G on the table. Press the highlighted Roll dice button.",
    skip: "Skip tutorial", replay: "Replay tutorial", start: "Start playing", return: "Resume game", practice: "Guided practice", working: "Watch the die and your Gold. These practice rolls leave your saved run untouched.",
    lessons: {
      number: ["Your first bet", "Tap the highlighted 3 to place a bet. Your saved Gold stays safe."],
      coverage: ["Add a group", "Tap Odds to cover 1, 3 and 5. You can try other groups too."],
      shake: ["Try Shake", "{stake} G bet → {return} G returned. Tilt shows bias. Tap Shake: fresh odds, no Gold or turn cost."],
      jackpot: ["Try a Jackpot", "Here, {n} is least likely. Bet only there, then Roll dice for ×24. In normal play its identity is hidden."],
      complete: ["You’re ready", "Jackpot: {return} G returned. Gold after 100 rolls is your score; 0 G earlier ends the run."],
    },
  },
  ko: {
    label: "튜토리얼", rollTitle: "이제 굴려 보세요", ready: "전체 베팅 {stake} G. 강조된 Roll dice를 누르세요.",
    skip: "튜토리얼 건너뛰기", replay: "튜토리얼 다시 하기", start: "게임 시작", return: "게임으로 복귀", practice: "안내 연습", working: "주사위와 Gold를 확인하세요. 연습은 저장된 진행에 영향을 주지 않습니다.",
    lessons: {
      number: ["첫 베팅", "강조된 3을 눌러 베팅하세요. 저장된 Gold는 안전하게 보관됩니다."],
      coverage: ["그룹 추가", "Odds는 1·3·5에 베팅합니다. 다른 그룹도 눌러 보세요."],
      shake: ["지급 확인 후 Shake", "{stake} G 베팅 → {return} G 지급. Tilt는 확률의 쏠림입니다. Shake를 누르면 Gold와 횟수 소모 없이 새 확률로 바뀝니다."],
      jackpot: ["Jackpot 체험", "여기서는 {n}의 확률이 가장 낮습니다. 그 숫자에만 걸고 Roll dice를 누르면 ×24. 실제 게임에서는 그 숫자가 숨겨져 있습니다."],
      complete: ["이제 직접 해보세요", "Jackpot: {return} G 지급. 100회 후 남은 Gold가 점수이며 그 전에 0 G가 되면 끝납니다."],
    },
  },
  ja: {
    label: "チュートリアル", rollTitle: "ダイスを振ろう", ready: "合計{stake} Gをベット。強調されたRoll diceを押しましょう。",
    skip: "チュートリアルをスキップ", replay: "チュートリアルを再プレイ", start: "ゲームを始める", return: "ゲームに戻る", practice: "ガイド付き練習", working: "ダイスとGoldに注目。練習は保存済みのゲームに影響しません。",
    lessons: {
      number: ["最初のベット", "強調された3をタップして賭けましょう。保存済みのGoldは保たれます。"],
      coverage: ["グループを追加", "Oddsは1・3・5をカバー。他のグループも試せます。"],
      shake: ["払戻しを見てShake", "{stake} G → {return} Gの払戻し。Tiltは確率の偏り。ShakeでGoldもターンも使わず新しい確率に。"],
      jackpot: ["Jackpotを試す", "ここでは{n}が最も出にくい数字です。その数字だけに賭けてRoll diceで×24。本番では対象の数字は非表示です。"],
      complete: ["準備完了", "Jackpot：{return} Gの払戻し。100回後のGoldがスコア。途中で0 Gなら終了。"],
    },
  },
  zh: {
    label: "教程", rollTitle: "现在掷骰", ready: "合计下注 {stake} G。点击高亮的 Roll dice。",
    skip: "跳过教程", replay: "重玩教程", start: "开始游戏", return: "返回游戏", practice: "引导练习", working: "观察骰子和 Gold。练习不会改变已保存的游戏。",
    lessons: {
      number: ["第一次下注", "点击高亮的 3 下注。已保存的 Gold 会安全保留。"],
      coverage: ["添加一组", "点击 Odds，覆盖 1、3、5。也可尝试其他组。"],
      shake: ["查看返还，试试 Shake", "下注 {stake} G → 返还 {return} G。Tilt 越高，概率越集中。点击 Shake 免费更换概率，不消耗次数。"],
      jackpot: ["体验 Jackpot", "这里 {n} 的概率最低。只在它上面下注，再点击 Roll dice，返还 ×24。正式游戏中该数字隐藏。"],
      complete: ["准备就绪", "Jackpot 返还 {return} G。100 次后剩余 Gold 即分数，提前归零则结束。"],
    },
  },
  es: {
    label: "Tutorial", rollTitle: "Ahora lanza el dado", ready: "{stake} G en la mesa. Pulsa Roll dice, resaltado.",
    skip: "Omitir tutorial", replay: "Repetir tutorial", start: "Empezar", return: "Volver al juego", practice: "Práctica guiada", working: "Observa el dado y tu Gold. Estos resultados guiados no cambian tu partida guardada.",
    lessons: {
      number: ["Tu primera apuesta", "Toca el 3 resaltado para apostar. Tu Gold guardado está a salvo."],
      coverage: ["Añade un grupo", "Pulsa Odds: cubre 1, 3 y 5. También puedes probar otros grupos."],
      shake: ["Prueba Shake", "{stake} G → {return} G. Tilt indica el sesgo. Shake renueva las probabilidades sin gastar Gold ni turnos."],
      jackpot: ["Prueba un Jackpot", "Aquí, {n} es el menos probable. Apuesta solo ahí y pulsa Roll dice para ×24. En el juego su identidad está oculta."],
      complete: ["Todo listo", "Jackpot: {return} G devueltos. Tu Gold tras 100 tiradas es tu puntuación; 0 G antes termina la partida."],
    },
  },
  fr: {
    label: "Tutoriel", rollTitle: "Lancez le dé", ready: "{stake} G sur la table. Appuyez sur Roll dice, en surbrillance.",
    skip: "Passer le tutoriel", replay: "Rejouer le tutoriel", start: "Jouer", return: "Reprendre", practice: "Entraînement guidé", working: "Regardez le dé et votre Gold. L’entraînement ne change pas votre partie sauvegardée.",
    lessons: {
      number: ["Votre première mise", "Touchez le 3 en surbrillance pour miser. Votre Gold sauvegardé est préservé."],
      coverage: ["Ajoutez un groupe", "Touchez Odds : 1, 3, 5. Essayez aussi les autres groupes."],
      shake: ["Le retour, puis Shake", "{stake} G → {return} G. Tilt indique le biais. Shake renouvelle les chances sans Gold ni tour."],
      jackpot: ["Essayez un Jackpot", "Ici, {n} est le moins probable. Misez uniquement dessus et lancez avec Roll dice pour ×24. En jeu, son identité est cachée."],
      complete: ["À vous de jouer", "Jackpot : {return} G rendus. Votre Gold après 100 lancers fait le score ; 0 G avant termine la partie."],
    },
  },
  de: {
    label: "Tutorial", rollTitle: "Jetzt würfeln", ready: "{stake} G auf dem Tisch. Drücke das hervorgehobene Roll dice.",
    skip: "Tutorial überspringen", replay: "Tutorial wiederholen", start: "Losspielen", return: "Weiterspielen", practice: "Geführte Übung", working: "Achte auf Würfel und Gold. Die Übung verändert deinen gespeicherten Durchlauf nicht.",
    lessons: {
      number: ["Dein erster Einsatz", "Tippe auf die hervorgehobene 3. Dein gespeichertes Gold bleibt erhalten."],
      coverage: ["Gruppe hinzufügen", "Tippe auf Odds: 1, 3, 5. Andere Gruppen sind auch möglich."],
      shake: ["Auszahlung, dann Shake", "{stake} G → {return} G. Tilt zeigt ungleiche Chancen. Shake erneuert sie ohne Gold- oder Zugkosten."],
      jackpot: ["Jackpot ausprobieren", "Hier ist {n} am unwahrscheinlichsten. Setze nur darauf, dann Roll dice für ×24. Im Spiel bleibt diese Zahl verborgen."],
      complete: ["Du bist bereit", "Jackpot: {return} G zurück. Gold nach 100 Würfen ist dein Ergebnis; 0 G davor beendet den Durchlauf."],
    },
  },
};
