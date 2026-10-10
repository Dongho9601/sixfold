# Verification report

## Board labels and per-run probability scoring — October 10, 2026

Columns now read **1st 2**, **2nd 2**, and **3rd 2**; rows read **Odds** and **Evens**. Their coverage and payout multipliers remain the established pairs at ×3 and parity groups at ×2.

Show probabilities is a standard Settings switch. Every new run starts with it off. Turning it on requires confirmation before the server saves visibility and excludes the current run from leaderboard scoring. Turning it off later, Shake, Jackpot, reload, and server restart preserve that exclusion; starting a new run restores eligibility. Excluded runs cannot create a leaderboard record or improve an existing one. Probability changes preserve draft wagers and chip positions. In-game status and results explain exclusion. All seven guide languages, the specification, README, probability model, and public rules/storage description reflect the new behavior.

Schema 4 adds two per-run fields with defaults while preserving competition saves, records, sessions, moderation, and historical receipts. The local administrative script now requires schema 4 for operations other than backup. Checks used temporary or in-memory data on macOS arm64 with Node v26.4.0:

- **`npm test`: 72 passed**, covering defaults, persistence across SQLite reopen, hiding after enabling, preserved records despite a higher assisted final score or Jackpot, assisted final-roll zero, eligibility after restart, stale revisions and receipt replay, invalid visibility inputs, and schema migration.
- **`npm run build`: passed**, including TypeScript, Vite, and Brotli/gzip precompression.
- **`PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:ui`: 29 passed**. New cases cover labels and accessibility names, confirmation cancellation and Escape, focus restoration, preserved draft chips, enabled/hidden settings through reload, excluded completion with a previous record, fresh-run reset, and recovery after a lost confirmation response. Existing interaction and all seven language-layout checks also pass.
- Visually inspected the board at 1280px and 390px and the confirmation at 320px. Automated layout checks cover 1280px, 390px, and 320px without horizontal overflow. Screenshots are generated under the ignored `test-results/` directory.
- **`git diff --check`: passed**. No real player database was opened or reset, and no production deployment was performed.

These changes track use of the probability switch. The API continues to expose odds independently, as documented in the specification and probability model; this work does not establish a secrecy boundary against browser inspection. Previous release measurements below remain historical.

## Release-candidate closure — October 10, 2026

This was a bounded closure pass, without repeating the optimization workloads or changing gameplay/server settlement code. At entry, `main`, local `origin/main`, and a fresh `git ls-remote --heads origin main` check all identified `661f4768be147614584d4d65f49cc91fb483e2cb`. The prepared release was **uncommitted**: 16 modified tracked files and nine untracked files. All 25 reported preparation files and all seven before/after benchmark reports existed. No changes were staged, committed, pushed, deployed, or written to real player data.

The code state verified in this closure is the 32-file source/input manifest with SHA-256 **`cac65279e3633076851ef69dde51e55dbbb0a6abcf01657e3a533a48579baafe`**. It covers client/server code, public assets, package/lock/build configuration, scripts, and tests. [The closure artifact](benchmarks/release-candidate-closure.json) contains per-file hashes, build-output hashes, the exact Git state, local/untracked inventory, runtime acquisition details, checks, and storage measurements. Its broader candidate inventory also hashes repository documentation and the existing benchmark artifact, excluding only the closure artifact itself to avoid self-reference. The earlier benchmark JSON remains unchanged (SHA-256 `03ebbc6d5470dc4e32d5584740e9b19005757d7f018910c36d11cf33e3502ad0`). The baseline commit is not a commit of these release changes and must not be labeled as the verified release.

### Linux attempt and native LTS checks

**Linux execution remains blocked.** The available host is macOS arm64. Docker, Podman, Colima, Lima, Apple container, nerdctl, QEMU, and Vagrant were absent from PATH; no corresponding installed app, container state directory, or Docker socket was found. `.github/` was absent. Read-only `gh workflow list --repo Dongho9601/sixfold --all`, `gh run list --repo Dongho9601/sixfold --limit 5 --json databaseId,workflowName,status,conclusion,headSha`, and `gh api repos/Dongho9601/sixfold/actions/runners` returned no workflows/runs or self-hosted runners. There was no existing CI job in which to execute this local candidate. Creating and pushing a workflow was outside the requested pass. No Linux tests or Linux success are claimed.

As additional operational evidence, the official **Node 24.21.0 LTS** Darwin arm64 archive was downloaded to a temporary directory. Its SHA-256 matched the official HTTPS `SHASUMS256.txt` (`bed7eea5325e1108f32ce5228ddd6a5f0f08a499ee42aa7442aea583702f6057`); the release signature was not separately verified. LTS status was checked against [Node's release announcement](https://nodejs.org/en/blog/release/v24.21.0). The actual runtime was **Node v24.21.0, npm 11.19.0, SQLite 3.53.4, macOS/Darwin arm64**. No project runtime/version declaration or dependency version was changed.

With that archive's `bin` directory first in PATH:

- **`npm test`: 68 passed**, zero failed/skipped. The existing restore regression was extended to copy the generated live-WAL backup into a new private directory, check saved state and the existing receipt, commit a new action, restart the restored store, and replay both receipts while preserving the source and backup.
- **`npm run build`: passed** TypeScript, Vite 7.3.7, and Brotli/gzip precompression. The first attempt caught a TypeScript annotation omission in the newly added verification script; it was fixed before the successful build. The release implementation itself needed no compatibility fix.
- **`npm ci --omit=dev`: passed** in a separate temporary runtime directory containing only the locked package files, `dist/`, `server/`, `src/config.ts`, `src/types.ts`, `scripts/admin.ts`, and `scripts/release-check.ts`. Four packages were installed; npm audited five packages and reported zero known vulnerabilities for that runtime install. npm warned about unapproved esbuild/fsevents install scripts; none were approved, and actual startup/admin checks worked with the installed packages.
- **`node --import tsx scripts/release-check.ts`: passed** in that production-only directory, with Vite, TypeScript, and Playwright absent. Four real production starts and four SIGTERM exits (code 0) checked health and built HTML, source restart persistence, a backup made while the source remained open, restoration into a new isolated path, saved state, byte-identical old HTTP receipt replay, a new action, another restart, byte-identical replay of both receipts, exactly two receipts, `quick_check=ok`, no foreign-key failures, and file mode 0600. All test databases and the runtime copy were removed afterward.
- **`git diff --check`: passed**. Source/build hashes and local documentation links were checked. Existing preparation evidence was retained.

The production-only check is reproducible after selecting the desired Node binary and building from the repository:

```sh
npm test
npm run build
SIXFOLD_RC_RUNTIME=$(mktemp -d)
cp package.json package-lock.json "$SIXFOLD_RC_RUNTIME/"
cp -R server dist "$SIXFOLD_RC_RUNTIME/"
mkdir -p "$SIXFOLD_RC_RUNTIME/src" "$SIXFOLD_RC_RUNTIME/scripts"
cp src/config.ts src/types.ts "$SIXFOLD_RC_RUNTIME/src/"
cp scripts/admin.ts scripts/release-check.ts "$SIXFOLD_RC_RUNTIME/scripts/"
cd "$SIXFOLD_RC_RUNTIME"
npm ci --omit=dev
node --import tsx scripts/release-check.ts
```

Keep the selected Node `bin` first in PATH for every command and remove the temporary runtime directory after reviewing the result. `release-check.ts` creates/removes its own separate temporary data and accepts no existing DB path or public URL. Run this sequence on the eventual Linux LTS image; the commands above currently establish native macOS evidence only. The browser suite and balance/optimization workloads were not rerun in this closure because no gameplay/client logic changed; their earlier results remain historical, with the limitations already documented below.

### Fresh database growth and recovery accounting

The same production-only verification script measured **1,000 new roll actions**, ten newly created players, no seeded leaderboard records, and no receipt compaction. Every player completed 100 rolls with 1 G on Red and Black, using the existing cryptographic random outcomes and unchanged game rules. All 1,000 accepted receipts were retained. File lengths were sampled after every action; this does not measure filesystem allocation or sub-action peaks.

| Storage component | Measured bytes |
|---|---:|
| Initial schema-only database after close/checkpoint | 28,672 |
| Main database while open after actions | 1,781,760 |
| WAL / SHM at largest sampled live total | 4,128,272 / 32,768 |
| Largest sampled live DB + WAL + SHM | 5,942,800 |
| Logical database and generated backup database | 2,002,944 |
| Backup WAL / inspection SHM at measurement | 0 / 32,768 |
| Database after clean close/checkpoint | 2,002,944 |
| Growth above initial standalone size | **1,974,272** |
| Growth/action, including the ten player records | **1,974.272** |

The open main file understated the committed logical size because some pages were still in WAL. The live backup included those pages; its 1,000 receipts and integrity were checked. SQLite settings were WAL, `synchronous=FULL` (2), foreign keys enabled, page size 4,096 bytes, and automatic checkpoint trigger 1,000 pages. No durability setting changed. The WAL threshold is not a size cap. The live files plus this one backup and its inspection SHM totaled **7,978,512 bytes** at the measured endpoint, without counting temporary restored copies or the runtime/build files.

[README's storage instructions](../README.md#storage-accounting-and-maintenance-space) now separate live DB/WAL/SHM, standalone snapshots, retained backups, restore copies, and maintenance space. A new online backup needs a full logical snapshot plus live-growth headroom. A restore rehearsal needs another database and journals while the source and snapshot remain. Compaction needs its pre-maintenance backup and journal headroom; it does not immediately shrink files. Offline VACUUM can need up to **twice the current database size in additional free space**, plus any newly created backup on that filesystem and operational margin, according to [SQLite](https://sqlite.org/lang_vacuum.html). A compaction cursor must restart at zero after VACUUM because implicit rowids can change. None of these operations deletes receipts or expiry identifiers. This one random-outcome macOS sample is not a host storage ceiling, Linux result, sustained soak, or capacity forecast.

### Scope changes and remaining decisions

Only the following seven files were added or amended by this closure; the earlier release-preparation implementation remains in place:

| File | Closure change |
|---|---|
| `tests/release.test.ts` | Extend the live-backup regression through a copied restore, new action, and second restart/replays. |
| `scripts/release-check.ts` (new) | Reproducible, isolated production-only HTTP recovery smoke and fixed fresh-database growth measurement. |
| `README.md` | Record actual LTS/platform evidence and Linux blocker; clarify recovery, component storage accounting, maintenance free space, and owner decisions. |
| `CREDITS.md` | Say ownership/license records have not yet been provided and publication rights remain unconfirmed, rather than treating them as unavailable or denied. |
| `public/about.html` | State that a public operator contact has not yet been published; remove internal ownership/approval details from public copy. |
| `docs/VERIFICATION.md` | Preserve historical results, distinguish the baseline commit from uncommitted results, and record this bounded closure. |
| `docs/benchmarks/release-candidate-closure.json` (new) | Candidate manifests, exact runtime/check metadata, untracked inventory, and raw storage/recovery evidence. |

**Owner decisions:** provide the actual public privacy/abuse contact, confirm rights to publish the code and assets, and review applicable dependency notices. Neither the corrected wording nor the public page supplies contact details or publication permission. The code and evidence remain local and uncommitted; a reviewed commit/release artifact is needed before distributing this candidate.

**Host-specific checks:** run this candidate on a supported Linux LTS runtime; then check the chosen host's HTTPS/public Origin, exact proxy trust/header replacement, persistent local filesystem including WAL/SHM and permissions, available disk/backup/restore space, process supervision and shutdown window, caching/compression, backup schedule/retention, and proxy/supervisor log settings. These checks cannot be closed against an unselected host.

**Verification limits:** no Linux execution, minimum Node 22.16 check, real TLS/proxy deployment, physical-device/Safari/Firefox verification, capacity claim, power-loss test, or multi-hour soak was added. Earlier Chromium/touch/hidden-tab checks remain emulated historical evidence. Restoring an older backup still loses post-snapshot changes and receipts and can permit those later requests to settle again; isolate and reconcile such a recovery as documented. Replay records remain indefinite. No deployment, push, visibility change, paid resource, or real player-data change occurred.

## Public hosting preparation — October 10, 2026

Audited the clean repository at commit `661f4768be147614584d4d65f49cc91fb483e2cb` before changing it. That commit identifies the baseline only: the final preparation tests and after measurements below used the uncommitted working tree, not that commit. A source manifest was not captured for those historical runs; the later closure section records the exact current source and build hashes for its own checks. The verified stack is TypeScript/Vite, Node's HTTP server, and built-in SQLite; no framework, database, or infrastructure migration was needed. The work prioritized settlement and saved-data correctness, then public request/static-serving protections and operations, then measured traffic/query improvements. No deployment, real-player writes, public-service load test, dependency version upgrade, paid resource, account system, or analytics was introduced.

### Findings and implementation

The existing cryptographic outcomes and session tokens, hashed session storage, exact BigInt Gold, bound SQL, escaped names, completed-run scoring, and transaction-protected revision/receipt settlement already worked. They remain authoritative. The tests cover retries and concurrent requests rather than replacing these safeguards with caches or client calculations. Odds remain visible in the state API and developer display; hiding them in ordinary play is still presentation behavior.

Verified gaps were permissive methods/media types/origin handling, absent public rate limits and Secure-cookie/proxy configuration, unrestricted static file lookup, destructive legacy-database initialization, no local moderation/consistent backup tooling, duplicated client reads, and full ranking materialization on every leaderboard query. The implementation now validates bounded requests, rejects cross-origin mutations and cross-site API reads, uses explicit trusted-proxy addresses, bounds limiter/request/connection storage, sanitizes internal errors, and inventories allowed build files. Personalized API caching is private with revalidation; cookie creation, mutations, errors, and health are no-store. Static hashes are immutable, HTML revalidates, and build-time Brotli/gzip avoids request-path compression work.

Schema 3 preserves competition players, scores, sessions, and complete receipts while adding local hide/show moderation and a partial ranking index. Nonempty legacy or newer unknown schemas fail without resetting data. The server reuses prepared statements and keeps WAL, synchronous=FULL, foreign keys, and the busy timeout. SQLite online backups are integrity checked and never overwrite a destination. The read-only backup command also accepts older schemas so the first schema-3 upgrade can be backed up before migration. Lossless receipt compaction examines at most 1,000 rows per invocation with a cursor; it does not delete replay IDs, fingerprints, or responses. Retention remains indefinite for saved games and replay safety. File shrinkage requires a separate offline VACUUM; backup rotation and bounded supervisor/proxy logs are operator tasks.

The client uses the returned authoritative action state, avoids per-roll state/leaderboard refetches, shares one in-flight read per endpoint, refreshes visible leaderboard data at 30-second useful freshness, and uses state ETags for the five-second cross-tab fallback. BroadcastChannel hints speed same-player tab updates. Read retries have bounded backoff; uncertain mutations retain their stable ID and player binding, honor retry delays, and require manual retry or one reload recovery. Hidden tabs pause polling/audio/decorative motion and finish already-committed presentation safely. A new compact response format omits the settlement duplicated in `state.lastRoll`; existing clients and durable receipts retain the original full response.

The changed files and their purposes are:

| Files | Meaningful behavior or verification change |
|---|---|
| `server/http.ts`, `server/config.ts`, `server/limits.ts`, `server/static.ts`, `server/index.ts` | Validated public requests/configuration, explicit origin/cookie/proxy behavior, bounded resource limits, safe static delivery, health and shutdown. |
| `server/store.ts`, `server/rules.ts` | Preserve competition saves and replay atomicity; refuse unsafe resets; indexed ranking, moderation flags, packed receipt decoding, and bounded malformed wager input before fingerprinting/BigInt. |
| `src/main.ts`, `src/types.ts`, `src/style.css`, `index.html` | Player-bound pending actions, compact transport, fewer/coalesced reads, bounded reconnect behavior, hidden-tab rendering/audio handling, and factual public-information entry points. |
| `scripts/admin.ts`, `scripts/compress.ts`, `scripts/workload.ts` | Filesystem-authorized moderation, pre-upgrade/live backup and receipt maintenance; build-time compression and reproducible isolated measurement. |
| `package.json`, `package-lock.json` | Operational/build/workload commands; existing tsx moved to runtime dependencies without any dependency version upgrade. |
| `tests/release.test.ts`, `tests/persistence.test.ts`, `tests/ui.test.mjs` | Release regression checks, non-destructive legacy handling, and real browser network/recovery/touch checks with isolated fixture data. |
| `README.md`, `docs/spec.md`, `CREDITS.md`, `public/about.html`, `docs/VERIFICATION.md`, `docs/benchmarks/release-readiness.json` | Current operations/rules/privacy/credits, explicit rights/contact/host blockers, final checks and raw measured evidence. |

Existing documentation history below remains intact.

### Checks actually run

Tested on macOS arm64 with **Node 26.4.0**, **SQLite 3.53.2**, **npm 11.17.0**, and headless **Chrome 154.0.8037.99** using the installed browser. Node 22.16 is the declared minimum, but that version and the eventual Linux/hosting image were not tested here.

- Before modification: `npm test` **54 passed**, `npm run build` passed, and the existing Chromium suite **19 passed**. The first browser invocation could not start because the Playwright-managed executable was absent; supplying `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the installed Chrome resolved the tooling issue.
- Final `npm test`: **68 passed**. Fourteen new release tests include malformed/invalid UTF-8 and byte-bounded bodies, deeply nested invalid wagers rejected before fingerprinting, aborted uploads, origin/proxy/cookie behavior, isolated private ETags, player-bound and legacy retries, compact/full receipt equivalence, rate refill/storage bounds, rollback on injected receipt failure, SQL-like names, static allowlists/symlinks/compression, pre-upgrade snapshots without schema changes, schema preservation/refusal, ranking-oracle comparisons, two independent SQLite processes racing a duplicate, live WAL backup/restore, and actual production startup/SIGTERM/restart persistence. Existing full game-rule tests continue to pass.
- Final `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:ui`: **26 passed**. Added coverage checks bounded initial-read backoff with manual recovery of a saved action, ten ordinary rolls without per-roll refetches, coalesced focus events, simulated hidden-tab motion completion/poll pause/resume, reconnect/lost-response recovery, persisted 429 retry delay, cookie replacement, malformed or unavailable browser storage, nickname text rendering, and touch-capable mobile controls. The test helper awaits the queued guide-close focus restoration before issuing shortcuts; this fixed a timing-dependent fixture failure. Existing rules, shortcuts, seven guide languages, final scores, and restart behavior remain covered. Accelerated 100-roll fixtures explicitly widen only their isolated test server's limits; separate tests exercise limiting.
- Final `npm run build`: TypeScript/Vite/precompression passed. JavaScript is **81.79 kB / 31.09 kB gzip**, versus **77.36 / 29.51 kB** before; release protections increased code size, so no JavaScript-size reduction is claimed. CSS is **29.85 / 7.73 kB gzip**. Four text outputs receive Brotli and gzip variants.
- `npm run test:balance` completed the existing 10,000 seeded starts per profile/policy, 80-roll pacing experiment. Game constants and settlement probabilities were not changed. `npm audit --include=dev --json` reported **zero known vulnerabilities** at the time of the check; this is not a general security guarantee.
- A separate temporary runtime directory installed with **`npm ci --omit=dev`**, without Vite, TypeScript, or Playwright. The built server started, served health, committed an action, shut down with SIGTERM, restored the same state after restart, replayed the identical receipt, and created a live backup through the administrative script. New database mode was 0600. Production game/public-information pages had no browser script errors; information-page widths 1280/390/320 px and the 320 px game had no horizontal overflow. Desktop and mobile screenshots were inspected.
- `git diff --check` passed. All new verification used temporary/in-memory synthetic data. No production/player database was opened for these checks.

### Local before/after measurements

The [raw measurement artifact](benchmarks/release-readiness.json) records commands, methodology, full query plans, and every result. `scripts/workload.ts` starts only its own localhost server and temporary SQLite file; it accepts no public URL. Before measurements used an isolated `git archive` of the baseline commit with the same workload driver copied in and the same locked installed dependencies. Before and after runs were sequential. Seed/setup work is excluded. Each database starts with 5,000 synthetic completed leaderboard entries. Accelerated rate allowances belong only to these isolated workload workers.

The API workload uses eight concurrent clients, two 100-roll runs each, red/black 1 G coverage to preserve bankroll, exact-ID retries every 20 rolls, leaderboard reads every ten rolls, and a restart between runs. It deliberately keeps the full legacy response format and the same requests on both builds. Latencies include reading the entire localhost response. CPU is measured in the child server; RSS is sampled every 20 ms with a final sample after query profiling. Body counters exclude HTTP headers.

| API workload, 1,600 rolls | Before | After |
|---|---:|---:|
| Requests / successful responses | 1,856 / 1,856 | 1,856 / 1,856 |
| Request JSON / response body bytes | 213,208 / 2,206,779 | 213,208 / 2,205,748 |
| p50 / p95 response latency | 2.41 / 11.56 ms | 2.03 / 2.63 ms |
| Elapsed / server CPU | 930.88 / 828.81 ms | 428.66 / 250.69 ms |
| Sampled peak RSS | 88.12 MiB | 85.05 MiB |
| Database after close / receipts | 4,456,448 bytes / 1,608 | 4,423,680 bytes / 1,608 |
| Separate 100 distant-player leaderboard reads | 317.70 ms | 9.72 ms |

The original query plan materialized the full ranked table, scanned players, and sorted temporary B-trees. The new top-ten read scans the partial ordered index only until ten rows; own-rank and neighbor queries use covering/range index searches and bounded neighbor results. An exact distant rank still counts the matching indexed ranges; this is not a claim of constant work for unlimited players.

The longer repetition uses the same eight clients and 50 runs each: **40,000 rolls, 46,400 requests, and 40,392 retained receipts**, with every HTTP response 200. It is prolonged local repetition, not a multi-hour soak or a public capacity test.

| Repeated workload | Before | After |
|---|---:|---:|
| p50 / p95 response latency | 3.75 / 8.69 ms | 2.05 / 2.93 ms |
| Elapsed / server CPU | 22.30 / 18.38 s | 11.25 / 5.23 s |
| Sampled peak RSS | 98.44 MiB | 96.34 MiB |
| Database after close | 82.23 MiB | 82.16 MiB |
| Separate 100 leaderboard reads | 309.20 ms | 10.07 ms |

Database growth is essentially unchanged before explicit retention maintenance: preserving replay responses remains the main storage cost. In an additional 40,000-roll run, the pre-maintenance workload had p95 latency **3.75 ms** and server CPU **5.48 s**, illustrating local run variation. 41 bounded compaction invocations took **2.71 s** and reduced receipt text from **48,954,694 to 24,975,369 bytes**. File size stayed **86,261,760 bytes** after compaction; offline VACUUM reduced it to **37,425,152 bytes**, and `quick_check` returned `ok`. Receipt replay equivalence after compaction/restart/backup is covered separately by regression tests. No record expiration or durability relaxation produced these results.

The browser workload uses the real built client at 1280×900, ten six-number 1 G full-coverage rolls with reduced motion, then 30 seconds of visible idle time. It measures initial loading as well as API traffic, including the client's new compact wire format. Chrome's encoded response counters include response headers/compressed bytes and exclude request headers; decoded body bytes are recorded separately. API calls revalidating with 304 have no response body.

| One browser session, ten rolls + 30 s idle | Before | After |
|---|---:|---:|
| State / leaderboard / action requests | 17 / 17 / 10 | 7 / 2 / 10 |
| Total API requests | 44 | 19 |
| API response bodies, decoded | 38,802 bytes | 10,105 bytes |
| API JSON request bodies | 1,530 bytes | 2,030 bytes |
| API responses, encoded including response headers | 49,853 bytes | 19,149 bytes |
| All responses, encoded including response headers | 158,556 bytes | 59,049 bytes |

The additional request bytes bind each action to its player. Six API reads returned 304; the other 13 API responses were 200. Observed reductions were **57% fewer API requests**, **62% fewer encoded API response bytes**, and **63% fewer encoded total response bytes** for this workload. Static precompression accounts for much of the total transfer improvement. These are single sequential localhost measurements with cryptographic outcomes, small expected payload variations, no remote TLS/proxy latency, and no hosting capacity claim. The application does not dynamically compress API JSON; the selected proxy may do so.

Reproduce the after workloads with a built client:

```sh
npm run build
npm run benchmark -- --concurrency 8 --runs 2 --ranked 5000 --output /tmp/sixfold-api.json
npm run benchmark -- --concurrency 8 --runs 50 --ranked 5000 --output /tmp/sixfold-repeat.json
PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run benchmark -- --browser --ranked 5000 --output /tmp/sixfold-browser.json
npm run benchmark -- --concurrency 8 --runs 50 --ranked 5000 --compact --output /tmp/sixfold-maintenance.json
```

### Launch blockers and limits

A public contact and existing project license/ownership record have **not yet been provided for review**; publication rights remain **unconfirmed**. This does not establish that records are unavailable or that permission has been denied. Add a real privacy/abuse contact to the public page and confirm publication rights for the code and bundled assets before launch. Repository assertions of original work are documented, not treated as proof. Documentation changes alone do not resolve those owner decisions, and no legal-compliance assurance is made.

The host is unselected. HTTPS termination, exact public Origin, trusted-header overwriting, private persistent local storage including WAL/SHM, process supervision, backup scheduling/restore rehearsal, log retention, and compression/cache responsibilities must be checked on the chosen host. Database restores to an older snapshot lose post-snapshot game state and replay receipts; keep such a restore isolated and reconcile affected clients, as described in README. Indefinite receipt/player retention remains intentional; disk usage must be monitored rather than blindly deleting deduplication records.

No account recovery, distributed bot prevention, hidden-odds secrecy, dashboard, provider-specific service, or new background job was added. No physical phone, Safari/Firefox, actual HTTPS proxy, minimum Node version, Linux host, large-capacity load, or multi-hour soak was verified. Browser touch checks use emulation, and hidden-tab events were simulated. Complete those applicable manual/host checks before public exposure; the local results do not predict simultaneous-player capacity.

## Compact rankings, revised shortcuts, and localized guide — October 10, 2026

Removed the “Play Gold only” labels from the sidebar, table, and guide. Leaderboard entries now use 40 px standard rows instead of 64 px, with a slightly taller highlighted personal record. Stronger target fills, gold hover outlines, and clearer group coverage make mouse feedback easier to see.

The leaderboard returns the top 10 plus the current player's best completed record and up to two immediately higher ranks. Global ranks remain correct outside the former top-50 cutoff; overlapping rows appear once, and a gap marks omitted ranks. Anonymous and unranked players receive the top 10. The browser shows a first-record prompt for an unranked player. Large displayed scores are compact; exact values remain in tooltips and accessible labels. The personal record context follows the idea described in the [osu! client interface reference](https://osu.ppy.sh/wiki/en/Client/Interface); the top-10/two-above selection follows this project's requested behavior.

Keyboard controls are R to roll, Space to Shake, 1/2/3 to recall recent amounts, W/E to subtract/add 5 G, and Q/Escape to clear unrolled bets. Clearing changes only the draft. Space suppresses native button activation and page scrolling during play, including when Shake is locked or the key repeats. Text fields, dialogs, composition, modifiers, busy actions, and pending actions retain their guards. Escape inside an ordinary dialog closes it without clearing bets.

How to play now starts with the goal, two playing steps, a payout reference, Tilt, Shake, Jackpot, and a keyboard reference. Longer rules, a probability example, and saving/preferences are in one disclosure. English, Korean, Japanese, Simplified Chinese, Spanish, French, and German share this structure. Browser language sets the initial selection; an explicit choice persists. The white 18 px serif reading style, sticky close control, and Tilt navigation remain. Korean uses serif fallbacks and keeps words together.

Verified:

- `npm test`: **54 passed**, including session-specific leaderboard selection, ranks 1/10/11/12/13/61, duplicate prevention, unranked users, zero records, ties, and scores beyond Number/SQLite integer precision.
- `npm run build`: TypeScript and production build passed. `git diff --check` passed.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:ui`: **19 passed**. Used the installed Chrome because the Playwright-managed executable is absent. The tests retain the existing gameplay, persistence, motion, touch, results, and restart coverage and add the requested keyboard and ranking behavior.
- All seven guide versions were exercised at 1280, 390, and 320 px, including expanded details, language persistence, automatic browser-language selection, and no horizontal overflow. The leaderboard fixture checks ranks 1–10 plus 64–66, a single personal row, row heights at most 48 px, and a move into first place without duplicates.
- After the final typography and personal-row label refinements, the two affected browser tests and the build passed again. A concurrent screenshot run briefly caused a Vite WebSocket port collision; the affected tests passed when run on their own.
- Visually inspected desktop/mobile rankings, the stronger column-hover highlight, the English desktop guide, the French desktop guide, and the Korean mobile guide. Also generated an expanded print preview and inspected its first page. Browser tests use isolated in-memory databases and emulated mobile widths; physical-device and other-browser coverage is not claimed. No normal game data was changed.

Previews: [Leaderboard, desktop](screenshots/compact-leaderboard-desktop.png) · [Leaderboard, mobile](screenshots/compact-leaderboard-mobile.png) · [Hover feedback](screenshots/stronger-hover-desktop.png) · [English guide](screenshots/concise-guide-desktop.png) · [Korean guide](screenshots/korean-guide-mobile.png).

Earlier sections record previous rules and layouts.

## Jackpot on every board and consistent stat cards — October 10, 2026

Removed the Jackpot probability gate. A winning sole wager on the pre-roll least-likely number now pays ×24 on every board, including nearly even and exactly even boards. Exact ties still select the lowest numerical face. Extra positive targets remove eligibility; zero entries are ignored. Jackpot still commits a fresh board and locks Shake. The obsolete probability threshold and availability field are removed, and the guide, specification, README, probability model, and offline audit match the new rule.

Settings no longer contains How to play. The sidebar help control and Tilt guide remain available. Bankroll, Rolls remaining, and On the table now share padding, label-over-value layout, spacing, and numeral typography. Rolls remaining retains its highlighted background. Both Gold cards use smaller G units on the numeral baseline and fit full exact amounts within fixed-height rows.

Verified:

- `npm test`: **53 passed**, including always-available Jackpot settlement, exact ties, pre-roll target selection, misses, extra bets, saved results, and restart behavior.
- `npm run build`: TypeScript and production build passed. `git diff --check` passed.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:ui`: **15 passed**. The browser fixture now uses a 5% least-likely face, above the removed threshold, and confirms ×24 settlement through the real API. Settings, sidebar help, Tilt navigation, touch and keyboard betting, final scores, and restart flows pass.
- Visually inspected desktop and mobile card formatting and mobile Settings. Layout checks cover 1280, 768, 390, and 320 px. Both Gold cards retain their height and fit exact amounts from 100 G through a 31-digit value; animated bankroll changes also preserve height. Tests use isolated databases and browser touch emulation, not physical phones.
- `npm run audit:strategies`: **5,000 seeded 100-roll runs per policy**, using fixed small wagers. Mean final Gold is **118.02** for random numbers, **121.23** for the old hedge-to-12% strategy, and **183.89** for selection using known expected returns. This measures the more generous rule without claiming optimal strategy or human balance.

Restarted the development server at `http://localhost:5173` to load the new settlement rule and confirmed HTTP 200. Read-only database counts matched before and after: **three players and 472 receipts**. No save or leaderboard reset was performed.

Previews: [Cards, desktop](screenshots/consistent-cards-desktop.png) · [Cards, mobile](screenshots/consistent-cards-mobile.png) · [Settings, mobile](screenshots/settings-without-guide-mobile.png).

Earlier sections record previous rules and layouts.

## Recent bets, stable bankroll cards, and run results — October 10, 2026

Removed the two betting hints. Left-clicking or tapping a placed chip now adds the selected amount; right-click removes the target's entire wager, and Delete/Backspace remains available for a focused target. Three chip shortcuts beside the amount remember distinct successful placements in newest-first order, persist across refreshes/restarts, and select an amount without placing a bet. Empty history slots are disabled.

Bankroll values remain exact and on one line. The font scales to the available width inside a fixed-height value row, including during animated balance changes. The mobile grid is constrained so a long number cannot expand its tracks before measurement.

The results dialog shows final Gold, personal best, and the first-record/improvement/tie/lower-score comparison. It saves the player's chosen name and starts the next run atomically through **Confirm & play again**. It also handles early bankruptcy without posting a score. The separate New run button is removed. A completed run and its comparison survive reload; failed name validation preserves the result, and a lost confirmation response retries the same saved action. Schema version 2 preserves competition data and adds the previous-best field. Legacy completed runs use their existing saved best because their earlier best was not recorded.

Verified:

- `npm test`: **52 passed**, including previous-best snapshots across multiple runs/reopened databases, a valid zero first record, atomic named restarts, duplicate/stale requests, and non-destructive migration of players, scores, and receipts.
- `npm run build`: TypeScript and production build passed. `git diff --check` passed.
- Chromium browser suite: **15 passed**. Coverage includes chip click/tap/right-click behavior, keyboard removal, recent-amount ordering and persistence, invalid/unaffordable amounts, pending-action locks, completion/reload/name confirmation, personal-best comparisons, invalid-name recovery, and retry after a committed response is lost.
- Controls were checked at 1600, 1280, 1101, 1051, 1024, 801, 768, 390, and 320 px. Recent chips stay beside the amount with no horizontal overflow. Bankroll tests at 1280, 768, 390, and 320 px verify identical card heights from 100 G through 31-digit exact balances. An animated 999,999 → 1,000,229 G win also preserves card height on every observed update.
- Visually inspected fresh desktop controls, mobile controls, the one-million bankroll, and desktop/mobile results dialogs. Tests use isolated in-memory databases; touch checks use browser emulation rather than a physical phone.

Restarted the normal development server at `http://localhost:5173` and verified HTTP 200. Read-only counts before and after migration matched: **three players and 339 receipts**, with schema version 1 upgraded to 2. No save or leaderboard reset was performed.

Previews: [Bet controls, desktop](screenshots/recent-bets-desktop.png) · [Bet controls, mobile](screenshots/recent-bets-mobile.png) · [One-million bankroll](screenshots/million-bankroll-mobile.png) · [Results, desktop](screenshots/run-results-desktop.png) · [Results, mobile](screenshots/run-results-mobile.png).

Earlier sections record previous versions of the controls and layouts.

## Six Tilt levels and longer upper-band windows — October 10, 2026

Tilt now has six levels. The former middle band is split at 4.5 effective outcomes; old Tilt 4 becomes 5 and old Tilt 5 becomes 6. Transfer ranges are 4–8%, 4.2–8.4%, 4.4–8.8%, 4.6–9.2%, 4.8–9.6%, and 5–10%. The mean increases only from 6% to 7.5%, giving concentrated boards more time while keeping every ordinary paying update active. The guide, labels, arithmetic examples, README, specification, and probability model match.

On the table now contains only its label and wager total. Edit bets, Clear, their editor, and the Jackpot availability line are removed. Clicking or tapping a placed chip takes back its target’s entire wager. Right-click or Delete/Backspace on a focused target also removes it. Target backgrounds and Enter/Space still add wagers. Exact large wagers remain available in target tooltips and accessible names.

Verified:

- `npm test`: **50 passed**, including six-level classification, label/normalization invariance, exact transfer arithmetic, upper-band pacing through actual settlement, probability conservation, persistence, restart, and final-roll scoring.
- `npm run build`: TypeScript and production build passed. `git diff --check` passed.
- Chromium browser suite: **12 passed**. Added all-six-level rendering and accessible-label checks, removal through actual touch hit testing, chip clicks, right-clicks, Delete, and Backspace. Existing restart confirmation/animation, pending actions, keyboard shortcuts, guide, and 100-roll submission checks pass.
- Layouts at 1280, 768, 390, and 320 px have no horizontal overflow. Visually inspected current 1280 and 320 px screenshots. Tests use in-memory databases; touch was browser emulation, not a physical phone.
- `npm run test:balance`: **10,000 seeded starts per profile/policy**. Current Tilt 5 lasts a median **three strongest-face rolls or four group rolls**; Tilt 6 lasts **two or four**, respectively. Full coverage gives two-roll medians for both. A chance includes the roll that first changes the starting Tilt; these are medians, not guaranteed minimums. Near-boundary boards can still move after one paying roll.
- `npm run audit:strategies`: **5,000 seeded 100-roll runs per policy**. Mean final Gold is **102.08** for random-number bets, **80.29** for the old hedge-to-12% strategy, and **144.10** for known-best-return selection. The former hedge strategy produced zero Jackpots. These fixed-small-wager diagnostics do not establish optimal play or human balance.

Restarted the normal development server on port 5173 and confirmed HTTP 200. Read-only database counts before and after the restart matched: schema version 1, three players, and 223 receipts. No save or leaderboard reset was performed.

Previews: [Six Tilt levels, desktop](screenshots/six-tilts-desktop.png) · [Six Tilt levels, mobile](screenshots/six-tilts-mobile.png).

Earlier sections below document previous layouts and transfer profiles.

## Restart from Settings — October 10, 2026

Added a red **Restart run** button at the bottom of Settings. Its confirmation explains that current progress and bets are discarded and a fresh run starts with 100 G and 100 rolls, while the completed leaderboard score remains. Cancel has initial focus. Cancel or Escape returns to Settings with the same saved state and draft. Confirm closes the dialogs and uses the existing restart animation. The server now accepts restart during an unfinished run and never posts that abandoned balance; action revision and duplicate-request protections still apply.

Verified:

- `npm test`: **49 passed**, including active-run resets, unchanged completed scores, no premature leaderboard submission, fresh odds, and duplicate/stale restart requests.
- `npm run build`: TypeScript and production build passed.
- Browser suite: **10 passed**. New coverage verifies Cancel/Escape, focus restoration, ignored R/S shortcuts, retained draft, confirmed restart animation, locked controls, and the saved fresh run after reload. Restart is also disabled during a pending Roll.
- Visually checked Settings at 1280 and 320 px and the confirmation at 320 px. No horizontal overflow. Browser tests use an isolated in-memory database.

Previews: [Settings](screenshots/settings-restart-mobile.png) · [Restart confirmation](screenshots/restart-confirm-mobile.png).

## Compact scoreboard, remaining rolls, restart, and slower Tilt — October 10, 2026

The left rail now contains exactly three cards: Bankroll, a highlighted Rolls remaining count, and On the table with Edit bets/Clear controls. Removed the Best completed run card, Available readout, and duplicate used-roll counter. The leaderboard shows its title and ranked names/scores, with the current player's row highlighted. Removed its explanatory copy, personal-record footer, and next-rank progress. The server still records final Bankroll on roll 100 and keeps each player's best completed score.

New run now slides out the old die and brings in a fresh one, counts the Bankroll back to 100 G, and fades/slides the three cards into place over approximately 800 ms. All actions stay locked during the transition. Reduced motion skips the movement. This presents the already-committed restart without adding another roll or changing the saved result.

Scaled every probability-transfer rate bound by **0.8**. Tilt levels 1–5 now use **4.8–9.6%, 7.2–14.4%, 9.6–19.2%, 12–24%, and 14.4–28.8%** of the paying face's probability above the floor. The Tilt thresholds are unchanged; a board near a boundary can still change level after one paying roll. The guide derives its ranges/example from configuration; the README, specification, and probability model match.

Verified:

- `npm test`: **48 passed**, including updated exact transfer arithmetic, probability conservation, pacing regression, settlement, persistence, final-roll scoring, and API/startup checks.
- `npm run build`: TypeScript and the production build passed. `git diff --check` passed.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:ui`: **nine passed**. Added three-card/compact-leaderboard checks and a real bankruptcy restart with active die/card animations, disabled controls, ignored R/S shortcuts, cleaned-up animation elements, and saved 100 G / zero rolls used. The existing 100-roll completion test still verifies a 280 G final score after an earlier 330 G peak and reduced-motion restart.
- Browser layouts at **1280, 768, 390, and 320 px** showed exactly three cards, a count at least 40 px tall, and no horizontal page overflow. Desktop/mobile layouts and the in-progress restart screenshot were visually inspected. Browser tests used an isolated in-memory database.
- `npm run test:balance`: all six candidate profiles and the configured profile completed, with 10,000 seeded boards per policy. Under rotating group bets, the median first Tilt 1 moved from **16 to 20 rolls**; the starting strongest-face opportunity window moved from **13 to 18 rolls**. Tilt 1 arrival within 20 rolls fell from **69.0% to 53.2%**. These are policy-specific measurements, not minimum stays at any Tilt level.
- `npm run audit:strategies`: 5,000 seeded 100-roll runs per policy completed. Mean final Gold was **101.53** for blind random-number bets, **73.93** for the former hedge-to-12% strategy, and **134.69** for selection using exact expected returns. The former hedge strategy produced zero Jackpots. Wagers were fixed at 1 G; this does not prove optimal play or human balance.

Restarted the normal development server on port 5173 to load the new server-side rates. The game and leaderboard endpoints responded successfully. No new save-data reset was performed; schema version 1, three player records, and 98 action receipts were preserved.

Previews: [Three cards, desktop](screenshots/three-cards-desktop.png) · [Three cards, mobile](screenshots/three-cards-mobile.png) · [Restart transition](screenshots/restart-transition.png).

Physical phones, Safari, Firefox, assistive-technology speech, and timed human play were not tested. Earlier entries below describe previous layouts and rates.

## 100-roll competition and rare Jackpot — October 10, 2026

Implemented 100 G starts, a durable 100-roll limit, ordinary ×6 singles, and ×24 Jackpot only for a sole wager on the least likely face when its normalized pre-roll chance is at most 1/24. Every settlement consumes one roll, including break-even wagers. Shake does not consume or replenish rolls. Only final Gold on roll 100 enters the leaderboard; each player retains their best completed run. Early bankruptcy submits nothing. A final zero score is valid. Completed or bankrupt runs disable wagering and Shake, and New run restores 100 G and zero rolls used.

The UI displays the roll count, Jackpot availability without the target, the best completed score, and the final result. The guide, README, specification, probability model, and offline strategy audit now describe these rules. The developer odds setting remains available.

Verified:

- `npm test`: **48 passed**, including inclusive Jackpot threshold and pre-roll normalization; ordinary ×6 above the threshold; all 100 settlements with no early score; final balance rather than peak; persistent roll 99; restart and old-receipt replay; concurrent requests competing for roll 100; and early versus final-roll bankruptcy. The persistence suite also passed after adding an explicit Jackpot-on-roll-100 check: its automatic reset keeps the completed count and posts the score once.
- `npm run build`: TypeScript and the production build passed. `git diff --check` passed.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:ui`: **seven passed**. The complete run case grows to 330 G, remains unranked through 99 rolls, posts a 280 G final score, rejects further R/S input, survives reload, and restarts at 100 G / zero rolls while retaining the 280 G record. Existing shortcut, pending-action, Settings, and guide checks passed.
- Completed-run layouts at 1280, 390, and 320 px had no horizontal page overflow. Desktop and mobile completion screenshots and the mobile new-run screenshot were visually inspected. No page errors were reported. Tests used reduced motion and isolated in-memory/temporary databases.
- `npm run audit:strategies`: 5,000 seeded 100-roll runs per policy completed. Mean final Gold was **101.17** for blind random-number bets, **68.97** for the old hedge-to-12% strategy, and **130.82** for selection using exact expected returns. The former hedge strategy produced zero Jackpots under the new threshold. All attack wagers were 1 G, with no manual Shake or restart; this is a diagnostic comparison, not a proof of optimal play or human balance.

Applied the requested reset to the normal `data/one-of-six.sqlite` after isolated verification. It contained **seven players and 271 receipts** at schema version 0; migration to version 1 left **zero players, zero receipts, and an empty leaderboard**. The migration test verifies that subsequent opens retain new saves instead of resetting again. Browser preference settings and archived backups are outside this active-save reset.

Previews: [Completed run, desktop](screenshots/100-rolls-desktop.png) · [Completed run, mobile](screenshots/100-rolls-mobile.png).

Physical phones, Safari, Firefox, assistive-technology speech, and timed human play sessions were not tested. Earlier entries below describe previous rules and scores.

## Additional 1.5× Tilt speed increase — October 10, 2026

Increased every transfer-rate bound by 1.5× relative to the preceding tuning. Tilt levels 1–5 now use **6–12%, 9–18%, 12–24%, 15–30%, and 18–36%** of the paying face's probability above the 2% floor. This is the 3× original-baseline profile in the pacing experiment. The spec, README, probability model, exact arithmetic tests, and browser guide assertions now match. The guide reads its rates and example directly from configuration.

Reran `npm run test:balance` with 10,000 identical seeded Tilt 2–5 starting boards per profile/policy. The configured result matches the 3× baseline profile: rotating 1 G group bets reach Tilt 1 in a median **16 rolls**, compared with 23 under the preceding tuning; **69.0% reach it within 20 rolls**, compared with 40.5%. The median first level change is five rolls, and the initial strongest-face opportunity window (at least 30% probability) is 13 rolls, down from 21. Full-coverage median arrival is seven rolls, down from 11. These are policy-specific pacing measurements, not guaranteed roll counts.

`npm test` passed all **45 tests**, including the revised 1,000-board pacing regression, exact transfer arithmetic, probability floor and conservation checks. All **six Chromium browser tests** passed, including the guide's new 6–12% / 18–36% ranges and its 34.87% example at desktop/mobile sizes. TypeScript, the production build, and `git diff --check` passed. Tests used isolated stores. The [desktop Tilt guide preview](screenshots/tilt-guide-oct10-1280.jpg) reflects the updated ranges.

## Current spec, quicker Tilt, shortcuts, and one guide — October 10, 2026 (initial tuning)

Replaced the historical `spec.md` with a specification of the current implementation: board mapping, hidden odds, entropy-based Tilt, earned Shake, Jackpot, accounting, persistence, layout, input, API, and current balance settings. Updated the README and probability model to match.

Compared five probability-transfer profiles (1×, 1.5×, 2×, 3×, 4× the preceding ranges) on 10,000 paired seeded Tilt 2–5 starting boards per policy, using 80 rolls per board. The experiment calls the actual probability rules with both rotating 1 G group bets and full coverage, without using a database. Selected 2×: ranges are now 4–8%, 6–12%, 8–16%, 10–20%, and 12–24% of the paying face's probability above the floor. The configured profile reproduced the 2× results exactly. Under group exploration, median first Tilt change improved from 13 to six rolls, first Tilt 1 from 47 to 23, and the proportion reaching Tilt 1 within 40 rolls from 36.9% to 89.7%. The median initial opportunity window (strongest starting face remaining at least 30%, for qualifying starts) was 21 rolls, versus 46 previously and 13/eight for 3×/4×. See [the model and limitations](PROBABILITY_MODEL.md#which-pace-preserves-opportunity-and-tension).

Reproduced the shortcut bug before fixing it: clicking number 6 left that button focused, and pressing R left revision 0, bankroll 100 G, and the 10 G draft unchanged. The handler excluded every button. It now accepts R/S from buttons while preserving text-editing, dialog, modifier, repeat, composition, disabled-action, and pending-action guards.

Moved the full rules and preference explanations from Settings to How to Play. Settings now contains the nickname form, three switches, and a guide link. The guide retains its white surface, serif reading text, expandable example, sticky close control, print styling, and focus restoration. Transfer ranges and example arithmetic in the guide derive from `CONFIG`.

Executed checks:

- `npm test`: **45 passed**, including all existing settlement, persistence, HTTP, and startup tests; updated exact transfer arithmetic; and a new 1,000-board settlement pacing regression that checks both Tilt 1 arrival and opportunity duration.
- `npm run build`: TypeScript and the production Vite build passed.
- `npm run test:balance`: all five candidates plus the configured profile completed on both policies; the detailed reproducible results are in the probability model.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:ui`: **six browser tests passed**. The suite starts its own in-memory API/Vite server on an available port. It checks click → R, Enter → R, uppercase R, Jackpot settlement and Tilt 1, locked/unlocked S, text fields and dialogs, modifiers/repeats/composition/consumed keys/editable text, prevention of a second action during a pending request, and Settings/guide behavior at 1280, 390, and 320 px. No page errors occurred.
- Visual inspection of desktop and mobile Settings, guide, and expanded probability example found no horizontal overflow. The Tilt link scrolled to an unobscured heading beneath the sticky title and returned focus on close. The Settings link opened only one dialog and returned focus to Settings. Nickname saving and probability visibility still worked.
- Print-media inspection confirmed that the game is hidden, the guide flows with visible overflow, its header is static, and its reading text remains 18 px. `git diff --check` passed.

Previews: [Settings on mobile](screenshots/settings-oct10-390.jpg) · [How to Play on mobile](screenshots/how-to-play-oct10-390.jpg) · [Tilt guide on desktop](screenshots/tilt-guide-oct10-1280.jpg).

Tests and browser fixtures used isolated memory/temporary stores; the normal player database was not changed. Browser coverage is desktop Chromium at resized viewports, not physical phones, Safari, or Firefox. Simulation measures pacing under two specified policies; it does not prove human enjoyment or cover all betting and Shake strategies.

## Startup port conflicts and group bet typography — October 9, 2026

Development startup now catches bind errors and, when no explicit `PORT` is set, tries up to 20 subsequent ports. The printed local and network URLs use the actual bound port. Explicit ports and production startup stay strict and exit with a concise explanation when the port is occupied. Failed startup closes Vite and SQLite resources.

Row coverage labels previously used smaller type than column labels while their payout multipliers were larger: at 1280px, rows used 13px coverage / 19px payout; at 320px they used 10px / 17px. Row, column, and color bets now share responsive label/payout sizes: 19px / 15px on the spacious layout, 16px / 13px on compact desktop and tablet layouts, and 14px / 12px on mobile. Removed the conflicting row overrides and the extra text reduction below 360px.

Verified:

- All 44 automated tests passed, including four new listener tests covering successful binding, occupied-port recovery, strict rejection, other bind errors, and preservation of existing server listeners. TypeScript, the production build, and `git diff --check` passed.
- Started `npm run dev` with an isolated in-memory database while a temporary server occupied 5173. Sixfold printed 5174, served the page and game API, and connected Vite's WebSocket on 5174. Explicit `PORT=5173` and production startup exited with status 1 and an actionable message, without an unhandled error or port fallback. `PORT=0` printed the actual assigned port. After releasing 5173, ordinary development startup served it successfully. Test servers were stopped afterward.
- Chromium checked 16 viewport widths: 1600, 1351, 1350, 1280, 1150, 1101, 1100, 1024, 801, 800, 768, 651, 650, 390, 360, and 320px. Labels and payouts matched across all seven groups, labels remained larger than payouts, and no group text clipped or document overflow appeared. Repeated the checks with odds hidden, odds visible, and all targets wagered with odds visible.
- At 320px, all 13 targets accepted 1 G wagers without changing board dimensions. Right-click canceled a row wager, Clear removed the draft, and a deterministic 10 G bottom-row win returned 20 G and settled the bankroll at 110 G. No page errors occurred. Desktop and mobile screenshots were visually inspected.

Previews: [Desktop](screenshots/row-type-1280.jpg) · [Mobile](screenshots/row-type-390.jpg).

Browser gameplay used the isolated in-memory fixture. The normal game database was not used for verification. Physical phones, Safari, and Firefox were not tested.

## Prominent Tilt, slower transfers, and die replacement — October 9, 2026

Tilt is now a large gold control above the table status (48px on desktop, 38px on mobile). It opens the guide directly at the explanation of low Tilt (1–2), high Tilt (4–5), and the middle level. Focus moves to that heading and returns to Tilt when the guide closes. A sticky guide header keeps Close visible during the jump; its print rule restores normal document flow.

Paying rolls use the pre-roll Tilt to choose a random transfer rate: 2–4%, 3–6%, 4–8%, 5–10%, or 6–12% for levels 1–5. The probability floor, random recipient shares, payout triggers, and Shake eligibility keep their established behavior. A level change caused by a payout affects the next roll's rate.

Roll keeps the original tumble. Shake instead slides the old die out and introduces a fresh stationary die from the other side, with separate moving shadows and softly masked edges. A Jackpot plays the replacement after its payout presentation. The replacement does not sample an outcome or change settlement. Reduced motion skips the movement, and decorative clones are removed at completion or cancellation.

Verified:

- All 40 automated tests passed. The new behavioral check covers every level's minimum, midpoint, and maximum rate, acceleration with Tilt, and a payout crossing from Tilt 5 into a lower level. Existing long-run probability, payout, persistence, retry, and Shake-lock tests still pass.
- TypeScript, the production build, and `git diff --check` passed.
- Chrome showed the Roll phase separately from the replacement phase. During replacement there was one identified live die plus two hidden decorative copies (old die and shadow); afterward the copies were removed. A 10 G Jackpot on 6 settled at 330 G, then showed the fresh die and a locked Shake. Manual Shake preserved the bankroll and locked again.
- Enabled Reduce motion during a replacement and verified cleanup and the final stationary die. A subsequent reduced-motion roll and Shake completed with one die, no decorative copies, and the correct balance.
- Visually checked the board and guide at 320px and 1280px. No document or guide horizontal overflow occurred. Tilt remained prominent, direct navigation focused the correct heading, closing returned focus, and the expanded odds example worked. Exact probability labels remained hidden. The guide header overlap found during mobile review was corrected and rechecked. Browser warning/error logs were empty.
- Restarted the local development server after saving `data/backups/before-tilt-refinement.sqlite`. Compared all player rows and receipts with the backup: they matched. Port 5173 returned HTTP 200. Gameplay checks used the isolated in-memory fixture, which was stopped afterward.

Previews: [Desktop](screenshots/tilt-refined-desktop.jpg) · [Mobile](screenshots/tilt-refined-mobile.jpg) · [Guide](screenshots/tilt-guide-desktop.jpg) · [Mobile guide](screenshots/tilt-guide-mobile.jpg).

Physical phones, Safari, Firefox, and screen-reader speech were not tested. Print styling was checked in CSS; a print preview was not rendered. Earlier entries describe previous rates and layouts.

## Random odds, Tilt, and earned Shake — October 9, 2026

Replaced the shuffled fixed template with a fresh Dirichlet draw and a 2% floor per face. Ordinary paying rolls now transfer a random 10–40% of the rolled face's surplus above that floor to five random receiving shares. Added the single Tilt level, based on entropy, and server-persisted Shake eligibility. The current formulas and choices are in [PROBABILITY_MODEL.md](PROBABILITY_MODEL.md).

Verified:

- All 39 automated tests, TypeScript, the production build, and `git diff --check` passed. Coverage includes distinct random initial boards, face symmetry, all five Tilt levels, variable transfer amounts/shares, preserved totals and bounds over 100,000 transfers, Jackpot resets, amount independence, and unchanged odds on misses.
- Store and HTTP checks cover rejected locked Shakes, the six-number break-even wager, 1 G gains/losses, returning to an earlier balance, eligibility surviving later break-even rolls, reset/restart/Jackpot locking, stale revisions, duplicate requests, and persistence across reopening SQLite. Legacy schema and receipt migration preserve game state.
- In the isolated Chrome fixture, six 10 G number bets returned 60 G and kept both the 100 G bankroll and locked Shake. A 1 G loss unlocked Shake. Refresh preserved that unlock; Shake preserved the 99 G bankroll and locked again. Tilt moved from 2 to 1 on the deterministic reset. Refresh retained the lock.
- Visually inspected the board at 320px and 1280px, plus the default desktop viewport. No horizontal overflow occurred at either measured breakpoint. All exact probability labels remained hidden. The expanded guide fit within its 287px mobile content width. Browser warning/error logs were empty.
- Restarted the normal local development server after making a SQLite backup at `data/backups/before-random-odds-20261009-232139.sqlite`. Compared every existing player field and action receipt with the backup: all were preserved. The new Shake column starts locked. The running game returned HTTP 200 on port 5173.

Previews: [Desktop](screenshots/random-odds-desktop.jpg) · [Mobile](screenshots/random-odds-mobile.jpg).

Browser gameplay used the isolated in-memory fixture, which was stopped afterward. No normal-game rolls were performed. Physical phones, Safari, Firefox, screen-reader speech, and longer-term player enjoyment were not tested. Earlier report entries describe prior rules.

## Numeral centering, expanded guide, and peripheral UI — October 9, 2026

Replaced SVG text-box centering with Canvas actual glyph measurements. The old SVG bounds included the same font ascent/descent area for every digit, leaving Georgia’s descending 3, 4, and 5 visibly low. The new positions center the visible numeral shapes and remove the downward text shadow.

Bankroll and Personal Best now share flat surfaces and consistent spacing, with aligned values on mobile. Wager controls share a baseline and height on desktop. Utility buttons, the leaderboard, the bet editor, and Settings use quieter borders, typography, and spacing. The felt board, chips, and game rules retain their existing design and behavior. The guide follows the personal guide-design reading style, reopens through **How to play**, and explains uneven starting odds, probability redistribution, a concrete 40% → 30% example, and play hints. It explicitly avoids promising equal odds.

Verified:

- All 34 automated tests, TypeScript, the production build, and `git diff --check` passed.
- Chrome checked at 1600, 1280, 1101, 1024, 768, 650, 390, and 320px widths, with no horizontal overflow. Screenshot pixel bounds (48 digit samples) placed all visible numeral centers within 1px of their cell centers. Mobile balance values and desktop amount/action controls aligned within 1px.
- All 13 targets accepted wagers at 320px; the board dimensions remained stable. Amount keys, reduction/removal, Clear, probability visibility, a deterministic 330 G Jackpot settlement, and free Shake passed. An 81-digit balance and a long leaderboard name did not create overflow at 320px or 1280px.
- Initial guide display, persistent dismissal, reopening, focus return, the expanded odds example, print layout, and touch-emulated guide controls passed. No page errors occurred. Desktop, mobile, Settings, the guide, and the leaderboard drawer were visually inspected.

Previews: [Desktop](screenshots/polished-desktop.png) · [Mobile](screenshots/polished-mobile.png) · [Guide](screenshots/expanded-guide.png) · [Settings](screenshots/polished-settings.png) · [Leaderboard](screenshots/polished-leaderboard.png).

Browser checks used the isolated in-memory tower fixture; normal game data was not changed. Physical phones, Safari, and Firefox were not tested.

## Wi-Fi access during development — October 9, 2026

The development server now binds to `0.0.0.0` and prints the computer's network URLs. Vite's reload WebSocket uses the same HTTP server and port. Client action IDs use `crypto.getRandomValues`, which works on plain HTTP network origins. `HOST` still overrides the bind address, and production startup still defaults to loopback.

Verified: all 34 tests, the production build, and `git diff --check` passed. An isolated `PORT=5175 DB_PATH=:memory: npm run dev` process listened on all IPv4 interfaces and returned HTTP 200 through the Mac's Wi-Fi address. Chrome loaded that network URL, connected Vite's WebSocket, completed Shake, and settled a 10 G wager on 1 at 150 G after rolling 1. No browser errors or warnings were reported. The test process was stopped; the normal game database was not used. Physical-phone connectivity and router/firewall behavior were not tested.

## Personal-best bet limit removed — October 9, 2026

Removed the 10% rule from server validation, the amount controls, roll eligibility, Settings, and the first-game guide. The Roll limit label and its hint are gone. Wagers may again use the full available bankroll; the 1 G minimum and existing overspending check remain. The leaderboard, cards, colors, number alignment, and win effects retain their latest design.

Verified: all 34 original tests, the production build, and `git diff --check` passed. In the isolated browser fixture, ↑ raised the amount from 10 to 15 G; a 50 G wager from a 100 G bankroll settled at 1,250 G; a full 1,250 G draft was accepted; adding another 1 G was rejected. No limit text or maximum-value attribute remained. The 320px layout had two accounting values and no horizontal overflow, and no page errors were reported. The previous section and its screenshots record the now-removed limit.

## Leaderboard tower, win celebration, and 10% roll limit — October 9, 2026

Bankroll and Personal Best now occupy separate cards. Red and Black use red and charcoal fills. Every number is centered from its visible SVG glyph bounds, including Georgia's descending 4. A persistent leaderboard tower sits on the right above 1100px; smaller layouts open the same content in a right-side drawer. Stacked ranks highlight the player and show the Gold needed to pass the next competitor. Rank improvements animate upward.

Net-positive wins now show a large gain banner, 40 shower particles (64 for Jackpot), larger bursts and coin flights, plus a layered fanfare, impact sound, and metallic coin notes. Sound defaults to on after interaction while honoring a saved mute preference. Mute stops scheduled notes. Reduced motion skips the moving celebration. Return and net amounts remain separate, and break-even/net-loss payouts do not receive a victory banner.

All wagers in a roll share a cap of **floor(saved Personal Best / 10)**, still bounded by available Gold. The UI shows the limit and rejects additions over it; arrow adjustments stop at it. The server independently enforces the same rule before drawing or writing a receipt. The settled record before the roll determines the cap, so a new best increases the next roll's limit. Existing action receipts remain retry-safe.

Verified in this pass:

- `npm test`: 37 passing tests. New checks cover the exact limit, combined targets, whole-Gold rounding, historical best after losses, available-bankroll limits, 81-digit precision, no sampling on rejection, transaction/receipt integrity, and rejection through HTTP. Existing payout scenarios use an explicit historical best that makes their stakes legal.
- TypeScript and the production build passed. `git diff --check` passed.
- Headless Chrome checked at 1600×1000, 1280×900, 1101×900, 1024×900, 768×900, 390×900, and 320×900. No horizontal overflow was observed. Desktop, mobile, the right-side drawer, and the celebration were visually reviewed.
- Measured visible glyph centers were within 0.51px of their cell centers for all six numbers. Probability visibility remains hidden by default.
- A 100 G record rejected an 11 G single bet and a 6 G + 5 G split. A 6 G + 4 G split was accepted. A deterministic 10 G Jackpot settled at 330 G and raised the displayed limit from 10 G to 33 G; the new 33 G stake was accepted.
- In the synthetic tower fixture, the Jackpot moved the player from rank 6 to rank 3. The right rail stayed visible on wide layouts, the mobile drawer opened against the right edge, and only one leaderboard content tree existed through viewport changes.
- The Jackpot displayed its large banner and at least 40 simultaneous shower particles. Audio instrumentation observed the actual oscillator/buffer source starts for the fanfare. Muting prevented new sound sources, persisted on reload, and reduced motion produced no active movement or banner. Effects cleaned up after settlement. No page errors occurred during the main checks.
- A separately mocked 81-digit browser state verified exact keyboard clamping at the cap, exact wager placement, and no overflow at 320px. Server precision and settlement were checked independently in the automated tests.

Previews: [Desktop tower](screenshots/tower-desktop.png) · [Mobile game](screenshots/tower-mobile.png) · [Win celebration](screenshots/tower-win.png) · [Mobile leaderboard](screenshots/tower-mobile-leaderboard.png).

The tower previews use synthetic opponents in an isolated in-memory fixture: `SCENARIO=tower npm run preview:fixture`. No normal game data was changed. Physical phones, Safari, Firefox, screen-reader speech, and subjective loudspeaker sound quality were not tested. Earlier entries describe previous rules and designs.

## Hidden odds, scattered chips, and first-game guidance — October 9, 2026

The board now centers number and group labels and separates the color bets with 14px of felt on desktop and 12px on mobile. Odds default to hidden, including accessible target names, and a saved developer switch in Settings reveals all 13 probabilities. The Jackpot panel and target marker are removed; settlement rules and win celebrations remain. Round casino chips use varied local positions, rotations, and colors; each addition places another chip, up to five per target, with the total on top. Existing chips keep their positions through unrelated UI updates.

The four preset amount buttons are removed. The wider amount field accepts exact integers and responds to ↑ / ↓ in 5 G steps, with a 1 G minimum. A first-game dialog explains betting and payouts when the saved player has no roll and has not dismissed the guide. Dismissal persists for that player in this browser. Existing roll history suppresses the guide.

Verified in this pass:

- All 34 existing rule, persistence, and HTTP tests passed. TypeScript and the production build passed; `git diff --check` passed.
- Headless Chrome checked at 1280×900, 1024×844, 768×844, 390×844, and 320×844. No horizontal page overflow occurred. Desktop and mobile screenshots were visually reviewed, including the guide and Settings. Mobile uses vertical scrolling.
- ↑ / ↓ changed 10 → 15 → 10, clamped 2 → 1, and preserved exact values through 9,007,199,254,740,993 → 9,007,199,254,740,998 → 9,007,199,254,740,993. Invalid input stayed invalid until corrected. Busy actions disabled the amount control.
- All 13 probability labels and accessible probability descriptions were absent by default, appeared with the developer switch, persisted through reload, and disappeared when switched off. Toggling preserved existing chip positions.
- The guide appeared for a fresh player, stayed dismissed after reload, and did not appear when a saved roll existed even after its local dismissal key was removed.
- Repeated additions placed multiple chips and preserved the exact aggregate wager. All 13 targets accepted wagers at 320px. Editor reduction/removal, right-click cancellation, Clear, and Shake removed the corresponding chips. Reduce motion skipped placement animations.
- The deterministic sole 10 G wager on 6 still returned 240 G and settled at 330 G. Settlement cleared the chips and wagers; free Shake kept the balance. No page errors occurred during the main interaction checks.
- Browser checks caught and fixed a dropped first bet after amount entry: amount changes now update the editor without replacing the board contents during the click.

Previews: [Desktop](screenshots/hidden-odds-desktop.png) · [Mobile](screenshots/hidden-odds-mobile.png) · [First-game guide](screenshots/first-game-guide.png).

Browser QA used the isolated in-memory fixture and did not touch the normal game database. Probability hiding is a presentation choice; the client API still receives the stored odds. Physical phones, Safari, Firefox, and screen-reader speech were not tested. Earlier entries describe superseded designs.

## Casino table and animation refinement — October 9, 2026

The current design uses Balatro-inspired placement: a left information rail, a stationary felt table, and wager/roll controls below it. Bets are coin stacks with a landing animation. The die has six physical faces and a 1.1-second toss with a bounce, shadow, and landing ring. Winning targets glow and show rising returns; coins and sparks accompany the bankroll count-up. Jackpot celebrations use more coins and sparks. The server still settles all results before animation begins.

Verified in this pass:

- `npm test`: all 34 tests passed. `npm run build` and `git diff --check` passed.
- Chrome inspected at its normal desktop size and at 1280×800, 768×800, 390×844, and 320×740. Mobile uses vertical scrolling; 320px and 390px checks showed no horizontal overflow after fixes.
- At 320px, all 13 targets held 1 G wagers with visible odds and coin labels. The board retained its exact document position, width, and height before and after those additions.
- The bet editor opens over the game. Reduction, removal, right-click cancellation, denomination selection, and exact-amount entry worked. The amount, Roll, and Shake controls remain outside the fixed betting grid.
- A motion-enabled sole 10 G wager on 6 returned 240 G, settled at 330 G, and refreshed the Jackpot marker to 5. The final desktop board remained at document top 149px, width 896px, and height 342px before and after the Jackpot. During the celebration the DOM contained nine flying coins and sixteen sparks.
- Captured the die during its tumble. An ordinary 10 G column win showed a +30 G floating return, four flying coins, seven sparks, and the animated balance. Overlapping number/column/color bets returned 110 G from a 30 G stake. A separate net-loss hit reported 5 G return and −5 G net accurately.
- Keyboard Enter on Roll, a complete miss, bankruptcy, restart, free Shake, mobile Settings, and the leaderboard worked. Restart restored 100 G and kept the 495 G record; Shake cleared wagers and kept Gold.
- The separate large-balance fixture wagered exactly 9,007,199,254,740,993 G and returned exactly 54,043,195,528,445,958 G. The mobile board stayed at document top 400px, width 325px, and height 344px through settlement. Compact coin text retains the exact amount in its tooltip, accessible target name, and editor.
- The existing Reduce motion preference skipped roll and celebration movement while still settling correctly. Motion was enabled for animation review, then the fixture preference was restored. A Chrome message-channel listener error appeared during development reloads; no application stack trace or game failure accompanied it.

Previews: [Desktop](screenshots/casino-desktop.jpg) · [Mobile](screenshots/casino-mobile.jpg) · [Jackpot animation frame](screenshots/casino-reward.jpg).

Browser tests used the isolated in-memory fixture, not the normal game database. Physical phones, Safari, Firefox, and subjective sound quality were not tested. Earlier entries below describe superseded designs.


Verified on October 9, 2026, using Node 26.4.0 and the available Chrome browser tools. The normal game is served at `http://localhost:5173`. Browser QA used both the Vite development client and the built production client.

## Minimal board and right-click cancellation — October 9, 2026

Replaced the decorative frame, gradients, gold chips, serif numerals, sidebar, slogans, and repeated labels with a flat green table and larger sans-serif text. Number text is 68–72px on desktop and 58px on mobile; number probabilities are 22px and 19px respectively. Group buttons show their covered numbers, return multiplier, probability, and any wager. Full rules remain in Settings.

Right-click clears the entire draft wager on the clicked target. The handler only intercepts context menus on betting targets, ignores empty targets, and respects the existing busy/pending action guards. Edit bets remains available for touch and keyboard users. The persistent result panel, board outcome ring, legend, and restored last-roll presentation are removed. The current roll still updates the die and Gold, and announces the outcome to assistive technology.

Verified for this pass:

- `npm test`: 34 passing existing tests. Production build and `git diff --check` passed.
- Browser checks at 1280×800, 390×844, and 320×740. Larger text can require vertical scrolling.
- Added 20 G to Number 1 and 10 G to Red. Right-clicking Number 1 removed all 20 G while preserving Red, including with invalid text in the amount field.
- Added 1 G to all 13 targets, then right-clicked each target. Final draft was 0 G, available Gold was 100 G, and Roll was disabled. Right-clicking an empty target was a no-op.
- At 320px, all 13 selected targets had no horizontal text clipping or page overflow; odds stayed visible. Number and column wagers of `9,007,199,254,740,993 G` also wrapped without clipping, and right-click canceled the large number wager.
- Right-clicking Black restored eligibility for a sole Number 6 Jackpot. Keyboard Roll settled the Jackpot at 330 G; a subsequent ordinary hit settled at 380 G. No last-roll panel or outcome marker appeared.
- Mobile draft removal, the header leaderboard button, and Settings worked. No browser warnings or errors were reported in the inspected fixture session.

Current previews: [Desktop](screenshots/refined-desktop.jpg) · [Mobile](screenshots/refined-mobile.jpg).

The requested new reference image or URL was not present in the conversation; the visual direction follows the explicit request for less decoration, larger type, and fewer labels. Earlier entries below describe superseded presentations.

## Roulette-inspired design refinement — October 9, 2026

The board now uses green felt, a connected ivory grid, larger centered numbers, stronger red/black contrast, and gold wager markers. Group odds remain visible after selection. A ring identifies the last rolled number; a star and ×24 identify the Jackpot target. On narrow screens, Roll and the amount selector share a row, with Shake below.

Checks for this refinement:

- `npm test`: all 34 existing tests passed. `npm run build` and `git diff --check` passed.
- Chrome layouts inspected at 1280×800, 768×800, 390×844, and 320×740. The normal large desktop viewport was also visually inspected. Mobile pages use vertical scrolling.
- At 320px, all 13 targets accepted 1 G wagers, all seven group probabilities remained visible, and the inspected target labels had no horizontal clipping. No document horizontal overflow was observed.
- Draft reduction and clearing, overlapping number/column/color wagers, mobile Settings and Leaderboard dialogs, keyboard Enter on Roll, Jackpot eligibility, a 240 G Jackpot return, automatic Shake, and free Shake were exercised in the isolated fixture. Reduced motion remained respected.
- The large-balance fixture exposed a collision in the compact desktop header. Balances and records above 12 digits now use separate rows; the 768px layout was rechecked for overlap. At 390px, number and column wagers of `9,007,199,254,740,993 G` wrapped without clipping, with group odds still visible. The ordinary ×6 result displayed exactly `54,043,195,528,445,958 G`.
- Sampled foreground/background contrast ratios: number text on red 6.11:1; on black 15.73:1; group coverage 7.99:1; selected group coverage 5.82:1; legend against the lightest felt base 5.00:1. These are specific color-pair checks, not a full accessibility audit.
- No warnings or errors appeared in the inspected fixture's browser runtime logs before the fixture restart.

Updated previews: [Desktop](screenshots/roulette-desktop.jpg) · [Mobile](screenshots/roulette-mobile.jpg). Both show overlapping wagers after a deterministic Jackpot. Game rules and server behavior were unchanged.

The earlier verification below records the original implementation; its screenshots and viewport-fit claims describe that earlier design.

## Automated checks actually run

`npm test`: **34 passing tests**, zero failures. Coverage includes:

- All 13 bet targets against all six outcomes, with the task's replacement mapping.
- Ordinary hit, complete miss, full-coverage break-even, net-loss win, and overlapping number/row/column/color returns.
- Exactly one outcome sample and one ordinary transfer; amount independence; both worked transfer examples; uniform-board and low-probability ordinary wins.
- Every additional target removing Jackpot eligibility, inactive zero wagers, internal-probability tie-breaking, missed Jackpot attempts, and forced Shake.
- A sole 10 G Jackpot from 100 G: **240 G returned, +230 G net, 330 G settled**, followed by a fresh permutation.
- 100,000 probability transfers preserving positive, finite values and a sum within `1e-10` of one.
- Invalid wagers, overspending, invalid requests/nicknames, rejected score submission, and session validation.
- SQLite reopening, free repeated Shake, preserved personal best, bankruptcy restart, and retry safety for all action types.
- Concurrent duplicate HTTP Rolls, stale revisions, request-ID reuse with altered data, lost-response recovery, a restarted HTTP server, and two independent sessions.
- Exact Gold beyond `2^53` and SQLite's 64-bit integer range, including 81-digit values, settlement, JSON, storage, and numerical leaderboard ordering.

`npm run build`: passed TypeScript checking and Vite production build. The final client is approximately 23.8 kB JavaScript and 21.6 kB CSS before compression. `git diff --check` passed. Dependency installation reported zero known vulnerabilities.

## Browser checks actually performed

| Check | Observed result |
|---|---|
| Desktop, 1280×800 | Board, amount selector, Roll/Shake, last result, and footer fit; document dimensions 1280×800. |
| Mobile, 390×844 | Responsive board and trophy drawer worked; document dimensions 390×844. |
| All targets | Added 1 G to each target: 13 G draft, 87 G available, 100 G settled. |
| Draft editing | Reduced individual wagers, removed wagers, and cleared the complete draft. |
| Overlapping wagers | Placed and rolled combinations of numbers, rows, columns, and colors. |
| Coverage | Left column selection highlighted exactly 1 and 2. Keyboard focus and selected group highlights were inspected. |
| Overspending | A 999 G addition against 100 G was rejected with an available-Gold message; draft stayed zero. |
| Full coverage | Six 10 G wagers returned 60 G, kept 100 G settled, and visibly moved the rolled number's probability. |
| Shake | Cleared the draft, changed the distribution, and kept settled Gold. |
| Shared leaderboard | Separate cookie sessions at `localhost` and `127.0.0.1` were named Desktop Player and Mobile Player; both clients displayed both records from the same backend. |
| Refresh and actual server restart | Stopped the development server and started the production server using the same SQLite file. Compared browser-visible Gold, all six probabilities, and the last result before and after; all matched. Nicknames and leaderboard also survived. |
| Jackpot fixture | Added Black to a sole marked-number wager and saw eligibility disappear; removed Black, rolled 6, saw 330 G, 240 G return, +230 G net, and a new marker on 5. |
| Keyboard and reduced motion | Used Enter to place/roll wagers and restart. Enabled Reduce motion in Settings; computed die animation was `none`, and settlement completed. |
| Bankruptcy | Lost the fixture's 330 G; restart restored 100 G while the best remained 330 G. |
| Large Gold fixture | Entered and wagered `9,007,199,254,740,993`. An ordinary ×6 hit displayed `54,043,195,528,445,958 G`, with exact `+45,035,996,273,704,965 G` net. |
| Settings | Saved nicknames and toggled sound and reduced motion. |
| Runtime logs | No browser errors in the inspected desktop or mobile sessions after final production reload. |

Browser review caught and fixed excessive desktop height, small mobile group labels, a missing mobile Settings accessible name, group-wager label overlap, and large personal-best text colliding with the board. Large wager drafts open the editing tray so the full integer remains easy to inspect. Expanded trays and unusually long values may require ordinary vertical scrolling.

## Reproduce deterministic UI cases

The optional test server is separate from normal play. It uses an in-memory database, an injected RNG, and `qa.localhost` to isolate its cookie from the normal game. There are no debug endpoints or selectable seeds in the normal backend.

```sh
npm run preview:fixture
```

Open `http://qa.localhost:5174`, wager 10 G only on 6, then Roll. The first Roll hits Jackpot and the deterministic forced reset produces an even board (Tilt 1, hidden target 1). Shake stays locked until a subsequent roll changes the bankroll. Restart this fixture process between deterministic runs.

For the large-integer case, stop the fixture process and run:

```sh
SCENARIO=large npm run preview:fixture
```

Reload the fixture page, wager the displayed `9007199254740993` G on 1, and Roll. The result is `54043195528445958` G. Test fixture scores do not enter the normal leaderboard. Both fixture processes were stopped after verification.

## Screenshots

- [Desktop with overlapping draft wagers](screenshots/desktop.jpg)
- [Mobile with column coverage highlighted](screenshots/mobile.jpg)
- [Shared leaderboard](screenshots/leaderboard.jpg)
- [Jackpot result and fresh board](screenshots/jackpot-desktop.jpg) — captured during fixture QA, before minor final spacing refinements.

## Limits

The sketch attachment was not available; its listed arrangement was followed. Browser verification used desktop Chromium with viewport resizing, not a physical touch device. Safari, Firefox, screen-reader speech, and OS-level reduced-motion emulation were not tested; reduced motion was exercised through the game's own setting. Sound controls and procedural audio calls worked without errors; subjective audio quality was not measured. Network-loss replay and stale-request behavior were exercised in automated HTTP tests rather than by disconnecting a live browser mid-Roll.
