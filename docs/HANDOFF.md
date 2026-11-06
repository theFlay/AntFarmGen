# Project handoff

Read this first in a new session. It records where the project stands, how it got here, and what comes next.

- **Live site:** https://theflay.github.io/AntFarmGen/
- **Repo:** https://github.com/theFlay/AntFarmGen (public, MIT licence, `develop` is the only branch)
- **Original brief:** `docs/Ant_nest_panel_generator_spec.docx`. Its "Design updates after the v1 review" section is the most complete record of design decisions. Its older sections and its "Handoff to Claude Code" section are partly out of date, so trust this file over them.

## What the project is

A static web app that turns panel and ant sizes into laser-ready cut files for all-acrylic ant nests, assembled like a jigsaw. Any part can be 3D printed instead. It has three modes: **Nest panel**, **Test tube rack** and **Outworld**. Everything runs in the browser, with no server or accounts.

## Where things stand

The software is feature complete for now. **Nothing has been cut in real acrylic yet**, so every fit value is a first guess. The next step is physical testing, not more features.

## Next steps

1. Buy 3mm cast clear acrylic, plus red for covers and racks.
2. Check how the Trotec software maps colours (the app defaults to red cut, black engrave).
3. Cut the **Fit test piece** (nest page, under Cut files) and the **Hole test strip** (rack page).
4. Measure and record the results: kerf stack, tab fit, door fit, peg and saddle fit, the smallest clean vent hole and slot, whether the heat groove rim survives handling, how the vial fits, and the size of the angled joint wedge.
5. Set the real values from those results, and change any design that does not fit.
6. Measure a queen's width and height, and the real test tube sizes.

Good first real build: a test tube rack, because it is a much smaller cut than a nest panel.

## Features built

**Nest panel**
- Grid from panel and ant sizes, seeded auto layout, and manual tools: Walls, Starting area, Brood, Join, Diagonal, Jog, Sensor, Pillar, Frost, Water, Ports, Route.
- Tunnel layout: branch out from the brood (default) or a random maze. Route shows the best way between two chambers or ports in green, with alternatives in red.
- Rules that gate export: connected nest, 1 to 3 tunnels per chamber, at most 2 sponges per chamber, no lone triangles, and the starting area must hold a port, a sponge and a brood chamber.
- Flat or upright orientation, which sets the service side: top sheet (flat) or back sheet (upright).
- A door on every tunnel. Doors replace sealed chambers: everything is cut, and the starting area only sets which doors start closed.
- Odd-shaped chambers. Diagonal walls, wall jogs and chamfers sit behind the "Use angled shapes" toggle, off by default, because those joints need cement.
- Fastening: acrylic pegs and wedge keys by default, or bolts (M2 to M8, or a custom hole), or cement only.
- Port plugs, upright feet, sand lips on upright floor tunnels, panel joiners on a fixed grid, whole-panel red cover.
- Sponge pockets, sensor pockets, support pillars, water vial holders (flat), water chambers (upright).
- Frosting for floor, ceiling and walls, as separate engrave files, whole or by chosen cells.
- Heat: floor channel (flat only), and border heat on any of the four borders (flat or upright).
- SVG and optional DXF export, laser bed checks for the Speedy 300 and 360, save and load layouts, and the fit test piece.

**Test tube rack**
- One or two sided, from tube diameter, length, stick-out and count. Tubes lie flat through end plate holes, rest in combs, and stop at a wall.
- Assumes red acrylic. Lift-off lid, plus tube end covers: a cap per tube, a sheath per side, or a hood over everything (for clear racks).
- Optional tube labels: prefix, number, suffix, start number, up to 4 digits. They go beside each hole, on the top face over the last 15mm of the closed end, and on caps or sheaths.
- A 3 x 3 grid of free text on the top face, and a hole test strip.

**Outworld**
- A tabbed box from inside length, width and height. It takes sheet thickness, kerf, sheet size and port spacing from the Nest panel page, so the two always match.
- Lid, picked in the app: lift-off (sits on the wall tabs), sliding (rests on the side walls, comes out through a slot in the front wall, stops at the port wall), or open top with an inward lip and a barrier coating.
- Vent hole grid in the lid. Warns over 2mm.
- Joins the nest by tube holes in the port wall, or by docking: the port wall butts onto the nest edge with a window lined up with one port.
- Tube dock: a plate with a tube hole that fixes over a nest port, one per tube. Bulkhead rings for a bought tub.
- Flat nests clamp with two bars that lie on the nest's top face. A pin drops through each bar into the nest joining slot either side of the port, and a short wedge key pulls the wall tight to the nest edge. Checks list which nest ports have a joining slot on both sides.
- Upright nests stand beside the outworld and dock at a port on their left or right edge, the lowest by default or a chosen one. Two edge clips, above and below the port, pass through slits in the wall and grip the front and back of the nest. The clips are a set amount narrower than the nest (grip, default 0.2mm). The window sits at the port's height above the shelf, allowing for the feet. Upright tube docks use the same clips, so they need no joining slots.
- A tube hole test strip.

**3D printing (all three modes)**
- Every part type has a choice of Acrylic or 3D print. The nest page holds the printer size (width, depth, height) and the laser cutting area (Speedy 300, Speedy 360 or a custom size), and the rack and outworld use the same values.
- Printed parts come out as binary STL files, one per part type, with the number to print in the file name. They use the same outline and holes as the cut part, without the kerf offset, so they fit the same slots.
- Parts that print better as one piece: the frame (one solid per section instead of a stack of layers), port plugs (one solid, no pin), vial holders (one piece with their posts), heat channel layers, rack caps, sheaths and the hood, printed outworld tube docks (with a 10mm socket for the tube), printed outworld tube ports (a sleeve, and the wall hole grows to fit it) and printed edge clips (5mm thick).
- Wall strips are all different, so they are packed onto print plates the size of the printer.
- Checks block export if a printed part is too big for the printer, or a cut part or sheet is too big for the laser. A panel bigger than the laser is allowed once every sheet-sized part is printed.

## Design decisions worth remembering

- **Door type A:** a solid T-headed strip fills the tunnel notch. Pulled up, its bottom sits flush with the inside of the sheet, so the slot stays filled. A saddle slides on over the head and holds it open. Everything below the sheet must stay solid, because any hole there is a window between chambers. Earlier foot, hook and key versions were dropped for this reason.
- **Tunnels** are notched from the service side, leaving a 3mm sill on the far side.
- **Junctions:** horizontal walls run through, vertical walls butt against them. Angled strips are trimmed until they just touch what they meet, which leaves small V-shaped wedges for cement.
- **Jogs:** vertical walls use 3 strips. Horizontal walls step out and back using 5, to keep both ends on the grid. Only solid walls jog, and the minimum is 6mm.
- **Diagonals** hold no tunnels or sponges.
- **Border heat:** the bottom frame layer is not cut at the ports, so the cable passes under them and ports sit at tunnel height. It needs a border of 20mm or more, and a 3mm rim stays inside the groove.
- **Sensor pockets** open through the service sheet, not always the back.
- **Pillars** are short tabbed posts, not rods, to stay all acrylic.
- **Saddles** stay on upright nests, held by friction only. Add a positive lock if the fit test shows it is needed.
- **Frame layers** only build the outer border, as stacked rings. Inner walls are already single strips at 90 degrees to the sheets.
- **Branching tunnels:** each chamber joins its least busy neighbour one step closer to the brood. A tree is already the fewest doors that can connect every chamber, so only loops add more. Loops go between chambers that are far apart along the tunnels.
- **Starting area:** it starts at the brood chamber, which is placed where the area grows from and given its own port where possible, then takes the nearest port along the tunnels. Starting from a nearby port chamber instead made it far too big. Rules warn if it ends up bigger than asked.
- **Sponges** favour one side so the ants get a damp end and a dry end, and are kept apart where there is room.
- **Outworld floor** sits 3mm up the walls so the slots below it keep a rim. That puts it 3mm above the bottom of a nest port when docked, a small step up for the ants.
- **Printed solids** are made with `earcut`, triangulated at an odd angle. Square layouts triangulated straight on sometimes bridged a hole along another edge and left a crack in the solid. Tests check every STL is closed.
- **Outworld lids** reach 4mm past the end walls, so no tab slot runs out to the lid's edge.
- **Edge clips** rely on grip only, with no catch. Small holes in the nest sheets for a snap catch were left out because they change the nest.
- **Outworld docking** on flat nests reuses the nest joining slots, which sit half a port spacing either side of each port. No new holes are needed in the nest.
- **Panel joiners** stand about 4.7mm proud, so a cover passes over them. Rules warn if the cover gap is too low.

## Not built

- A custom Exo Terra lid (waiting on a tube size).
- A printed fit test piece. Printed parts have no fit tuning of their own yet.
- Splitting a printed part that is too big for the printer. For now it must be set to acrylic.
- Engraved text on printed parts, and a snap catch for the edge clips.
- A ramp for an upright nest's port, which can be well above the outworld floor.
- More door types. `src/doors.js` is set up for them.
- An outer wall made of single strips instead of stacked frame layers. The owner leans towards strips with small stacked spacer blocks at each peg or bolt, as an option and the default, with stacked layers kept for border heat. Still to agree: how ports and plugs work through a 3mm wall.
- A long corridor chamber (highway). It would need an exception to the 3 tunnel limit, and pillars to stop the sheets bowing.
- Covers per section or per chamber.
- Comments shown on the page itself. Feedback goes through GitHub Issues and Discussions.

## Least proven

The angled joints, the saddle fit on upright nests, the heat groove rim, water chamber sealing, the outworld dock clamp, the edge clip grip, the sliding lid, and every printed part's fit. Peg, key, plug, lip, dock bar, dock pin, dock key, clip and sleeve sizes are first guesses.

## Working on it

```
npm install
npx playwright install chromium
npm test          # unit tests, build, browser tests
npm run visual    # renders the preview and cut files to tests/out
node tests/live.mjs "text on the page"   # checks the live site
```

- Edit `src/`, then run `npm run build`. Never edit `index.html` by hand.
- Every push to `develop` is tested by `.github/workflows/pages.yml`, and only goes live if the tests pass.
- Current state: 187 unit tests plus the browser tests, all passing.
- After a change, look at rendered output as well as the tests. Several real bugs were only found that way.

## Project rules

- The repo is public. Never commit passwords, keys, personal details, the names of places or organisations, or links to Claude sessions. Leave out any `Claude-Session` commit line.
- The goal is all acrylic: cut, then assemble like a jigsaw. Cement and bolts stay optional.
- Lay out options and tradeoffs before changing the physical design. The project owner makes those calls.
- Never use em dashes in anything written for the project owner.
- Layout files are untrusted input. Everything loaded goes through `src/sanitize.js`.
