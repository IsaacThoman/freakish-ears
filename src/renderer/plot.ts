import {
  DEFAULT_END_FREQUENCY,
  DEFAULT_START_FREQUENCY,
} from './constants';
import { getMeasurementPointsForDisplay } from './measurements';
import type {
  ApoEqMode,
  ApoFilter,
  ApoFilterKind,
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

function apoFilterKindUsesGain(kind: ApoFilterKind): boolean {
  return kind === 'PK' || kind === 'LS' || kind === 'HS';
}

function formatApoFilterKindLabel(kind: ApoFilterKind): string {
  switch (kind) {
    case 'PK':
      return 'Peak';
    case 'LS':
      return 'Low Shelf';
    case 'HS':
      return 'High Shelf';
    case 'LP':
      return 'Low Pass';
    case 'HP':
      return 'High Pass';
    case 'NO':
      return 'Notch';
    case 'BP':
      return 'Band Pass';
    case 'AP':
      return 'All Pass';
  }
}

type PlotLabelSizing = {
  axisTextSize: number;
  axisLabelSize: number;
  yTickCount: number;
  xTicks: number[];
};

type ResponseToleranceOverlay = {
  measurementId: string;
  referenceCurve: ReferenceCurve;
  bands: Array<{
    label: string;
    minimumFrequencyHz: number;
    maximumFrequencyHz: number;
    toleranceDb: number;
  }>;
};

export const DEFAULT_PLOT_WIDTH = 960;
export const DEFAULT_PLOT_HEIGHT = 480;
const DEFAULT_PLOT_LEFT = 84;
const DEFAULT_PLOT_RIGHT = 24;
const DEFAULT_PLOT_TOP = 18;
const DEFAULT_PLOT_BOTTOM = 94;
const MIN_PLOT_LEFT = 84;
const Y_TICK_LABEL_OFFSET = 10;
const X_TICK_BASELINE_Y_OFFSET = 42;
const X_AXIS_LABEL_BASELINE_Y_OFFSET = 12;

type TextMetricsSummary = {
  width: number;
  ascent: number;
  descent: number;
  height: number;
};

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
    left: Math.max(MIN_PLOT_LEFT, baseLeft * scale),
    right: baseRight * scale,
    top: baseTop * scale,
    bottom: baseBottom * scale,
  };
}

function measureSvgText(text: string, fontSize: number): TextMetricsSummary {
  if (typeof document === 'undefined') {
    const width = text.length * fontSize * 0.62;
    const ascent = fontSize * 0.75;
    const descent = fontSize * 0.25;
    return {
      width,
      ascent,
      descent,
      height: ascent + descent,
    };
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    const width = text.length * fontSize * 0.62;
    const ascent = fontSize * 0.75;
    const descent = fontSize * 0.25;
    return {
      width,
      ascent,
      descent,
      height: ascent + descent,
    };
  }

  const bodyFontFamily = document.body ? window.getComputedStyle(document.body).fontFamily : 'system-ui';
  context.font = `${fontSize}px ${bodyFontFamily}`;
  const metrics = context.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.75;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.25;
  return {
    width: metrics.width,
    ascent,
    descent,
    height: ascent + descent,
  };
}

function getAxisLabelGap(labelSizing: PlotLabelSizing): number {
  const tickMetrics = measureSvgText('0 dB', labelSizing.axisTextSize);
  const labelMetrics = measureSvgText('Frequency (Hz, log)', labelSizing.axisLabelSize);
  return Math.max(
    4,
    X_TICK_BASELINE_Y_OFFSET -
      X_AXIS_LABEL_BASELINE_Y_OFFSET -
      tickMetrics.descent -
      labelMetrics.ascent,
  );
}

function getYAxisLabelX(
  left: number,
  yTicks: number[],
  labelText: string,
  labelSizing: PlotLabelSizing,
): number {
  const widestTickLabelWidth = yTicks.reduce((widest, value) => {
    const metrics = measureSvgText(formatDbLabel(value), labelSizing.axisTextSize);
    return Math.max(widest, metrics.width);
  }, 0);
  const axisLabelGap = getAxisLabelGap(labelSizing);
  const labelMetrics = measureSvgText(labelText, labelSizing.axisLabelSize);
  const tickLabelLeftEdge = left - Y_TICK_LABEL_OFFSET - widestTickLabelWidth;
  return tickLabelLeftEdge - axisLabelGap - labelMetrics.descent;
}

export function renderResponsePlot(input: {
  visibleMeasurements: LoadedMeasurement[];
  allMeasurements: LoadedMeasurement[];
  visibleReferenceCurves: ReferenceCurve[];
  allReferenceCurves: ReferenceCurve[];
  measurementKeepCount: number;
  normalizePlot: boolean;
  smoothingMode: MeasurementSmoothingMode;
  splOffsetDb: number;
  busy: boolean;
  outputFolder: string | null;
  compact: boolean;
  containerWidth: number;
  toleranceOverlay: ResponseToleranceOverlay | null;
}): string {
  if (input.allMeasurements.length === 0 && input.allReferenceCurves.length === 0) {
    return `
      <div class="plot-empty-state">
        <span>Run or import measurements to plot response.</span>
      </div>
      ${renderMeasurementList(input.allMeasurements, input.allReferenceCurves, input.measurementKeepCount, input.busy, input.outputFolder)}
    `;
  }

  if (input.visibleMeasurements.length === 0 && input.visibleReferenceCurves.length === 0) {
    return `
      <div class="plot-empty-state">
        <span>No measurements or reference curves are currently selected for display.</span>
      </div>
      ${renderMeasurementList(input.allMeasurements, input.allReferenceCurves, input.measurementKeepCount, input.busy, input.outputFolder)}
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
  const yAxisLabelText = input.normalizePlot ? 'Normalized response (dB)' : 'Response (dB)';
  const yAxisLabelX = getYAxisLabelX(geometry.left, yTicks, yAxisLabelText, labelSizing);

  const xAxisY = geometry.height - geometry.bottom;
  const yAxisX = geometry.left;
  const toleranceFailPaths = buildToleranceFailPaths(
    input.toleranceOverlay,
    plottedMeasurements,
    plottedReferenceCurves,
    geometry,
    xAxisY,
  );

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
      ${toleranceFailPaths
        .map(
          (path) => `<path d="${path}" fill="rgba(255,70,70,0.22)" stroke="none"></path>`,
        )
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
          return `<text x="${x.toFixed(1)}" y="${geometry.height - X_TICK_BASELINE_Y_OFFSET}" text-anchor="middle" class="plot-axis-text">${formatFrequencyLabel(frequency)}</text>`;
         })
         .join('')}
      <text x="${(geometry.left + (geometry.width - geometry.right)) / 2}" y="${geometry.height - X_AXIS_LABEL_BASELINE_Y_OFFSET}" text-anchor="middle" class="plot-axis-label">Frequency (Hz, log)</text>
      <text x="${yAxisLabelX}" y="${(geometry.top + (geometry.height - geometry.bottom)) / 2}" text-anchor="middle" transform="rotate(-90 ${yAxisLabelX} ${(geometry.top + (geometry.height - geometry.bottom)) / 2})" class="plot-axis-label">${yAxisLabelText}</text>
    </svg>
    ${renderMeasurementList(input.allMeasurements, input.allReferenceCurves, input.measurementKeepCount, input.busy, input.outputFolder)}
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
  sampleRate: number;
  measurementName: string | null;
  targetName: string | null;
  compact: boolean;
  containerWidth: number;
}): string {
  const enabledFilters = input.filters.filter((filter) => filter.enabled);
  const sampledPoints = buildApoPreviewSampledPoints(enabledFilters, input.eqMode, input.sampleRate);
  const individualPointSets = input.eqMode === 'graphic'
    ? []
    : enabledFilters.map((filter) => ({
        filter,
        points: sampledPoints.map((point) => ({
          frequencyHz: point.frequencyHz,
          totalDb: getApoFilterResponseDb(filter, point.frequencyHz, input.sampleRate),
        })),
      }));
  const geometry = getApoEqPlotGeometry(
    enabledFilters,
    sampledPoints,
    individualPointSets,
    input.containerWidth,
    input.sampleRate,
  );
  const labelSizing = getPlotLabelSizing(input.compact);
  const yTicks = Array.from({ length: labelSizing.yTickCount }, (_unused, index) => {
    const ratio = index / (labelSizing.yTickCount - 1);
    return geometry.maxDb - (geometry.maxDb - geometry.minDb) * ratio;
  });
  const yAxisLabelText = 'EQ Gain (dB)';
  const yAxisLabelX = getYAxisLabelX(geometry.left, yTicks, yAxisLabelText, labelSizing);
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

          const filterSummary = apoFilterKindUsesGain(filter.kind)
            ? `${formatApoFilterKindLabel(filter.kind)} ${filter.frequencyHz.toFixed(0)} Hz ${filter.gainDb.toFixed(1)} dB Q ${filter.q.toFixed(2)}`
            : `${formatApoFilterKindLabel(filter.kind)} ${filter.frequencyHz.toFixed(0)} Hz Q ${filter.q.toFixed(2)}`;

          return `<polyline points="${path}" fill="none" stroke="rgba(125,125,125,0.65)" stroke-width="1.5" stroke-dasharray="6 6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"><title>${escapeHtml(input.eqMode === 'graphic' ? `GEQ ${filter.frequencyHz.toFixed(0)} Hz ${filter.gainDb.toFixed(1)} dB Q ${filter.q.toFixed(2)}` : filterSummary)}</title></polyline>`;
        })
        .join('')}
      <polyline points="${combinedPath}" fill="none" stroke="#f8a145" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>
      ${enabledFilters
        .map((filter) => {
          const x = getPlotX(filter.frequencyHz, geometry);
          const nodeGainDb = getApoFilterNodeGainDb(filter, input.sampleRate);
          const y = getPlotY(nodeGainDb, geometry);
          const nodeSummary = apoFilterKindUsesGain(filter.kind)
            ? `${formatApoFilterKindLabel(filter.kind)} ${filter.frequencyHz.toFixed(0)} Hz, ${filter.gainDb.toFixed(1)} dB`
            : `${formatApoFilterKindLabel(filter.kind)} ${filter.frequencyHz.toFixed(0)} Hz`;
          return `<circle class="apo-filter-node" data-apo-filter-id="${escapeHtml(filter.id)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="#f8a145" stroke="#4d2b0b" stroke-width="2" cursor="grab" vector-effect="non-scaling-stroke"><title>${escapeHtml(nodeSummary)}</title></circle>`;
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
        return `<text x="${x.toFixed(1)}" y="${geometry.height - X_TICK_BASELINE_Y_OFFSET}" text-anchor="middle" class="plot-axis-text">${formatFrequencyLabel(frequency)}</text>`;
      }).join('')}
      <text x="${(geometry.left + (geometry.width - geometry.right)) / 2}" y="${geometry.height - X_AXIS_LABEL_BASELINE_Y_OFFSET}" text-anchor="middle" class="plot-axis-label">Frequency (Hz, log)</text>
      <text x="${yAxisLabelX}" y="${(geometry.top + (geometry.height - geometry.bottom)) / 2}" text-anchor="middle" transform="rotate(-90 ${yAxisLabelX} ${(geometry.top + (geometry.height - geometry.bottom)) / 2})" class="plot-axis-label">${yAxisLabelText}</text>
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
  sampleRate: number,
): ResponsePlotGeometry {
  const allValues = [
    ...sampledPoints.map((point) => point.totalDb),
    ...individualPointSets.flatMap((entry) => entry.points.map((point) => point.totalDb)),
    ...enabledFilters.map((filter) => getApoFilterNodeGainDb(filter, sampleRate)),
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

function getApoFilterResponseDb(filter: ApoFilter, frequencyHz: number, sampleRate: number): number {
  if (filter.kind === 'PK') {
    const distanceOctaves = Math.log2(frequencyHz / filter.frequencyHz);
    const sigma = 0.6 / Math.sqrt(filter.q);
    return filter.gainDb * Math.exp(-(distanceOctaves * distanceOctaves) / (2 * sigma * sigma));
  }

  const normalizedFrequencyHz = clamp(filter.frequencyHz, 20, sampleRate / 2 - 1);
  const normalizedQ = clamp(filter.q, 0.1, 10);
  const omega0 = (2 * Math.PI * normalizedFrequencyHz) / sampleRate;
  const cosOmega0 = Math.cos(omega0);
  const sinOmega0 = Math.sin(omega0);
  const alpha = sinOmega0 / (2 * normalizedQ);
  const gainAmplitude = Math.pow(10, filter.gainDb / 40);
  let b0 = 1;
  let b1 = 0;
  let b2 = 0;
  let a0 = 1;
  let a1 = 0;
  let a2 = 0;

  switch (filter.kind) {
    case 'LS': {
      const sqrtA = Math.sqrt(gainAmplitude);
      const twoSqrtAAlpha = 2 * sqrtA * alpha;
      b0 = gainAmplitude * ((gainAmplitude + 1) - (gainAmplitude - 1) * cosOmega0 + twoSqrtAAlpha);
      b1 = 2 * gainAmplitude * ((gainAmplitude - 1) - (gainAmplitude + 1) * cosOmega0);
      b2 = gainAmplitude * ((gainAmplitude + 1) - (gainAmplitude - 1) * cosOmega0 - twoSqrtAAlpha);
      a0 = (gainAmplitude + 1) + (gainAmplitude - 1) * cosOmega0 + twoSqrtAAlpha;
      a1 = -2 * ((gainAmplitude - 1) + (gainAmplitude + 1) * cosOmega0);
      a2 = (gainAmplitude + 1) + (gainAmplitude - 1) * cosOmega0 - twoSqrtAAlpha;
      break;
    }
    case 'HS': {
      const sqrtA = Math.sqrt(gainAmplitude);
      const twoSqrtAAlpha = 2 * sqrtA * alpha;
      b0 = gainAmplitude * ((gainAmplitude + 1) + (gainAmplitude - 1) * cosOmega0 + twoSqrtAAlpha);
      b1 = -2 * gainAmplitude * ((gainAmplitude - 1) + (gainAmplitude + 1) * cosOmega0);
      b2 = gainAmplitude * ((gainAmplitude + 1) + (gainAmplitude - 1) * cosOmega0 - twoSqrtAAlpha);
      a0 = (gainAmplitude + 1) - (gainAmplitude - 1) * cosOmega0 + twoSqrtAAlpha;
      a1 = 2 * ((gainAmplitude - 1) - (gainAmplitude + 1) * cosOmega0);
      a2 = (gainAmplitude + 1) - (gainAmplitude - 1) * cosOmega0 - twoSqrtAAlpha;
      break;
    }
    case 'LP':
      b0 = (1 - cosOmega0) / 2;
      b1 = 1 - cosOmega0;
      b2 = (1 - cosOmega0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosOmega0;
      a2 = 1 - alpha;
      break;
    case 'HP':
      b0 = (1 + cosOmega0) / 2;
      b1 = -(1 + cosOmega0);
      b2 = (1 + cosOmega0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosOmega0;
      a2 = 1 - alpha;
      break;
    case 'NO':
      b0 = 1;
      b1 = -2 * cosOmega0;
      b2 = 1;
      a0 = 1 + alpha;
      a1 = -2 * cosOmega0;
      a2 = 1 - alpha;
      break;
    case 'BP':
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cosOmega0;
      a2 = 1 - alpha;
      break;
    case 'AP':
      b0 = 1 - alpha;
      b1 = -2 * cosOmega0;
      b2 = 1 + alpha;
      a0 = 1 + alpha;
      a1 = -2 * cosOmega0;
      a2 = 1 - alpha;
      break;
  }

  const omega = (2 * Math.PI * clamp(frequencyHz, 20, sampleRate / 2 - 1)) / sampleRate;
  const numeratorReal = b0 + b1 * Math.cos(omega) + b2 * Math.cos(2 * omega);
  const numeratorImag = -b1 * Math.sin(omega) - b2 * Math.sin(2 * omega);
  const denominatorReal = a0 + a1 * Math.cos(omega) + a2 * Math.cos(2 * omega);
  const denominatorImag = -a1 * Math.sin(omega) - a2 * Math.sin(2 * omega);
  const numeratorMagnitude = Math.hypot(numeratorReal, numeratorImag);
  const denominatorMagnitude = Math.hypot(denominatorReal, denominatorImag);
  const magnitude = denominatorMagnitude === 0 ? 1 : numeratorMagnitude / denominatorMagnitude;

  return 20 * Math.log10(Math.max(magnitude, 1e-6));
}

function getApoFilterNodeGainDb(filter: ApoFilter, sampleRate: number): number {
  if (apoFilterKindUsesGain(filter.kind)) {
    return filter.gainDb;
  }

  return getApoFilterResponseDb(filter, filter.frequencyHz, sampleRate);
}

function buildApoPreviewSampledPoints(
  enabledFilters: ApoFilter[],
  eqMode: ApoEqMode,
  sampleRate: number,
): Array<{ frequencyHz: number; totalDb: number }> {
  return Array.from({ length: 256 }, (_unused, index) => {
    const ratio = index / 255;
    const frequencyHz =
      DEFAULT_START_FREQUENCY *
      Math.pow(DEFAULT_END_FREQUENCY / DEFAULT_START_FREQUENCY, ratio);

    return {
      frequencyHz,
      totalDb: eqMode === 'graphic'
        ? getGraphicEqResponseDb(enabledFilters, frequencyHz)
        : enabledFilters.reduce(
            (total, filter) => total + getApoFilterResponseDb(filter, frequencyHz, sampleRate),
            0,
          ),
    };
  });
}

function getGraphicEqResponseDb(filters: ApoFilter[], frequencyHz: number): number {
  if (filters.length === 0) {
    return 0;
  }

  const sortedFilters = [...filters].sort(
    (left, right) => left.frequencyHz - right.frequencyHz,
  );

  if (frequencyHz <= sortedFilters[0].frequencyHz) {
    return sortedFilters[0].gainDb;
  }

  if (frequencyHz >= sortedFilters[sortedFilters.length - 1].frequencyHz) {
    return sortedFilters[sortedFilters.length - 1].gainDb;
  }

  for (let index = 1; index < sortedFilters.length; index += 1) {
    const leftFilter = sortedFilters[index - 1];
    const rightFilter = sortedFilters[index];

    if (frequencyHz > rightFilter.frequencyHz) {
      continue;
    }

    const leftLogFrequency = Math.log(leftFilter.frequencyHz);
    const rightLogFrequency = Math.log(rightFilter.frequencyHz);
    const targetLogFrequency = Math.log(frequencyHz);
    const ratio =
      rightLogFrequency === leftLogFrequency
        ? 0
        : (targetLogFrequency - leftLogFrequency) /
          (rightLogFrequency - leftLogFrequency);

    return leftFilter.gainDb + (rightFilter.gainDb - leftFilter.gainDb) * ratio;
  }

  return sortedFilters[sortedFilters.length - 1].gainDb;
}

function renderMeasurementList(
  measurements: LoadedMeasurement[],
  referenceCurves: ReferenceCurve[],
  measurementKeepCount: number,
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
                  <div class="measurement-row${measurement.visible ? '' : ' is-hidden'}${measurement.starred ? ' is-starred' : ''}">
                    <label class="measurement-toggle" title="${escapeHtml(measurement.sourcePath ?? measurement.name)}">
                      <input type="checkbox" data-measurement-toggle="${measurement.id}" ${measurement.visible ? 'checked' : ''} />
                      <span class="measurement-swatch" style="background:${measurement.color}"></span>
                      <span class="measurement-name">${escapeHtml(measurement.name)}</span>
                    </label>
                    <div class="measurement-actions">
                      <button class="btn btn-icon measurement-star-button" type="button" data-measurement-star="${measurement.id}" aria-pressed="${measurement.starred ? 'true' : 'false'}" title="${measurement.starred ? 'Unstar' : 'Star'}" ${busy ? 'disabled' : ''}>
                        ${measurement.starred
                          ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="star-icon"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
                          : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="star-icon"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
                        }
                      </button>
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
      <label class="measurement-keep-control">
        <span>Number to keep</span>
        <input type="number" min="1" max="100" step="1" value="${measurementKeepCount}" data-measurement-keep-count ${busy ? 'disabled' : ''} />
        <span class="measurement-keep-hint">Starred measurements are kept.</span>
      </label>
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

function buildToleranceFailPaths(
  overlay: ResponseToleranceOverlay | null,
  plottedMeasurements: Array<{ measurement: LoadedMeasurement; points: MeasurementPoint[] }>,
  plottedReferenceCurves: Array<{ referenceCurve: ReferenceCurve; points: MeasurementPoint[] }>,
  geometry: ResponsePlotGeometry,
  xAxisY: number,
): string[] {
  if (!overlay) {
    return [];
  }

  const plottedMeasurement = plottedMeasurements.find(
    (entry) => entry.measurement.id === overlay.measurementId,
  );
  if (!plottedMeasurement) {
    return [];
  }

  const plottedReferenceCurve = plottedReferenceCurves.find(
    (entry) => entry.referenceCurve.id === overlay.referenceCurve.id,
  );
  const referencePoints = plottedReferenceCurve?.points;
  if (!referencePoints) {
    return [];
  }
  const failPaths: string[] = [];
  let activeSegment: MeasurementPoint[] = [];

  const flushSegment = () => {
    if (activeSegment.length < 2) {
      activeSegment = [];
      return;
    }

    const curvePath = activeSegment
      .map((point) => `${getPlotX(point.frequencyHz, geometry).toFixed(1)},${getPlotY(point.smoothedMagnitudeDbRelative, geometry).toFixed(1)}`)
      .join(' L ');
    const firstPoint = activeSegment[0];
    const lastPoint = activeSegment[activeSegment.length - 1];
    const firstX = getPlotX(firstPoint.frequencyHz, geometry).toFixed(1);
    const lastX = getPlotX(lastPoint.frequencyHz, geometry).toFixed(1);

    failPaths.push(
      `M ${firstX},${xAxisY.toFixed(1)} L ${curvePath} L ${lastX},${xAxisY.toFixed(1)} Z`,
    );
    activeSegment = [];
  };

  for (let index = 0; index < plottedMeasurement.points.length; index += 1) {
    const displayPoint = plottedMeasurement.points[index];
    if (!displayPoint) {
      flushSegment();
      continue;
    }

    const matchingBand = overlay.bands.find(
      (band) =>
        displayPoint.frequencyHz >= band.minimumFrequencyHz &&
        displayPoint.frequencyHz <= band.maximumFrequencyHz,
    );
    if (!matchingBand) {
      flushSegment();
      continue;
    }

    const referencePoint = findClosestPoint(referencePoints, displayPoint.frequencyHz);
    const errorDb = Math.abs(
      referencePoint.smoothedMagnitudeDbRelative -
        displayPoint.smoothedMagnitudeDbRelative,
    );

    if (errorDb > matchingBand.toleranceDb) {
      activeSegment.push(displayPoint);
    } else {
      flushSegment();
    }
  }

  flushSegment();
  return failPaths;
}

export function attachApoPlotInteractions(input: {
  plotCard: HTMLElement;
  filters: ApoFilter[];
  eqMode: ApoEqMode;
  sampleRate: number;
  lockFrequency: boolean;
  onFilterDrag: ApoPlotDragHandler;
  onDragEnd: () => void;
}): void {
  const { plotCard } = input;
  const plotCardWithController = plotCard as HTMLElement & {
    __apoPlotController?: {
      filters: ApoFilter[];
      eqMode: ApoEqMode;
      sampleRate: number;
      lockFrequency: boolean;
      onFilterDrag: ApoPlotDragHandler;
      onDragEnd: () => void;
      draggingFilterId: string | null;
      cleanup: () => void;
    };
  };

  if (plotCardWithController.__apoPlotController) {
    plotCardWithController.__apoPlotController.filters = input.filters;
    plotCardWithController.__apoPlotController.eqMode = input.eqMode;
    plotCardWithController.__apoPlotController.sampleRate = input.sampleRate;
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
    const sampleRate = plotCardWithController.__apoPlotController?.sampleRate ?? 48000;
    const sampledPoints = buildApoPreviewSampledPoints(
      enabledFilters,
      plotCardWithController.__apoPlotController?.eqMode ?? 'parametric',
      sampleRate,
    );
    const individualPointSets = (plotCardWithController.__apoPlotController?.eqMode ?? 'parametric') === 'graphic'
      ? []
      : enabledFilters.map((filter) => ({
          filter,
          points: sampledPoints.map((point) => ({
            frequencyHz: point.frequencyHz,
            totalDb: getApoFilterResponseDb(filter, point.frequencyHz, sampleRate),
          })),
        }));

    const geometry = getApoEqPlotGeometry(enabledFilters, sampledPoints, individualPointSets, width, sampleRate);
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
      const displayedGainDb = apoFilterKindUsesGain(activeFilter?.kind ?? 'PK')
        ? gainDb
        : getApoFilterNodeGainDb(
            {
              ...(activeFilter ?? {
                id: '',
                enabled: true,
                kind: 'PK',
                frequencyHz,
                gainDb: 0,
                q: 1.41,
              }),
              frequencyHz,
            },
            controller.sampleRate,
          );
      tooltip.textContent = `${frequencyHz.toFixed(0)} Hz, ${gainDb.toFixed(1)} dB`;

      const svgRect = svg.getBoundingClientRect();
      const nodeX = getPlotX(frequencyHz, geometry);
      const nodeY = getPlotY(displayedGainDb, geometry);
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
      eqMode: input.eqMode,
      sampleRate: input.sampleRate,
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
