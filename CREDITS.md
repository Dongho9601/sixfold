# Credits

All die artwork, inline SVG icons, board styling, favicon, and procedural audio were created for this prototype. No external artwork, fonts, music, or sound recordings are bundled or fetched at runtime.

Design reference: [Casino.org’s roulette table layout](https://www.casino.org/blog/the-roulette-table-explained/) informed the green felt, connected light grid, red/black number fields, outside group bets, and bet placement. The current design uses original felt and wood styling, stacked gold coins, and a six-faced CSS die. The Sixfold layout and all visuals are original CSS/SVG; no reference images are included.

Layout and interaction reference: [Balatro gameplay screenshots on PlayStation](https://www.playstation.com/en-us/games/balatro/) informed the left information rail, lower action controls, and emphasis on localized reward feedback. No Balatro assets, typefaces, or code are included.

System fonts: Helvetica Neue / Arial and Georgia, supplied by the operating system.

Software dependencies and their license files are recorded in `package-lock.json` and installed packages. Main dependencies: Vite (MIT), TypeScript (Apache-2.0), tsx (MIT), and Node.js with its bundled SQLite. The project uses Node's built-in SQLite support rather than a downloaded database service.

## Public release provenance review — October 10, 2026

The repository contains code-defined CSS die artwork, inline SVG icons, procedural Web Audio, and `public/favicon.svg`; no external runtime fonts, recordings, images, or asset downloads were found. The reference screenshots are documentation material, outside the production static allowlist. `public/about.html` presents the same factual credits and links to the design references.

The existing original-work attribution above is a repository claim, not an independently verified chain of ownership or a publication license. No existing project license or ownership record has been provided for this review. Rights to publish Sixfold’s code and bundled CSS/SVG/audio remain unconfirmed; owner confirmation is required before public launch. This records an unresolved question, not a denial of permission or a finding that supporting records cannot exist. No project license or contact details have been invented. Retain dependency license files in the runtime distribution and review any required public notices for generated/bundled code; this audit makes no legal-compliance assurance. Playwright is also Apache-2.0 and remains a development/test dependency. The locked package licenses were checked against installed package metadata; no dependency versions were changed in this preparation.
