---
name: Nimstead Pulse
description: The CVE landscape in plain sight. Ink on paper, one crimson seal for confirmed exploitation.
colors:
  paper: "light-dark(#FFFFFF, #111111)"
  concrete: "light-dark(#EDEDEB, #1E1E1E)"
  ink: "light-dark(#111111, #F2F2F0)"
  ink-2: "light-dark(#3A3A38, #CFCFCC)"
  muted: "light-dark(#5C5C5C, #A3A3A0)"
  line: "light-dark(#E4E4E2, #2C2C2C)"
  rule-strong: "light-dark(#111111, #F2F2F0)"
  line-strong: "light-dark(#8A8A87, #6E6E6C)"
  volume: "light-dark(#111111, #F2F2F0)"
  volume-soft: "light-dark(#8A8A87, #6E6E6C)"
  exploited: "light-dark(#B0122C, #F4A3AE)"
  exploited-soft: "color-mix(in srgb, light-dark(#B0122C, #F4A3AE) 58%, light-dark(#FFFFFF, #111111))"
  blush: "light-dark(#F8E3E6, #3A1016)"
  wine: "light-dark(#8E0E23, #F4A3AE)"
  seal: "#B0122C"
  sev-critical: "light-dark(#111111, #F2F2F0)"
  sev-high: "light-dark(#5C5C5C, #A3A3A0)"
  sev-medium: "light-dark(#A3A3A0, #6E6E6C)"
  sev-low: "light-dark(#D6D6D3, #3A3A3A)"
  sev-unscored: "light-dark(#EDEDEB, #262626)"
  band: "light-dark(#111111, #0A0A0A)"
  band-fg: "#F2F2F0"
  ash: "#BDBDBD"
  band-line: "#2C2C2C"
  band-crimson: "#F4A3AE"
  disabled: "#8A8A8A"
typography:
  display:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5.2vw, 4.75rem)"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.05em"
  numeral:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3rem, 6.4vw, 5.75rem)"
    fontWeight: 800
    lineHeight: 0.86
    letterSpacing: "-0.055em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 5vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.05em"
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  finding:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 2vw, 1.5rem)"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  lede:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  summary:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.55
  ui:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.4
  data:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  small:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
  meta:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
  mono:
    fontFamily: "Geist Mono Variable, ui-monospace, Cascadia Mono, monospace"
    fontSize: "0.875em"
    fontWeight: 500
    letterSpacing: "-0.01em"
rounded:
  none: "0px"
spacing:
  gutter: "clamp(16px, 3vw, 40px)"
  wrap: "1320px"
  control: "2.75rem"
  row: "0.6rem"
  figure-gap: "clamp(1.5rem, 3vw, 3rem)"
  band-pad: "clamp(1.75rem, 3.5vw, 2.75rem)"
  section: "3.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.95rem 1.35rem"
  button-primary-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.5rem 0.85rem"
  button-secondary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "0.4rem 0.8rem"
  tool-button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.muted}"
    rounded: "{rounded.none}"
    height: "{spacing.control}"
  chip:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.none}"
    padding: "0.2em 0.6em"
  chip-exploited:
    backgroundColor: "{colors.blush}"
    textColor: "{colors.wine}"
    rounded: "{rounded.none}"
    padding: "0.2em 0.6em"
  chip-exploited-solid:
    backgroundColor: "{colors.seal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.none}"
    padding: "0.2em 0.6em"
  input-textarea:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.none}"
    padding: "0.8rem 0.9rem"
  ink-band:
    backgroundColor: "{colors.band}"
    textColor: "{colors.band-fg}"
    padding: "{spacing.band-pad} 0"
  topbar:
    backgroundColor: "{colors.band}"
    textColor: "{colors.ash}"
    padding: "0.6rem 0"
---

# Design System: Nimstead Pulse

## Overview

**Creative North Star: "Plain Sight"**

Nimstead Pulse is the Nimstead "Plain Sight" brand applied to a dense, chart-led reading surface. Everything is ink on paper: type, bars, lines and rules are Ink; the ground is Paper; fields, tracks and hover washes are Concrete. One colour carries meaning, and only one meaning: crimson marks confirmed exploitation (a CVE listed in CISA KEV). The page reads like a printed bulletin issued by a software company: an Ink topbar with an issue line, a heavy Archivo headline computed from the data, a full-bleed Ink band of vital signs, then numbered figures that each open on a 2px Ink rule and cite numbered sources.

Density is high but orderly. Corners are square everywhere. Depth comes from inversion (full-width Ink bands), not from cards or shadows. Status is always written as a word; colour reinforces it, never replaces it. The system rejects the dark SOC dashboard: glowing KPI tiles, gradients, threat-level hues and red counters.

The app follows the brand guide and departs from it in a few deliberate places, each recorded below with its reason: crimson is narrowed to exploitation only, figure heads use muted ink instead of crimson section numbers, the wrap is wider for chart density, and the dark theme lifts crimson to a readable tint.

**Key Characteristics:**
- Paper ground, Ink type and data; reported volume is Ink and severity is an ink ramp.
- Crimson only where exploitation is confirmed; the Seal Crimson fill is reserved for the seal square and the solid "Exploited · in KEV" chip.
- Zero radius; 1px Line rows and 2px Ink rules open every figure and list.
- Archivo 800, tightly tracked, for display and numerals over plain Archivo body; Geist Mono only for literal identifiers.
- Depth only by inversion: the Ink topbar, the Pulse band and the closing band.
- Motion is ease-out-expo with no overshoot; reduced motion collapses all of it.

## Colors

An achromatic ink-and-paper palette with a single semantic crimson. Every themed token carries a light and a dark value; the dark theme is set by `prefers-color-scheme` unless the user forces a theme with the toggle.

### Primary
- **Exploited Crimson** (exploited): text, strokes, bars, legend swatches and the headline word "exploited" wherever a datum means confirmed exploitation. Seal Crimson in light; in dark it lifts to the brand's readable pink, because Seal Crimson falls below 3:1 on the dark Paper.
- **Exploited Soft** (exploited-soft): a lighter step of whichever crimson the theme uses, mixed toward Paper rather than defined as a new hex. Used for the second exploited series ("Other exploitation") beside full crimson ("Known ransomware use"); stays at 3:1 or better on Paper in both themes. The days-to-KEV lag ramp in Exploitation uses further color-mix steps of the same pair.
- **Seal Crimson** (seal): fill only, in both themes. The wordmark seal square, the seal square beside the newly-exploited numeral in the Pulse band, and the solid "Exploited · in KEV" chip with white text. Never used as text or a thin stroke on a dark ground.
- **Band Crimson** (band-crimson): the readable crimson on the always-dark Ink band, used for the exploited trace and its end marker in the Pulse band.

### Secondary
- **Blush** (blush) and **Wine** (wine): the readable pair for exploited chips (Wine text on Blush, led by a crimson square), e.g. "Ransomware use known". The brand's Fix-now badge, narrowed here to exploitation.

### Neutral
- **Paper** (paper): page ground, button and dialog surfaces.
- **Concrete** (concrete): field fills, meter tracks, hover washes on rows, tabs and controls, highlighted notes.
- **Ink** (ink): body type, headings, focus rings, primary buttons, active tabs and presets.
- **Ink 2** (ink-2): secondary copy such as legends, chip text and descriptions.
- **Muted / Graphite** (muted): supporting copy, labels, table headers, axis text, figure numbers.
- **Line** (line): 1px row dividers and hairlines.
- **Rule Strong** (rule-strong): the 2px Ink rule that opens figures, lists, tables, the notes and the sheet header.
- **Line Strong** (line-strong): neutral chip borders, scrollbars, close button border, hovered tab underline.
- **Volume / Volume Soft** (volume, volume-soft): reported CVE volume is Ink; the soft step is the de-emphasised comparison series.
- **Severity ramp** (sev-critical through sev-unscored): Critical is Ink, then Graphite, a mid grey, a light grey and Concrete for unscored. The ramp inverts sensibly in dark.
- **Band, Band Foreground, Ash, Band Line** (band, band-fg, ash, band-line): the Ink band family. Band is Ink in light and one step below the page in dark; Ash carries secondary text on bands; Band Line divides band columns and draws the band's edge lines in dark.

- **Brand optical sizes:** the compact masthead uses 1.4rem and the footer endorsement 1.375rem to retain the lockup proportions at their different reading sizes.
- **Slide export:** a fixed 1280 × 720 canvas including the outer gutter, rendered at 2×. Archivo uses 40px for the finding, 48px for vital signs, 18px for the proof caption, 14px for explanations, 12–13px for compact labels and 11px for provenance. These artifact sizes stay independent of viewport and browser text zoom.

### Named Rules
**The One Meaning Rule.** Crimson means confirmed exploitation and nothing else. Not focus, not errors, not emphasis, not "critical" severity, not brand decoration beyond the seal square. If a crimson mark cannot be read as "in KEV", it is wrong.

**The Fill-Only Seal Rule.** Seal Crimson is a fill. Wherever crimson must be read as text, a stroke or a small mark on a dark ground, use the lifted crimson (Exploited in dark, Band Crimson on the Ink band).

**The Ink Volume Rule.** Reported volume is Ink and severity is an ink ramp, never a hue. A chart that needs a second non-exploited series uses Volume Soft or the severity greys.

## Typography

**Display Font:** Archivo Variable (with ui-sans-serif, system-ui)
**Body Font:** Archivo Variable (with ui-sans-serif, system-ui)
**Mono Font:** Geist Mono Variable (with ui-monospace, Cascadia Mono), for literal identifiers only

**Character:** one grotesque doing two jobs. Archivo at 800 with tight negative tracking gives the headline and numerals the weight of a printed masthead; the same family at 400 keeps the body plain. Tabular figures are on by default across the page.

### Hierarchy
- **Display** (800, clamp(2.25rem, 5.2vw, 4.75rem), 0.94, -0.05em): the Overview headline sentence computed from the data, max 19ch.
- **Numeral** (800, clamp(3rem, 6.4vw, 5.75rem), 0.86, -0.055em): the three Pulse band vital signs. Smaller stat numerals in This week and Your CVEs use the same weight and tracking at about 2-3.2rem.
- **Headline** (800, clamp(2.2rem, 5vw, 3.75rem), 0.95, -0.05em): view titles on every tab; the CVE ID in the case sheet uses the same voice at up to 2.6rem.
- **Title** (700, 1.25rem, 1.25, -0.02em): figure captions, list heads such as "Latest confirmed exploitation", the KEV name in the sheet.
- **Lede** (400, 1.125rem, 1.5): view introductions in Muted, max 62ch.
- **Body** (400, 1rem, 1.55): running text and table cells (tables at 0.875rem).
- **Summary** (700, 1.0625rem, 1.55): snapshot change-summary headings; a modest step above body text inside the detailed handover.
- **Small** (400, 0.8125rem, 1.55): figure notes, legends, sources and notes, max 80ch.
- **Label** (600, 0.6875rem, 0.12em, uppercase, Muted or Ash on bands): table headers, definition terms, field labels, the names over stat numerals and Pulse signs, and small section heads such as "Sources and notes" and "Timeline". The topbar issue line uses the same tracking at 500.
- **Mono** (500, 0.875em, -0.01em): CVE IDs, kbd hints and the CVE-list textarea (400, 0.875rem, 1.6). Nowhere else.

### Named Rules
**The Literal Mono Rule.** Geist Mono is reserved for strings a reader might type or paste: CVE IDs, keyboard shortcuts and the CVE-list field. Labels, numbers and captions stay in Archivo.

**The Label Is Not An Eyebrow Rule.** The uppercase Label names a value, column, field or small section; it is never stacked above a larger heading as a decorative eyebrow.

## Layout

Content sits in a single wrap of max 1320px with a fluid gutter of clamp(16px, 3vw, 40px). The brand wrap is 1180px; the app widens it for chart density so monthly bars across five or more years stay legible. Ink bands (topbar, Pulse band, closing band) run full bleed outside the wrap.

The Overview opens on a 7:4 grid: the display sentence left, three Summary answers (Volume, Speed, So what) right, each under a 2px rule. Below 1100px the answers go to a three-column row; below 900px everything stacks to one column, including the Pulse band, whose columns switch from left dividers to top dividers. Paired figures use a two-column grid with a gap of clamp(1.5rem, 3vw, 3rem), stacking at 900px. Figure captions stack their actions below 560px.

The tab nav uses Paper with 1px Line borders and wraps whenever its labels need room, including at enlarged text sizes. Only a single row is sticky; multiple rows scroll with the page. Under 640px the nav is always static, and the search and theme controls collapse to 44px square buttons.

Rhythm: figures pad 1rem top, 1.75rem bottom; table rows pad 0.6rem; view heads pad clamp(2rem, 4vw, 3.25rem) top; the notes block opens 3.5rem below the last figure. Every interactive control is at least 2.75rem (44px) tall.

The period defaults to the 5Y preset (the latest 60 months). Presets (12M, 3Y, 5Y, 10Y, All) always mean "the latest n months"; anything the brush makes is a custom range.

## Elevation & Depth

Flat by default. Surfaces do not lift; hierarchy comes from rules, weight and inversion. The one structural depth device is the full-width Ink band. Transient overlays (chart tooltips, the search dialog and the CVE case sheet) carry soft ambient shadows over a 50% Ink backdrop; these are the only shadows in the build.

### Shadow Vocabulary
- **Tooltip** (`box-shadow: 0 10px 28px rgb(0 0 0 / 0.14)`): chart hover and keyboard tooltips.
- **Sheet** (`box-shadow: -20px 0 50px rgb(0 0 0 / 0.18)`): the right-hand CVE case sheet.
- **Dialog** (`box-shadow: 0 30px 80px rgb(0 0 0 / 0.28)`): the search dialog.

### Named Rules
**The Inversion Rule.** To make something feel weightier, invert it to an Ink band; never raise it on a card or shadow. Shadows belong only to transient overlays.

**The Full-Bleed Without Overflow Rule.** Ink bands that sit inside the wrap reach the viewport edges through `border-image ... fill 0 // 0 100vw`, never through negative margins or 100vw widths, so they never cause horizontal scroll.

## Shapes

Square everywhere (0px radius): buttons, chips, fields, dialogs, tooltips, bars, meters, the seal and the brush handles. Borders are the form language: 2px Ink for controls and the rule that opens every figure, list and table; 1px Line for row dividers; 1px Line Strong for neutral chips and the close button. Line caps on chart traces are square. The seal is a small solid square set at the top right of a word or numeral.

## Components

### Buttons
Blunt, bordered, ink-on-paper; hover inverts.
- **Shape:** square (0px), 2px Ink border.
- **Primary:** Ink fill, Paper text, 700 0.9375rem, padding 0.95rem 1.35rem (the "Everything that changed this week" call to action; the primary action on Your CVEs). Hover inverts to Paper with Ink text.
- **Secondary:** Paper fill, Ink text, 700 0.8125rem, padding 0.5rem 0.85rem (figure "Copy PNG" and "CSV"). Hover inverts to Ink. Active nudges down 1px.
- **Tool buttons:** the header search and theme toggle are 2.75rem tall with a 2px Ink border, Muted text, Concrete on hover.
- **Disabled:** Concrete fill and border, grey text, default cursor.
- **Focus:** a 2px Ink outline offset 2px, everywhere. Never crimson.

### Segmented presets
The period presets sit in one 2px Ink frame divided by 2px Ink lines, 700 0.75rem. The pressed preset is Ink with Paper text; others are Paper with Concrete hover.

### Chips
- **Neutral:** 700 0.6875rem uppercase, 0.04em tracking, 1px Line Strong border, Ink 2 text. A severity chip borders itself in its severity grey and leads with a swatch.
- **Exploited:** Wine on Blush with no border, led by a 7px crimson square ("Ransomware use known").
- **Exploited solid:** Seal Crimson fill, white text, white square ("Exploited · in KEV"). One per CVE, in the case sheet and lists.

### Figures
Every chart is a numbered figure. A 2px Ink rule opens it; the caption reads "Figure N." in 800 Muted followed by the title in 700 Ink, with an optional Muted subline. The brand uses crimson section numbers; here the number is Muted because notes cross-reference figures by number and crimson is reserved. Copy PNG and CSV buttons sit right. Legends use 0.75em square swatches with a word for every series; partial months are hatched. Notes below are Small Muted text.

### Tables and lists
Label-styled headers over a 2px Ink rule, 1px Line row dividers, Concrete row hover, numerals right-aligned and tabular. CVE IDs are Mono and underlined as links.

### Inputs / Fields
- **Search:** a dialog field with no box, only a 1px Line bottom border, 500 1.125rem; the active result inverts to Ink.
- **CVE list textarea:** 1px Ink border, Paper fill, Mono 0.875rem/1.6; while a file is dragged over it the border goes to 2px and the fill to Concrete.
- **Caret** is Ink.

### Navigation
An Ink topbar carries the issue line (series name, Vol., No., issued date; sources at right) in 500 0.6875rem uppercase with 0.12em tracking in Ash. The masthead holds the "Nimstead Pulse" lockup ("Nimstead" 800, "Pulse" 400, tracked -0.045em, no seal: only the company wordmark carries it) with search and theme at right. The closing band uses the endorsed lockup instead: "Pulse" 800 at display size over "a Nimstead■ product", the seal on Nimstead. The sticky tab nav sets tabs at 500 0.9375rem in Muted; hover shows a 2px Line Strong underline, the current tab is Ink 700 with a 2px Ink underline.

### Pulse band (signature)
The Overview's full-bleed Ink band of three vital signs: CVEs published, newly exploited (KEV) and median days to KEV for the latest month. Each column has a Label in Ash, a huge Numeral in Band Foreground (the exploited numeral carries the Seal square), a comparison line in Ash and a 44px 24-month trace drawn in Band Foreground (Band Crimson for the exploited trace) with a square end marker. Columns divide with 1px Band Line. Traces draw on once on entry over 1.4s ease-out-expo.

### Period brush
A full-width monthly histogram under Figure 1b with a 2px Ink window and 8x24px Ink grips. Out-of-range months fade under a Paper wash; bars inside the window are Volume. Dragging, flicking and resizing ride critically damped springs (a flick earns slight bounce, a placed drop settles flat); arrow keys step by month, Shift by year. Changing the window rewrites the headline, the summary and every figure.

### View finding
Every analysis view opens with one computed sentence (`.view-head .insight`, the finding step, key numbers in 800) beside its title on screens ≥1100px: the story before the chart. It is computed from the selected period, never written by hand.

### Capped bars
KEV bar charts pass `cap` to Bars: the axis stops at 1.4× the 90th percentile, so the KEV launch backlog of 2021–22 cannot flatten recent months. A clipped bar shows a Paper break and its value; on bars narrower than 16px only the tallest is labelled. Captions say so.

### Example list
"Your CVEs" renders a fixed example list automatically on its first visit in a page load, labelled as a worked example; after Clear the view stays empty and offers "Show the example again". It is fetched exactly like a pasted list, so it adds no request that could reveal anything.

### Start here (This week)
A ranked, single-column list under the stats: every KEV item overdue or due today, then everything newly exploited, then the rest of the KEV deadlines in the window, then the 2 fresh CVEs with the highest EPSS ("Likely target" at EPSS 10% or more, otherwise "Top EPSS this week"). The first 7 rows show, then a linklike "Show all N" toggle. Each row is number, CVE ID (fixed width), reason chip, name with a facts line (date · severity · EPSS) and the deadline in words; crimson chips only for KEV rows. "Copy as text" writes a plain brief of the full list to the clipboard and nothing else; CSV downloads the full list.

### Pulse band lines
Each figure's line compares with its previous 12-month average. The published figure says "The highest month on record." when true and otherwise gives no multiple, so the headline's percentage is the only growth rate on the first screen.

### Headline proof chart
Overview Figure 1 plots rolling 12-month CVEs (ink) against KEV listings (crimson) as plain counts on separate scales, starting after the KEV launch backfill. "Copy summary for slides" renders the headline, comparison basis, three vital signs, proof chart and provenance on a dedicated landscape canvas. Short or partial periods explain why the annual comparison is unavailable.

### CVE case sheet
A right-hand dialog, max 520px, with a 2px Ink left edge, sliding in on 320ms ease-out-expo and out faster. The CVE ID is set in Headline voice; chips, a two-column facts grid under 1px rules, an EPSS meter (Ink on Concrete) and a timeline on a 2px Line rail where the KEV step is crimson.

## Do's and Don'ts

### Do:
- **Do** use crimson only for data that means confirmed exploitation, and pair it with a word ("Exploited", "in KEV", "Added to KEV").
- **Do** use Seal Crimson only as a fill: the seal square and the solid "Exploited · in KEV" chip with white text.
- **Do** use the lifted crimson for crimson text, strokes and marks in dark and on the Ink band.
- **Do** derive lighter crimson steps with color-mix toward Paper rather than adding new hexes.
- **Do** draw reported volume in Ink and severity as the ink ramp.
- **Do** open every figure, list and table with a 2px Ink rule and number every figure "Figure N." in Muted.
- **Do** keep every corner square (0px) and every control at least 44px tall.
- **Do** make heavy moments with full-bleed Ink bands built with border-image so they never overflow.
- **Do** keep focus rings 2px Ink, offset 2px.
- **Do** animate with ease-out-expo (cubic-bezier(0.16, 1, 0.3, 1)) and no overshoot, and collapse all motion under reduced-motion.

### Don't:
- **Don't** use crimson for focus, errors, emphasis, critical severity or decoration.
- **Don't** colour severity with hues (no red/orange/yellow/green scale).
- **Don't** set crimson text in Seal Crimson on a dark ground; it falls below 3:1.
- **Don't** use Geist Mono for labels, numbers or captions; it is for CVE IDs, kbd and the CVE-list field only.
- **Don't** round corners, add gradients, glows or card shadows; shadows belong only to tooltips, the search dialog and the sheet.
- **Don't** stack an uppercase Label above a heading as an eyebrow.
- **Don't** build a dark SOC dashboard of glowing KPI tiles and threat counters.
