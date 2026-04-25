# Equalizer Layout Guidelines

Use these rules for future EQ layout changes.

## Source Of Truth

There are only two places to change EQ layout now:

1. `src/index.css`
2. `src/renderer/plot.ts`

Do not tune EQ spacing by changing random margins or by remeasuring the rendered SVG.

## Panel Spacing

The EQ panel stack is controlled by CSS tokens on `.apo-plot-stack` in `src/index.css`.

Primary tokens:

- `--apo-section-gap`

These control:

- hover label to plot viewport
- plot viewport to x-axis label row
- x-axis label row to divider
- divider to EQ controls

If the divider/text/settings spacing looks wrong, change these tokens first.

## Plot Geometry

The EQ plot uses a dedicated geometry config in `src/renderer/plot.ts`:

- `EQ_PLOT_FRAME_SPACING`

This controls the SVG gutters only:

- `outerHorizontalPadding`
- `outerTopPadding`
- `outerBottomPadding`
- `yTickGap`
- `xTickGap`
- `yAxisLabelGap`
- `xAxisLabelGap`

If the plot area itself is too wide/narrow or the y-axis label/ticks are too tight/loose, change this object.

Do not change the measurement plot by accident when tuning EQ. The measurement plot uses `DEFAULT_PLOT_FRAME_SPACING` and the EQ plot uses `EQ_PLOT_FRAME_SPACING`.

## Viewport Rule

The EQ plot is sized from `#apoPlotViewport` only.

That means:

- divider changes should not resize the SVG directly
- preamp/settings changes should not resize the SVG directly
- plot interactions should reuse the render geometry instead of recomputing it from the DOM

If sizing becomes unstable again, check that the viewport remains the only measurement source.

## X-Axis Label Rule

The EQ x-axis label is an HTML row, not an SVG label.

That is intentional.

Reason:

- CSS controls its spacing more predictably than SVG text metrics
- small layout changes are easier and safer

If the x-axis label spacing looks wrong, change the CSS tokens on `.apo-plot-stack`, not the SVG geometry.

## Safe Change Order

When adjusting EQ layout, use this order:

1. Change `.apo-plot-stack` spacing tokens in CSS.
2. If the plot box itself still needs adjustment, change `EQ_PLOT_FRAME_SPACING`.
3. Recheck hover/drag alignment.
4. Run `npm run lint`.

## What Not To Do

Avoid:

- adding ad hoc margins on individual form fields
- reading `apoPlotCard.clientHeight` as the source of truth for layout
- recomputing interaction geometry from the SVG `viewBox`
- changing shared default plot constants when you only mean to tune EQ
