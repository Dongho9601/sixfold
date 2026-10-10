/** Isolated browser QA only. Never imported by the normal server. No disk records. */
import { createServer } from "vite";
import { Store } from "../server/store.ts";
import { createGameServer } from "../server/http.ts";

const large = process.env.SCENARIO === "large";
const tower = process.env.SCENARIO === "tower";
let draws = 0;
const random = () => {
  const index = draws++;
  if (index < 5) return 0.999; // Initial template remains in numerical order.
  if (large) return 0.1; // First ordinary Roll lands on 1.
  if (index === 5) return 0.99; // First Roll lands on the marked 6.
  if (index < 11) return 0; // Jackpot's forced Shake creates a different permutation.
  return 0.1;
};
class FixtureStore extends Store {
  override create() {
    const { token, state } = super.create();
    if (large)
      this.db
        .prepare("UPDATE players SET gold = ?, best_gold = ? WHERE id = ?")
        .run("9007199254740993", "9007199254740993", state.id);
    return { token, state: this.get(state.id) };
  }
}
const store = new FixtureStore(":memory:", random);
if (tower) {
  // Synthetic opponents only exist in this isolated, in-memory QA scenario.
  for (const [nickname, best] of [["Crown Keeper", "900"], ["High Roller", "600"], ["Lucky Seven", "300"], ["Red Fox", "220"], ["Night Owl", "160"]]) {
    const { state } = store.create();
    store.db.prepare("UPDATE players SET nickname = ?, best_gold = ? WHERE id = ?").run(nickname, best, state.id);
  }
  draws = 0;
}
const vite = await createServer({
  server: { middlewareMode: true, hmr: { port: 24679 } },
  appType: "spa",
});
const server = createGameServer(store, (req, res) =>
  vite.middlewares(req, res),
);
server.listen(5174, "127.0.0.1", () =>
  console.log(
    `Isolated ${large ? "large Gold" : tower ? "leaderboard tower" : "Jackpot"} fixture: http://qa.localhost:5174`,
  ),
);
async function stop() {
  await vite.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
