# Ant nest panel generator

Enter panel and ant sizes, then laser-cut the files it gives you and assemble the nest like a jigsaw. Everything is acrylic. Cement and bolts are optional.

Use it at [theflay.github.io/AntFarmGen](https://theflay.github.io/AntFarmGen/), or open `index.html` from a copy of this repo. It is one self-contained file.

Ideas and bug reports are welcome in [Issues](https://github.com/theFlay/AntFarmGen/issues/new/choose), and chat is in [Discussions](https://github.com/theFlay/AntFarmGen/discussions).

This repo is public: see [SECURITY.md](SECURITY.md). Pushes to `develop` publish the committed `index.html`, so run `npm test` before pushing.

## Licence

Open source under the [MIT licence](LICENSE). Use it, change it and share it freely.

## Working on it

```
npm install
npx playwright install chromium
npm test          # unit tests, build, then browser tests
npm run visual    # renders the preview and every cut file to tests/out
```

Edit the code in `src/`, then run `npm run build` to rebuild `index.html`. Do not edit `index.html` directly.

| File | What it does |
|---|---|
| `src/params.js` | The settings form |
| `src/grid.js` | Grid from panel and ant sizes |
| `src/layout.js` | Wall states, joined cells, diagonals, chambers |
| `src/generate.js` | Seeded auto layout, starting area, sponges |
| `src/geometry.js` | Strips, angled strips, tabs, doors, ports, frame, fasteners, sockets |
| `src/doors.js` | Door types. Add a new type here |
| `src/hardware.js` | Pegs, keys, plugs, cover legs, feet |
| `src/rules.js` | Layout rules that gate export |
| `src/export.js` | SVG cut files and the fit test piece |
| `src/draw.js` | Preview and assembly map |
| `src/app.js` | UI, undo, save and load |

The design brief is `docs/Ant_nest_panel_generator_spec.docx`. The door drawing is `docs/door-design-v3.png`, made by `node tests/door-drawing.mjs`.

## Before trusting any cut

Nothing here has been cut yet. Cut the fit test piece first (the button is under Export), then set kerf, slot clearance and door fit from it. Also check how your laser software maps cut and engrave colours.
