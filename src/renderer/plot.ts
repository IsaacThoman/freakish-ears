import {
  DEFAULT_END_FREQUENCY,
  DEFAULT_START_FREQUENCY,
} from './constants';
import { getMeasurementPointsForDisplay } from './measurements';
import {
  apoFilterKindUsesGain,
  formatApoFilterKindLabel,
  formatApoFilterShapeValue,
  getApoFilterNodeGainDb,
  getApoFilterResponseDb,
  getApoFilterShapeLabel,
} from './apo';
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
  getToleranceFailureSegments,
} from './utils';

const EQ_GRAPH_FREQUENCIES = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const COMPACT_GRAPH_FREQUENCIES = [20, 100, 1000, 10000, 20000];

type PlotLabelSizing = {
  axisTextSize: number;
  axisLabelSize: number;
  yTickCount: number;
  xTicks: number[];
};

type ApoBandVisualStyle = {
  nodeFill: string;
  strokeSoft: string;
  fillTop: string;
  fillBottom: string;
};

type GraphicEqNodeRenderProfile = {
  radius: number;
  strokeWidth: number;
  visibleStride: number;
};

type BandFillPolarity = 'positive' | 'negative';

type BandFillSegment = {
  path: string;
  polarity: BandFillPolarity;
};

type SvgGradientStop = {
  color: string;
  opacity: number;
};

type ResponseToleranceOverlay = {
  measurementId: string;
  referenceCurve: ReferenceCurve;
  maxAcceptableErrorWidthHz: number;
  bands: Array<{
    label: string;
    minimumFrequencyHz: number;
    maximumFrequencyHz: number;
    toleranceDb: number;
  }>;
};

export const DEFAULT_PLOT_WIDTH = 960;
export const DEFAULT_PLOT_HEIGHT = 480;
const DEFAULT_PLOT_RIGHT = 24;
const DEFAULT_PLOT_TOP = 18;
const DEFAULT_PLOT_BOTTOM = 94;
const PLOT_TEXT_SIZE_PX = 11;
const PLOT_LABEL_SIZE_PX = 11;
const PLOT_OUTER_HORIZONTAL_PADDING = 12;
const PLOT_OUTER_TOP_PADDING = 18;
const PLOT_OUTER_BOTTOM_PADDING = 12;
const PLOT_Y_TICK_GAP = 10;
const PLOT_X_TICK_GAP = 10;
const PLOT_AXIS_LABEL_GAP = 8;
const PLOT_DRAW_AREA_ASPECT_RATIO =
  (DEFAULT_PLOT_HEIGHT - DEFAULT_PLOT_TOP - DEFAULT_PLOT_BOTTOM) /
  (DEFAULT_PLOT_WIDTH - 84 - DEFAULT_PLOT_RIGHT);
const APO_PARAMETRIC_BAND_COLORS = [
  '#ffb74f',
  '#ffd95e',
  '#c3f05e',
  '#55e0a3',
  '#49d7e8',
  '#57a7ff',
  '#9d7cff',
  '#e76fff',
  '#ff6ba4',
  '#ff7d5c',
  '#ff9b7a',
  '#ffb36b',
  '#f7d65a',
  '#d7ef63',
  '#96ef68',
  '#5de58d',
  '#48dfc1',
  '#51d3f2',
  '#6ab8ff',
  '#7d97ff',
  '#ad83ff',
  '#d578ff',
  '#f06fd7',
  '#ff7497',
];

type TextMetricsSummary = {
  width: number;
  ascent: number;
  descent: number;
  height: number;
};

function getWidestTextWidth(texts: string[], fontSize: number): number {
  return texts.reduce((widest, text) => Math.max(widest, measureSvgText(text, fontSize).width), 0);
}

function getTallestTextMetrics(texts: string[], fontSize: number): TextMetricsSummary {
  return texts.reduce<TextMetricsSummary>((tallest, text) => {
    const metrics = measureSvgText(text, fontSize);
    return metrics.height > tallest.height ? metrics : tallest;
  }, measureSvgText(texts[0] ?? '', fontSize));
}

function buildPlotFrame(
  containerWidth: number,
  yTicks: number[],
  xTicks: number[],
  yAxisLabelText: string,
  labelSizing: PlotLabelSizing,
): { width: number; height: number; left: number; right: number; top: number; bottom: number } {
  const yTickWidth = getWidestTextWidth(
    yTicks.map((value) => formatDbLabel(value)),
    labelSizing.axisTextSize,
  );
  const xTickMetrics = getTallestTextMetrics(
    xTicks.map((frequency) => formatFrequencyLabel(frequency)),
    labelSizing.axisTextSize,
  );
  const yTickMetrics = getTallestTextMetrics(
    yTicks.map((value) => formatDbLabel(value)),
    labelSizing.axisTextSize,
  );
  const xAxisLabelMetrics = measureSvgText('Frequency (Hz, log)', labelSizing.axisLabelSize);
  const yAxisLabelMetrics = measureSvgText(yAxisLabelText, labelSizing.axisLabelSize);
  const left = Math.ceil(
    PLOT_OUTER_HORIZONTAL_PADDING +
    yAxisLabelMetrics.height +
    PLOT_AXIS_LABEL_GAP +
    yTickWidth +
    PLOT_Y_TICK_GAP,
  );
  const right = Math.ceil(
    Math.max(
      PLOT_OUTER_HORIZONTAL_PADDING,
      getWidestTextWidth([formatFrequencyLabel(xTicks[xTicks.length - 1] ?? DEFAULT_END_FREQUENCY)], labelSizing.axisTextSize) / 2,
    ),
  );
  const top = Math.ceil(PLOT_OUTER_TOP_PADDING + yTickMetrics.height / 2);
  const bottom = Math.ceil(
    PLOT_OUTER_BOTTOM_PADDING +
    PLOT_X_TICK_GAP +
    xTickMetrics.height +
    PLOT_AXIS_LABEL_GAP +
    xAxisLabelMetrics.height,
  );
  const drawableWidth = Math.max(containerWidth - left - right, 1);

  return {
    width: containerWidth,
    height: Math.ceil(top + drawableWidth * PLOT_DRAW_AREA_ASPECT_RATIO + bottom),
    left,
    right,
    top,
    bottom,
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

function getYAxisLabelX(
  left: number,
  yTicks: number[],
  labelText: string,
  labelSizing: PlotLabelSizing,
): number {
  const widestTickLabelWidth = getWidestTextWidth(
    yTicks.map((value) => formatDbLabel(value)),
    labelSizing.axisTextSize,
  );
  const labelMetrics = measureSvgText(labelText, labelSizing.axisLabelSize);
  const tickLabelLeftEdge = left - PLOT_Y_TICK_GAP - widestTickLabelWidth;
  return tickLabelLeftEdge - PLOT_AXIS_LABEL_GAP - labelMetrics.height / 2;
}

function getXAxisTickY(geometry: ResponsePlotGeometry): number {
  return geometry.height - geometry.bottom + PLOT_X_TICK_GAP;
}

function getXAxisLabelY(geometry: ResponsePlotGeometry, labelSizing: PlotLabelSizing): number {
  const tickMetrics = getTallestTextMetrics(['20k'], labelSizing.axisTextSize);
  return getXAxisTickY(geometry) + tickMetrics.height + PLOT_AXIS_LABEL_GAP;
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
  const labelSizing = getPlotLabelSizing(input.compact);
  const yAxisLabelText = input.normalizePlot ? 'Normalized response (dB)' : 'Response (dB)';
  const geometry = getResponsePlotGeometry(
    [...plottedMeasurements.map((entry) => entry.points), ...plottedReferenceCurves.map((entry) => entry.points)],
    input.containerWidth,
    labelSizing,
    yAxisLabelText,
  );
  const xTicks = labelSizing.xTicks.filter(
    (frequency) =>
      frequency >= geometry.minFrequency && frequency <= geometry.maxFrequency,
  );
  const yTicks = Array.from({ length: labelSizing.yTickCount }, (_unused, index) => {
    const ratio = index / (labelSizing.yTickCount - 1);
    return geometry.maxDb - (geometry.maxDb - geometry.minDb) * ratio;
  });
  const yAxisLabelX = getYAxisLabelX(geometry.left, yTicks, yAxisLabelText, labelSizing);
  const xAxisTickY = getXAxisTickY(geometry);
  const xAxisLabelY = getXAxisLabelY(geometry, labelSizing);

  const xAxisY = geometry.height - geometry.bottom;
  const yAxisX = geometry.left;
  const toleranceFailPaths = buildToleranceFailPaths(
    input.toleranceOverlay,
    plottedMeasurements,
    plottedReferenceCurves,
    geometry,
    xAxisY,
  );

  const starredMeasurements = plottedMeasurements.filter(({ measurement }) => measurement.starred);
  const graphIdBase = `response-plot-${Date.now()}`;
  const starredGradientDefs = starredMeasurements.map(({ measurement }) => {
    const gradientId = `${graphIdBase}-starred-gradient-${measurement.id}`;
    const starredStyle: ApoBandVisualStyle = {
      nodeFill: '#f8a145',
      strokeSoft: '#f8a145',
      fillTop: 'rgba(248,161,69,0.35)',
      fillBottom: 'rgba(248,161,69,0.02)',
    };
    return buildApoBandGradientDef(gradientId, starredStyle);
  }).join('');

  return `
    <div class="plot-hover" id="plotHover">Hover: --</div>
      <svg id="responsePlot" width="${geometry.width}" height="${geometry.height}" viewBox="0 0 ${geometry.width} ${geometry.height}" role="img" aria-label="Measured frequency response overlay with logarithmic frequency axis">
      ${starredGradientDefs.length > 0 ? `<defs>${starredGradientDefs}</defs>` : ''}
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

          const isStarred = measurement.starred;
          const strokeColor = isStarred ? '#f8a145' : measurement.color;
          const strokeWidth = isStarred ? '3.75' : '3';

          if (isStarred) {
            const gradientId = `${graphIdBase}-starred-gradient-${measurement.id}`;
            const fillPath = buildClosedBandFillPath(points.map((p) => ({ frequencyHz: p.frequencyHz, totalDb: p.smoothedMagnitudeDbRelative })), geometry, xAxisY);
            const fillMarkup = fillPath.length > 0
              ? `<path d="${fillPath}" fill="url(#${gradientId})" stroke="none"></path>`
              : '';
            return `${fillMarkup}<polyline points="${path}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>`;
          }

          return `<polyline points="${path}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>`;
        })
        .join('')}
      <line id="plotHoverLine" x1="0" y1="${geometry.top}" x2="0" y2="${xAxisY}" stroke="#f8a145" stroke-width="1" opacity="0" vector-effect="non-scaling-stroke"></line>
      ${input.visibleMeasurements
        .map(
          (measurement, index) =>
            `<circle class="plot-hover-dot" data-hover-index="${index}" cx="0" cy="0" r="4" fill="${measurement.starred ? '#f8a145' : measurement.color}" stroke="#0d0d0f" stroke-width="1.5" opacity="0" vector-effect="non-scaling-stroke"></circle>`,
        )
        .join('')}
      ${yTicks
        .map((value) => {
          const y = getPlotY(value, geometry);
            return `<text x="${(geometry.left - PLOT_Y_TICK_GAP).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle" class="plot-axis-text">${formatDbLabel(value)}</text>`;
           })
           .join('')}
      ${xTicks
        .map((frequency) => {
          const x = getPlotX(frequency, geometry);
          return `<text x="${x.toFixed(1)}" y="${xAxisTickY.toFixed(1)}" text-anchor="middle" dominant-baseline="hanging" class="plot-axis-text">${formatFrequencyLabel(frequency)}</text>`;
         })
         .join('')}
      <text x="${((geometry.left + (geometry.width - geometry.right)) / 2).toFixed(1)}" y="${xAxisLabelY.toFixed(1)}" text-anchor="middle" dominant-baseline="hanging" class="plot-axis-label">Frequency (Hz, log)</text>
      <text x="${yAxisLabelX.toFixed(1)}" y="${((geometry.top + (geometry.height - geometry.bottom)) / 2).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${yAxisLabelX.toFixed(1)} ${((geometry.top + (geometry.height - geometry.bottom)) / 2).toFixed(1)})" class="plot-axis-label">${yAxisLabelText}</text>
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

  const viewBox = svg.getAttribute('viewBox');
  const viewBoxWidth = viewBox ? Number(viewBox.split(' ')[2]) : NaN;
  if (!Number.isFinite(viewBoxWidth) || viewBoxWidth <= 0) {
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
  const compact = viewBoxWidth < 560;
  const labelSizing = getPlotLabelSizing(compact);
  const yAxisLabelText = input.normalizePlot ? 'Normalized response (dB)' : 'Response (dB)';
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
    viewBoxWidth,
    labelSizing,
    yAxisLabelText,
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
      hoverDetails.push(`<span style="color:${measurement.starred ? '#f8a145' : measurement.color}">${valueText}</span>`);
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
  responseMultiplier: number;
  preampDb: number;
  measurementName: string | null;
  targetName: string | null;
  compact: boolean;
  containerWidth: number;
}): string {
  const enabledFilters = input.filters.filter((filter) => filter.enabled);
  const sampledPoints = buildApoPreviewSampledPoints(
    enabledFilters,
    input.eqMode,
    input.sampleRate,
    input.responseMultiplier,
    input.preampDb,
  );
  const individualPointSets = input.eqMode === 'graphic'
    ? []
    : enabledFilters.map((filter) => ({
        filter,
        points: sampledPoints.map((point) => ({
          frequencyHz: point.frequencyHz,
          totalDb: getRenderedApoEqValueDb(
            getApoFilterResponseDb(filter, point.frequencyHz, input.sampleRate),
            input.eqMode,
            input.responseMultiplier,
            input.preampDb,
          ),
        })),
      }));
  const labelSizing = getPlotLabelSizing(input.compact);
  const yAxisLabelText = Math.abs(input.preampDb) >= 0.05 ? 'Output Gain (dB)' : 'EQ Gain (dB)';
  const geometry = getApoEqPlotGeometry(
    enabledFilters,
    sampledPoints,
    individualPointSets,
    input.containerWidth,
    input.sampleRate,
    input.eqMode,
    input.responseMultiplier,
    input.preampDb,
    labelSizing,
    yAxisLabelText,
  );
  const yTicks = Array.from({ length: labelSizing.yTickCount }, (_unused, index) => {
    const ratio = index / (labelSizing.yTickCount - 1);
    return geometry.maxDb - (geometry.maxDb - geometry.minDb) * ratio;
  });
  const yAxisLabelX = getYAxisLabelX(geometry.left, yTicks, yAxisLabelText, labelSizing);
  const xAxisTickY = getXAxisTickY(geometry);
  const xAxisLabelY = getXAxisLabelY(geometry, labelSizing);
  const xAxisY = getPlotY(0, geometry);
  const yAxisX = geometry.left;
  const isParametricMode = input.eqMode === 'parametric';
  const graphicNodeProfile = getGraphicEqNodeRenderProfile(enabledFilters, geometry);
  const combinedStrokePath = buildPolylinePath(sampledPoints, geometry);
  const graphIdBase = `apo-eq-${getSvgSafeId(`${input.eqMode}-${input.measurementName ?? 'measurement'}-${input.targetName ?? 'target'}`)}`;
  const bandVisuals = individualPointSets.map(({ filter, points }, index) => ({
    filter,
    points,
    style: getApoBandVisualStyle(index),
    gradientId: `${graphIdBase}-band-gradient-${index}`,
  }));
  const combinedGradientIdBase = `${graphIdBase}-combined-gradient`;
  const combinedVisualStyle: ApoBandVisualStyle = {
    nodeFill: '#f8a145',
    strokeSoft: '#f8a145',
    fillTop: 'rgba(248,161,69,0.35)',
    fillBottom: 'rgba(248,161,69,0.02)',
  };
  const svgDefs = isParametricMode
    ? `
      <defs>
        ${buildApoBandGradientDef(combinedGradientIdBase, combinedVisualStyle)}
        ${bandVisuals
          .map(({ style, gradientId }) => buildApoBandGradientDef(gradientId, style))
          .join('')}
      </defs>`
    : `
      <defs>
        ${buildApoBandGradientDef(combinedGradientIdBase, combinedVisualStyle)}
      </defs>`;

  return `
    <div class="plot-hover" id="apoPlotHover">Hover: --</div>
    <svg class="apo-eq-svg${isParametricMode ? ' apo-eq-svg-parametric' : ' apo-eq-svg-graphic'}" width="${geometry.width}" height="${geometry.height}" viewBox="0 0 ${geometry.width} ${geometry.height}" role="img" aria-label="Equalizer APO frequency response graph">
      ${svgDefs}
      <rect x="0" y="0" width="${geometry.width}" height="${geometry.height}" rx="4" fill="rgba(255,255,255,0.02)"></rect>
      ${yTicks
        .map((value) => {
          const y = getPlotY(value, geometry);
          return `<line x1="${geometry.left}" y1="${y.toFixed(1)}" x2="${geometry.width - geometry.right}" y2="${y.toFixed(1)}" stroke="${isParametricMode ? (Math.abs(value) < 0.01 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)') : 'rgba(255,255,255,0.07)'}" vector-effect="non-scaling-stroke" />`;
        })
        .join('')}
      ${labelSizing.xTicks.map((frequency) => {
        const x = getPlotX(frequency, geometry);
        return `<line x1="${x.toFixed(1)}" y1="${geometry.top}" x2="${x.toFixed(1)}" y2="${geometry.height - geometry.bottom}" stroke="${isParametricMode ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.06)'}" vector-effect="non-scaling-stroke" />`;
      }).join('')}
      <line x1="${yAxisX}" y1="${xAxisY.toFixed(1)}" x2="${geometry.width - geometry.right}" y2="${xAxisY.toFixed(1)}" stroke="${isParametricMode ? 'rgba(255,255,255,0.24)' : 'rgba(248,161,69,0.3)'}" vector-effect="non-scaling-stroke" />
      <line x1="${yAxisX}" y1="${geometry.top}" x2="${yAxisX}" y2="${geometry.height - geometry.bottom}" stroke="${isParametricMode ? 'rgba(255,255,255,0.12)' : 'rgba(248,161,69,0.24)'}" vector-effect="non-scaling-stroke" />
      ${individualPointSets
        .map(({ filter, points }, index) => {
          const linePath = buildPolylinePath(points, geometry);
          const fillSegments = buildClosedBandFillSegments(points, geometry, xAxisY);
          const visualStyle = bandVisuals[index]?.style ?? getApoBandVisualStyle(index);
          const gradientIdBase = bandVisuals[index]?.gradientId ?? `${graphIdBase}-band-gradient-${index}`;

          const filterSummary = apoFilterKindUsesGain(filter.kind)
            ? `${formatApoFilterKindLabel(filter.kind)} ${filter.frequencyHz.toFixed(0)} Hz ${filter.gainDb.toFixed(1)} dB`
            : `${formatApoFilterKindLabel(filter.kind)} ${filter.frequencyHz.toFixed(0)} Hz`;
          const shapeSummary =
            filter.kind === 'LPBW' || filter.kind === 'HPBW' || filter.kind === 'LPLR' || filter.kind === 'HPLR'
              ? ` ${getApoFilterShapeLabel(filter.kind)} ${filter.order ?? 4}`
              : filter.kind === 'LSC_DB' || filter.kind === 'HSC_DB'
              ? ` ${getApoFilterShapeLabel(filter.kind)} ${filter.slopeDbPerOct?.toFixed(1) ?? '6.0'} dB/oct`
              : filter.kind === 'LS' || filter.kind === 'HS'
                ? ''
                : ` ${getApoFilterShapeLabel(filter.kind)} ${filter.q.toFixed(2)}`;

          if (!isParametricMode) {
            return `<polyline points="${points.map((point) => `${getPlotX(point.frequencyHz, geometry).toFixed(1)},${getPlotY(point.totalDb, geometry).toFixed(1)}`).join(' ')}" fill="none" stroke="rgba(125,125,125,0.65)" stroke-width="1.5" stroke-dasharray="6 6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"><title>${escapeHtml(input.eqMode === 'graphic' ? `GEQ ${filter.frequencyHz.toFixed(0)} Hz ${filter.gainDb.toFixed(1)} dB Q ${filter.q.toFixed(2)}` : `${filterSummary}${shapeSummary}`)}</title></polyline>`;
          }

          const fillMarkup = fillSegments
            .map((segment) => `<path d="${segment.path}" fill="url(#${getApoBandGradientId(gradientIdBase, segment.polarity)})" stroke="none"></path>`)
            .join('');
          return `<g class="apo-parametric-band-visual" data-apo-filter-id="${escapeHtml(filter.id)}">${fillMarkup}<path d="${linePath}" fill="none" stroke="${visualStyle.strokeSoft}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"><title>${escapeHtml(`${filterSummary}${shapeSummary}`)}</title></path></g>`;
        })
        .join('')}
      ${(() => {
        const combinedFillSegments = buildClosedBandFillSegments(sampledPoints, geometry, xAxisY);
        const combinedFillMarkup = combinedFillSegments
          .map((segment) => `<path d="${segment.path}" fill="url(#${getApoBandGradientId(combinedGradientIdBase, segment.polarity)})" stroke="none"></path>`)
          .join('');
        return isParametricMode
          ? `${combinedFillMarkup}<path d="${combinedStrokePath}" fill="none" stroke="#f8a145" stroke-width="3.45" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>`
          : `${combinedFillMarkup}<polyline points="${sampledPoints.map((point) => `${getPlotX(point.frequencyHz, geometry).toFixed(1)},${getPlotY(point.totalDb, geometry).toFixed(1)}`).join(' ')}" fill="none" stroke="#f8a145" stroke-width="3.45" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>`;
      })()}
      <line id="apoPlotHoverLine" x1="0" y1="${geometry.top}" x2="0" y2="${geometry.height - geometry.bottom}" stroke="#f8a145" stroke-width="1" opacity="0" vector-effect="non-scaling-stroke"></line>
      ${enabledFilters
        .filter((filter, index) => shouldRenderGraphicEqNode(index, enabledFilters.length, input.eqMode, graphicNodeProfile))
        .map((filter, index) => {
          const x = getPlotX(filter.frequencyHz, geometry);
          const nodeGainDb = getRenderedApoFilterNodeGainDb(
            filter,
            input.sampleRate,
            input.eqMode,
            input.responseMultiplier,
            input.preampDb,
          );
          const y = getPlotY(nodeGainDb, geometry);
          const visualStyle = isParametricMode
            ? (bandVisuals[index]?.style ?? getApoBandVisualStyle(index))
            : null;
          const nodeSummary = apoFilterKindUsesGain(filter.kind)
            ? `${formatApoFilterKindLabel(filter.kind)} ${filter.frequencyHz.toFixed(0)} Hz, ${filter.gainDb.toFixed(1)} dB`
            : `${formatApoFilterKindLabel(filter.kind)} ${filter.frequencyHz.toFixed(0)} Hz`;
          return `<circle class="apo-filter-node" data-apo-filter-id="${escapeHtml(filter.id)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${graphicNodeProfile.radius.toFixed(1)}" fill="${visualStyle?.nodeFill ?? '#f8a145'}" stroke="#4d2b0b" stroke-width="${graphicNodeProfile.strokeWidth.toFixed(2)}" cursor="grab" vector-effect="non-scaling-stroke"><title>${escapeHtml(nodeSummary)}</title></circle>`;
        })
        .join('')}
      ${yTicks
        .map((value) => {
          const y = getPlotY(value, geometry);
          return `<text x="${(geometry.left - PLOT_Y_TICK_GAP).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle" class="plot-axis-text">${formatDbLabel(getDisplayedApoAxisValueDb(value, input.preampDb))}</text>`;
        })
        .join('')}
      ${labelSizing.xTicks.map((frequency) => {
        const x = getPlotX(frequency, geometry);
        return `<text x="${x.toFixed(1)}" y="${xAxisTickY.toFixed(1)}" text-anchor="middle" dominant-baseline="hanging" class="plot-axis-text">${formatFrequencyLabel(frequency)}</text>`;
      }).join('')}
      <text x="${((geometry.left + (geometry.width - geometry.right)) / 2).toFixed(1)}" y="${xAxisLabelY.toFixed(1)}" text-anchor="middle" dominant-baseline="hanging" class="plot-axis-label">Frequency (Hz, log)</text>
      <text x="${yAxisLabelX.toFixed(1)}" y="${((geometry.top + (geometry.height - geometry.bottom)) / 2).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${yAxisLabelX.toFixed(1)} ${((geometry.top + (geometry.height - geometry.bottom)) / 2).toFixed(1)})" class="plot-axis-label">${yAxisLabelText}</text>
    </svg>
  `;
}

function getPlotLabelSizing(compact: boolean): PlotLabelSizing {
  if (compact) {
    return {
      axisTextSize: PLOT_TEXT_SIZE_PX,
      axisLabelSize: PLOT_LABEL_SIZE_PX,
      yTickCount: 4,
      xTicks: COMPACT_GRAPH_FREQUENCIES,
    };
  }

  return {
    axisTextSize: PLOT_TEXT_SIZE_PX,
    axisLabelSize: PLOT_LABEL_SIZE_PX,
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
  eqMode: ApoEqMode,
  responseMultiplier: number,
  preampDb: number,
  labelSizing: PlotLabelSizing,
  yAxisLabelText: string,
): ResponsePlotGeometry {
  const allValues = [
    ...sampledPoints.map((point) => point.totalDb),
    ...individualPointSets.flatMap((entry) => entry.points.map((point) => point.totalDb)),
    ...enabledFilters.map((filter) => getRenderedApoFilterNodeGainDb(
      filter,
      sampleRate,
      eqMode,
      responseMultiplier,
      preampDb,
    )),
    0,
  ];
  const minDb = Math.min(-12, Math.floor((Math.min(...allValues) - 1) / 3) * 3);
  const maxDb = Math.max(12, Math.ceil((Math.max(...allValues) + 1) / 3) * 3);
  const yTicks = Array.from({ length: labelSizing.yTickCount }, (_unused, index) => {
    const ratio = index / (labelSizing.yTickCount - 1);
    return maxDb - (maxDb - minDb) * ratio;
  });
  const frame = buildPlotFrame(
    containerWidth,
    yTicks,
    labelSizing.xTicks,
    yAxisLabelText,
    labelSizing,
  );

  return {
    width: frame.width,
    height: frame.height,
    left: frame.left,
    right: frame.right,
    top: frame.top,
    bottom: frame.bottom,
    minFrequency: DEFAULT_START_FREQUENCY,
    maxFrequency: DEFAULT_END_FREQUENCY,
    minDb,
    maxDb,
  };
}

function getApoBandVisualStyle(index: number): ApoBandVisualStyle {
  const color = APO_PARAMETRIC_BAND_COLORS[index % APO_PARAMETRIC_BAND_COLORS.length];
  return {
    nodeFill: color,
    strokeSoft: withAlpha(color, 0.45),
    fillTop: withAlpha(color, 0.28),
    fillBottom: withAlpha(color, 0.02),
  };
}

function withAlpha(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  if (expanded.length !== 6) {
    return hexColor;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function getSvgGradientStop(color: string): SvgGradientStop {
  const rgbaMatch = color.match(/^rgba\((\d+),(\d+),(\d+),([+-]?\d*\.?\d+)\)$/u);
  if (rgbaMatch) {
    const red = clamp(Number(rgbaMatch[1]), 0, 255);
    const green = clamp(Number(rgbaMatch[2]), 0, 255);
    const blue = clamp(Number(rgbaMatch[3]), 0, 255);
    const opacity = clamp(Number(rgbaMatch[4]), 0, 1);
    return {
      color: `rgb(${red},${green},${blue})`,
      opacity,
    };
  }

  return {
    color,
    opacity: 1,
  };
}

function getApoBandGradientId(gradientIdBase: string, polarity: BandFillPolarity): string {
  return `${gradientIdBase}-${polarity}`;
}

function buildApoBandGradientDef(
  gradientIdBase: string,
  style: ApoBandVisualStyle,
): string {
  const visibleStop = getSvgGradientStop(style.fillTop);

  return [
    buildBaselineAnchoredGradientDef(
      getApoBandGradientId(gradientIdBase, 'positive'),
      visibleStop.color,
      visibleStop.opacity,
      'positive',
    ),
    buildBaselineAnchoredGradientDef(
      getApoBandGradientId(gradientIdBase, 'negative'),
      visibleStop.color,
      visibleStop.opacity,
      'negative',
    ),
  ].join('');
}

function buildBaselineAnchoredGradientDef(
  gradientId: string,
  color: string,
  opacity: number,
  polarity: BandFillPolarity,
): string {
  // Use objectBoundingBox so gradient scales with the fill path, avoiding edge artifacts
  if (polarity === 'negative') {
    return `
            <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
              <stop offset="0%" stop-color="${color}" stop-opacity="0" />
              <stop offset="100%" stop-color="${color}" stop-opacity="${opacity.toFixed(3)}" />
            </linearGradient>
            `;
  }

  return `
            <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
              <stop offset="0%" stop-color="${color}" stop-opacity="${opacity.toFixed(3)}" />
              <stop offset="100%" stop-color="${color}" stop-opacity="0" />
            </linearGradient>
            `;
}

function getSvgSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function buildPolylinePath(
  points: Array<{ frequencyHz: number; totalDb: number }>,
  geometry: ResponsePlotGeometry,
): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${getPlotX(point.frequencyHz, geometry).toFixed(1)},${getPlotY(point.totalDb, geometry).toFixed(1)}`;
    })
    .join(' ');
}

function buildClosedFillPath(
  points: Array<{ frequencyHz: number; totalDb: number }>,
  geometry: ResponsePlotGeometry,
  baselineY: number,
): string {
  if (points.length === 0) {
    return '';
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  if (!firstPoint || !lastPoint) {
    return '';
  }

  const firstX = getPlotX(firstPoint.frequencyHz, geometry).toFixed(1);
  const lastX = getPlotX(lastPoint.frequencyHz, geometry).toFixed(1);
  const curveCommands = points
    .map((point) => `L ${getPlotX(point.frequencyHz, geometry).toFixed(1)},${getPlotY(point.totalDb, geometry).toFixed(1)}`)
    .join(' ');
  return `M ${firstX},${baselineY.toFixed(1)} ${curveCommands} L ${lastX},${baselineY.toFixed(1)} Z`;
}

function buildClosedBandFillPath(
  points: Array<{ frequencyHz: number; totalDb: number }>,
  geometry: ResponsePlotGeometry,
  baselineY: number,
): string {
  return buildClosedBandFillSegments(points, geometry, baselineY)[0]?.path ?? '';
}

function buildClosedBandFillSegments(
  points: Array<{ frequencyHz: number; totalDb: number }>,
  geometry: ResponsePlotGeometry,
  baselineY: number,
): BandFillSegment[] {
  const ACTIVE_FILL_THRESHOLD_DB = 0.05;
  const firstActiveIndex = points.findIndex((point) => Math.abs(point.totalDb) >= ACTIVE_FILL_THRESHOLD_DB);
  if (firstActiveIndex < 0) {
    return [];
  }

  let lastActiveIndex = firstActiveIndex;
  for (let index = points.length - 1; index >= firstActiveIndex; index -= 1) {
    if (Math.abs(points[index].totalDb) >= ACTIVE_FILL_THRESHOLD_DB) {
      lastActiveIndex = index;
      break;
    }
  }

  const startIndex = Math.max(0, firstActiveIndex - 1);
  const endIndex = Math.min(points.length - 1, lastActiveIndex + 1);
  const trimmedPoints = points.slice(startIndex, endIndex + 1);
  const expandedPoints: Array<{ frequencyHz: number; totalDb: number }> = [];

  for (let index = 0; index < trimmedPoints.length; index += 1) {
    const point = trimmedPoints[index];
    if (!point) {
      continue;
    }

    expandedPoints.push(point);

    const nextPoint = trimmedPoints[index + 1];
    if (!nextPoint) {
      continue;
    }

    const currentDb = point.totalDb;
    const nextDb = nextPoint.totalDb;
    if (currentDb === 0 || nextDb === 0 || Math.sign(currentDb) === Math.sign(nextDb)) {
      continue;
    }

    const crossingRatio = currentDb / (currentDb - nextDb);
    const currentLogFrequency = Math.log(point.frequencyHz);
    const nextLogFrequency = Math.log(nextPoint.frequencyHz);
    expandedPoints.push({
      frequencyHz: Math.exp(currentLogFrequency + (nextLogFrequency - currentLogFrequency) * crossingRatio),
      totalDb: 0,
    });
  }

  const fillSegments: BandFillSegment[] = [];
  let currentPolarity: BandFillPolarity | null = null;
  let currentSegmentPoints: Array<{ frequencyHz: number; totalDb: number }> = [];

  for (let index = 0; index < expandedPoints.length; index += 1) {
    const point = expandedPoints[index];
    if (!point) {
      continue;
    }

    const pointPolarity = point.totalDb >= ACTIVE_FILL_THRESHOLD_DB
      ? 'positive'
      : point.totalDb <= -ACTIVE_FILL_THRESHOLD_DB
        ? 'negative'
        : null;

    if (!pointPolarity) {
      if (currentPolarity && currentSegmentPoints.length > 0) {
        currentSegmentPoints.push(point);
        fillSegments.push({
          path: buildClosedFillPath(currentSegmentPoints, geometry, baselineY),
          polarity: currentPolarity,
        });
        currentPolarity = null;
        currentSegmentPoints = [];
      }
      continue;
    }

    if (!currentPolarity) {
      const previousPoint = expandedPoints[index - 1];
      currentPolarity = pointPolarity;
      currentSegmentPoints = previousPoint && Math.abs(previousPoint.totalDb) < ACTIVE_FILL_THRESHOLD_DB
        ? [previousPoint, point]
        : [point];
      continue;
    }

    if (currentPolarity !== pointPolarity) {
      fillSegments.push({
        path: buildClosedFillPath(currentSegmentPoints, geometry, baselineY),
        polarity: currentPolarity,
      });
      const previousPoint = expandedPoints[index - 1];
      currentPolarity = pointPolarity;
      currentSegmentPoints = previousPoint ? [previousPoint, point] : [point];
      continue;
    }

    currentSegmentPoints.push(point);
  }

  if (currentPolarity && currentSegmentPoints.length > 0) {
    fillSegments.push({
      path: buildClosedFillPath(currentSegmentPoints, geometry, baselineY),
      polarity: currentPolarity,
    });
  }

  return fillSegments;
}

function buildApoPreviewSampledPoints(
  enabledFilters: ApoFilter[],
  eqMode: ApoEqMode,
  sampleRate: number,
  responseMultiplier = 1,
  preampDb = 0,
): Array<{ frequencyHz: number; totalDb: number }> {
  const sampleFrequencies =
    eqMode === 'graphic'
      ? buildGraphicEqPreviewSampleFrequencies(enabledFilters)
      : buildParametricEqPreviewSampleFrequencies(enabledFilters);

  return sampleFrequencies.map((frequencyHz) => ({
    frequencyHz,
    totalDb:
      eqMode === 'graphic'
        ? getGraphicEqResponseDb(enabledFilters, frequencyHz)
        : getRenderedApoEqValueDb(
            enabledFilters.reduce(
              (total, filter) => total + getApoFilterResponseDb(filter, frequencyHz, sampleRate),
              0,
            ),
            eqMode,
            responseMultiplier,
            preampDb,
          ),
  }));
}

function getRenderedApoEqValueDb(
  valueDb: number,
  eqMode: ApoEqMode,
  responseMultiplier: number,
  _preampDb: number,
): number {
  void _preampDb;

  if (eqMode !== 'parametric') {
    return valueDb;
  }

  return valueDb * responseMultiplier;
}

function getEditableApoGainDb(
  displayedDb: number,
  eqMode: ApoEqMode,
  responseMultiplier: number,
  _preampDb: number,
): number {
  void _preampDb;

  if (eqMode !== 'parametric') {
    return displayedDb;
  }

  const normalizedMultiplier = Math.max(Math.abs(responseMultiplier), 1e-6);
  return displayedDb / normalizedMultiplier;
}

function getDisplayedApoAxisValueDb(valueDb: number, preampDb: number): number {
  return valueDb + preampDb;
}

function getRenderedApoFilterNodeGainDb(
  filter: ApoFilter,
  sampleRate: number,
  eqMode: ApoEqMode = 'parametric',
  responseMultiplier = 1,
  preampDb = 0,
): number {
  return getRenderedApoEqValueDb(
    getApoFilterNodeGainDb(filter, sampleRate),
    eqMode,
    responseMultiplier,
    preampDb,
  );
}

function buildParametricEqPreviewSampleFrequencies(filters: ApoFilter[]): number[] {
  const logStart = Math.log(DEFAULT_START_FREQUENCY);
  const logEnd = Math.log(DEFAULT_END_FREQUENCY);
  const baselineSampleCount = Math.max(512, filters.length * 64);
  const sampledFrequencies = new Set<number>();

  for (let index = 0; index < baselineSampleCount; index += 1) {
    const ratio = baselineSampleCount <= 1 ? 0 : index / (baselineSampleCount - 1);
    sampledFrequencies.add(Number(
      (
        DEFAULT_START_FREQUENCY *
        Math.exp((logEnd - logStart) * ratio)
      ).toFixed(4),
    ));
  }

  for (const filter of filters) {
    const centerHz = clamp(filter.frequencyHz, DEFAULT_START_FREQUENCY, DEFAULT_END_FREQUENCY);
    sampledFrequencies.add(Number(centerHz.toFixed(4)));

    const q = Math.max(filter.q, 0.1);
    const spreadOctaves = clamp(0.5 / q, 0.08, 0.75);
    for (const direction of [-1, -0.5, 0.5, 1]) {
      const nearbyFrequencyHz = clamp(
        centerHz * Math.pow(2, spreadOctaves * direction),
        DEFAULT_START_FREQUENCY,
        DEFAULT_END_FREQUENCY,
      );
      sampledFrequencies.add(Number(nearbyFrequencyHz.toFixed(4)));
    }
  }

  return Array.from(sampledFrequencies).sort((left, right) => left - right);
}

function buildGraphicEqPreviewSampleFrequencies(filters: ApoFilter[]): number[] {
  const logStart = Math.log(DEFAULT_START_FREQUENCY);
  const logEnd = Math.log(DEFAULT_END_FREQUENCY);
  const baselineSampleCount = Math.max(256, filters.length * 4);
  const sampledFrequencies = new Set<number>();

  for (let index = 0; index < baselineSampleCount; index += 1) {
    const ratio = baselineSampleCount <= 1 ? 0 : index / (baselineSampleCount - 1);
    sampledFrequencies.add(Number(
      (
        DEFAULT_START_FREQUENCY *
        Math.exp((logEnd - logStart) * ratio)
      ).toFixed(4),
    ));
  }

  for (let index = 0; index < filters.length; index += 1) {
    const filter = filters[index];
    sampledFrequencies.add(Number(filter.frequencyHz.toFixed(4)));

    const nextFilter = filters[index + 1];
    if (!nextFilter) {
      continue;
    }

    const midpointHz = Math.sqrt(filter.frequencyHz * nextFilter.frequencyHz);
    sampledFrequencies.add(Number(midpointHz.toFixed(4)));
  }

  return Array.from(sampledFrequencies).sort((left, right) => left - right);
}

function getGraphicEqNodeRenderProfile(
  enabledFilters: ApoFilter[],
  geometry: ResponsePlotGeometry,
): GraphicEqNodeRenderProfile {
  if (enabledFilters.length <= 1) {
    return {
      radius: 8,
      strokeWidth: 2,
      visibleStride: 1,
    };
  }

  const plotWidth = Math.max(geometry.width - geometry.left - geometry.right, 1);
  const pixelsPerBand = plotWidth / Math.max(enabledFilters.length - 1, 1);
  const visibleStride = pixelsPerBand >= 10 ? 1 : Math.max(1, Math.ceil(10 / Math.max(pixelsPerBand, 0.5)));

  return {
    radius: clamp(2 + pixelsPerBand * 0.35, 2, 8),
    strokeWidth: clamp(1 + pixelsPerBand * 0.06, 1, 2),
    visibleStride,
  };
}

function shouldRenderGraphicEqNode(
  index: number,
  filterCount: number,
  eqMode: ApoEqMode,
  profile: GraphicEqNodeRenderProfile,
): boolean {
  if (eqMode !== 'graphic' || profile.visibleStride <= 1) {
    return true;
  }

  return index === 0 || index === filterCount - 1 || index % profile.visibleStride === 0;
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
        <span>Keep</span>
        <input type="number" min="1" max="100" step="1" value="${measurementKeepCount}" data-measurement-keep-count ${busy ? 'disabled' : ''} />
        <span>curves. Starred measurements are always kept.</span>
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
  labelSizing: PlotLabelSizing,
  yAxisLabelText: string,
): ResponsePlotGeometry {
  const points = measurementPointSets.flatMap((measurement) => measurement);
  const frequencies = points.map((point) => point.frequencyHz);
  const smoothedValues = points.map((point) => point.smoothedMagnitudeDbRelative);
  const measuredTop = Math.max(...smoothedValues) + 3;
  const measuredBottom = Math.min(...smoothedValues) - 3;
  const minDb = measuredBottom;
  const maxDb = measuredBottom + Math.max(24, measuredTop - measuredBottom);
  const yTicks = Array.from({ length: labelSizing.yTickCount }, (_unused, index) => {
    const ratio = index / (labelSizing.yTickCount - 1);
    return maxDb - (maxDb - minDb) * ratio;
  });
  const frame = buildPlotFrame(
    containerWidth,
    yTicks,
    labelSizing.xTicks,
    yAxisLabelText,
    labelSizing,
  );

  return {
    width: frame.width,
    height: frame.height,
    left: frame.left,
    right: frame.right,
    top: frame.top,
    bottom: frame.bottom,
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
  const failureSegments = getToleranceFailureSegments(
    plottedMeasurement.points,
    referencePoints,
    overlay.bands,
  ).filter((segment) => segment.widthHz >= overlay.maxAcceptableErrorWidthHz);

  for (const segment of failureSegments) {
    const firstPoint = segment.points[0];
    const lastPoint = segment.points[segment.points.length - 1];
    if (!firstPoint || !lastPoint) {
      continue;
    }

    if (segment.points.length === 1) {
      const pointX = getPlotX(firstPoint.frequencyHz, geometry);
      const pointY = getPlotY(firstPoint.smoothedMagnitudeDbRelative, geometry);
      const minimumX = geometry.left;
      const maximumX = geometry.width - geometry.right;
      const leftX = clamp(pointX - 2, minimumX, maximumX).toFixed(1);
      const rightX = clamp(pointX + 2, minimumX, maximumX).toFixed(1);

      failPaths.push(
        `M ${leftX},${xAxisY.toFixed(1)} L ${pointX.toFixed(1)},${pointY.toFixed(1)} L ${rightX},${xAxisY.toFixed(1)} Z`,
      );
      continue;
    }

    const curvePath = segment.points
      .map((point) => `${getPlotX(point.frequencyHz, geometry).toFixed(1)},${getPlotY(point.smoothedMagnitudeDbRelative, geometry).toFixed(1)}`)
      .join(' L ');
    const firstX = getPlotX(firstPoint.frequencyHz, geometry).toFixed(1);
    const lastX = getPlotX(lastPoint.frequencyHz, geometry).toFixed(1);

    failPaths.push(
      `M ${firstX},${xAxisY.toFixed(1)} L ${curvePath} L ${lastX},${xAxisY.toFixed(1)} Z`,
    );
  }
  return failPaths;
}

export function attachApoPlotInteractions(input: {
  plotCard: HTMLElement;
  filters: ApoFilter[];
  eqMode: ApoEqMode;
  sampleRate: number;
  responseMultiplier: number;
  preampDb: number;
  lockFrequency: boolean;
  onFilterSelect: (filterId: string) => void;
  onFilterDrag: ApoPlotDragHandler;
  onDragEnd: () => void;
  onAddFilter: (frequencyHz: number, gainDb: number) => void;
}): void {
  const { plotCard } = input;
  const plotCardWithController = plotCard as HTMLElement & {
    __apoPlotController?: {
      filters: ApoFilter[];
      eqMode: ApoEqMode;
      sampleRate: number;
      responseMultiplier: number;
      preampDb: number;
      lockFrequency: boolean;
      onFilterSelect: (filterId: string) => void;
      onFilterDrag: ApoPlotDragHandler;
      onDragEnd: () => void;
      onAddFilter: (frequencyHz: number, gainDb: number) => void;
      draggingFilterId: string | null;
      cleanup: () => void;
    };
  };

  if (plotCardWithController.__apoPlotController) {
    plotCardWithController.__apoPlotController.filters = input.filters;
    plotCardWithController.__apoPlotController.eqMode = input.eqMode;
    plotCardWithController.__apoPlotController.sampleRate = input.sampleRate;
    plotCardWithController.__apoPlotController.responseMultiplier = input.responseMultiplier;
    plotCardWithController.__apoPlotController.preampDb = input.preampDb;
    plotCardWithController.__apoPlotController.lockFrequency = input.lockFrequency;
    plotCardWithController.__apoPlotController.onFilterSelect = input.onFilterSelect;
    plotCardWithController.__apoPlotController.onFilterDrag = input.onFilterDrag;
    plotCardWithController.__apoPlotController.onDragEnd = input.onDragEnd;
    plotCardWithController.__apoPlotController.onAddFilter = input.onAddFilter;
    return;
  }

  const resetHoverState = () => {
    const hoverLine = plotCard.querySelector<SVGLineElement>('#apoPlotHoverLine');
    const hoverLabel = plotCard.querySelector<HTMLDivElement>('#apoPlotHover');
    hoverLine?.setAttribute('opacity', '0');
    if (hoverLabel) {
      hoverLabel.textContent = 'Hover: --';
    }
  };

  const formatNodeTooltipText = (filter: ApoFilter, frequencyHz: number, gainDb: number): string => {
    const tooltipParts = [`${frequencyHz.toFixed(0)} Hz`, `${gainDb.toFixed(1)} dB`];

    if ((plotCardWithController.__apoPlotController?.eqMode ?? input.eqMode) !== 'graphic') {
      tooltipParts.push(`${getApoFilterShapeLabel(filter.kind)} ${formatApoFilterShapeValue(filter)}`);
    }

    return tooltipParts.join(', ');
  };

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
      plotCardWithController.__apoPlotController?.responseMultiplier ?? 1,
      plotCardWithController.__apoPlotController?.preampDb ?? 0,
    );
    const individualPointSets = (plotCardWithController.__apoPlotController?.eqMode ?? 'parametric') === 'graphic'
      ? []
      : enabledFilters.map((filter) => ({
          filter,
          points: sampledPoints.map((point) => ({
            frequencyHz: point.frequencyHz,
            totalDb: getRenderedApoEqValueDb(
              getApoFilterResponseDb(filter, point.frequencyHz, sampleRate),
              plotCardWithController.__apoPlotController?.eqMode ?? 'parametric',
              plotCardWithController.__apoPlotController?.responseMultiplier ?? 1,
              plotCardWithController.__apoPlotController?.preampDb ?? 0,
            ),
          })),
        }));

    const compact = width < 560;
    const labelSizing = getPlotLabelSizing(compact);
    const geometry = getApoEqPlotGeometry(
      enabledFilters,
      sampledPoints,
      individualPointSets,
      width,
      sampleRate,
      plotCardWithController.__apoPlotController?.eqMode ?? 'parametric',
      plotCardWithController.__apoPlotController?.responseMultiplier ?? 1,
      plotCardWithController.__apoPlotController?.preampDb ?? 0,
      labelSizing,
      'EQ Gain (dB)',
    );
    return { ...geometry, width, height };
  };

  const updateHover = (clientX: number) => {
    const controller = plotCardWithController.__apoPlotController;
    if (!controller?.filters.length || controller.draggingFilterId) {
      return;
    }

    const svg = plotCard.querySelector<SVGSVGElement>('svg');
    const hoverLine = plotCard.querySelector<SVGLineElement>('#apoPlotHoverLine');
    const hoverLabel = plotCard.querySelector<HTMLDivElement>('#apoPlotHover');
    if (!svg || !hoverLine || !hoverLabel) {
      return;
    }

    const geometry = getGeometryFromSvg(controller.filters);
    if (!geometry) {
      return;
    }

    const bounds = svg.getBoundingClientRect();
    const plotX = ((clientX - bounds.left) / bounds.width) * geometry.width;
    const hoveredFrequency = clamp(getFrequencyForPlotX(plotX, geometry), DEFAULT_START_FREQUENCY, DEFAULT_END_FREQUENCY);
    const sampledPoints = buildApoPreviewSampledPoints(
      controller.filters.filter((filter) => filter.enabled),
      controller.eqMode,
      controller.sampleRate,
      controller.responseMultiplier,
      controller.preampDb,
    );
    const closestPoint = sampledPoints.reduce((closest, point) => (
      Math.abs(point.frequencyHz - hoveredFrequency) < Math.abs(closest.frequencyHz - hoveredFrequency)
        ? point
        : closest
    ));
    const hoverLineX = getPlotX(closestPoint.frequencyHz, geometry);

    hoverLine.setAttribute('x1', hoverLineX.toFixed(1));
    hoverLine.setAttribute('x2', hoverLineX.toFixed(1));
    hoverLine.setAttribute('opacity', '1');
    const displayedDb = getDisplayedApoAxisValueDb(closestPoint.totalDb, controller.preampDb);
    hoverLabel.textContent = `Hover: ${formatFrequencyDetailed(closestPoint.frequencyHz)} | ${displayedDb.toFixed(1)} dB`;
  };

  const getTooltipScreenPosition = (svg: SVGSVGElement, nodeX: number, nodeY: number) => {
    const screenMatrix = svg.getScreenCTM();
    if (!screenMatrix) {
      return null;
    }

    const svgPoint = svg.createSVGPoint();
    svgPoint.x = nodeX;
    svgPoint.y = nodeY;
    return svgPoint.matrixTransform(screenMatrix);
  };

  const handleMouseDown = (event: MouseEvent) => {
    const controller = plotCardWithController.__apoPlotController;
    if (!controller) {
      return;
    }

    const svg = plotCard.querySelector('svg');
    if (!(svg instanceof SVGSVGElement)) {
      return;
    }

    const target = event.target;
    const geometry = getGeometryFromSvg(controller.filters);
    const filterId =
      target instanceof SVGCircleElement && target.classList.contains('apo-filter-node')
        ? target.getAttribute('data-apo-filter-id')
        : controller.eqMode === 'graphic' && geometry
          ? getGraphicEqFilterIdForPointer(controller.filters, geometry, svg, event.clientX, event.clientY)
          : null;
    if (!filterId || !geometry) {
      return;
    }

    controller.onFilterSelect(filterId);

    event.preventDefault();

    // Create tooltip positioned above the node (append to body to survive re-renders)
    const filter = controller.filters.find((f) => f.id === filterId);
    if (!filter) {
      return;
    }

    controller.draggingFilterId = filterId;
    if (target instanceof SVGCircleElement && target.classList.contains('apo-filter-node')) {
      target.classList.add('is-dragging');
      target.setAttribute('cursor', 'grabbing');
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'apo-node-tooltip';
    tooltip.id = 'apo-node-tooltip';

    // Set initial content from filter values
    tooltip.textContent = formatNodeTooltipText(filter, filter.frequencyHz, filter.gainDb);

    // Position using the filter's graph coordinates so it still works when many nodes are hidden.
    const nodeCx = getPlotX(filter.frequencyHz, geometry);
    const nodeCy = getPlotY(
      getRenderedApoFilterNodeGainDb(
        filter,
        controller.sampleRate,
        controller.eqMode,
        controller.responseMultiplier,
        controller.preampDb,
      ),
      geometry,
    );
    const screenPosition = getTooltipScreenPosition(svg, nodeCx, nodeCy);
    if (screenPosition) {
      tooltip.style.left = `${screenPosition.x}px`;
      tooltip.style.top = `${screenPosition.y}px`;
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
      getEditableApoGainDb(
        getDbForPlotY(transformedPoint.y, geometry),
        controller.eqMode,
        controller.responseMultiplier,
        controller.preampDb,
      ),
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
                order: null,
                slopeDbPerOct: null,
              }),
              frequencyHz,
            },
            controller.sampleRate,
          );
      tooltip.textContent = formatNodeTooltipText(activeFilter ?? filterFallback(frequencyHz), frequencyHz, displayedGainDb);

      const nodeX = getPlotX(frequencyHz, geometry);
      const nodeY = getPlotY(
        getRenderedApoEqValueDb(
          displayedGainDb,
          controller.eqMode,
          controller.responseMultiplier,
          controller.preampDb,
        ),
        geometry,
      );
      const screenPosition = getTooltipScreenPosition(svg, nodeX, nodeY);
      if (screenPosition) {
        tooltip.style.left = `${screenPosition.x}px`;
        tooltip.style.top = `${screenPosition.y}px`;
      }
    }

    controller.onFilterDrag(controller.draggingFilterId, frequencyHz, gainDb, axis);
  };

  const handlePointerMove = (event: PointerEvent) => {
    updateHover(event.clientX);
  };

  const handlePointerLeave = () => {
    resetHoverState();
  };

  const handleDoubleClick = (event: MouseEvent) => {
    const controller = plotCardWithController.__apoPlotController;
    if (!controller || controller.draggingFilterId) {
      return;
    }

    const svg = plotCard.querySelector('svg');
    if (!(svg instanceof SVGSVGElement)) {
      return;
    }

    const geometry = getGeometryFromSvg(controller.filters);
    if (!geometry) {
      return;
    }

    const svgPoint = svg.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;

    const screenMatrix = svg.getScreenCTM();
    if (!screenMatrix) {
      return;
    }

    const transformedPoint = svgPoint.matrixTransform(screenMatrix.inverse());
    if (
      transformedPoint.x < geometry.left ||
      transformedPoint.x > geometry.width - geometry.right ||
      transformedPoint.y < geometry.top ||
      transformedPoint.y > geometry.height - geometry.bottom
    ) {
      return;
    }

    event.preventDefault();
    controller.onAddFilter(
      clamp(getFrequencyForPlotX(transformedPoint.x, geometry), 20, 20000),
      clamp(
        getEditableApoGainDb(
          getDbForPlotY(transformedPoint.y, geometry),
          controller.eqMode,
          controller.responseMultiplier,
          controller.preampDb,
        ),
        -24,
        24,
      ),
    );
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
    resetHoverState();
  };

  const cleanup = () => {
    plotCard.removeEventListener('mousedown', handleMouseDown);
    plotCard.removeEventListener('dblclick', handleDoubleClick);
    plotCard.removeEventListener('pointermove', handlePointerMove);
    plotCard.removeEventListener('pointerleave', handlePointerLeave);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);

    // Clean up tooltip from body if it exists
    const tooltip = document.getElementById('apo-node-tooltip');
    if (tooltip && tooltip.parentElement) {
      tooltip.parentElement.removeChild(tooltip);
    }
  };

  plotCard.addEventListener('mousedown', handleMouseDown);
  plotCard.addEventListener('dblclick', handleDoubleClick);
  plotCard.addEventListener('pointermove', handlePointerMove);
  plotCard.addEventListener('pointerleave', handlePointerLeave);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  plotCardWithController.__apoPlotController = {
    filters: input.filters,
    eqMode: input.eqMode,
    sampleRate: input.sampleRate,
    responseMultiplier: input.responseMultiplier,
    preampDb: input.preampDb,
    lockFrequency: input.lockFrequency,
    onFilterSelect: input.onFilterSelect,
    onFilterDrag: input.onFilterDrag,
    onDragEnd: input.onDragEnd,
    onAddFilter: input.onAddFilter,
    draggingFilterId: null,
    cleanup,
  };
}

function filterFallback(frequencyHz: number): ApoFilter {
  return {
    id: '',
    enabled: true,
    kind: 'PK',
    frequencyHz,
    gainDb: 0,
    q: 1.41,
    order: null,
    slopeDbPerOct: null,
  };
}

function getDbForPlotY(y: number, geometry: ResponsePlotGeometry): number {
  const clampedY = clamp(y, geometry.top, geometry.height - geometry.bottom);
  const ratio =
    (clampedY - geometry.top) /
    (geometry.height - geometry.top - geometry.bottom);
  return geometry.maxDb - ratio * (geometry.maxDb - geometry.minDb);
}

function getGraphicEqFilterIdForPointer(
  filters: ApoFilter[],
  geometry: ResponsePlotGeometry,
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): string | null {
  const enabledFilters = filters.filter((filter) => filter.enabled);
  if (enabledFilters.length === 0) {
    return null;
  }

  const svgPoint = svg.createSVGPoint();
  svgPoint.x = clientX;
  svgPoint.y = clientY;

  const screenMatrix = svg.getScreenCTM();
  if (!screenMatrix) {
    return null;
  }

  const transformedPoint = svgPoint.matrixTransform(screenMatrix.inverse());
  if (
    transformedPoint.x < geometry.left ||
    transformedPoint.x > geometry.width - geometry.right ||
    transformedPoint.y < geometry.top ||
    transformedPoint.y > geometry.height - geometry.bottom
  ) {
    return null;
  }

  let closestFilter: ApoFilter | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const filter of enabledFilters) {
    const distance = Math.abs(getPlotX(filter.frequencyHz, geometry) - transformedPoint.x);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestFilter = filter;
    }
  }

  return closestFilter?.id ?? null;
}
