# Credits

All die artwork, inline SVG icons, board styling, favicon, and procedural audio were created for this prototype. No external artwork, fonts, music, or sound recordings are bundled or fetched at runtime.

Design reference: [Casino.org’s roulette table layout](https://www.casino.org/blog/the-roulette-table-explained/) informed the green felt, connected light grid, red/black number fields, outside group bets, and bet placement. The current design uses original felt and wood styling, stacked gold coins, and a six-faced CSS die. The Sixfold layout and all visuals are original CSS/SVG; no reference images are included.

Layout and interaction reference: [Balatro gameplay screenshots on PlayStation](https://www.playstation.com/en-us/games/balatro/) informed the left information rail, lower action controls, and emphasis on localized reward feedback. No Balatro assets, typefaces, or code are included.

System fonts: Helvetica Neue / Arial and Georgia, supplied by the operating system.

Software dependencies and their licenses are recorded in `package-lock.json` and installed packages: Vite (MIT), TypeScript (Apache-2.0), tsx (MIT), and Playwright (Apache-2.0). Node.js is a development/test tool. The production game uses browser APIs and static HTML, JavaScript, CSS, and SVG, with no database or production Node dependency.

The generated browser bundle includes Vite’s module-preload helper. Its existing MIT copyright and permission notice is copied from the installed Vite license into `public/third-party-notices.txt`, included in the static output, and linked from About. This notice does not license Sixfold itself.

Documentation screenshots are captures of Sixfold itself. Reference images and third-party artwork are not bundled into the game. The About page carries the same design-reference attribution.

No project license exists in this checkout or the reviewed Git history. Making the source repository public and granting an open-source license are separate choices. No license has been added by this migration; existing attribution and dependency licenses are preserved.
