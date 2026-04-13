import {
  DEFAULT_END_FREQUENCY,
  DEFAULT_START_FREQUENCY,
} from './constants';
import { getMeasurementPointsForDisplay } from './measurements';
import type {
  ApoEqMode,
  ApoFilter,
  LoadedMeasurement,
  MeasurementPoint,
  MeasurementSmoothingMode,
  ReferenceCurve,
  ResponsePlotGeometry,
} from './types';
import {
  clamp,
  escapeHtml,
  findClosestPoint,
  formatDbLabel,
  formatFrequencyDetailed,
  formatFrequencyLabel,
} from './utils';

const EQ_GRAPH_FREQUENCIES = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const COMPACT_GRAPH_FREQUENCIES = [20, 100, 1000, 10000, 20000];

type PlotLabelSizing = {
  axisTextSize: number;
  axisLabelSize: number;
  yTickCount: number;
  xTicks: number[];
};

export const DEFAULT_PLOT_WIDTH = 960;
const DEFAULT_PLOT_HEIGHT = 356;
const DEFAULT_PLOT_LEFT = 84;
const DEFAULT_PLOT_RIGHT = 24;
const DEFAULT_PLOT_TOP = 18;
const DEFAULT_PLOT_BOTTOM = 94;

function scaleGeometry(
  containerWidth: number,
  baseWidth: number,
  baseHeight: number,
  baseLeft: number,
  baseRight: number,
  baseTop: number,
  baseBottom: number,
): { width: number; height: number; left: number; right: number; top: number; bottom: number } {
  const scale = containerWidth / baseWidth;
  return {
    width: containerWidth,
    height: baseHeight * scale,
    left: baseLeft * scale,
    right: baseRight * scale,
    top: baseTop * scale,
    bottom: baseBottom * scale,
  };
}

export function renderResponsePlot(input: {
  visibleMeasurements: LoadedMeasurement[];
  allMeasurements: LoadedMeasurement[];
  visibleReferenceCurves: ReferenceCurve[];
  allReferenceCurves: ReferenceCurve[];
  normalizePlot: boolean;
  smoothingMode: MeasurementSmoothingMode;
  splOffsetDb: number;
  busy: boolean;
  outputFolder: string | null;
  compact: boolean;
  containerWidth: number;
}): string {
  if (input.allMeasurements.length === 0 && input.allReferenceCurves.length === 0) {
    return `
      <div class="plot-empty-state">
        <span>Run or import measurements to plot response.</span>
      </div>
      ${renderMeasurementList(input.allMeasurements, input.allReferenceCurves, input.busy, input.outputFolder)}
    `;
  }

  if (input.visibleMeasurements.length === 0 && input.visibleReferenceCurves.length === 0) {
    return `
      <div class="plot-empty-state">
        <span>No measurements or reference curves are currently selected for display.</span>
      </div>
      ${renderMeasurementList(input.allMeasurements, input.allReferenceCurves, input.busy, input.outputFolder)}
    `;
  }

  const plottedReferenceCurves = input.visibleReferenceCurves.map((referenceCurve) => ({
    referenceCurve,
    points: getMeasurementPointsForDisplay(
      referenceCurve.plotPoints,
      referenceCurve,
      false,
      0,
      input.smoothingMode,
      null,
    ),
  }));
  const referenceNormalizationDb = plottedReferenceCurves[0]
    ? findClosestPoint(
        plottedReferenceCurves[0].points,
        1000,
      ).smoothedMagnitudeDbRelative
    : null;

  const plottedMeasurements = input.visibleMeasurements.map((measurement) => ({
    measurement,
    points: getMeasurementPointsForDisplay(
        measurement.plotPoints,
        measurement,
        input.normalizePlot,
        input.splOffsetDb,
        input.smoothingMode,
        referenceNormalizationDb,
      ),
  }));
  const geometry = getResponsePlotGeometry(
    [...plottedMeasurements.map((entry) => entry.points), ...plottedReferenceCurves.map((entry) => entry.points)],
    input.containerWidth,
  );
  const labelSizing = getPlotLabelSizing(input.compact);
  const xTicks = labelSizing.xTicks.filter(
    (frequency) =>
      frequency >= geometry.minFrequency && frequency <= geometry.maxFrequency,
  );
  const yTicks = Array.from({ length: labelSizing.yTickCount }, (_unused, index) => {
    const ratio = index / (labelSizing.yTickCount - 1);
    return geometry.maxDb - (geometry.maxDb - geometry.minDb) * ratio;
  });

  const xAxisY = geometry.height - geometry.bottom;
  const yAxisX = geometry.left;

  return `
    <div class="plot-hover" id="plotHover">Hover: --</div>
      <svg id="responsePlot" viewBox="0 0 ${geometry.width} ${geometry.height}" role="img" aria-label="Measured frequency response overlay with logarithmic frequency axis">
      <rect x="0" y="0" width="${geometry.width}" height="${geometry.height}" rx="4" fill="rgba(255,255,255,0.02)"></rect>
      ${yTicks
        .map((value) => {
          const y = getPlotY(value, geometry);
          return `<line x1="${geometry.left}" y1="${y.toFixed(1)}" x2="${geometry.width - geometry.right}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.07)" vector-effect="non-scaling-stroke" />`;
        })
        .join('')}
      ${xTicks
        .map((frequency) => {
          const x = getPlotX(frequency, geometry);
          return `<line x1="${x.toFixed(1)}" y1="${geometry.top}" x2="${x.toFixed(1)}" y2="${xAxisY}" stroke="rgba(255,255,255,0.06)" vector-effect="non-scaling-stroke" />`;
        })
        .join('')}
      <line x1="${yAxisX}" y1="${xAxisY}" x2="${geometry.width - geometry.right}" y2="${xAxisY}" stroke="rgba(248,161,69,0.24)" vector-effect="non-scaling-stroke" />
      <line x1="${yAxisX}" y1="${geometry.top}" x2="${yAxisX}" y2="${xAxisY}" stroke="rgba(248,161,69,0.24)" vector-effect="non-scaling-stroke" />
      ${plottedReferenceCurves
        .map(({ referenceCurve, points }) => {
          const path = points
            .map((point) => {
              const x = getPlotX(point.frequencyHz, geometry);
              const y = getPlotY(point.smoothedMagnitudeDbRelative, geometry);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');

          return `<polyline points="${path}" fill="none" stroke="${referenceCurve.color}" stroke-width="2" stroke-dasharray="8 8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>`;
        })
        .join('')}
      ${plottedMeasurements
        .map(({ measurement, points }) => {
          const path = points
            .map((point) => {
              const x = getPlotX(point.frequencyHz, geometry);
              const y = getPlotY(point.smoothedMagnitudeDbRelative, geometry);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');

          return `<polyline points="${path}" fill="none" stroke="${measurement.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>`;
        })
        .join('')}
      <line id="plotHoverLine" x1="0" y1="${geometry.top}" x2="0" y2="${xAxisY}" stroke="#f8a145" stroke-width="1" opacity="0" vector-effect="non-scaling-stroke"></line>
      ${input.visibleMeasurements
        .map(
          (measurement, index) =>
            `<circle class="plot-hover-dot" data-hover-index="${index}" cx="0" cy="0" r="4" fill="${measurement.color}" stroke="#0d0d0f" stroke-width="1.5" opacity="0" vector-effect="non-scaling-stroke"></circle>`,
        )
        .join('')}
      ${yTicks
        .map((value) => {
          const y = getPlotY(value, geometry);
            return `<text x="${geometry.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="plot-axis-text">${formatDbLabel(value)}</text>`;
          })
          .join('')}
      ${xTicks
        .map((frequency) => {
          const x = getPlotX(frequency, geometry);
          return `<text x="${x.toFixed(1)}" y="${geometry.height - 42}" text-anchor="middle" class="plot-axis-text">${formatFrequencyLabel(frequency)}</text>`;
         })
         .join('')}
      <text x="${(geometry.left + (geometry.width - geometry.right)) / 2}" y="${geometry.height - 12}" text-anchor="middle" class="plot-axis-label">Frequency (Hz, log)</text>
      <text x="${Math.min(28, geometry.left - 12)}" y="${(geometry.top + (geometry.height - geometry.bottom)) / 2}" text-anchor="middle" transform="rotate(-90 ${Math.min(28, geometry.left - 12)} ${(geometry.top + (geometry.height - geometry.bottom)) / 2})" class="plot-axis-label">${input.normalizePlot ? 'Normalized response (dB)' : 'Response (dB)'}</text>
    </svg>
    ${renderMeasurementList(input.allMeasurements, input.allReferenceCurves, input.busy, input.outputFolder)}
  `;
}

export function attachPlotInteractions(input: {
  plotCard: HTMLDivElement;
  measurements: LoadedMeasurement[];
  referenceCurves: ReferenceCurve[];
  normalizePlot: boolean;
  smoothingMode: MeasurementSmoothingMode;
  splOffsetDb: number;
}): void {
  const svg = input.plotCard.querySelector<SVGSVGElement>('#responsePlot');
  const hoverLine = input.plotCard.querySelector<SVGLineElement>('#plotHoverLine');
  const hoverDots = Array.from(
    input.plotCard.querySelectorAll<SVGCircleElement>('.plot-hover-dot'),
  );
  const hoverLabel = input.plotCard.querySelector<HTMLDivElement>('#plotHover');

  if (
    !svg ||
    !hoverLine ||
    !hoverLabel ||
    input.measurements.length === 0 ||
    hoverDots.length !== input.measurements.length
  ) {
    return;
  }

  const plottedMeasurements = input.measurements.map((measurement) => ({
    measurement,
    points: getMeasurementPointsForDisplay(
        measurement.plotPoints,
        measurement,
        input.normalizePlot,
        input.splOffsetDb,
        input.smoothingMode,
        input.referenceCurves[0]
          ? findClosestPoint(
              getMeasurementPointsForDisplay(
                input.referenceCurves[0].plotPoints,
                input.referenceCurves[0],
                false,
                0,
                input.smoothingMode,
                null,
              ),
              1000,
            ).smoothedMagnitudeDbRelative
          : null,
      ),
  }));
  const geometry = getResponsePlotGeometry(
    [
      ...plottedMeasurements.map((entry) => entry.points),
      ...input.referenceCurves.map((referenceCurve) =>
        getMeasurementPointsForDisplay(
          referenceCurve.plotPoints,
          referenceCurve,
          false,
          0,
          input.smoothingMode,
          null,
        ),
      ),
    ],
  );

  const updateHover = (clientX: number) => {
    const bounds = svg.getBoundingClientRect();
    const plotX = ((clientX - bounds.left) / bounds.width) * geometry.width;
    const hoveredFrequency = getFrequencyForPlotX(plotX, geometry);
    const hoverDetails: string[] = [];
    const hoverLineX = getPlotX(hoveredFrequency, geometry);

    plottedMeasurements.forEach(({ measurement, points }, index) => {
      const closestPoint = findClosestPoint(points, hoveredFrequency);
      const x = getPlotX(closestPoint.frequencyHz, geometry);
      const y = getPlotY(closestPoint.smoothedMagnitudeDbRelative, geometry);

      hoverDots[index]?.setAttribute('cx', x.toFixed(1));
      hoverDots[index]?.setAttribute('cy', y.toFixed(1));
      hoverDots[index]?.setAttribute('opacity', '1');
      const valueText = `${closestPoint.smoothedMagnitudeDbRelative.toFixed(1)} ${input.normalizePlot ? 'dB rel' : 'dB'}`;
      hoverDetails.push(`<span style="color:${measurement.color}">${valueText}</span>`);
    });

    hoverLine.setAttribute('x1', hoverLineX.toFixed(1));
    hoverLine.setAttribute('x2', hoverLineX.toFixed(1));
    hoverLine.setAttribute('opacity', '1');
    hoverLabel.innerHTML = `Hover: ${formatFrequencyDetailed(hoveredFrequency)} | ${hoverDetails.join(' | ')}`;
  };

  svg.addEventListener('pointermove', (event) => {
    updateHover(event.clientX);
  });

  svg.addEventListener('pointerleave', () => {
    hoverLine.setAttribute('opacity', '0');
    for (const hoverDot of hoverDots) {
      hoverDot.setAttribute('opacity', '0');
    }

    hoverLabel.textContent = 'Hover: --';
  });
}

export type ApoDragAxis = 'both' | 'horizontal' | 'vertical';

export type ApoPlotDragHandler = (
  filterId: string,
  frequencyHz: number,
  gainDb: number,
  axis: ApoDragAxis,
) => void;

export function renderApoEqPlot(input: {
  filters: ApoFilter[];
  eqMode: ApoEqMode;
  measurementName: string | null;
  targetName: string | null;
  compact: boolean;
  containerWidth: number;
}): string {
  const enabledFilters = input.filters.filter((filter) => filter.enabled);
  const sampledPoints = Array.from({ length: 256 }, (_unused, index) => {
    const ratio = index / 255;
    const frequencyHz =
      DEFAULT_START_FREQUENCY *
      Math.pow(DEFAULT_END_FREQUENCY / DEFAULT_START_FREQUENCY, ratio);

    return {
      frequencyHz,
      totalDb: enabledFilters.reduce(
        (total, filter) => total + getApoFilterResponseDb(filter, frequencyHz),
        0,
      ),
    };
  });
  const individualPointSets = enabledFilters.map((filter) => ({
    filter,
    points: sampledPoints.map((point) => ({
      frequencyHz: point.frequencyHz,
      totalDb: getApoFilterResponseDb(filter, point.frequencyHz),
    })),
  }));
  const geometry = getApoEqPlotGeometry(enabledFilters, sampledPoints, individualPointSets, input.containerWidth);
  const labelSizing = getPlotLabelSizing(input.compact);
  const yTicks = Array.from({ length: labelSizing.yTickCount }, (_unused, index) => {
    const ratio = index / (labelSizing.yTickCount - 1);
    return geometry.maxDb - (geometry.maxDb - geometry.minDb) * ratio;
  });
  const xAxisY = getPlotY(0, geometry);
  const yAxisX = geometry.left;
  const combinedPath = sampledPoints
    .map((point) => `${getPlotX(point.frequencyHz, geometry).toFixed(1)},${getPlotY(point.totalDb, geometry).toFixed(1)}`)
    .join(' ');

  return `
    <div class="plot-hover">EQ Graph: ${escapeHtml(input.measurementName ?? 'No measurement')} -> ${escapeHtml(input.targetName ?? 'No target')}</div>
    <svg viewBox="0 0 ${geometry.width} ${geometry.height}" role="img" aria-label="Equalizer APO frequency response graph">
      <rect x="0" y="0" width="${geometry.width}" height="${geometry.height}" rx="4" fill="rgba(255,255,255,0.02)"></rect>
      ${yTicks
        .map((value) => {
          const y = getPlotY(value, geometry);
          return `<line x1="${geometry.left}" y1="${y.toFixed(1)}" x2="${geometry.width - geometry.right}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.07)" vector-effect="non-scaling-stroke" />`;
        })
        .join('')}
      ${labelSizing.xTicks.map((frequency) => {
        const x = getPlotX(frequency, geometry);
        return `<line x1="${x.toFixed(1)}" y1="${geometry.top}" x2="${x.toFixed(1)}" y2="${geometry.height - geometry.bottom}" stroke="rgba(255,255,255,0.06)" vector-effect="non-scaling-stroke" />`;
      }).join('')}
      <line x1="${yAxisX}" y1="${xAxisY.toFixed(1)}" x2="${geometry.width - geometry.right}" y2="${xAxisY.toFixed(1)}" stroke="rgba(248,161,69,0.3)" vector-effect="non-scaling-stroke" />
      <line x1="${yAxisX}" y1="${geometry.top}" x2="${yAxisX}" y2="${geometry.height - geometry.bottom}" stroke="rgba(248,161,69,0.24)" vector-effect="non-scaling-stroke" />
      ${individualPointSets
        .map(({ filter, points }) => {
          const path = points
            .map((point) => `${getPlotX(point.frequencyHz, geometry).toFixed(1)},${getPlotY(point.totalDb, geometry).toFixed(1)}`)
            .join(' ');

          return `<polyline points="${path}" fill="none" stroke="rgba(125,125,125,0.65)" stroke-width="1.5" stroke-dasharray="6 6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"><title>${escapeHtml(`${input.eqMode === 'graphic' ? 'GEQ' : 'PK'} ${filter.frequencyHz.toFixed(0)} Hz ${filter.gainDb.toFixed(1)} dB Q ${filter.q.toFixed(2)}`)}</title></polyline>`;
        })
        .join('')}
      <polyline points="${combinedPath}" fill="none" stroke="#f8a145" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>
      ${enabledFilters
        .map((filter) => {
          const x = getPlotX(filter.frequencyHz, geometry);
          const y = getPlotY(filter.gainDb, geometry);
          return `<circle class="apo-filter-node" data-apo-filter-id="${escapeHtml(filter.id)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="#f8a145" stroke="#4d2b0b" stroke-width="2" cursor="grab" vector-effect="non-scaling-stroke"><title>${escapeHtml(`${filter.frequencyHz.toFixed(0)} Hz, ${filter.gainDb.toFixed(1)} dB`)}</title></circle>`;
        })
        .join('')}
      ${yTicks
        .map((value) => {
          const y = getPlotY(value, geometry);
          return `<text x="${geometry.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="plot-axis-text">${formatDbLabel(value)}</text>`;
        })
        .join('')}
      ${labelSizing.xTicks.map((frequency) => {
        const x = getPlotX(frequency, geometry);
        return `<text x="${x.toFixed(1)}" y="${geometry.height - 42}" text-anchor="middle" class="plot-axis-text">${formatFrequencyLabel(frequency)}</text>`;
      }).join('')}
      <text x="${(geometry.left + (geometry.width - geometry.right)) / 2}" y="${geometry.height - 12}" text-anchor="middle" class="plot-axis-label">Frequency (Hz, log)</text>
      <text x="${Math.min(28, geometry.left - 12)}" y="${(geometry.top + (geometry.height - geometry.bottom)) / 2}" text-anchor="middle" transform="rotate(-90 ${Math.min(28, geometry.left - 12)} ${(geometry.top + (geometry.height - geometry.bottom)) / 2})" class="plot-axis-label">EQ Gain (dB)</text>
    </svg>
  `;
}

function getPlotLabelSizing(compact: boolean): PlotLabelSizing {
  if (compact) {
    return {
      axisTextSize: 12,
      axisLabelSize: 12,
      yTickCount: 4,
      xTicks: COMPACT_GRAPH_FREQUENCIES,
    };
  }

  return {
    axisTextSize: 12,
    axisLabelSize: 12,
      yTickCount: 5,
      xTicks: EQ_GRAPH_FREQUENCIES,
  };
}

function getApoEqPlotGeometry(
  enabledFilters: ApoFilter[],
  sampledPoints: Array<{ frequencyHz: number; totalDb: number }>,
  individualPointSets: Array<{
    filter: ApoFilter;
    points: Array<{ frequencyHz: number; totalDb: number }>;
  }>,
  containerWidth: number,
): ResponsePlotGeometry {
  const allValues = [
    ...sampledPoints.map((point) => point.totalDb),
    ...individualPointSets.flatMap((entry) => entry.points.map((point) => point.totalDb)),
    ...enabledFilters.map((filter) => filter.gainDb),
    0,
  ];
  const minDb = Math.min(-12, Math.floor((Math.min(...allValues) - 1) / 3) * 3);
  const maxDb = Math.max(12, Math.ceil((Math.max(...allValues) + 1) / 3) * 3);

  const scaled = scaleGeometry(
    containerWidth,
    DEFAULT_PLOT_WIDTH,
    DEFAULT_PLOT_HEIGHT,
    DEFAULT_PLOT_LEFT,
    DEFAULT_PLOT_RIGHT,
    DEFAULT_PLOT_TOP,
    DEFAULT_PLOT_BOTTOM,
  );

  return {
    width: scaled.width,
    height: scaled.height,
    left: scaled.left,
    right: scaled.right,
    top: scaled.top,
    bottom: scaled.bottom,
    minFrequency: DEFAULT_START_FREQUENCY,
    maxFrequency: DEFAULT_END_FREQUENCY,
    minDb,
    maxDb,
  };
}

function getApoFilterResponseDb(filter: ApoFilter, frequencyHz: number): number {
  const distanceOctaves = Math.log2(frequencyHz / filter.frequencyHz);
  const sigma = 0.6 / Math.sqrt(filter.q);
  return filter.gainDb * Math.exp(-(distanceOctaves * distanceOctaves) / (2 * sigma * sigma));
}

function renderMeasurementList(
  measurements: LoadedMeasurement[],
  referenceCurves: ReferenceCurve[],
  busy: boolean,
  outputFolder: string | null,
): string {
  return `
    <div class="measurement-list">
      <div class="measurement-list-header">Loaded measurements</div>
      ${
        measurements.length === 0
          ? '<div class="measurement-empty">No measurements loaded.</div>'
          : measurements
              .map(
                (measurement) => `
                  <div class="measurement-row${measurement.visible ? '' : ' is-hidden'}">
                    <label class="measurement-toggle" title="${escapeHtml(measurement.sourcePath ?? measurement.name)}">
                      <input type="checkbox" data-measurement-toggle="${measurement.id}" ${measurement.visible ? 'checked' : ''} />
                      <span class="measurement-swatch" style="background:${measurement.color}"></span>
                      <span class="measurement-name">${escapeHtml(measurement.name)}</span>
                    </label>
                    <div class="measurement-actions">
                      <button class="btn btn-secondary measurement-export-button" type="button" data-measurement-export="${measurement.id}" ${busy || !outputFolder ? 'disabled' : ''}>
                        Export
                      </button>
                      <button class="btn btn-secondary measurement-remove-button" type="button" data-measurement-remove="${measurement.id}" ${busy ? 'disabled' : ''}>
                        Remove
                      </button>
                    </div>
                  </div>
                `,
              )
              .join('')
      }
      <div class="measurement-list-header">Reference curves</div>
      ${
        referenceCurves.length === 0
          ? '<div class="measurement-empty">No reference curves loaded.</div>'
          : referenceCurves
              .map(
                (referenceCurve) => `
                  <div class="measurement-row${referenceCurve.visible ? '' : ' is-hidden'}">
                    <label class="measurement-toggle" title="${escapeHtml(referenceCurve.sourcePath ?? referenceCurve.name)}">
                      <input type="checkbox" data-reference-toggle="${referenceCurve.id}" ${referenceCurve.visible ? 'checked' : ''} />
                      <span class="measurement-swatch measurement-swatch-reference"></span>
                      <span class="measurement-name">${escapeHtml(referenceCurve.name)}</span>
                    </label>
                    <div class="measurement-actions">
                      <button class="btn btn-secondary measurement-remove-button" type="button" data-reference-remove="${referenceCurve.id}" ${busy ? 'disabled' : ''}>
                        Remove
                      </button>
                    </div>
                  </div>
                `,
              )
              .join('')
      }
    </div>
  `;
}

function getResponsePlotGeometry(
  measurementPointSets: MeasurementPoint[][],
  containerWidth: number,
): ResponsePlotGeometry {
  const points = measurementPointSets.flatMap((measurement) => measurement);
  const frequencies = points.map((point) => point.frequencyHz);
  const smoothedValues = points.map((point) => point.smoothedMagnitudeDbRelative);
  const measuredTop = Math.max(...smoothedValues) + 3;
  const measuredBottom = Math.min(...smoothedValues) - 3;
  const minDb = measuredBottom;
  const maxDb = measuredBottom + Math.max(24, measuredTop - measuredBottom);

  const scaled = scaleGeometry(
    containerWidth,
    DEFAULT_PLOT_WIDTH,
    DEFAULT_PLOT_HEIGHT,
    DEFAULT_PLOT_LEFT,
    DEFAULT_PLOT_RIGHT,
    DEFAULT_PLOT_TOP,
    DEFAULT_PLOT_BOTTOM,
  );

  return {
    width: scaled.width,
    height: scaled.height,
    left: scaled.left,
    right: scaled.right,
    top: scaled.top,
    bottom: scaled.bottom,
    minFrequency:
      frequencies.length > 0 ? Math.min(...frequencies) : DEFAULT_START_FREQUENCY,
    maxFrequency:
      frequencies.length > 0 ? Math.max(...frequencies) : DEFAULT_END_FREQUENCY,
    minDb,
    maxDb,
  };
}

function getFrequencyForPlotX(x: number, geometry: ResponsePlotGeometry): number {
  const clampedX = clamp(x, geometry.left, geometry.width - geometry.right);
  const ratio =
    (clampedX - geometry.left) /
    (geometry.width - geometry.left - geometry.right);

  return Math.pow(
    10,
    Math.log10(geometry.minFrequency) +
      (Math.log10(geometry.maxFrequency) - Math.log10(geometry.minFrequency)) *
        ratio,
  );
}

function getPlotX(frequencyHz: number, geometry: ResponsePlotGeometry): number {
  return (
    geometry.left +
    ((Math.log10(frequencyHz) - Math.log10(geometry.minFrequency)) /
      (Math.log10(geometry.maxFrequency) - Math.log10(geometry.minFrequency))) *
      (geometry.width - geometry.left - geometry.right)
  );
}

function getPlotY(valueDb: number, geometry: ResponsePlotGeometry): number {
  return (
    geometry.top +
    ((geometry.maxDb - valueDb) / (geometry.maxDb - geometry.minDb)) *
      (geometry.height - geometry.top - geometry.bottom)
  );
}

export function attachApoPlotInteractions(input: {
  plotCard: HTMLElement;
  filters: ApoFilter[];
  lockFrequency: boolean;
  onFilterDrag: ApoPlotDragHandler;
  onDragEnd: () => void;
}): void {
  const { plotCard } = input;
  const plotCardWithController = plotCard as HTMLElement & {
    __apoPlotController?: {
      filters: ApoFilter[];
      lockFrequency: boolean;
      onFilterDrag: ApoPlotDragHandler;
      onDragEnd: () => void;
      draggingFilterId: string | null;
      cleanup: () => void;
    };
  };

  if (plotCardWithController.__apoPlotController) {
    plotCardWithController.__apoPlotController.filters = input.filters;
    plotCardWithController.__apoPlotController.lockFrequency = input.lockFrequency;
    plotCardWithController.__apoPlotController.onFilterDrag = input.onFilterDrag;
    plotCardWithController.__apoPlotController.onDragEnd = input.onDragEnd;
    return;
  }

  const getGeometryFromSvg = (filters: ApoFilter[]): ResponsePlotGeometry | null => {
    const svg = plotCard.querySelector('svg');
    if (!svg) {
      return null;
    }

    const viewBox = svg.getAttribute('viewBox');
    if (!viewBox) return null;
    const [width, height] = viewBox.split(' ').slice(2).map(Number);
    if (!width || !height) return null;

    const enabledFilters = filters.filter((filter) => filter.enabled);
    const sampledPoints = Array.from({ length: 256 }, (_unused, index) => {
      const ratio = index / 255;
      const frequencyHz =
        DEFAULT_START_FREQUENCY *
        Math.pow(DEFAULT_END_FREQUENCY / DEFAULT_START_FREQUENCY, ratio);

      return {
        frequencyHz,
        totalDb: enabledFilters.reduce(
          (total, filter) => total + getApoFilterResponseDb(filter, frequencyHz),
          0,
        ),
      };
    });
    const individualPointSets = enabledFilters.map((filter) => ({
      filter,
      points: sampledPoints.map((point) => ({
        frequencyHz: point.frequencyHz,
        totalDb: getApoFilterResponseDb(filter, point.frequencyHz),
      })),
    }));

    const geometry = getApoEqPlotGeometry(enabledFilters, sampledPoints, individualPointSets, width);
    return { ...geometry, width, height };
  };

  const handleMouseDown = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof SVGCircleElement) || !target.classList.contains('apo-filter-node')) {
      return;
    }

    event.preventDefault();
    const controller = plotCardWithController.__apoPlotController;
    if (!controller) {
      return;
    }

    controller.draggingFilterId = target.getAttribute('data-apo-filter-id');
    target.classList.add('is-dragging');
    target.setAttribute('cursor', 'grabbing');

    // Create tooltip positioned above the node (append to body to survive re-renders)
    const filterId = target.getAttribute('data-apo-filter-id');
    const filter = controller.filters.find((f) => f.id === filterId);

    const tooltip = document.createElement('div');
    tooltip.className = 'apo-node-tooltip';
    tooltip.id = 'apo-node-tooltip';

    // Set initial content from filter values
    const initialFreq = filter ? filter.frequencyHz.toFixed(0) : '0';
    const initialGain = filter ? filter.gainDb.toFixed(1) : '0.0';
    tooltip.textContent = `${initialFreq} Hz, ${initialGain} dB`;

    // Position using the node's screen coordinates
    const svgRect = target.ownerSVGElement?.getBoundingClientRect();
    if (svgRect) {
      const nodeCx = parseFloat(target.getAttribute('cx') || '0');
      const nodeCy = parseFloat(target.getAttribute('cy') || '0');
      const scaleX = svgRect.width / 960;
      const scaleY = svgRect.height / 356;

      // Calculate screen position
      const screenX = svgRect.left + nodeCx * scaleX;
      const screenY = svgRect.top + nodeCy * scaleY;

      // Position above the node (fixed offset of 32px above center)
      tooltip.style.left = `${screenX}px`;
      tooltip.style.top = `${screenY - 32}px`;
    }

    document.body.appendChild(tooltip);
  };

  const handleMouseMove = (event: MouseEvent) => {
    const controller = plotCardWithController.__apoPlotController;
    if (!controller?.draggingFilterId) {
      return;
    }

    const svg = plotCard.querySelector('svg');
    if (!(svg instanceof SVGSVGElement)) {
      return;
    }

    const geometry = getGeometryFromSvg(controller.filters);
    if (!geometry) return;

    const svgPoint = svg.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;

    const screenMatrix = svg.getScreenCTM();
    if (!screenMatrix) {
      return;
    }

    const transformedPoint = svgPoint.matrixTransform(screenMatrix.inverse());
    const axis: ApoDragAxis = controller.lockFrequency
      ? 'vertical'
      : event.shiftKey
        ? 'horizontal'
        : event.altKey
          ? 'vertical'
          : 'both';
    const activeFilter = controller.filters.find(
      (filter) => filter.id === controller.draggingFilterId,
    );
    const frequencyHz = controller.lockFrequency
      ? (activeFilter?.frequencyHz ?? 1000)
      : clamp(
          getFrequencyForPlotX(transformedPoint.x, geometry),
          20,
          20000,
        );
    const gainDb = clamp(
      getDbForPlotY(transformedPoint.y, geometry),
      -24,
      24,
    );

    // Update tooltip text and position above the node
    const tooltip = document.getElementById('apo-node-tooltip');
    if (tooltip) {
      tooltip.textContent = `${frequencyHz.toFixed(0)} Hz, ${gainDb.toFixed(1)} dB`;

      const svgRect = svg.getBoundingClientRect();
      const nodeX = getPlotX(frequencyHz, geometry);
      const nodeY = getPlotY(gainDb, geometry);
      const scaleX = svgRect.width / 960;
      const scaleY = svgRect.height / 356;

      // Position above the node using screen coordinates
      const screenX = svgRect.left + nodeX * scaleX;
      const screenY = svgRect.top + nodeY * scaleY;
      tooltip.style.left = `${screenX}px`;
      tooltip.style.top = `${screenY - 32}px`;
    }

    controller.onFilterDrag(controller.draggingFilterId, frequencyHz, gainDb, axis);
  };

  const handleMouseUp = () => {
    const controller = plotCardWithController.__apoPlotController;
    if (!controller?.draggingFilterId) {
      return;
    }

    // Remove dragging class from all nodes (in case re-render happened)
    const svg = plotCard.querySelector('svg');
    svg?.querySelectorAll('.apo-filter-node.is-dragging').forEach((node) => {
      node.classList.remove('is-dragging');
      node.setAttribute('cursor', 'grab');
    });

    // Remove tooltip from body
    const tooltip = document.getElementById('apo-node-tooltip');
    if (tooltip && tooltip.parentElement) {
      tooltip.parentElement.removeChild(tooltip);
    }

    controller.draggingFilterId = null;
    controller.onDragEnd();
  };

  const cleanup = () => {
    plotCard.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);

    // Clean up tooltip from body if it exists
    const tooltip = document.getElementById('apo-node-tooltip');
    if (tooltip && tooltip.parentElement) {
      tooltip.parentElement.removeChild(tooltip);
    }
  };

  plotCard.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  plotCardWithController.__apoPlotController = {
    filters: input.filters,
    lockFrequency: input.lockFrequency,
    onFilterDrag: input.onFilterDrag,
    onDragEnd: input.onDragEnd,
    draggingFilterId: null,
    cleanup,
  };
}

function getDbForPlotY(y: number, geometry: ResponsePlotGeometry): number {
  const clampedY = clamp(y, geometry.top, geometry.height - geometry.bottom);
  const ratio =
    (clampedY - geometry.top) /
    (geometry.height - geometry.top - geometry.bottom);
  return geometry.maxDb - ratio * (geometry.maxDb - geometry.minDb);
}
