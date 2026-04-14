import type { ApoFilter, ApoFilterKind } from './types';
import { clamp } from './utils';

const APO_DEFAULT_Q = Math.SQRT1_2;
const APO_DEFAULT_PEAK_Q = 1.41;
const APO_DEFAULT_ORDER = 4;
const APO_DEFAULT_SLOPE_DB_PER_OCT = 6;
const MIN_SLOPE_DB_PER_OCT = 0.1;
const MAX_SLOPE_DB_PER_OCT = 60;

type BiquadCoefficients = {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
};

export const PARAMETRIC_APO_FILTER_KIND_OPTIONS: Array<{
  value: ApoFilterKind;
  label: string;
}> = [
  { value: 'PK', label: 'Peak filter' },
  { value: 'LP', label: 'Low pass filter' },
  { value: 'HP', label: 'High pass filter' },
  { value: 'BP', label: 'Band pass filter' },
  { value: 'LS', label: 'Low shelf filter' },
  { value: 'HS', label: 'High shelf filter' },
  { value: 'NO', label: 'Notch filter' },
  { value: 'AP', label: 'All pass filter' },
  { value: 'LSC_DB', label: 'Low shelf filter (slope in dB)' },
  { value: 'HSC_DB', label: 'High shelf filter (slope in dB)' },
  { value: 'LPBW', label: 'Low pass Butterworth filter (even orders only)' },
  { value: 'HPBW', label: 'High pass Butterworth filter (even orders only)' },
  { value: 'LPLR', label: 'Low pass Linkwitz Riley filter (even orders only)' },
  { value: 'HPLR', label: 'High pass Linkwitz Riley filter (even orders only)' },
  { value: 'LSQ', label: 'Low shelf filter (Q as slope)' },
  { value: 'HSQ', label: 'High shelf filter (Q as slope)' },
  { value: 'LSCQ', label: 'Low shelf filter (corner frequency, Q as slope)' },
  { value: 'HSCQ', label: 'High shelf filter (corner frequency, Q as slope)' },
];

export function apoFilterKindUsesGain(kind: ApoFilterKind): boolean {
  return (
    kind === 'PK' ||
    kind === 'LS' ||
    kind === 'HS' ||
    kind === 'LSC_DB' ||
    kind === 'HSC_DB' ||
    kind === 'LSQ' ||
    kind === 'HSQ' ||
    kind === 'LSCQ' ||
    kind === 'HSCQ'
  );
}

export function apoFilterKindUsesShape(kind: ApoFilterKind): boolean {
  return (
    apoFilterKindUsesQ(kind) ||
    apoFilterKindUsesOrder(kind) ||
    apoFilterKindUsesSlopeDb(kind)
  );
}

export function apoFilterKindUsesQ(kind: ApoFilterKind): boolean {
  return (
    kind === 'PK' ||
    kind === 'LP' ||
    kind === 'HP' ||
    kind === 'BP' ||
    kind === 'NO' ||
    kind === 'AP' ||
    kind === 'LSQ' ||
    kind === 'HSQ' ||
    kind === 'LSCQ' ||
    kind === 'HSCQ'
  );
}

export function apoFilterKindUsesOrder(kind: ApoFilterKind): boolean {
  return kind === 'LPBW' || kind === 'HPBW' || kind === 'LPLR' || kind === 'HPLR';
}

export function apoFilterKindUsesSlopeDb(kind: ApoFilterKind): boolean {
  return kind === 'LSC_DB' || kind === 'HSC_DB';
}

export function getDefaultApoFilterQ(kind: ApoFilterKind): number {
  return kind === 'PK' ? APO_DEFAULT_PEAK_Q : APO_DEFAULT_Q;
}

export function getDefaultApoFilterOrder(kind: ApoFilterKind): number | null {
  if (!apoFilterKindUsesOrder(kind)) {
    return null;
  }

  return kind === 'LPBW' || kind === 'HPBW' ? 2 : APO_DEFAULT_ORDER;
}

export function getDefaultApoFilterSlopeDbPerOct(kind: ApoFilterKind): number | null {
  return apoFilterKindUsesSlopeDb(kind) ? APO_DEFAULT_SLOPE_DB_PER_OCT : null;
}

export function normalizeApoFilterOrder(order: unknown, kind: ApoFilterKind): number | null {
  if (!apoFilterKindUsesOrder(kind)) {
    return null;
  }

  const defaultOrder = getDefaultApoFilterOrder(kind) ?? APO_DEFAULT_ORDER;
  const parsedOrder = Math.round(Number(order));
  const minimumOrder = kind === 'LPBW' || kind === 'HPBW' ? 2 : 4;
  const normalizedOrder = Number.isFinite(parsedOrder) ? parsedOrder : defaultOrder;
  return clamp(normalizedOrder % 2 === 0 ? normalizedOrder : normalizedOrder + 1, minimumOrder, 20);
}

export function normalizeApoFilterSlopeDbPerOct(value: unknown, kind: ApoFilterKind): number | null {
  if (!apoFilterKindUsesSlopeDb(kind)) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return APO_DEFAULT_SLOPE_DB_PER_OCT;
  }

  return clamp(parsed, MIN_SLOPE_DB_PER_OCT, MAX_SLOPE_DB_PER_OCT);
}

export function formatApoFilterKindLabel(kind: ApoFilterKind): string {
  return (
    PARAMETRIC_APO_FILTER_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind
  );
}

export function getApoFilterShapeLabel(kind: ApoFilterKind): string {
  if (apoFilterKindUsesOrder(kind)) {
    return 'Order';
  }

  if (apoFilterKindUsesSlopeDb(kind)) {
    return 'Slope';
  }

  return 'Q';
}

export function formatApoFilterShapeValue(filter: ApoFilter): string {
  if (apoFilterKindUsesOrder(filter.kind)) {
    return String(normalizeApoFilterOrder(filter.order, filter.kind) ?? APO_DEFAULT_ORDER);
  }

  if (apoFilterKindUsesSlopeDb(filter.kind)) {
    return (normalizeApoFilterSlopeDbPerOct(filter.slopeDbPerOct, filter.kind) ?? APO_DEFAULT_SLOPE_DB_PER_OCT).toFixed(1);
  }

  return clamp(filter.q, 0.1, 10).toFixed(2);
}

export function createDefaultApoFilterShapeValue(kind: ApoFilterKind): string {
  if (apoFilterKindUsesOrder(kind)) {
    return String(getDefaultApoFilterOrder(kind) ?? APO_DEFAULT_ORDER);
  }

  if (apoFilterKindUsesSlopeDb(kind)) {
    return APO_DEFAULT_SLOPE_DB_PER_OCT.toFixed(1);
  }

  return getDefaultApoFilterQ(kind).toFixed(2);
}

export function buildApoFilterConfigLines(filter: ApoFilter, index: number): string[] {
  const enabledToken = filter.enabled ? 'ON' : 'OFF';
  const normalizedFilter = getNormalizedApoFilter(filter);
  const filterNumberPrefix = `Filter ${index + 1}: ${enabledToken}`;

  switch (normalizedFilter.kind) {
    case 'PK':
      return [
        `${filterNumberPrefix} PK Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Gain ${normalizedFilter.gainDb.toFixed(1)} dB Q ${normalizedFilter.q.toFixed(2)}`,
      ];
    case 'LP':
      return [
        normalizedFilter.q <= APO_DEFAULT_Q + 0.001
          ? `${filterNumberPrefix} LP Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz`
          : `${filterNumberPrefix} LPQ Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Q ${normalizedFilter.q.toFixed(2)}`,
      ];
    case 'HP':
      return [
        normalizedFilter.q <= APO_DEFAULT_Q + 0.001
          ? `${filterNumberPrefix} HP Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz`
          : `${filterNumberPrefix} HPQ Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Q ${normalizedFilter.q.toFixed(2)}`,
      ];
    case 'BP':
      return [
        `${filterNumberPrefix} BP Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Q ${normalizedFilter.q.toFixed(2)}`,
      ];
    case 'LS':
      return [
        `${filterNumberPrefix} LS Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Gain ${normalizedFilter.gainDb.toFixed(1)} dB`,
      ];
    case 'HS':
      return [
        `${filterNumberPrefix} HS Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Gain ${normalizedFilter.gainDb.toFixed(1)} dB`,
      ];
    case 'LSQ':
      return [
        `${filterNumberPrefix} LS Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Gain ${normalizedFilter.gainDb.toFixed(1)} dB Q ${normalizedFilter.q.toFixed(2)}`,
      ];
    case 'HSQ':
      return [
        `${filterNumberPrefix} HS Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Gain ${normalizedFilter.gainDb.toFixed(1)} dB Q ${normalizedFilter.q.toFixed(2)}`,
      ];
    case 'LSC_DB': {
      const lowShelfSlopeDbPerOct =
        normalizedFilter.slopeDbPerOct ?? APO_DEFAULT_SLOPE_DB_PER_OCT;
      return [
        `${filterNumberPrefix} LSC ${lowShelfSlopeDbPerOct.toFixed(1)} dB Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Gain ${normalizedFilter.gainDb.toFixed(1)} dB`,
      ];
    }
    case 'HSC_DB': {
      const highShelfSlopeDbPerOct =
        normalizedFilter.slopeDbPerOct ?? APO_DEFAULT_SLOPE_DB_PER_OCT;
      return [
        `${filterNumberPrefix} HSC ${highShelfSlopeDbPerOct.toFixed(1)} dB Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Gain ${normalizedFilter.gainDb.toFixed(1)} dB`,
      ];
    }
    case 'LSCQ':
      return [
        `${filterNumberPrefix} LSC Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Gain ${normalizedFilter.gainDb.toFixed(1)} dB Q ${normalizedFilter.q.toFixed(2)}`,
      ];
    case 'HSCQ':
      return [
        `${filterNumberPrefix} HSC Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Gain ${normalizedFilter.gainDb.toFixed(1)} dB Q ${normalizedFilter.q.toFixed(2)}`,
      ];
    case 'NO': {
      const line = `${filterNumberPrefix} NO Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz`;
      return [normalizedFilter.q <= APO_DEFAULT_Q + 0.001 ? line : `${line} Q ${normalizedFilter.q.toFixed(2)}`];
    }
    case 'AP':
      return [
        `${filterNumberPrefix} AP Fc ${normalizedFilter.frequencyHz.toFixed(1)} Hz Q ${normalizedFilter.q.toFixed(2)}`,
      ];
    case 'LPBW':
    case 'HPBW':
    case 'LPLR':
    case 'HPLR': {
      const sections = getExpandedApoSections(normalizedFilter);
      return [
        buildLogicalApoFilterComment(normalizedFilter),
        ...sections.map((section) => buildExpandedSectionConfigLine(section, index, enabledToken)),
      ];
    }
  }
}

export function buildLogicalApoFilterComment(filter: ApoFilter): string {
  const parts = [
    '# FreakishEarsApo',
    `kind=${filter.kind}`,
    `enabled=${filter.enabled ? '1' : '0'}`,
    `fc=${filter.frequencyHz.toFixed(1)}`,
  ];

  if (apoFilterKindUsesGain(filter.kind)) {
    parts.push(`gain=${filter.gainDb.toFixed(1)}`);
  }

  if (apoFilterKindUsesQ(filter.kind)) {
    parts.push(`q=${filter.q.toFixed(4)}`);
  }

  if (apoFilterKindUsesOrder(filter.kind)) {
    parts.push(`order=${normalizeApoFilterOrder(filter.order, filter.kind)}`);
  }

  if (apoFilterKindUsesSlopeDb(filter.kind)) {
    parts.push(`slope=${normalizeApoFilterSlopeDbPerOct(filter.slopeDbPerOct, filter.kind)}`);
  }

  return parts.join(' ');
}

export function parseLogicalApoFilterComment(line: string): ApoFilter | null {
  const match = line.trim().match(/^#\s+FreakishEarsApo\s+(.+)$/u);
  if (!match) {
    return null;
  }

  const fields = new Map<string, string>();
  for (const token of match[1].split(/\s+/u)) {
    const separatorIndex = token.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    fields.set(token.slice(0, separatorIndex), token.slice(separatorIndex + 1));
  }

  const kind = fields.get('kind');
  if (!kind || !isApoFilterKind(kind)) {
    return null;
  }

  return getNormalizedApoFilter({
    id: 'apo-filter-imported',
    enabled: fields.get('enabled') !== '0',
    kind,
    frequencyHz: Number(fields.get('fc') ?? '1000'),
    gainDb: Number(fields.get('gain') ?? '0'),
    q: Number(fields.get('q') ?? getDefaultApoFilterQ(kind)),
    order: Number(fields.get('order') ?? getDefaultApoFilterOrder(kind)),
    slopeDbPerOct: Number(fields.get('slope') ?? getDefaultApoFilterSlopeDbPerOct(kind)),
  });
}

export function getExpandedApoSectionCount(filter: ApoFilter): number {
  return getExpandedApoSections(filter).length;
}

export function getApoFilterResponseDb(filter: ApoFilter, frequencyHz: number, sampleRate: number): number {
  const expandedSections = getExpandedApoSections(filter);
  return expandedSections.reduce(
    (totalDb, section) => totalDb + getExpandedApoSectionResponseDb(section, frequencyHz, sampleRate),
    0,
  );
}

export function getApoFilterNodeGainDb(filter: ApoFilter, sampleRate: number): number {
  if (apoFilterKindUsesGain(filter.kind)) {
    return filter.gainDb;
  }

  return getApoFilterResponseDb(filter, filter.frequencyHz, sampleRate);
}

export function isApoFilterKind(value: unknown): value is ApoFilterKind {
  return PARAMETRIC_APO_FILTER_KIND_OPTIONS.some((option) => option.value === value);
}

type ExpandedApoSection = {
  kind: 'PK' | 'LP' | 'LPQ' | 'HP' | 'HPQ' | 'BP' | 'NO' | 'AP' | 'LS' | 'HS' | 'LSC' | 'HSC';
  frequencyHz: number;
  gainDb: number;
  q: number;
  bandwidthOrQOrS: number;
  isBandwidthOrS: boolean;
  isCornerFreq: boolean;
  slopeDbPerOct: number | null;
};

function getNormalizedApoFilter(filter: ApoFilter): ApoFilter {
  return {
    ...filter,
    frequencyHz: clamp(filter.frequencyHz, 20, 20000),
    gainDb: clamp(filter.gainDb, -24, 24),
    q: clamp(filter.q || getDefaultApoFilterQ(filter.kind), 0.1, 10),
    order: normalizeApoFilterOrder(filter.order, filter.kind),
    slopeDbPerOct: normalizeApoFilterSlopeDbPerOct(filter.slopeDbPerOct, filter.kind),
  };
}

function buildExpandedSectionConfigLine(
  section: ExpandedApoSection,
  index: number,
  enabledToken: string,
): string {
  const filterNumberPrefix = `Filter ${index + 1}: ${enabledToken}`;

  switch (section.kind) {
    case 'PK':
      return `${filterNumberPrefix} PK Fc ${section.frequencyHz.toFixed(1)} Hz Gain ${section.gainDb.toFixed(1)} dB Q ${section.q.toFixed(2)}`;
    case 'LP':
      return `${filterNumberPrefix} LP Fc ${section.frequencyHz.toFixed(1)} Hz`;
    case 'LPQ':
      return `${filterNumberPrefix} LPQ Fc ${section.frequencyHz.toFixed(1)} Hz Q ${section.q.toFixed(2)}`;
    case 'HP':
      return `${filterNumberPrefix} HP Fc ${section.frequencyHz.toFixed(1)} Hz`;
    case 'HPQ':
      return `${filterNumberPrefix} HPQ Fc ${section.frequencyHz.toFixed(1)} Hz Q ${section.q.toFixed(2)}`;
    case 'BP':
      return `${filterNumberPrefix} BP Fc ${section.frequencyHz.toFixed(1)} Hz Q ${section.q.toFixed(2)}`;
    case 'NO':
      return `${filterNumberPrefix} NO Fc ${section.frequencyHz.toFixed(1)} Hz Q ${section.q.toFixed(2)}`;
    case 'AP':
      return `${filterNumberPrefix} AP Fc ${section.frequencyHz.toFixed(1)} Hz Q ${section.q.toFixed(2)}`;
    case 'LS':
      return `${filterNumberPrefix} LS Fc ${section.frequencyHz.toFixed(1)} Hz Gain ${section.gainDb.toFixed(1)} dB`;
    case 'HS':
      return `${filterNumberPrefix} HS Fc ${section.frequencyHz.toFixed(1)} Hz Gain ${section.gainDb.toFixed(1)} dB`;
    case 'LSC':
      return `${filterNumberPrefix} LSC Fc ${section.frequencyHz.toFixed(1)} Hz Gain ${section.gainDb.toFixed(1)} dB Q ${section.q.toFixed(2)}`;
    case 'HSC':
      return `${filterNumberPrefix} HSC Fc ${section.frequencyHz.toFixed(1)} Hz Gain ${section.gainDb.toFixed(1)} dB Q ${section.q.toFixed(2)}`;
  }
}

function getExpandedApoSections(filter: ApoFilter): ExpandedApoSection[] {
  const normalizedFilter = getNormalizedApoFilter(filter);

  switch (normalizedFilter.kind) {
    case 'PK':
      return [{ kind: 'PK', frequencyHz: normalizedFilter.frequencyHz, gainDb: normalizedFilter.gainDb, q: normalizedFilter.q, bandwidthOrQOrS: normalizedFilter.q, isBandwidthOrS: false, isCornerFreq: false, slopeDbPerOct: null }];
    case 'LP':
      return [{ kind: normalizedFilter.q <= APO_DEFAULT_Q + 0.001 ? 'LP' : 'LPQ', frequencyHz: normalizedFilter.frequencyHz, gainDb: 0, q: normalizedFilter.q, bandwidthOrQOrS: normalizedFilter.q, isBandwidthOrS: false, isCornerFreq: false, slopeDbPerOct: null }];
    case 'HP':
      return [{ kind: normalizedFilter.q <= APO_DEFAULT_Q + 0.001 ? 'HP' : 'HPQ', frequencyHz: normalizedFilter.frequencyHz, gainDb: 0, q: normalizedFilter.q, bandwidthOrQOrS: normalizedFilter.q, isBandwidthOrS: false, isCornerFreq: false, slopeDbPerOct: null }];
    case 'BP':
      return [{ kind: 'BP', frequencyHz: normalizedFilter.frequencyHz, gainDb: 0, q: normalizedFilter.q, bandwidthOrQOrS: normalizedFilter.q, isBandwidthOrS: false, isCornerFreq: false, slopeDbPerOct: null }];
    case 'NO':
      return [{ kind: 'NO', frequencyHz: normalizedFilter.frequencyHz, gainDb: 0, q: normalizedFilter.q, bandwidthOrQOrS: normalizedFilter.q, isBandwidthOrS: false, isCornerFreq: false, slopeDbPerOct: null }];
    case 'AP':
      return [{ kind: 'AP', frequencyHz: normalizedFilter.frequencyHz, gainDb: 0, q: normalizedFilter.q, bandwidthOrQOrS: normalizedFilter.q, isBandwidthOrS: false, isCornerFreq: false, slopeDbPerOct: null }];
    case 'LS':
      return [{ kind: 'LS', frequencyHz: normalizedFilter.frequencyHz, gainDb: normalizedFilter.gainDb, q: APO_DEFAULT_Q, bandwidthOrQOrS: 0.9 / 12, isBandwidthOrS: true, isCornerFreq: true, slopeDbPerOct: null }];
    case 'HS':
      return [{ kind: 'HS', frequencyHz: normalizedFilter.frequencyHz, gainDb: normalizedFilter.gainDb, q: APO_DEFAULT_Q, bandwidthOrQOrS: 0.9 / 12, isBandwidthOrS: true, isCornerFreq: true, slopeDbPerOct: null }];
    case 'LSQ':
      return [{ kind: 'LS', frequencyHz: normalizedFilter.frequencyHz, gainDb: normalizedFilter.gainDb, q: normalizedFilter.q, bandwidthOrQOrS: normalizedFilter.q, isBandwidthOrS: false, isCornerFreq: true, slopeDbPerOct: null }];
    case 'HSQ':
      return [{ kind: 'HS', frequencyHz: normalizedFilter.frequencyHz, gainDb: normalizedFilter.gainDb, q: normalizedFilter.q, bandwidthOrQOrS: normalizedFilter.q, isBandwidthOrS: false, isCornerFreq: true, slopeDbPerOct: null }];
    case 'LSCQ':
      return [{ kind: 'LSC', frequencyHz: normalizedFilter.frequencyHz, gainDb: normalizedFilter.gainDb, q: normalizedFilter.q, bandwidthOrQOrS: normalizedFilter.q, isBandwidthOrS: false, isCornerFreq: false, slopeDbPerOct: null }];
    case 'HSCQ':
      return [{ kind: 'HSC', frequencyHz: normalizedFilter.frequencyHz, gainDb: normalizedFilter.gainDb, q: normalizedFilter.q, bandwidthOrQOrS: normalizedFilter.q, isBandwidthOrS: false, isCornerFreq: false, slopeDbPerOct: null }];
    case 'LSC_DB':
      return [{ kind: 'LSC', frequencyHz: normalizedFilter.frequencyHz, gainDb: normalizedFilter.gainDb, q: APO_DEFAULT_Q, bandwidthOrQOrS: (normalizedFilter.slopeDbPerOct ?? APO_DEFAULT_SLOPE_DB_PER_OCT) / 12, isBandwidthOrS: true, isCornerFreq: false, slopeDbPerOct: normalizedFilter.slopeDbPerOct }];
    case 'HSC_DB':
      return [{ kind: 'HSC', frequencyHz: normalizedFilter.frequencyHz, gainDb: normalizedFilter.gainDb, q: APO_DEFAULT_Q, bandwidthOrQOrS: (normalizedFilter.slopeDbPerOct ?? APO_DEFAULT_SLOPE_DB_PER_OCT) / 12, isBandwidthOrS: true, isCornerFreq: false, slopeDbPerOct: normalizedFilter.slopeDbPerOct }];
    case 'LPBW':
      return buildButterworthSections('LP', normalizedFilter.frequencyHz, normalizeApoFilterOrder(normalizedFilter.order, normalizedFilter.kind) ?? 2);
    case 'HPBW':
      return buildButterworthSections('HP', normalizedFilter.frequencyHz, normalizeApoFilterOrder(normalizedFilter.order, normalizedFilter.kind) ?? 2);
    case 'LPLR':
      return buildLinkwitzRileySections('LP', normalizedFilter.frequencyHz, normalizeApoFilterOrder(normalizedFilter.order, normalizedFilter.kind) ?? APO_DEFAULT_ORDER);
    case 'HPLR':
      return buildLinkwitzRileySections('HP', normalizedFilter.frequencyHz, normalizeApoFilterOrder(normalizedFilter.order, normalizedFilter.kind) ?? APO_DEFAULT_ORDER);
  }
}

function buildButterworthSections(
  family: 'LP' | 'HP',
  frequencyHz: number,
  order: number,
): ExpandedApoSection[] {
  const sections: ExpandedApoSection[] = [];

  if (order % 2 === 1) {
    sections.push({
      kind: family,
      frequencyHz,
      gainDb: 0,
      q: APO_DEFAULT_Q,
      bandwidthOrQOrS: APO_DEFAULT_Q,
      isBandwidthOrS: false,
      isCornerFreq: false,
      slopeDbPerOct: null,
    });
  }

  for (let index = 1; index <= Math.floor(order / 2); index += 1) {
    const q = 1 / (2 * Math.cos(((2 * index - 1) * Math.PI) / (2 * order)));
    sections.push({
      kind: family === 'LP' ? 'LPQ' : 'HPQ',
      frequencyHz,
      gainDb: 0,
      q,
      bandwidthOrQOrS: q,
      isBandwidthOrS: false,
      isCornerFreq: false,
      slopeDbPerOct: null,
    });
  }

  return sections;
}

function buildLinkwitzRileySections(
  family: 'LP' | 'HP',
  frequencyHz: number,
  order: number,
): ExpandedApoSection[] {
  const butterworthOrder = Math.max(1, Math.round(order / 2));
  const butterworthSections = buildButterworthSections(family, frequencyHz, butterworthOrder);
  return [...butterworthSections, ...butterworthSections];
}

function getExpandedApoSectionResponseDb(
  section: ExpandedApoSection,
  frequencyHz: number,
  sampleRate: number,
): number {
  const coefficients = getBiquadCoefficients(section, sampleRate);
  if (!coefficients) {
    return 0;
  }

  const omega = (2 * Math.PI * clamp(frequencyHz, 20, sampleRate / 2 - 1)) / sampleRate;
  const numeratorReal =
    coefficients.b0 + coefficients.b1 * Math.cos(omega) + coefficients.b2 * Math.cos(2 * omega);
  const numeratorImag =
    -coefficients.b1 * Math.sin(omega) - coefficients.b2 * Math.sin(2 * omega);
  const denominatorReal =
    coefficients.a0 + coefficients.a1 * Math.cos(omega) + coefficients.a2 * Math.cos(2 * omega);
  const denominatorImag =
    -coefficients.a1 * Math.sin(omega) - coefficients.a2 * Math.sin(2 * omega);
  const numeratorMagnitude = Math.hypot(numeratorReal, numeratorImag);
  const denominatorMagnitude = Math.hypot(denominatorReal, denominatorImag);
  const magnitude = denominatorMagnitude === 0 ? 1 : numeratorMagnitude / denominatorMagnitude;
  return 20 * Math.log10(Math.max(magnitude, 1e-6));
}

function getBiquadCoefficients(
  section: ExpandedApoSection,
  sampleRate: number,
): BiquadCoefficients | null {
  const normalizedFrequencyHz = clamp(section.frequencyHz, 20, sampleRate / 2 - 1);
  const gainAmplitude = Math.pow(10, section.gainDb / 40);

  const resolveShelfFrequencyHz = (): number => {
    if (!section.isCornerFreq || (section.kind !== 'LS' && section.kind !== 'HS')) {
      return normalizedFrequencyHz;
    }

    let s = section.bandwidthOrQOrS;
    if (!section.isBandwidthOrS) {
      const q = clamp(section.bandwidthOrQOrS, 0.1, 10);
      s = 1.0 / (((1.0 / (q * q) - 2.0) / (gainAmplitude + 1.0 / gainAmplitude)) + 1.0);
    }

    const centerFreqFactor = Math.pow(10, Math.abs(section.gainDb) / 80.0 / s);
    return clamp(
      section.kind === 'LS'
        ? normalizedFrequencyHz * centerFreqFactor
        : normalizedFrequencyHz / centerFreqFactor,
      20,
      sampleRate / 2 - 1,
    );
  };

  const biquadFrequencyHz = resolveShelfFrequencyHz();
  const omega0 = (2 * Math.PI * biquadFrequencyHz) / sampleRate;
  const cosOmega0 = Math.cos(omega0);
  const sinOmega0 = Math.sin(omega0);
  const alpha = !section.isBandwidthOrS
    ? sinOmega0 / (2 * clamp(section.bandwidthOrQOrS, 0.1, 10))
    : (section.kind === 'LS' || section.kind === 'HS')
      ? (sinOmega0 / 2) * Math.sqrt((gainAmplitude + 1 / gainAmplitude) * (1 / section.bandwidthOrQOrS - 1) + 2)
      : sinOmega0 / (2 * clamp(section.q, 0.1, 10));

  switch (section.kind) {
    case 'PK':
      return {
        b0: 1 + alpha * gainAmplitude,
        b1: -2 * cosOmega0,
        b2: 1 - alpha * gainAmplitude,
        a0: 1 + alpha / gainAmplitude,
        a1: -2 * cosOmega0,
        a2: 1 - alpha / gainAmplitude,
      };
    case 'LP': {
      const gamma = Math.tan(omega0 / 2);
      return {
        b0: gamma,
        b1: gamma,
        b2: 0,
        a0: gamma + 1,
        a1: gamma - 1,
        a2: 0,
      };
    }
    case 'HP': {
      const gamma = Math.tan(omega0 / 2);
      return {
        b0: 1,
        b1: -1,
        b2: 0,
        a0: gamma + 1,
        a1: gamma - 1,
        a2: 0,
      };
    }
    case 'LPQ':
      return {
        b0: (1 - cosOmega0) / 2,
        b1: 1 - cosOmega0,
        b2: (1 - cosOmega0) / 2,
        a0: 1 + alpha,
        a1: -2 * cosOmega0,
        a2: 1 - alpha,
      };
    case 'HPQ':
      return {
        b0: (1 + cosOmega0) / 2,
        b1: -(1 + cosOmega0),
        b2: (1 + cosOmega0) / 2,
        a0: 1 + alpha,
        a1: -2 * cosOmega0,
        a2: 1 - alpha,
      };
    case 'BP':
      return {
        b0: alpha,
        b1: 0,
        b2: -alpha,
        a0: 1 + alpha,
        a1: -2 * cosOmega0,
        a2: 1 - alpha,
      };
    case 'NO':
      return {
        b0: 1,
        b1: -2 * cosOmega0,
        b2: 1,
        a0: 1 + alpha,
        a1: -2 * cosOmega0,
        a2: 1 - alpha,
      };
    case 'AP':
      return {
        b0: 1 - alpha,
        b1: -2 * cosOmega0,
        b2: 1 + alpha,
        a0: 1 + alpha,
        a1: -2 * cosOmega0,
        a2: 1 - alpha,
      };
    case 'LS':
    case 'HS': {
      const sqrtA = Math.sqrt(gainAmplitude);
      const twoSqrtAAlpha = 2 * sqrtA * alpha;

      if (section.kind === 'LS') {
        return {
          b0: gainAmplitude * ((gainAmplitude + 1) - (gainAmplitude - 1) * cosOmega0 + twoSqrtAAlpha),
          b1: 2 * gainAmplitude * ((gainAmplitude - 1) - (gainAmplitude + 1) * cosOmega0),
          b2: gainAmplitude * ((gainAmplitude + 1) - (gainAmplitude - 1) * cosOmega0 - twoSqrtAAlpha),
          a0: (gainAmplitude + 1) + (gainAmplitude - 1) * cosOmega0 + twoSqrtAAlpha,
          a1: -2 * ((gainAmplitude - 1) + (gainAmplitude + 1) * cosOmega0),
          a2: (gainAmplitude + 1) + (gainAmplitude - 1) * cosOmega0 - twoSqrtAAlpha,
        };
      }

      return {
        b0: gainAmplitude * ((gainAmplitude + 1) + (gainAmplitude - 1) * cosOmega0 + twoSqrtAAlpha),
        b1: -2 * gainAmplitude * ((gainAmplitude - 1) + (gainAmplitude + 1) * cosOmega0),
        b2: gainAmplitude * ((gainAmplitude + 1) + (gainAmplitude - 1) * cosOmega0 - twoSqrtAAlpha),
        a0: (gainAmplitude + 1) - (gainAmplitude - 1) * cosOmega0 + twoSqrtAAlpha,
        a1: 2 * ((gainAmplitude - 1) - (gainAmplitude + 1) * cosOmega0),
        a2: (gainAmplitude + 1) - (gainAmplitude - 1) * cosOmega0 - twoSqrtAAlpha,
      };
    }
    case 'LSC':
      return getBiquadCoefficients({
        ...section,
        kind: 'LS',
      }, sampleRate);
    case 'HSC':
      return getBiquadCoefficients({
        ...section,
        kind: 'HS',
      }, sampleRate);
  }
}
