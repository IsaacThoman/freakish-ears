import {
  DEFAULT_END_FREQUENCY,
  DEFAULT_START_FREQUENCY,
} from './constants';
import { getMeasurementPointsForDisplay } from './measurements';
import type {
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
  );
  const xTicks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter(
    (frequency) =>
      frequency >= geometry.minFrequency && frequency <= geometry.maxFrequency,
  );
  const yTicks = Array.from({ length: 5 }, (_unused, index) => {
    const ratio = index / 4;
    return geometry.maxDb - (geometry.maxDb - geometry.minDb) * ratio;
  });

  const xAxisY = geometry.height - geometry.bottom;
  const yAxisX = geometry.left;

  return `
    <div class="plot-hover" id="plotHover">Hover: --</div>
      <svg id="responsePlot" width="${geometry.width}" height="${geometry.height}" viewBox="0 0 ${geometry.width} ${geometry.height}" role="img" aria-label="Measured frequency response overlay with logarithmic frequency axis">
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
      <text x="28" y="${(geometry.top + (geometry.height - geometry.bottom)) / 2}" text-anchor="middle" transform="rotate(-90 28 ${(geometry.top + (geometry.height - geometry.bottom)) / 2})" class="plot-axis-label">${input.normalizePlot ? 'Normalized response (dB)' : 'Response (dB)'}</text>
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

export function renderApoEqPlot(input: {
  filters: ApoFilter[];
  measurementName: string | null;
  targetName: string | null;
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
  const allValues = [
    ...sampledPoints.map((point) => point.totalDb),
    ...individualPointSets.flatMap((entry) => entry.points.map((point) => point.totalDb)),
    0,
  ];
  const minDb = Math.min(-12, Math.floor((Math.min(...allValues) - 1) / 3) * 3);
  const maxDb = Math.max(12, Math.ceil((Math.max(...allValues) + 1) / 3) * 3);
  const geometry: ResponsePlotGeometry = {
    width: 960,
    height: 356,
    left: 84,
    right: 24,
    top: 18,
    bottom: 94,
    minFrequency: DEFAULT_START_FREQUENCY,
    maxFrequency: DEFAULT_END_FREQUENCY,
    minDb,
    maxDb,
  };
  const yTicks = Array.from({ length: 7 }, (_unused, index) => {
    const ratio = index / 6;
    return geometry.maxDb - (geometry.maxDb - geometry.minDb) * ratio;
  });
  const xAxisY = getPlotY(0, geometry);
  const yAxisX = geometry.left;
  const combinedPath = sampledPoints
    .map((point) => `${getPlotX(point.frequencyHz, geometry).toFixed(1)},${getPlotY(point.totalDb, geometry).toFixed(1)}`)
    .join(' ');

  return `
    <div class="plot-hover">EQ Graph: ${escapeHtml(input.measurementName ?? 'No measurement')} -> ${escapeHtml(input.targetName ?? 'No target')}</div>
    <svg width="${geometry.width}" height="${geometry.height}" viewBox="0 0 ${geometry.width} ${geometry.height}" role="img" aria-label="Equalizer APO frequency response graph">
      <rect x="0" y="0" width="${geometry.width}" height="${geometry.height}" rx="4" fill="rgba(255,255,255,0.02)"></rect>
      ${yTicks
        .map((value) => {
          const y = getPlotY(value, geometry);
          return `<line x1="${geometry.left}" y1="${y.toFixed(1)}" x2="${geometry.width - geometry.right}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.07)" vector-effect="non-scaling-stroke" />`;
        })
        .join('')}
      ${EQ_GRAPH_FREQUENCIES.map((frequency) => {
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

          return `<polyline points="${path}" fill="none" stroke="rgba(125,125,125,0.65)" stroke-width="1.5" stroke-dasharray="6 6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"><title>${escapeHtml(`PK ${filter.frequencyHz.toFixed(0)} Hz ${filter.gainDb.toFixed(1)} dB Q ${filter.q.toFixed(2)}`)}</title></polyline>`;
        })
        .join('')}
      <polyline points="${combinedPath}" fill="none" stroke="#f8a145" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>
      ${yTicks
        .map((value) => {
          const y = getPlotY(value, geometry);
          return `<text x="${geometry.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="plot-axis-text">${formatDbLabel(value)}</text>`;
        })
        .join('')}
      ${EQ_GRAPH_FREQUENCIES.map((frequency) => {
        const x = getPlotX(frequency, geometry);
        return `<text x="${x.toFixed(1)}" y="${geometry.height - 42}" text-anchor="middle" class="plot-axis-text">${formatFrequencyLabel(frequency)}</text>`;
      }).join('')}
      <text x="${(geometry.left + (geometry.width - geometry.right)) / 2}" y="${geometry.height - 12}" text-anchor="middle" class="plot-axis-label">Frequency (Hz, log)</text>
      <text x="28" y="${(geometry.top + (geometry.height - geometry.bottom)) / 2}" text-anchor="middle" transform="rotate(-90 28 ${(geometry.top + (geometry.height - geometry.bottom)) / 2})" class="plot-axis-label">EQ Gain (dB)</text>
    </svg>
  `;
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
): ResponsePlotGeometry {
  const points = measurementPointSets.flatMap((measurement) => measurement);
  const frequencies = points.map((point) => point.frequencyHz);
  const smoothedValues = points.map((point) => point.smoothedMagnitudeDbRelative);
  const measuredTop = Math.max(...smoothedValues) + 3;
  const measuredBottom = Math.min(...smoothedValues) - 3;
  const minDb = measuredBottom;
  const maxDb = measuredBottom + Math.max(24, measuredTop - measuredBottom);

  return {
    width: 960,
    height: 356,
    left: 84,
    right: 24,
    top: 18,
    bottom: 94,
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
