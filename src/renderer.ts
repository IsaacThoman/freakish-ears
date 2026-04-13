import './index.css';
import logoUrl from './assets/dutocal-logo.webp';

import {
  ACTIVE_CONFIG_STORAGE_KEY,
  APO_EQ_MODE_STORAGE_KEY,
  APO_FILTERS_STORAGE_KEY,
  APO_MAX_BOOST_STORAGE_KEY,
  APO_MAX_CUT_STORAGE_KEY,
  APO_MAX_FILTERS_STORAGE_KEY,
  APO_SELECTED_MEASUREMENT_STORAGE_KEY,
  APO_SELECTED_REFERENCE_STORAGE_KEY,
  AUTOMATION_BAND_TOLERANCES_STORAGE_KEY,
  AUTOMATION_DELAY_SECONDS_STORAGE_KEY,
  AUTOMATION_ALGORITHM_STORAGE_KEY,
  AUTOMATION_REGRESSION_LIMIT_STORAGE_KEY,
  AUTOMATION_STOP_ON_TOLERANCE_STORAGE_KEY,
  DEFAULT_DYNAMIC_PROPORTIONAL_P,
  DEFAULT_APO_EQ_MODE,
  DEFAULT_MEASUREMENT_BACKEND,
  DEFAULT_MEASUREMENT_KEEP_COUNT,
  DEFAULT_APO_MAX_BOOST_DB,
  DEFAULT_APO_MAX_CUT_DB,
  DEFAULT_APO_MAX_FILTERS,
  DEFAULT_AUTOMATION_ALGORITHM,
  DEFAULT_AUTOMATION_DELAY_SECONDS,
  DEFAULT_AUTOMATION_REGRESSION_LIMIT,
  DEFAULT_AUTOMATION_STOP_ON_TOLERANCE,
  DEFAULT_DURATION_SECONDS,
  DEFAULT_END_FREQUENCY,
  DEFAULT_PROPORTIONAL_P,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_SMOOTHING_MODE,
  DEFAULT_START_FREQUENCY,
  DEFAULT_SWEEP_LEVEL_DB,
  DURATION_STORAGE_KEY,
  DYNAMIC_PROPORTIONAL_P_STORAGE_KEY,
  END_FREQUENCY_STORAGE_KEY,
  INPUT_DEVICE_STORAGE_KEY,
  INPUT_CHANNEL_STORAGE_KEY,
  MEASUREMENT_BACKEND_STORAGE_KEY,
  MEASUREMENT_KEEP_COUNT_STORAGE_KEY,
  MAX_SWEEP_LEVEL_DB,
  MIN_SWEEP_LEVEL_DB,
  NORMALIZE_PLOT_STORAGE_KEY,
  OUTPUT_CHANNEL_STORAGE_KEY,
  OUTPUT_DEVICE_STORAGE_KEY,
  POST_ROLL_SECONDS,
  PRE_ROLL_SECONDS,
  PROPORTIONAL_P_STORAGE_KEY,
  PLOT_COLORS,
  PLOT_NORMALIZATION_FREQUENCY_HZ,
  SAMPLE_RATE_OPTIONS,
  SAMPLE_RATE_STORAGE_KEY,
  SMOOTHING_MODE_OPTIONS,
  SMOOTHING_MODE_STORAGE_KEY,
  START_FREQUENCY_STORAGE_KEY,
  STARRED_PLOT_COLORS,
  STORAGE_KEY,
  SWEEP_LEVEL_STORAGE_KEY,
} from './renderer/constants';
import { analyzeMeasurement, encodeWavFile, recordSweepMeasurement } from './renderer/audio';
import {
  buildMeasurementCsv,
  buildMeasurementJson,
  buildRewMeasurementText,
  createReferenceCurve,
  createLoadedMeasurement,
  createMeasurementFromAnalysis,
  getMeasurementPointsForDisplay,
  parseImportedMeasurementFile,
} from './renderer/measurements';
import {
  type ApoDragAxis,
  attachApoPlotInteractions,
  attachPlotInteractions,
  renderApoEqPlot,
  renderResponsePlot,
  DEFAULT_PLOT_HEIGHT,
  DEFAULT_PLOT_WIDTH,
} from './renderer/plot';
import type {
  ApoEqMode,
  ApoFilter,
  ApoFilterKind,
  AppState,
  AutomationAlgorithm,
  AutomationBandTolerances,
  AutomationToleranceBand,
  LoadedMeasurement,
  LogTone,
  MeasurementBackend,
  MeasurementChannelSelection,
  MeasurementSmoothingMode,
  ReferenceCurve,
  StatusTone,
  ToastState,
} from './renderer/types';
import {
  clamp,
  escapeHtml,
  findClosestPoint,
  formatTimestampForPath,
  getErrorMessage,
  readStoredNumber,
  wait,
} from './renderer/utils';

const app = document.querySelector<HTMLDivElement>('#app');

const AUTOMATION_TOLERANCE_BANDS: Array<{
  key: AutomationToleranceBand;
  label: string;
  minimumFrequencyHz: number;
  maximumFrequencyHz: number;
  defaultToleranceDb: number;
}> = [
  {
    key: 'subBass',
    label: 'Sub-bass',
    minimumFrequencyHz: 20,
    maximumFrequencyHz: 60,
    defaultToleranceDb: 3,
  },
  {
    key: 'bass',
    label: 'Bass',
    minimumFrequencyHz: 60,
    maximumFrequencyHz: 250,
    defaultToleranceDb: 3,
  },
  {
    key: 'lowMid',
    label: 'Low mid',
    minimumFrequencyHz: 250,
    maximumFrequencyHz: 500,
    defaultToleranceDb: 3,
  },
  {
    key: 'mid',
    label: 'Mid',
    minimumFrequencyHz: 500,
    maximumFrequencyHz: 2000,
    defaultToleranceDb: 3,
  },
  {
    key: 'upMid',
    label: 'Up mid',
    minimumFrequencyHz: 2000,
    maximumFrequencyHz: 4000,
    defaultToleranceDb: 3,
  },
  {
    key: 'presence',
    label: 'Presence',
    minimumFrequencyHz: 4000,
    maximumFrequencyHz: 6000,
    defaultToleranceDb: 3,
  },
  {
    key: 'brilliance',
    label: 'Brilliance',
    minimumFrequencyHz: 6000,
    maximumFrequencyHz: 20000,
    defaultToleranceDb: 3,
  },
];

const DYNAMIC_PROPORTIONAL_P_MIN_SCALE = 0.35;
const DYNAMIC_PROPORTIONAL_P_MAX_SCALE = 2.5;
const DYNAMIC_PROPORTIONAL_P_FULL_SCALE_ERROR_DB = 12;

const PARAMETRIC_APO_FILTER_KIND_OPTIONS: Array<{
  value: ApoFilterKind;
  label: string;
}> = [
  { value: 'PK', label: 'Peak' },
  { value: 'LS', label: 'Low Shelf' },
  { value: 'HS', label: 'High Shelf' },
  { value: 'LP', label: 'Low Pass' },
  { value: 'HP', label: 'High Pass' },
  { value: 'NO', label: 'Notch' },
  { value: 'BP', label: 'Band Pass' },
  { value: 'AP', label: 'All Pass' },
];

if (!app) {
  throw new Error('Unable to find the app root.');
}

app.innerHTML = `
  <main class="shell">
    <header class="header">
      <img class="header-logo" src="${logoUrl}" alt="dutocal" />
    </header>

    <section class="grid">
      <div class="options-stack">
        <section class="panel section">
          <span class="section-title">Input</span>

        <div class="field">
          <label for="measurementBackendSelect">Backend</label>
          <select id="measurementBackendSelect">
            <option value="web-audio">Built-in</option>
            <option value="sox">SoX</option>
          </select>
          <span style="color:var(--text-muted);font-size:11px">SoX uses the system default input/output devices, but still applies the selected sample rate and channel routing.</span>
        </div>

        <div class="field">
          <label for="sampleRateSelect">Sample Rate</label>
          <select id="sampleRateSelect">
            ${SAMPLE_RATE_OPTIONS.map((value) => `<option value="${value}" ${value === DEFAULT_SAMPLE_RATE ? 'selected' : ''}>${value.toLocaleString()} Hz</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label for="inputChannelSelect">Input Channel</label>
          <select id="inputChannelSelect">
            <option value="both">Both</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>

        <div class="field">
          <select id="microphoneSelect"></select>
        </div>

        <button id="refreshDevicesButton" class="btn btn-secondary" type="button">
          Refresh
        </button>

        <span class="section-title">Output</span>

        <div class="field">
          <label for="outputChannelSelect">Output Channel</label>
          <select id="outputChannelSelect">
            <option value="both">Both</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>

        <div class="field">
          <select id="outputSelect"></select>
        </div>

        <div class="folder-row">
          <button id="chooseFolderButton" class="btn btn-secondary" type="button">
            Folder
          </button>
          <div id="selectedFolder" class="folder-chip">None</div>
        </div>

        <div class="folder-row">
          <button id="saveConfigButton" class="btn btn-secondary" type="button">
            Save Config
          </button>
          <button id="importConfigButton" class="btn btn-secondary" type="button">
            Import Config
          </button>
        </div>

        <span class="section-title">Sweep</span>

        <div class="inline-row">
          <div class="inline-field">
            <label for="startFrequencyInput">Start Hz</label>
            <input id="startFrequencyInput" type="number" min="10" max="22000" step="1" value="${DEFAULT_START_FREQUENCY}" />
          </div>
          <div class="inline-field">
            <label for="endFrequencyInput">End Hz</label>
            <input id="endFrequencyInput" type="number" min="20" max="22000" step="1" value="${DEFAULT_END_FREQUENCY}" />
          </div>
          <div class="inline-field">
            <label for="durationInput">Seconds</label>
            <input id="durationInput" type="number" min="2" max="30" step="0.5" value="${DEFAULT_DURATION_SECONDS}" />
          </div>
        </div>

        <div class="field">
          <label for="volumeInput">Level</label>
          <div class="slider-row">
            <input id="volumeInput" class="range-input" type="range" min="${MIN_SWEEP_LEVEL_DB}" max="${MAX_SWEEP_LEVEL_DB}" step="1" value="${DEFAULT_SWEEP_LEVEL_DB}" />
            <div class="number-input-row">
              <input id="volumeNumberInput" class="level-number-input" type="number" min="${MIN_SWEEP_LEVEL_DB}" max="${MAX_SWEEP_LEVEL_DB}" step="1" value="${DEFAULT_SWEEP_LEVEL_DB}" />
              <span>dB</span>
            </div>
          </div>
        </div>

          <button id="runMeasurementButton" class="btn btn-primary" type="button">
            Run
          </button>
        </section>

        <section class="panel section automation-panel">
          <span class="section-title">AUTOCAL</span>

          <div class="field">
            <label for="automationAlgorithmSelect">Algorithm</label>
            <select id="automationAlgorithmSelect">
              <option value="proportional">Proportional</option>
            </select>
          </div>

          <div id="proportionalAutomationFields" class="automation-fields">
            <div class="field">
              <label for="automationDelayInput">Delay Between Runs</label>
              <div class="number-input-row">
                <input id="automationDelayInput" class="level-number-input" type="number" min="0" max="3600" step="0.1" value="${DEFAULT_AUTOMATION_DELAY_SECONDS.toFixed(1)}" />
                <span>s</span>
              </div>
            </div>
            <div id="proportionalPField" class="field">
              <label for="proportionalPInput">P Value</label>
              <div class="number-input-row">
                <input id="proportionalPInput" class="level-number-input" type="number" min="0" max="1" step="0.01" placeholder="-.--" value="${DEFAULT_PROPORTIONAL_P.toFixed(2)}" />
              </div>
            </div>
            <label class="plot-toggle">
              <input id="dynamicProportionalPToggle" type="checkbox" />
              <span>Dynamic P Value</span>
            </label>
            <div class="field">
              <label for="automationRegressionLimitInput">Revert After Regressions</label>
              <div class="number-input-row">
                <input id="automationRegressionLimitInput" class="level-number-input" type="number" min="0" max="20" step="1" value="${DEFAULT_AUTOMATION_REGRESSION_LIMIT}" />
                <span>runs</span>
              </div>
            </div>
            <label class="plot-toggle">
              <input id="automationStopOnToleranceToggle" type="checkbox" />
              <span>Stop when within tolerance</span>
            </label>
            <div id="automationToleranceFields" class="automation-fields">
              <div class="automation-tolerance-grid">
                ${AUTOMATION_TOLERANCE_BANDS.map(
                  (band) => `
                    <div class="field">
                      <label for="automationTolerance${band.key}Input">${band.label}</label>
                      <div class="number-input-row">
                        <input id="automationTolerance${band.key}Input" class="level-number-input" type="number" min="0" max="24" step="0.1" value="${band.defaultToleranceDb.toFixed(1)}" />
                        <span>dB</span>
                      </div>
                    </div>
                  `,
                ).join('')}
              </div>
            </div>
            <span class="automation-hint">Each pass measures the current response, adds (target - measured) * P to the current APO correction, then applies the updated APO config.</span>
          </div>
          <button id="runAutomationButton" class="btn btn-primary automation-run-button" type="button">
            Run Until Stopped
          </button>
        </section>
      </div>

      <section class="panel section">
        <div id="statusPill" class="status-bar" data-tone="idle">Ready</div>

        <div id="summaryGrid" class="metrics">
          <div class="metric">
            <div class="metric-label">Latency</div>
            <div class="metric-value" id="latencyValue">--</div>
          </div>
          <div class="metric">
            <div class="metric-label">Peak</div>
            <div class="metric-value" id="peakValue">--</div>
          </div>
          <div class="metric">
            <div class="metric-label">RMS</div>
            <div class="metric-value" id="rmsValue">--</div>
          </div>
          <div class="metric">
            <div class="metric-label">Path</div>
            <div class="metric-value" id="savedPathValue">--</div>
          </div>
        </div>

        <div id="plotsContainer" class="plots-container">
          <div class="plot-toolbar plot-toolbar-measurements">
            <div class="plot-toolbar-actions">
              <label class="plot-toggle">
                <input id="normalizePlotToggle" type="checkbox" />
                <span>Normalize @ 1 kHz</span>
              </label>
              <label class="plot-smoothing" for="smoothingModeSelect">
                <span>Smoothing</span>
                <select id="smoothingModeSelect">
                  ${SMOOTHING_MODE_OPTIONS.map((value) => `<option value="${value}">${formatSmoothingModeLabel(value)}</option>`).join('')}
                </select>
              </label>
              <button id="importMeasurementsButton" class="btn btn-secondary" type="button">
                Import
              </button>
              <button id="importReferenceButton" class="btn btn-secondary" type="button">
                Import Ref
              </button>
            </div>
          </div>
          <div class="apo-controls-bar">
            <div id="apoEqModeToggle" class="segmented-toggle" role="tablist" aria-label="EQ mode selector">
              <button id="apoEqModeParametricButton" class="segmented-toggle-option" type="button" data-apo-eq-mode="parametric" role="tab" aria-selected="true">Parametric</button>
              <button id="apoEqModeGraphicButton" class="segmented-toggle-option" type="button" data-apo-eq-mode="graphic" role="tab" aria-selected="false">Graphic</button>
              <span id="apoEqModeThumb" class="segmented-toggle-thumb" aria-hidden="true"></span>
            </div>
            <label class="apo-control-group apo-control-group-inline" for="apoMaxFiltersInput">
              <span>Filters</span>
              <input id="apoMaxFiltersInput" type="number" min="1" max="256" step="1" value="${DEFAULT_APO_MAX_FILTERS}" />
            </label>
          </div>

          <input id="measurementFileInput" type="file" accept=".txt,.csv,.json,.targetcurve,text/plain,application/json" multiple hidden />
          <input id="referenceFileInput" type="file" accept=".txt,.csv,.targetcurve,text/plain" multiple hidden />
          <input id="configFileInput" type="file" accept=".json,application/json,text/plain" hidden />

          <div id="measurementsPlotCard" class="plot-card">
            <span style="color:var(--text-muted);font-size:11px">Run or import measurements to plot response</span>
          </div>
          <div class="apo-plot-stack">
            <div id="apoPlotCard" class="plot-card">
              <span style="color:var(--text-muted);font-size:11px">Enable filters to see EQ graph</span>
            </div>
          </div>
        </div>

        <div id="apoCard" class="apo-card">
          <div class="apo-toolbar">
            <span class="section-title">Equalizer</span>
            <div class="apo-toolbar-actions">
              <button id="generateApoFiltersButton" class="btn btn-secondary" type="button">
                Generate Baseline
              </button>
              <button id="addApoFilterButton" class="btn btn-secondary" type="button">
                Add Filter
              </button>
              <button id="clearApoFiltersButton" class="btn btn-secondary" type="button">
                Clear
              </button>
              <button id="exportApoConfigButton" class="btn btn-secondary" type="button">
                Export APO
              </button>
              <div class="apo-apply-anchor">
                <button id="applyApoConfigButton" class="btn btn-secondary" type="button">
                  Apply APO
                </button>
                <div id="apoApplyWarning" class="apo-apply-warning" hidden>
                  <span>PEACE is running</span>
                </div>
              </div>
            </div>
          </div>

          <div class="apo-grid">
            <div class="field">
              <label for="apoMeasurementSelect">Measurement</label>
              <select id="apoMeasurementSelect"></select>
            </div>

            <div class="field">
              <label for="apoReferenceSelect">Target</label>
              <select id="apoReferenceSelect"></select>
            </div>
          </div>



          <span class="apo-hint">Generate filters from the selected measurement and target curve, then fine-tune them below or iterate automatically from the left panel.</span>
          <span id="apoApplyStatus" class="apo-hint"></span>

          <div class="apo-filter-header">
            <span class="apo-filter-header-cell">On</span>
            <span class="apo-filter-header-cell apo-filter-header-type">Type</span>
            <span class="apo-filter-header-cell">Freq (Hz)</span>
            <span class="apo-filter-header-cell">Gain (dB)</span>
            <span class="apo-filter-header-cell apo-filter-header-q">Q</span>
            <span class="apo-filter-header-cell">Action</span>
          </div>

          <div id="apoFilterList" class="apo-filter-list"></div>

          <div class="field">
            <label for="apoConfigPreview">APO Config Preview</label>
            <textarea id="apoConfigPreview" class="apo-config-preview" readonly></textarea>
          </div>
        </div>

        <span class="section-title">Log</span>
        <ul id="logList" class="log-list"></ul>
      </section>
    </section>
    <button id="toastButton" class="toast" type="button" hidden></button>
  </main>
`;

const microphoneSelect = getElement<HTMLSelectElement>('microphoneSelect');
const measurementBackendSelect = getElement<HTMLSelectElement>('measurementBackendSelect');
const sampleRateSelect = getElement<HTMLSelectElement>('sampleRateSelect');
const inputChannelSelect = getElement<HTMLSelectElement>('inputChannelSelect');
const refreshDevicesButton = getElement<HTMLButtonElement>('refreshDevicesButton');
const chooseFolderButton = getElement<HTMLButtonElement>('chooseFolderButton');
const saveConfigButton = getElement<HTMLButtonElement>('saveConfigButton');
const importConfigButton = getElement<HTMLButtonElement>('importConfigButton');
const selectedFolder = getElement<HTMLDivElement>('selectedFolder');
const outputChannelSelect = getElement<HTMLSelectElement>('outputChannelSelect');
const outputSelect = getElement<HTMLSelectElement>('outputSelect');
const startFrequencyInput = getElement<HTMLInputElement>('startFrequencyInput');
const endFrequencyInput = getElement<HTMLInputElement>('endFrequencyInput');
const durationInput = getElement<HTMLInputElement>('durationInput');
const volumeInput = getElement<HTMLInputElement>('volumeInput');
const volumeNumberInput = getElement<HTMLInputElement>('volumeNumberInput');
const runMeasurementButton = getElement<HTMLButtonElement>('runMeasurementButton');
const runAutomationButton = getElement<HTMLButtonElement>('runAutomationButton');
const automationAlgorithmSelect = getElement<HTMLSelectElement>('automationAlgorithmSelect');
const proportionalAutomationFields = getElement<HTMLDivElement>('proportionalAutomationFields');
const automationDelayInput = getElement<HTMLInputElement>('automationDelayInput');
const proportionalPField = getElement<HTMLDivElement>('proportionalPField');
const proportionalPInput = getElement<HTMLInputElement>('proportionalPInput');
const dynamicProportionalPToggle = getElement<HTMLInputElement>('dynamicProportionalPToggle');
const automationStopOnToleranceToggle = getElement<HTMLInputElement>('automationStopOnToleranceToggle');
const automationRegressionLimitInput = getElement<HTMLInputElement>('automationRegressionLimitInput');
const automationToleranceFields = getElement<HTMLDivElement>('automationToleranceFields');
const automationToleranceInputs: Record<AutomationToleranceBand, HTMLInputElement> = {
  subBass: getElement<HTMLInputElement>('automationTolerancesubBassInput'),
  bass: getElement<HTMLInputElement>('automationTolerancebassInput'),
  lowMid: getElement<HTMLInputElement>('automationTolerancelowMidInput'),
  mid: getElement<HTMLInputElement>('automationTolerancemidInput'),
  upMid: getElement<HTMLInputElement>('automationToleranceupMidInput'),
  presence: getElement<HTMLInputElement>('automationTolerancepresenceInput'),
  brilliance: getElement<HTMLInputElement>('automationTolerancebrillianceInput'),
};
const statusPill = getElement<HTMLDivElement>('statusPill');
const latencyValue = getElement<HTMLSpanElement>('latencyValue');
const peakValue = getElement<HTMLSpanElement>('peakValue');
const rmsValue = getElement<HTMLSpanElement>('rmsValue');
const savedPathValue = getElement<HTMLSpanElement>('savedPathValue');
const importMeasurementsButton = getElement<HTMLButtonElement>('importMeasurementsButton');
const importReferenceButton = getElement<HTMLButtonElement>('importReferenceButton');
const normalizePlotToggle = getElement<HTMLInputElement>('normalizePlotToggle');
const smoothingModeSelect = getElement<HTMLSelectElement>('smoothingModeSelect');

const measurementFileInput = getElement<HTMLInputElement>('measurementFileInput');
const referenceFileInput = getElement<HTMLInputElement>('referenceFileInput');
const configFileInput = getElement<HTMLInputElement>('configFileInput');
const plotsContainer = getElement<HTMLDivElement>('plotsContainer');
const measurementsPlotCard = getElement<HTMLDivElement>('measurementsPlotCard');
const apoEqModeToggle = getElement<HTMLDivElement>('apoEqModeToggle');
const apoEqModeParametricButton = getElement<HTMLButtonElement>('apoEqModeParametricButton');
const apoEqModeGraphicButton = getElement<HTMLButtonElement>('apoEqModeGraphicButton');
const apoPlotCard = getElement<HTMLDivElement>('apoPlotCard');
const apoCard = getElement<HTMLDivElement>('apoCard');
const generateApoFiltersButton = getElement<HTMLButtonElement>('generateApoFiltersButton');
const addApoFilterButton = getElement<HTMLButtonElement>('addApoFilterButton');
const clearApoFiltersButton = getElement<HTMLButtonElement>('clearApoFiltersButton');
const exportApoConfigButton = getElement<HTMLButtonElement>('exportApoConfigButton');
const applyApoConfigButton = getElement<HTMLButtonElement>('applyApoConfigButton');
const apoApplyWarning = getElement<HTMLDivElement>('apoApplyWarning');
const apoMeasurementSelect = getElement<HTMLSelectElement>('apoMeasurementSelect');
const apoReferenceSelect = getElement<HTMLSelectElement>('apoReferenceSelect');
const apoMaxFiltersInput = getElement<HTMLInputElement>('apoMaxFiltersInput');
const apoFilterList = getElement<HTMLDivElement>('apoFilterList');
const apoConfigPreview = getElement<HTMLTextAreaElement>('apoConfigPreview');
const apoApplyStatus = getElement<HTMLSpanElement>('apoApplyStatus');
const logList = getElement<HTMLUListElement>('logList');
const toastButton = getElement<HTMLButtonElement>('toastButton');

const PLOT_ASPECT_RATIO = DEFAULT_PLOT_WIDTH / DEFAULT_PLOT_HEIGHT;
const PLOTS_GAP_PX = 12;
const MIN_SPLIT_PLOT_HEIGHT_PX = 220;
const storedApoFilters = readStoredApoFilterSets();
const storedApoMaxFilterCounts = readStoredApoMaxFilterCounts();

const state: AppState = {
  busy: false,
  outputFolder: localStorage.getItem(STORAGE_KEY),
  measurementBackend: readStoredMeasurementBackend(),
  measurementKeepCount: readStoredMeasurementKeepCount(),
  splOffsetDb: 0,
  normalizePlot: localStorage.getItem(NORMALIZE_PLOT_STORAGE_KEY) !== 'false',
  smoothingMode: readStoredSmoothingMode(),
  measurements: [],
  referenceCurves: [],
  focusedMeasurementId: null,
  nextMeasurementIndex: 1,
  nextReferenceIndex: 1,
  apoEqMode: readStoredApoEqMode(),
  parametricApoFilters: storedApoFilters.parametric,
  graphicApoFilters: storedApoFilters.graphic,
  automationAlgorithm: readStoredAutomationAlgorithm(),
  automationDelaySeconds: clamp(
    readStoredNumber(
      AUTOMATION_DELAY_SECONDS_STORAGE_KEY,
      DEFAULT_AUTOMATION_DELAY_SECONDS,
    ),
    0,
    3600,
  ),
  proportionalP: clamp(
    readStoredNumber(PROPORTIONAL_P_STORAGE_KEY, DEFAULT_PROPORTIONAL_P),
    0,
    1,
  ),
  dynamicProportionalP:
    localStorage.getItem(DYNAMIC_PROPORTIONAL_P_STORAGE_KEY) === 'true'
      ? true
      : DEFAULT_DYNAMIC_PROPORTIONAL_P,
  automationStopOnTolerance:
    localStorage.getItem(AUTOMATION_STOP_ON_TOLERANCE_STORAGE_KEY) === 'true'
      ? true
      : DEFAULT_AUTOMATION_STOP_ON_TOLERANCE,
  automationBandTolerances: readStoredAutomationBandTolerances(),
  automationRegressionLimit: clamp(
    readStoredNumber(
      AUTOMATION_REGRESSION_LIMIT_STORAGE_KEY,
      DEFAULT_AUTOMATION_REGRESSION_LIMIT,
    ),
    0,
    20,
  ),
  latestAutomationToleranceStatus: null,
  automationRunning: false,
  automationStopRequested: false,
  apoSelectedMeasurementId: localStorage.getItem(APO_SELECTED_MEASUREMENT_STORAGE_KEY),
  apoSelectedReferenceId: localStorage.getItem(APO_SELECTED_REFERENCE_STORAGE_KEY),
  parametricApoMaxFilters: storedApoMaxFilterCounts.parametric,
  graphicApoMaxFilters: storedApoMaxFilterCounts.graphic,
  apoMaxBoostDb: clamp(
    readStoredNumber(APO_MAX_BOOST_STORAGE_KEY, DEFAULT_APO_MAX_BOOST_DB),
    0,
    24,
  ),
  apoMaxCutDb: clamp(
    readStoredNumber(APO_MAX_CUT_STORAGE_KEY, DEFAULT_APO_MAX_CUT_DB),
    0,
    24,
  ),
  nextApoFilterIndex: 1,
  latestStatusMessage: 'Ready',
  latestStatusTone: 'idle',
  equalizerApoStatus: null,
  toast: null,
  toastTimeoutId: 0,
};

state.nextApoFilterIndex =
  [...state.parametricApoFilters, ...state.graphicApoFilters].reduce((maxId, filter) => {
    const numericId = Number(filter.id.replace('apo-filter-', ''));
    return Number.isFinite(numericId) ? Math.max(maxId, numericId) : maxId;
  }, 0) + 1;

function getActiveApoFilters(): ApoFilter[] {
  return state.apoEqMode === 'graphic' ? state.graphicApoFilters : state.parametricApoFilters;
}

function setActiveApoFilters(filters: ApoFilter[]): void {
  if (state.apoEqMode === 'graphic') {
    state.graphicApoFilters = filters;
    return;
  }

  state.parametricApoFilters = filters;
}

function getActiveApoMaxFilters(): number {
  return state.apoEqMode === 'graphic' ? state.graphicApoMaxFilters : state.parametricApoMaxFilters;
}

function setActiveApoMaxFilters(value: number): void {
  if (state.apoEqMode === 'graphic') {
    state.graphicApoMaxFilters = value;
    return;
  }

  state.parametricApoMaxFilters = value;
}

function syncParametricApoFilterCountToFilters(): void {
  state.parametricApoMaxFilters = clamp(state.parametricApoFilters.length, 0, 256);
}

function syncParametricFiltersToCount(): void {
  const targetCount = clamp(state.parametricApoMaxFilters, 0, 256);
  const currentFilters = [...state.parametricApoFilters].sort(
    (left, right) => left.frequencyHz - right.frequencyHz,
  );

  if (currentFilters.length < targetCount) {
    let nextFilters = currentFilters;

    while (nextFilters.length < targetCount) {
      nextFilters = [
        ...nextFilters,
        {
          id: `apo-filter-${state.nextApoFilterIndex}`,
          enabled: true,
          kind: 'PK',
          frequencyHz: findNextParametricFilterFrequency(nextFilters),
          gainDb: 0,
          q: 1.41,
        },
      ];
      state.nextApoFilterIndex += 1;
    }

    state.parametricApoFilters = nextFilters;
    return;
  }

  if (currentFilters.length > targetCount) {
    state.parametricApoFilters = currentFilters.slice(0, targetCount);
  }
}

chooseFolderButton.addEventListener('click', () => {
  void chooseOutputFolder();
});

saveConfigButton.addEventListener('click', () => {
  void saveConfiguration();
});

importConfigButton.addEventListener('click', () => {
  configFileInput.click();
});

measurementBackendSelect.addEventListener('change', () => {
  state.measurementBackend = getSelectedMeasurementBackend();
  localStorage.setItem(MEASUREMENT_BACKEND_STORAGE_KEY, state.measurementBackend);
  updateMeasurementBackendUi();
  persistActiveConfiguration();
});

refreshDevicesButton.addEventListener('click', () => {
  void refreshMicrophones(true);
});

microphoneSelect.addEventListener('change', () => {
  localStorage.setItem(INPUT_DEVICE_STORAGE_KEY, microphoneSelect.value);
  microphoneSelect.dataset.storedDeviceId = microphoneSelect.value;
});

outputSelect.addEventListener('change', () => {
  localStorage.setItem(OUTPUT_DEVICE_STORAGE_KEY, outputSelect.value);
  outputSelect.dataset.storedDeviceId = outputSelect.value;
});

importMeasurementsButton.addEventListener('click', () => {
  measurementFileInput.click();
});

importReferenceButton.addEventListener('click', () => {
  referenceFileInput.click();
});

measurementFileInput.addEventListener('change', () => {
  const files = Array.from(measurementFileInput.files ?? []);
  measurementFileInput.value = '';

  if (files.length > 0) {
    void importMeasurementFiles(files);
  }
});

referenceFileInput.addEventListener('change', () => {
  const files = Array.from(referenceFileInput.files ?? []);
  referenceFileInput.value = '';

  if (files.length > 0) {
    void importReferenceFiles(files);
  }
});

configFileInput.addEventListener('change', () => {
  const file = configFileInput.files?.[0] ?? null;
  configFileInput.value = '';

  if (file) {
    void importConfiguration(file);
  }
});

runMeasurementButton.addEventListener('click', () => {
  void runMeasurement();
});

runAutomationButton.addEventListener('click', () => {
  void toggleAutomationLoop();
});

document.addEventListener('keydown', (event) => {
  if (
    event.key.toLowerCase() !== 'd' ||
    !event.ctrlKey ||
    !event.shiftKey ||
    event.altKey ||
    event.metaKey
  ) {
    return;
  }

  event.preventDefault();
  resetUserInputsToDefaults();
});

measurementsPlotCard.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const measurementId = target.dataset.measurementToggle;
  if (measurementId) {
    setMeasurementVisibility(measurementId, target.checked);
    return;
  }

  if (target.dataset.measurementKeepCount !== undefined) {
    state.measurementKeepCount = normalizeMeasurementKeepCount(target.value);
    target.value = String(state.measurementKeepCount);
    localStorage.setItem(MEASUREMENT_KEEP_COUNT_STORAGE_KEY, String(state.measurementKeepCount));
    const prunedMeasurements = pruneMeasurementsToKeepCount();
    if (prunedMeasurements.length > 0) {
      appendMeasurementPruneLog(prunedMeasurements);
    }
    persistActiveConfiguration();
    renderMeasurements();
    return;
  }

  const referenceId = target.dataset.referenceToggle;
  if (referenceId) {
    setReferenceVisibility(referenceId, target.checked);
  }
});

measurementsPlotCard.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const removeButton = target.closest('[data-measurement-remove]');
  const measurementId =
    removeButton instanceof HTMLButtonElement
      ? removeButton.dataset.measurementRemove
      : undefined;
  const exportButton = target.closest('[data-measurement-export]');
  const exportMeasurementId =
    exportButton instanceof HTMLButtonElement
      ? exportButton.dataset.measurementExport
      : undefined;
  const starButton = target.closest('[data-measurement-star]');
  const starMeasurementId =
    starButton instanceof HTMLButtonElement
      ? starButton.dataset.measurementStar
      : undefined;
  const referenceRemoveButton = target.closest('[data-reference-remove]');
  const referenceId =
    referenceRemoveButton instanceof HTMLButtonElement
      ? referenceRemoveButton.dataset.referenceRemove
      : undefined;

  if (measurementId) {
    removeMeasurement(measurementId);
    return;
  }

  if (exportMeasurementId) {
    void exportMeasurement(exportMeasurementId);
    return;
  }

  if (starMeasurementId) {
    toggleMeasurementStar(starMeasurementId);
    return;
  }

  if (referenceId) {
    removeReferenceCurve(referenceId);
  }
});

volumeInput.addEventListener('input', () => {
  syncVolumeControls('slider');
});

volumeNumberInput.addEventListener('input', () => {
  syncVolumeControls('number', false);
});

volumeNumberInput.addEventListener('blur', () => {
  syncVolumeControls('number');
});

normalizePlotToggle.addEventListener('change', () => {
  state.normalizePlot = normalizePlotToggle.checked;
  localStorage.setItem(NORMALIZE_PLOT_STORAGE_KEY, String(state.normalizePlot));
  persistActiveConfiguration();
  renderMeasurements();
});

smoothingModeSelect.addEventListener('change', () => {
  state.smoothingMode = getSelectedSmoothingMode();
  localStorage.setItem(SMOOTHING_MODE_STORAGE_KEY, state.smoothingMode);
  persistActiveConfiguration();
  renderMeasurements();
  renderApoSection();
});

sampleRateSelect.addEventListener('change', () => {
  localStorage.setItem(SAMPLE_RATE_STORAGE_KEY, sampleRateSelect.value);
  persistActiveConfiguration();
});

inputChannelSelect.addEventListener('change', () => {
  localStorage.setItem(INPUT_CHANNEL_STORAGE_KEY, inputChannelSelect.value);
  persistActiveConfiguration();
});

outputChannelSelect.addEventListener('change', () => {
  localStorage.setItem(OUTPUT_CHANNEL_STORAGE_KEY, outputChannelSelect.value);
  persistActiveConfiguration();
});

startFrequencyInput.addEventListener('input', () => {
  const value = Number(startFrequencyInput.value);
  if (Number.isFinite(value)) {
    localStorage.setItem(START_FREQUENCY_STORAGE_KEY, String(value));
    persistActiveConfiguration();
  }
});

endFrequencyInput.addEventListener('input', () => {
  const value = Number(endFrequencyInput.value);
  if (Number.isFinite(value)) {
    localStorage.setItem(END_FREQUENCY_STORAGE_KEY, String(value));
    persistActiveConfiguration();
  }
});

durationInput.addEventListener('input', () => {
  const value = Number(durationInput.value);
  if (Number.isFinite(value)) {
    localStorage.setItem(DURATION_STORAGE_KEY, String(value));
    persistActiveConfiguration();
  }
});

volumeInput.addEventListener('input', () => {
  const value = Number(volumeInput.value);
  if (Number.isFinite(value)) {
    localStorage.setItem(SWEEP_LEVEL_STORAGE_KEY, String(value));
    persistActiveConfiguration();
  }
});

automationAlgorithmSelect.addEventListener('change', () => {
  state.automationAlgorithm = getSelectedAutomationAlgorithm();
  persistAutomationSettings();
  persistActiveConfiguration();
  updateAutomationUi();
});

automationStopOnToleranceToggle.addEventListener('change', () => {
  syncAutomationSettings(true);
  setStatus(state.latestStatusMessage, state.latestStatusTone);
  updateAutomationUi();
});

proportionalPInput.addEventListener('input', () => {
  syncAutomationSettings(false);
});

proportionalPInput.addEventListener('blur', () => {
  syncAutomationSettings(true);
});

dynamicProportionalPToggle.addEventListener('change', () => {
  syncAutomationSettings(true);
  updateAutomationUi();
});

automationDelayInput.addEventListener('input', () => {
  syncAutomationSettings(false);
});

automationDelayInput.addEventListener('blur', () => {
  syncAutomationSettings(true);
});

automationRegressionLimitInput.addEventListener('input', () => {
  syncAutomationSettings(false);
});

automationRegressionLimitInput.addEventListener('blur', () => {
  syncAutomationSettings(true);
});

for (const input of Object.values(automationToleranceInputs)) {
  input.addEventListener('input', () => {
    syncAutomationSettings(false);
  });

  input.addEventListener('blur', () => {
    syncAutomationSettings(true);
  });
}

generateApoFiltersButton.addEventListener('click', () => {
  void generateApoFilters();
});

addApoFilterButton.addEventListener('click', () => {
  addApoFilter();
});

clearApoFiltersButton.addEventListener('click', () => {
  clearApoFilters();
});

exportApoConfigButton.addEventListener('click', () => {
  void exportApoConfig();
});

applyApoConfigButton.addEventListener('click', () => {
  void applyApoConfig();
});

apoEqModeToggle.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const nextMode = target.dataset.apoEqMode;
  if (!isApoEqMode(nextMode)) {
    return;
  }

  if (state.apoEqMode === nextMode) {
    return;
  }

  state.apoEqMode = nextMode;
  apoMaxFiltersInput.value = String(getActiveApoMaxFilters());
  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
});

apoMeasurementSelect.addEventListener('change', () => {
  state.apoSelectedMeasurementId = apoMeasurementSelect.value || null;
  persistApoSelections();
  renderApoSection();
  updateAutomationUi();
});

apoReferenceSelect.addEventListener('change', () => {
  state.apoSelectedReferenceId = apoReferenceSelect.value || null;
  persistApoSelections();
  renderApoSection();
  updateAutomationUi();
});

apoMaxFiltersInput.addEventListener('input', () => {
  syncApoGenerationSettings(false);
});

apoMaxFiltersInput.addEventListener('blur', () => {
  syncApoGenerationSettings(true);
});

apoFilterList.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const filterId = target.dataset.apoFilterId;
  const field = target.dataset.apoField;
  if (!filterId || !field) {
    return;
  }

  if (field === 'enabled' && target instanceof HTMLInputElement) {
    updateApoFilter(filterId, field, target.checked);
    return;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
    updateApoFilter(filterId, field, target.value);
  }
});

apoFilterList.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const removeButton = target.closest<HTMLButtonElement>('[data-apo-filter-remove]');
  const filterId = removeButton?.dataset.apoFilterRemove;

  if (filterId) {
    removeApoFilter(filterId);
  }
});

toastButton.addEventListener('click', () => {
  const toast = state.toast;
  if (!toast) {
    return;
  }

  void openToastPath(toast.actionPath);
});

navigator.mediaDevices?.addEventListener?.('devicechange', () => {
  void refreshMicrophones(false);
});

let plotsResizeTimeoutId: number | null = null;
const plotsResizeObserver = new ResizeObserver(() => {
  updatePlotsLayout();
  // Debounce re-render to avoid excessive redraws during resize
  if (plotsResizeTimeoutId) {
    window.clearTimeout(plotsResizeTimeoutId);
  }
  plotsResizeTimeoutId = window.setTimeout(() => {
    renderMeasurements();
    renderApoSection();
  }, 100);
});
plotsResizeObserver.observe(plotsContainer);

updateSelectedFolder();
measurementBackendSelect.value = state.measurementBackend;
updateMeasurementBackendUi();
syncVolumeControls('slider');
normalizePlotToggle.checked = state.normalizePlot;
smoothingModeSelect.value = state.smoothingMode;
apoMaxFiltersInput.value = String(getActiveApoMaxFilters());
automationAlgorithmSelect.value = state.automationAlgorithm;
proportionalPInput.value = state.proportionalP.toFixed(2);
automationDelayInput.value = state.automationDelaySeconds.toFixed(1);
initializeMeasurementConfigFromStorage();
hideToast();
updateMeasurementActionState();
updateAutomationUi();
renderApoSection();
appendLog('Click Refresh to access microphones and outputs.');
void refreshEqualizerApoStatus();
void refreshMicrophones(false);

function getElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`);
  }

  return element as TElement;
}

function setBusy(isBusy: boolean): void {
  state.busy = isBusy;

  sampleRateSelect.disabled = isBusy;
  inputChannelSelect.disabled = isBusy;
  microphoneSelect.disabled = isBusy;
  refreshDevicesButton.disabled = isBusy;
  chooseFolderButton.disabled = isBusy;
  saveConfigButton.disabled = isBusy;
  importConfigButton.disabled = isBusy;
  outputChannelSelect.disabled = isBusy;
  outputSelect.disabled = isBusy;
  startFrequencyInput.disabled = isBusy;
  endFrequencyInput.disabled = isBusy;
  durationInput.disabled = isBusy;
  volumeInput.disabled = isBusy;
  volumeNumberInput.disabled = isBusy;
  runMeasurementButton.disabled = isBusy || state.automationRunning;
  runAutomationButton.disabled = isBusy && !state.automationRunning;
  measurementFileInput.disabled = isBusy;
  referenceFileInput.disabled = isBusy;
  configFileInput.disabled = isBusy;
  measurementBackendSelect.disabled = isBusy;
  automationAlgorithmSelect.disabled = isBusy;
  automationDelayInput.disabled = isBusy;
  dynamicProportionalPToggle.disabled = isBusy;
  automationStopOnToleranceToggle.disabled = isBusy;
  automationRegressionLimitInput.disabled = isBusy;
  updateProportionalPControlState();
  updateAutomationToleranceFieldState();
  smoothingModeSelect.disabled = isBusy;
  generateApoFiltersButton.disabled = isBusy;
  addApoFilterButton.disabled = isBusy;
  clearApoFiltersButton.disabled = isBusy;
  exportApoConfigButton.disabled = isBusy;
  applyApoConfigButton.disabled = isBusy;
  apoEqModeParametricButton.disabled = isBusy;
  apoEqModeGraphicButton.disabled = isBusy;
  apoMeasurementSelect.disabled = isBusy;
  apoReferenceSelect.disabled = isBusy;
  apoMaxFiltersInput.disabled = isBusy;
  updateMeasurementBackendUi();

  updateMeasurementActionState();

  if (state.measurements.length > 0 || state.referenceCurves.length > 0) {
    renderMeasurements();
  }
}

function setStatus(message: string, tone: StatusTone): void {
  state.latestStatusMessage = message;
  state.latestStatusTone = tone;
  statusPill.textContent =
    state.automationStopOnTolerance && state.latestAutomationToleranceStatus
      ? `${message} ${state.latestAutomationToleranceStatus}`
      : message;
  statusPill.dataset.tone = tone;
}

function getAutomationToleranceStatusSuffix(): string {
  return state.automationStopOnTolerance && state.latestAutomationToleranceStatus
    ? ` ${state.latestAutomationToleranceStatus}`
    : '';
}

function appendLog(message: string, tone: LogTone = 'neutral'): void {
  const item = document.createElement('li');
  item.dataset.tone = tone;
  item.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  logList.prepend(item);
}

function isBusyFileError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return /\bEBUSY\b/u.test(message) || /resource busy or locked/iu.test(message);
}

function updateSelectedFolder(): void {
  selectedFolder.textContent = state.outputFolder ?? 'None';
  updateMeasurementActionState();

  if (state.measurements.length > 0 || state.referenceCurves.length > 0) {
    renderMeasurements();
  }
}

function updateMeasurementActionState(): void {
  importMeasurementsButton.disabled = state.busy;
  importReferenceButton.disabled = state.busy;
  saveConfigButton.disabled = state.busy;
  importConfigButton.disabled = state.busy;
  runMeasurementButton.disabled = state.busy || state.automationRunning;
  runAutomationButton.disabled = state.busy && !state.automationRunning;
  runAutomationButton.textContent = state.automationStopRequested
    ? 'Stopping...'
    : state.automationRunning
      ? 'Stop'
      : 'Run Until Stopped';
  generateApoFiltersButton.disabled =
    state.busy || !state.apoSelectedMeasurementId || !state.apoSelectedReferenceId;
  addApoFilterButton.disabled = state.busy || state.apoEqMode === 'graphic';
  clearApoFiltersButton.disabled = state.busy || getActiveApoFilters().length === 0;
  exportApoConfigButton.disabled = state.busy || !state.outputFolder;
  const enabledFilterCount = getActiveApoFilters().filter((filter) => filter.enabled).length;
  const apoInstalled = state.equalizerApoStatus?.installed ?? false;
  applyApoConfigButton.disabled = state.busy || enabledFilterCount === 0 || !apoInstalled;
}

function updateMeasurementBackendUi(): void {
  const usesSox = state.measurementBackend === 'sox';
  microphoneSelect.disabled = state.busy || usesSox;
  refreshDevicesButton.disabled = state.busy || usesSox;
  outputSelect.disabled = state.busy || usesSox;
}

function updateProportionalPControlState(): void {
  const proportionalPDisabled = state.busy || state.dynamicProportionalP;
  proportionalPField.dataset.disabled = proportionalPDisabled ? 'true' : 'false';
  proportionalPField.setAttribute('aria-disabled', String(proportionalPDisabled));
  proportionalPInput.disabled = proportionalPDisabled;
  proportionalPInput.readOnly = proportionalPDisabled;
  proportionalPInput.placeholder = state.dynamicProportionalP ? '-.--' : '';

  if (proportionalPInput.disabled && document.activeElement === proportionalPInput) {
    proportionalPInput.blur();
  }

  if (!state.dynamicProportionalP) {
    proportionalPInput.value = state.proportionalP.toFixed(2);
    return;
  }

  const currentProportionalP = state.automationRunning
    ? getCurrentAutomationProportionalP(
        getSelectedApoMeasurement(),
        getSelectedApoReference(),
      )
    : null;
  proportionalPInput.value = currentProportionalP?.toFixed(2) ?? '';
}

function updateAutomationToleranceFieldState(): void {
  const toleranceFieldsDisabled = state.busy || !state.automationStopOnTolerance;
  automationToleranceFields.dataset.disabled = toleranceFieldsDisabled ? 'true' : 'false';

  for (const input of Object.values(automationToleranceInputs)) {
    input.disabled = toleranceFieldsDisabled;
  }
}

function updateAutomationUi(): void {
  const isProportional = state.automationAlgorithm === 'proportional';
  automationAlgorithmSelect.value = state.automationAlgorithm;
  automationDelayInput.value = state.automationDelaySeconds.toFixed(1);
  proportionalAutomationFields.hidden = !isProportional;
  dynamicProportionalPToggle.checked = state.dynamicProportionalP;
  updateProportionalPControlState();
  automationStopOnToleranceToggle.checked = state.automationStopOnTolerance;
  automationRegressionLimitInput.value = String(state.automationRegressionLimit);
  updateAutomationToleranceFieldState();
  for (const band of AUTOMATION_TOLERANCE_BANDS) {
    automationToleranceInputs[band.key].value = state.automationBandTolerances[band.key].toFixed(1);
  }
  updateMeasurementActionState();
}

function showToast(toast: ToastState): void {
  state.toast = toast;
  toastButton.hidden = false;
  toastButton.innerHTML = `<span class="toast-title">${escapeHtml(toast.message)}</span><span class="toast-action">${escapeHtml(toast.actionLabel)}</span>`;

  if (state.toastTimeoutId) {
    window.clearTimeout(state.toastTimeoutId);
  }

  state.toastTimeoutId = window.setTimeout(() => {
    hideToast();
  }, 5000);
}

function hideToast(): void {
  state.toast = null;
  toastButton.hidden = true;
  toastButton.textContent = '';

  if (state.toastTimeoutId) {
    window.clearTimeout(state.toastTimeoutId);
    state.toastTimeoutId = 0;
  }
}

async function openToastPath(filePath: string): Promise<void> {
  try {
    await window.freakishEars.showItemInFolder(filePath);
    hideToast();
  } catch (error) {
    appendLog(`Unable to open exported item: ${getErrorMessage(error)}`, 'error');
  }
}

function syncVolumeControls(source: 'slider' | 'number', normalize = true): void {
  if (source === 'slider') {
    const level = clamp(
      Number(volumeInput.value),
      MIN_SWEEP_LEVEL_DB,
      MAX_SWEEP_LEVEL_DB,
    );

    volumeInput.value = level.toFixed(0);
    volumeNumberInput.value = level.toFixed(0);
    return;
  }

  const parsed = Number(volumeNumberInput.value);
  if (!Number.isFinite(parsed)) {
    if (normalize) {
      volumeNumberInput.value = volumeInput.value;
    }

    return;
  }

  const level = clamp(parsed, MIN_SWEEP_LEVEL_DB, MAX_SWEEP_LEVEL_DB);
  volumeInput.value = level.toFixed(0);

  if (normalize) {
    volumeNumberInput.value = level.toFixed(0);
  }
}

function resetUserInputsToDefaults(): void {
  if (state.busy || state.automationRunning) {
    return;
  }

  measurementBackendSelect.value = DEFAULT_MEASUREMENT_BACKEND;
  state.measurementBackend = DEFAULT_MEASUREMENT_BACKEND;
  localStorage.setItem(MEASUREMENT_BACKEND_STORAGE_KEY, state.measurementBackend);

  sampleRateSelect.value = String(DEFAULT_SAMPLE_RATE);
  localStorage.setItem(SAMPLE_RATE_STORAGE_KEY, sampleRateSelect.value);

  inputChannelSelect.value = 'both';
  outputChannelSelect.value = 'both';
  localStorage.setItem(INPUT_CHANNEL_STORAGE_KEY, inputChannelSelect.value);
  localStorage.setItem(OUTPUT_CHANNEL_STORAGE_KEY, outputChannelSelect.value);

  if (microphoneSelect.options.length > 0) {
    microphoneSelect.selectedIndex = 0;
  }
  microphoneSelect.dataset.storedDeviceId = microphoneSelect.value;
  localStorage.setItem(INPUT_DEVICE_STORAGE_KEY, microphoneSelect.value);

  if (Array.from(outputSelect.options).some((option) => option.value === '')) {
    outputSelect.value = '';
  } else if (outputSelect.options.length > 0) {
    outputSelect.selectedIndex = 0;
  }
  outputSelect.dataset.storedDeviceId = outputSelect.value;
  localStorage.setItem(OUTPUT_DEVICE_STORAGE_KEY, outputSelect.value);

  startFrequencyInput.value = String(DEFAULT_START_FREQUENCY);
  endFrequencyInput.value = String(DEFAULT_END_FREQUENCY);
  durationInput.value = String(DEFAULT_DURATION_SECONDS);
  volumeInput.value = String(DEFAULT_SWEEP_LEVEL_DB);
  volumeNumberInput.value = String(DEFAULT_SWEEP_LEVEL_DB);
  syncVolumeControls('slider');
  localStorage.setItem(START_FREQUENCY_STORAGE_KEY, startFrequencyInput.value);
  localStorage.setItem(END_FREQUENCY_STORAGE_KEY, endFrequencyInput.value);
  localStorage.setItem(DURATION_STORAGE_KEY, durationInput.value);
  localStorage.setItem(SWEEP_LEVEL_STORAGE_KEY, volumeInput.value);

  state.splOffsetDb = 0;

  state.normalizePlot = true;
  normalizePlotToggle.checked = state.normalizePlot;
  localStorage.setItem(NORMALIZE_PLOT_STORAGE_KEY, String(state.normalizePlot));

  state.smoothingMode = DEFAULT_SMOOTHING_MODE;
  smoothingModeSelect.value = state.smoothingMode;
  localStorage.setItem(SMOOTHING_MODE_STORAGE_KEY, state.smoothingMode);

  state.measurementKeepCount = DEFAULT_MEASUREMENT_KEEP_COUNT;
  localStorage.setItem(MEASUREMENT_KEEP_COUNT_STORAGE_KEY, String(state.measurementKeepCount));
  const prunedMeasurements = pruneMeasurementsToKeepCount();
  if (prunedMeasurements.length > 0) {
    appendMeasurementPruneLog(prunedMeasurements);
  }

  state.automationAlgorithm = DEFAULT_AUTOMATION_ALGORITHM;
  automationAlgorithmSelect.value = state.automationAlgorithm;
  state.automationDelaySeconds = DEFAULT_AUTOMATION_DELAY_SECONDS;
  state.proportionalP = DEFAULT_PROPORTIONAL_P;
  state.dynamicProportionalP = DEFAULT_DYNAMIC_PROPORTIONAL_P;
  state.automationStopOnTolerance = DEFAULT_AUTOMATION_STOP_ON_TOLERANCE;
  state.automationBandTolerances = createDefaultAutomationBandTolerances();
  state.automationRegressionLimit = DEFAULT_AUTOMATION_REGRESSION_LIMIT;
  state.latestAutomationToleranceStatus = null;
  persistAutomationSettings();

  state.apoEqMode = DEFAULT_APO_EQ_MODE;
  state.parametricApoMaxFilters = 0;
  state.graphicApoMaxFilters = DEFAULT_APO_MAX_FILTERS;
  state.parametricApoFilters = [];
  state.graphicApoFilters = buildGraphicEqFilters(state.graphicApoMaxFilters);
  state.nextApoFilterIndex = state.graphicApoFilters.length + 1;
  apoMaxFiltersInput.value = String(getActiveApoMaxFilters());
  persistApoState();

  updateMeasurementBackendUi();
  updateAutomationUi();
  renderMeasurements();
  persistActiveConfiguration();
  setStatus('Restored default input values.', 'success');
  appendLog('Restored user input fields to defaults.', 'success');
}

async function chooseOutputFolder(): Promise<void> {
  const result = await window.freakishEars.selectOutputFolder();

  if (result.folderPath) {
    state.outputFolder = result.folderPath;
    localStorage.setItem(STORAGE_KEY, result.folderPath);
    persistActiveConfiguration();
    updateSelectedFolder();
    appendLog(`Save folder set to ${result.folderPath}.`, 'success');
  }
}

async function importMeasurementFiles(files: File[]): Promise<void> {
  if (state.busy || files.length === 0) {
    return;
  }

  const importedMeasurements: LoadedMeasurement[] = [];
  const importFailures: string[] = [];

  try {
    setBusy(true);
    setStatus('Importing measurement files...', 'working');

    for (const file of files) {
      try {
        const contents = await file.text();
        const imported = parseImportedMeasurementFile(file, contents);
        importedMeasurements.push(takeMeasurement(imported));
      } catch (error) {
        importFailures.push(`${file.name}: ${getErrorMessage(error)}`);
      }
    }

    for (const measurement of importedMeasurements) {
      addMeasurement(measurement);
    }

    if (importedMeasurements.length > 0) {
      setStatus(
        `Imported ${importedMeasurements.length} measurement file${importedMeasurements.length === 1 ? '' : 's'}.`,
        'success',
      );
      appendLog(
        `Imported ${importedMeasurements.length} measurement file${importedMeasurements.length === 1 ? '' : 's'} for overlay plotting.`,
        'success',
      );
    }

    if (importFailures.length > 0) {
      for (const failure of importFailures) {
        appendLog(`Import failed: ${failure}`, 'error');
      }

      if (importedMeasurements.length === 0) {
        setStatus('Unable to import the selected measurement files.', 'error');
      }
    }
  } finally {
    setBusy(false);
  }
}

async function exportMeasurement(measurementId: string): Promise<void> {
  if (state.busy) {
    return;
  }

  const outputFolder = state.outputFolder;
  const measurement = state.measurements.find((entry) => entry.id === measurementId);

  if (!outputFolder) {
    setStatus('Choose a save folder before exporting.', 'error');
    appendLog('Export aborted because no save folder is selected.', 'error');
    return;
  }

  if (!measurement) {
    setStatus('Unable to find that measurement for export.', 'error');
    appendLog('Export aborted because the selected measurement no longer exists.', 'error');
    return;
  }

  try {
    setBusy(true);
    setStatus(`Exporting ${measurement.name}...`, 'working');

    const saveResult = await window.freakishEars.saveMeasurementSession({
      folderPath: outputFolder,
      sessionName: `measurement-export-${measurement.exportName}-${formatTimestampForPath(new Date())}`,
      files: [
        {
          name: `${measurement.exportName}.txt`,
          contents: new TextEncoder().encode(
            buildRewMeasurementText({
              measurement,
              splOffsetDb: state.splOffsetDb,
            }),
          ),
        },
      ],
    });

    savedPathValue.textContent = saveResult.sessionDirectory;
    setStatus('Measurement export complete.', 'success');
    appendLog(`Exported ${measurement.name} to ${saveResult.sessionDirectory}.`, 'success');
    showToast({
      message: `Exported ${measurement.name}`,
      actionLabel: 'View in Finder',
      actionPath: saveResult.filePaths[0] ?? saveResult.sessionDirectory,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`Measurement export failed: ${message}`, 'error');
    appendLog(`Measurement export failed: ${message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function refreshMicrophones(requestPermission: boolean): Promise<void> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This environment does not support microphone capture.');
    }

    const priorSelection = microphoneSelect.value;
    const priorOutputSelection = outputSelect.value;
    const storedSelection = microphoneSelect.dataset.storedDeviceId ?? localStorage.getItem(INPUT_DEVICE_STORAGE_KEY) ?? '';
    const storedOutputSelection = outputSelect.dataset.storedDeviceId ?? localStorage.getItem(OUTPUT_DEVICE_STORAGE_KEY) ?? '';

    if (requestPermission) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      for (const track of stream.getTracks()) {
        track.stop();
      }
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const microphones = devices.filter((device) => device.kind === 'audioinput');
    const outputs = devices.filter((device) => device.kind === 'audiooutput');

    microphoneSelect.innerHTML = '';
    outputSelect.innerHTML = '';

    const defaultOutputOption = document.createElement('option');
    defaultOutputOption.value = '';
    defaultOutputOption.textContent = 'System default';
    outputSelect.append(defaultOutputOption);

    if (microphones.length === 0) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = 'No microphones found';
      microphoneSelect.append(emptyOption);
      appendLog('No microphone inputs are currently available.', 'error');
      return;
    }

    for (const microphone of microphones) {
      const option = document.createElement('option');
      option.value = microphone.deviceId;
      option.textContent = microphone.label || 'Unnamed microphone';
      microphoneSelect.append(option);
    }

    const seenOutputIds = new Set<string>();
    for (const output of outputs) {
      if (!output.deviceId || seenOutputIds.has(output.deviceId)) {
        continue;
      }

      seenOutputIds.add(output.deviceId);
      const option = document.createElement('option');
      option.value = output.deviceId;
      option.textContent = output.label || 'Unnamed output';
      outputSelect.append(option);
    }

    if (microphones.some((microphone) => microphone.deviceId === priorSelection)) {
      microphoneSelect.value = priorSelection;
    } else if (microphones.some((microphone) => microphone.deviceId === storedSelection)) {
      microphoneSelect.value = storedSelection;
    }

    if (
      priorOutputSelection &&
      Array.from(outputSelect.options).some((option) => option.value === priorOutputSelection)
    ) {
      outputSelect.value = priorOutputSelection;
    } else if (Array.from(outputSelect.options).some((option) => option.value === storedOutputSelection)) {
      outputSelect.value = storedOutputSelection;
    }

    localStorage.setItem(INPUT_DEVICE_STORAGE_KEY, microphoneSelect.value);
    localStorage.setItem(OUTPUT_DEVICE_STORAGE_KEY, outputSelect.value);
    delete microphoneSelect.dataset.storedDeviceId;
    delete outputSelect.dataset.storedDeviceId;

    appendLog(
      `Loaded ${microphones.length} microphone input(s) and ${seenOutputIds.size + 1} output option(s).`,
      'success',
    );
    updateMeasurementBackendUi();
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`Microphone setup failed: ${message}`, 'error');
    appendLog(`Unable to refresh microphones: ${message}`, 'error');
  }
}

async function runMeasurement(): Promise<LoadedMeasurement | null> {
  if (state.busy) {
    return null;
  }

  const outputFolder = state.outputFolder;
  const measurementBackend = getSelectedMeasurementBackend();
  const sampleRate = getSelectedSampleRate();
  const inputChannel = getSelectedChannel(inputChannelSelect);
  const outputChannel = getSelectedChannel(outputChannelSelect);
  const deviceId = microphoneSelect.value;
  const outputDeviceId = outputSelect.value;
  const startFrequency = Number(startFrequencyInput.value);
  const endFrequency = Number(endFrequencyInput.value);
  const durationSeconds = Number(durationInput.value);
  const sweepLevelDb = Number(volumeInput.value);

  if (!outputFolder) {
    setStatus('Choose a save folder before measuring.', 'error');
    appendLog('Measurement aborted because no save folder is selected.', 'error');
    return null;
  }

  if (measurementBackend === 'web-audio' && !deviceId) {
    setStatus('Select a microphone before measuring.', 'error');
    appendLog('Measurement aborted because no microphone is selected.', 'error');
    return null;
  }

  if (
    !Number.isFinite(startFrequency) ||
    !Number.isFinite(endFrequency) ||
    !Number.isFinite(durationSeconds) ||
    !Number.isFinite(sampleRate) ||
    !Number.isFinite(sweepLevelDb) ||
    startFrequency < 10 ||
    endFrequency <= startFrequency ||
    endFrequency > 22000 ||
    durationSeconds < 2 ||
    durationSeconds > 30 ||
    sampleRate < 8000 ||
    sweepLevelDb < MIN_SWEEP_LEVEL_DB ||
    sweepLevelDb > MAX_SWEEP_LEVEL_DB
  ) {
    setStatus('Sweep settings are invalid.', 'error');
    appendLog('Sweep settings must be numeric, ordered, and within range.', 'error');
    return null;
  }

  try {
    setBusy(true);
    state.measurementBackend = measurementBackend;

    let capture: Parameters<typeof analyzeMeasurement>[0];
    let captureWav: Uint8Array;
    let microphoneLabel: string;
    let outputDeviceLabel: string;

    if (measurementBackend === 'sox') {
      setStatus('Capturing sweep measurement via SoX...', 'working');
      appendLog(
        `Running SoX at ${sampleRate} Hz with input ${inputChannel} and output ${outputChannel} on the system default devices.`,
      );

      const soxCapture = await window.freakishEars.runSoxMeasurement({
        startFrequency,
        endFrequency,
        durationSeconds,
        sweepLevelDb,
        sampleRate,
        inputChannel,
        outputChannel,
        preRollSeconds: PRE_ROLL_SECONDS,
        postRollSeconds: POST_ROLL_SECONDS,
      });

      capture = {
        recording: soxCapture.recording,
        sweep: soxCapture.sweep,
        sampleRate: soxCapture.sampleRate,
        preRollSamples: soxCapture.preRollSamples,
      };
      captureWav = encodeWavFile(capture.recording, capture.sampleRate);
      microphoneLabel = 'System default (SoX)';
      outputDeviceLabel = 'System default (SoX)';
    } else {
      setStatus('Capturing sweep measurement...', 'working');
      appendLog(
        `Opening the selected microphone at ${sampleRate} Hz with input ${inputChannel} and output ${outputChannel}.`,
      );

      capture = await recordSweepMeasurement({
        deviceId,
        outputDeviceId,
        sampleRate,
        inputChannel,
        outputChannel,
        startFrequency,
        endFrequency,
        durationSeconds,
        sweepLevelDb,
      });
      captureWav = encodeWavFile(capture.recording, capture.sampleRate);
      microphoneLabel =
        microphoneSelect.selectedOptions[0]?.textContent ?? 'Unknown microphone';
      outputDeviceLabel =
        outputSelect.selectedOptions[0]?.textContent ?? 'System default';
    }

    setStatus('Processing response values...', 'working');
    appendLog('Captured raw PCM. Aligning the sweep and computing the response.');

    const analysis = analyzeMeasurement(capture, startFrequency, endFrequency);
    const sessionName = `measurement-${formatTimestampForPath(new Date())}`;
    const measurementJson = buildMeasurementJson({
      analysis,
      capture,
      microphoneLabel,
      outputDeviceLabel,
      settings: {
        backend: measurementBackend,
        startFrequency,
        endFrequency,
        durationSeconds,
        sweepLevelDb,
        sampleRate,
        inputChannel,
        outputChannel,
      },
      preRollSeconds: PRE_ROLL_SECONDS,
      postRollSeconds: POST_ROLL_SECONDS,
      splOffsetDb: state.splOffsetDb,
    });
    const measurementCsv = buildMeasurementCsv(analysis.points);

    const saveResult = await window.freakishEars.saveMeasurementSession({
      folderPath: outputFolder,
      sessionName,
      files: [
        {
          name: 'recording.wav',
          contents: captureWav,
        },
        {
          name: 'values.csv',
          contents: new TextEncoder().encode(measurementCsv),
        },
        {
          name: 'values.json',
          contents: new TextEncoder().encode(measurementJson),
        },
      ],
    });

    const measurement = takeMeasurementFromAnalysis(analysis, saveResult.sessionDirectory);
    addMeasurement(measurement);
    updateLatestAutomationToleranceStatus(measurement, getSelectedApoReference());
    setStatus('Measurement complete.', 'success');
    appendLog(
      `Measurement saved to ${saveResult.sessionDirectory}.${getAutomationToleranceStatusSuffix()}`,
      'success',
    );
    return measurement;
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`Measurement failed: ${message}`, 'error');
    appendLog(`Measurement failed: ${message}`, 'error');
    return null;
  } finally {
    setBusy(false);
  }
}

function takeMeasurement(importedMeasurement: Parameters<typeof createLoadedMeasurement>[0]): LoadedMeasurement {
  const measurement = createLoadedMeasurement(importedMeasurement, state.nextMeasurementIndex);
  state.nextMeasurementIndex += 1;
  return measurement;
}

function takeReferenceCurve(
  importedMeasurement: Parameters<typeof createReferenceCurve>[0],
): ReferenceCurve {
  const referenceCurve = createReferenceCurve(importedMeasurement, state.nextReferenceIndex);
  state.nextReferenceIndex += 1;
  return referenceCurve;
}

function takeMeasurementFromAnalysis(
  analysis: Parameters<typeof createMeasurementFromAnalysis>[0],
  sessionDirectory: string,
): LoadedMeasurement {
  const measurement = createMeasurementFromAnalysis(
    analysis,
    sessionDirectory,
    state.nextMeasurementIndex,
  );
  state.nextMeasurementIndex += 1;
  return measurement;
}

function addMeasurement(measurement: LoadedMeasurement): void {
  state.measurements = [...state.measurements, measurement];
  const prunedMeasurements = pruneMeasurementsToKeepCount();
  state.focusedMeasurementId = state.measurements.some((entry) => entry.id === measurement.id)
    ? measurement.id
    : state.measurements.at(-1)?.id ?? null;
  if (!state.apoSelectedMeasurementId) {
    state.apoSelectedMeasurementId = measurement.id;
    persistApoSelections();
  }
  if (prunedMeasurements.length > 0) {
    appendMeasurementPruneLog(prunedMeasurements);
  }
  renderMeasurements();
  renderApoSection();
}

function getMeasurementDefaultColor(measurement: LoadedMeasurement): string {
  const numericId = Number(measurement.id.replace('measurement-', ''));
  if (Number.isFinite(numericId) && numericId > 0) {
    return PLOT_COLORS[(numericId - 1) % PLOT_COLORS.length];
  }

  return measurement.color;
}

function getNextStarredMeasurementColor(currentMeasurementId: string): string {
  const usedStarredColors = new Set(
    state.measurements
      .filter((measurement) => measurement.starred && measurement.id !== currentMeasurementId)
      .map((measurement) => measurement.color),
  );

  return (
    STARRED_PLOT_COLORS.find((color) => !usedStarredColors.has(color)) ?? STARRED_PLOT_COLORS[0]
  );
}

function getPlotMeasurementOrder(measurements: LoadedMeasurement[]): LoadedMeasurement[] {
  return [
    ...measurements.filter((measurement) => !measurement.starred),
    ...measurements.filter((measurement) => measurement.starred),
  ];
}

function toggleMeasurementStar(measurementId: string): void {
  let updatedMeasurementName: string | null = null;
  let starred = false;

  state.measurements = state.measurements.map((measurement) => {
    if (measurement.id !== measurementId) {
      return measurement;
    }

    updatedMeasurementName = measurement.name;
    starred = !measurement.starred;
    return {
      ...measurement,
      starred,
      color: starred
        ? getNextStarredMeasurementColor(measurement.id)
        : getMeasurementDefaultColor(measurement),
    };
  });

  if (updatedMeasurementName) {
    appendLog(`${starred ? 'Starred' : 'Unstarred'} measurement ${updatedMeasurementName}.`);
    if (!starred) {
      const prunedMeasurements = pruneMeasurementsToKeepCount();
      if (prunedMeasurements.length > 0) {
        appendMeasurementPruneLog(prunedMeasurements);
      }
    }
    renderMeasurements();
    renderApoSection();
  }
}

function addReferenceCurve(referenceCurve: ReferenceCurve): void {
  state.referenceCurves = [
    ...state.referenceCurves.map((entry) => ({ ...entry, visible: false })),
    referenceCurve,
  ];
  renderMeasurements();
  if (!state.apoSelectedReferenceId) {
    state.apoSelectedReferenceId = referenceCurve.id;
    persistApoSelections();
  }
  renderApoSection();
}

function setMeasurementVisibility(measurementId: string, visible: boolean): void {
  state.measurements = state.measurements.map((measurement) =>
    measurement.id === measurementId ? { ...measurement, visible } : measurement,
  );
  renderMeasurements();
}

function setReferenceVisibility(referenceId: string, visible: boolean): void {
  state.referenceCurves = state.referenceCurves.map((referenceCurve) => {
    if (referenceCurve.id === referenceId) {
      return { ...referenceCurve, visible };
    }

    return visible ? { ...referenceCurve, visible: false } : referenceCurve;
  });
  renderMeasurements();
}

function removeMeasurement(measurementId: string): void {
  const removedMeasurement = state.measurements.find(
    (measurement) => measurement.id === measurementId,
  );

  state.measurements = state.measurements.filter(
    (measurement) => measurement.id !== measurementId,
  );

  if (removedMeasurement) {
    appendLog(`Removed measurement ${removedMeasurement.name}.`);
  }

  if (state.focusedMeasurementId === measurementId) {
    state.focusedMeasurementId = state.measurements.at(-1)?.id ?? null;
  }

  if (state.apoSelectedMeasurementId === measurementId) {
    state.apoSelectedMeasurementId = state.measurements.at(-1)?.id ?? null;
    persistApoSelections();
  }

  renderMeasurements();
  renderApoSection();
}

function removeReferenceCurve(referenceId: string): void {
  const removedReference = state.referenceCurves.find(
    (referenceCurve) => referenceCurve.id === referenceId,
  );

  state.referenceCurves = state.referenceCurves.filter(
    (referenceCurve) => referenceCurve.id !== referenceId,
  );

  if (removedReference) {
    appendLog(`Removed reference curve ${removedReference.name}.`);
  }

  if (state.apoSelectedReferenceId === referenceId) {
    state.apoSelectedReferenceId = state.referenceCurves.at(-1)?.id ?? null;
    persistApoSelections();
  }

  renderMeasurements();
  renderApoSection();
}

function renderMeasurements(): void {
  const visibleMeasurements = getPlotMeasurementOrder(
    state.measurements.filter((measurement) => measurement.visible),
  );
  const visibleReferenceCurves = state.referenceCurves.filter(
    (referenceCurve) => referenceCurve.visible,
  );

  if (
    state.focusedMeasurementId &&
    !state.measurements.some(
      (measurement) => measurement.id === state.focusedMeasurementId,
    )
  ) {
    state.focusedMeasurementId = state.measurements.at(-1)?.id ?? null;
  }

  renderPlotCard(visibleMeasurements, visibleReferenceCurves);
  updateMeasurementSummary();
  updateMeasurementActionState();
  renderApoSection();
}

function renderPlotCard(
  visibleMeasurements: LoadedMeasurement[],
  visibleReferenceCurves: ReferenceCurve[],
): void {
  const orderedMeasurements = getPlotMeasurementOrder(visibleMeasurements);
  const measurementsCompact = measurementsPlotCard.clientWidth < 560;
  const apoCompact = apoPlotCard.clientWidth < 560;
  const measurementsContainerWidth = measurementsPlotCard.clientWidth;
  const apoContainerWidth = apoPlotCard.clientWidth;

  // Render measurements plot
  measurementsPlotCard.innerHTML = renderResponsePlot({
    visibleMeasurements: orderedMeasurements,
    allMeasurements: state.measurements,
    visibleReferenceCurves,
    allReferenceCurves: state.referenceCurves,
    measurementKeepCount: state.measurementKeepCount,
    normalizePlot: state.normalizePlot,
    smoothingMode: state.smoothingMode,
    splOffsetDb: state.splOffsetDb,
    busy: state.busy,
    outputFolder: state.outputFolder,
    compact: measurementsCompact,
    containerWidth: measurementsContainerWidth > 0 ? measurementsContainerWidth : DEFAULT_PLOT_WIDTH,
    toleranceOverlay:
      state.automationStopOnTolerance && state.measurements.at(-1) && getSelectedApoReference()
        ? {
            measurementId: state.measurements.at(-1)?.id ?? '',
            referenceCurve: getSelectedApoReference() as ReferenceCurve,
            bands: AUTOMATION_TOLERANCE_BANDS.map((band) => ({
              label: band.label,
              minimumFrequencyHz: band.minimumFrequencyHz,
              maximumFrequencyHz: band.maximumFrequencyHz,
              toleranceDb: state.automationBandTolerances[band.key],
            })),
          }
        : null,
  });
  attachPlotInteractions({
    plotCard: measurementsPlotCard,
    measurements: orderedMeasurements,
    referenceCurves: visibleReferenceCurves,
    normalizePlot: state.normalizePlot,
    smoothingMode: state.smoothingMode,
    splOffsetDb: state.splOffsetDb,
  });

  // Render APO EQ plot
  const measurement = getSelectedApoMeasurement();
  const referenceCurve = getSelectedApoReference();
  const activeApoFilters = getActiveApoFilters();

  apoPlotCard.innerHTML = renderApoEqPlot({
    filters: activeApoFilters,
    eqMode: state.apoEqMode,
    sampleRate: getSelectedSampleRate(),
    measurementName: measurement?.name ?? null,
    targetName: referenceCurve?.name ?? null,
    compact: apoCompact,
    containerWidth: apoContainerWidth > 0 ? apoContainerWidth : DEFAULT_PLOT_WIDTH,
  });

  attachApoPlotInteractions({
    plotCard: apoPlotCard,
    filters: activeApoFilters,
    eqMode: state.apoEqMode,
    sampleRate: getSelectedSampleRate(),
    lockFrequency: state.apoEqMode === 'graphic',
    onFilterDrag: handleApoFilterDrag,
    onDragEnd: handleApoFilterDragEnd,
  });

  updatePlotsLayout();
}

function updatePlotsLayout(): void {
  plotsContainer.classList.remove('is-split');

  const availableWidth = plotsContainer.clientWidth;
  const splitPlotWidth = Math.max((availableWidth - PLOTS_GAP_PX) / 2, 0);
  const splitPlotHeight = splitPlotWidth / PLOT_ASPECT_RATIO;

  // Keep side-by-side only when the resulting graph height remains usable.
  if (splitPlotHeight >= MIN_SPLIT_PLOT_HEIGHT_PX) {
    plotsContainer.classList.add('is-split');
  }
}

function updateMeasurementSummary(): void {
  const focusedMeasurement = getFocusedMeasurement();

  latencyValue.textContent = formatOptionalMeasurementValue(
    focusedMeasurement?.summary.latencyMs,
    'ms',
  );
  peakValue.textContent = formatOptionalMeasurementValue(
    focusedMeasurement?.summary.peakDbfs,
    'dBFS',
  );
  rmsValue.textContent = formatOptionalMeasurementValue(
    focusedMeasurement?.summary.rmsDbfs,
    'dBFS',
  );
  savedPathValue.textContent = focusedMeasurement?.summary.savedPath ?? '--';
}

function getFocusedMeasurement(): LoadedMeasurement | null {
  if (state.focusedMeasurementId) {
    const focusedMeasurement = state.measurements.find(
      (measurement) => measurement.id === state.focusedMeasurementId,
    );

    if (focusedMeasurement) {
      return focusedMeasurement;
    }
  }

  return state.measurements.at(-1) ?? null;
}

function formatOptionalMeasurementValue(
  value: number | null | undefined,
  unit: string,
): string {
  return Number.isFinite(value) ? `${value.toFixed(1)} ${unit}` : '--';
}

function readStoredMeasurementBackend(): MeasurementBackend {
  return localStorage.getItem(MEASUREMENT_BACKEND_STORAGE_KEY) === 'sox'
    ? 'sox'
    : DEFAULT_MEASUREMENT_BACKEND;
}

function readStoredMeasurementKeepCount(): number {
  return normalizeMeasurementKeepCount(
    readStoredNumber(MEASUREMENT_KEEP_COUNT_STORAGE_KEY, DEFAULT_MEASUREMENT_KEEP_COUNT),
  );
}

function normalizeMeasurementKeepCount(value: unknown): number {
  const parsed = Number(value);
  return clamp(
    Number.isFinite(parsed) ? Math.round(parsed) : DEFAULT_MEASUREMENT_KEEP_COUNT,
    1,
    100,
  );
}

function initializeMeasurementConfigFromStorage(): void {
  const persistedConfig = readPersistedActiveConfiguration();

  if (persistedConfig) {
    applyImportedConfiguration(persistedConfig, false);
    return;
  }

  const storedSampleRate = readStoredNumber(SAMPLE_RATE_STORAGE_KEY, DEFAULT_SAMPLE_RATE);
  const storedStartFreq = readStoredNumber(START_FREQUENCY_STORAGE_KEY, DEFAULT_START_FREQUENCY);
  const storedEndFreq = readStoredNumber(END_FREQUENCY_STORAGE_KEY, DEFAULT_END_FREQUENCY);
  const storedDuration = readStoredNumber(DURATION_STORAGE_KEY, DEFAULT_DURATION_SECONDS);
  const storedSweepLevel = readStoredNumber(SWEEP_LEVEL_STORAGE_KEY, DEFAULT_SWEEP_LEVEL_DB);
  const storedInputChannel = localStorage.getItem(INPUT_CHANNEL_STORAGE_KEY);
  const storedOutputChannel = localStorage.getItem(OUTPUT_CHANNEL_STORAGE_KEY);
  const storedInputDeviceId = localStorage.getItem(INPUT_DEVICE_STORAGE_KEY);
  const storedOutputDeviceId = localStorage.getItem(OUTPUT_DEVICE_STORAGE_KEY);

  if (SAMPLE_RATE_OPTIONS.includes(storedSampleRate as typeof SAMPLE_RATE_OPTIONS[number])) {
    sampleRateSelect.value = String(storedSampleRate);
  }

  if (Number.isFinite(storedStartFreq) && storedStartFreq >= 1 && storedStartFreq < 100000) {
    startFrequencyInput.value = String(storedStartFreq);
  }

  if (Number.isFinite(storedEndFreq) && storedEndFreq > 1 && storedEndFreq <= 100000) {
    endFrequencyInput.value = String(storedEndFreq);
  }

  if (Number.isFinite(storedDuration) && storedDuration >= 2 && storedDuration <= 30) {
    durationInput.value = String(storedDuration);
  }

  if (Number.isFinite(storedSweepLevel) && storedSweepLevel >= MIN_SWEEP_LEVEL_DB && storedSweepLevel <= MAX_SWEEP_LEVEL_DB) {
    volumeInput.value = String(storedSweepLevel);
    syncVolumeControls('slider');
  }

  if (storedInputChannel === 'left' || storedInputChannel === 'right' || storedInputChannel === 'both') {
    inputChannelSelect.value = storedInputChannel;
  }

  if (storedOutputChannel === 'left' || storedOutputChannel === 'right' || storedOutputChannel === 'both') {
    outputChannelSelect.value = storedOutputChannel;
  }

  if (storedInputDeviceId) {
    microphoneSelect.dataset.storedDeviceId = storedInputDeviceId;
  }

  if (storedOutputDeviceId !== null) {
    outputSelect.dataset.storedDeviceId = storedOutputDeviceId;
  }
}

function readPersistedActiveConfiguration(): Record<string, unknown> | null {
  const stored = localStorage.getItem(ACTIVE_CONFIG_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function persistActiveConfiguration(): void {
  const payload = {
    backend: getSelectedMeasurementBackend(),
    measurementKeepCount: state.measurementKeepCount,
    sampleRate: getSelectedSampleRate(),
    inputChannel: getSelectedChannel(inputChannelSelect),
    outputChannel: getSelectedChannel(outputChannelSelect),
    inputDeviceId: getPreferredInputDeviceId(),
    outputDeviceId: getPreferredOutputDeviceId(),
    startFrequency: Number(startFrequencyInput.value),
    endFrequency: Number(endFrequencyInput.value),
    durationSeconds: Number(durationInput.value),
    sweepLevelDb: Number(volumeInput.value),
    splOffsetDb: state.splOffsetDb,
    smoothingMode: getSelectedSmoothingMode(),
    normalizePlot: normalizePlotToggle.checked,
    apoEqMode: state.apoEqMode,
    automationAlgorithm: state.automationAlgorithm,
    automationDelaySeconds: state.automationDelaySeconds,
    proportionalP: state.proportionalP,
    dynamicProportionalP: state.dynamicProportionalP,
    automationStopOnTolerance: state.automationStopOnTolerance,
    automationBandTolerances: state.automationBandTolerances,
    automationRegressionLimit: state.automationRegressionLimit,
    apoSelectedMeasurementId: state.apoSelectedMeasurementId,
    apoSelectedReferenceId: state.apoSelectedReferenceId,
    parametricApoMaxFilters: state.parametricApoMaxFilters,
    graphicApoMaxFilters: state.graphicApoMaxFilters,
    apoMaxBoostDb: state.apoMaxBoostDb,
    apoMaxCutDb: state.apoMaxCutDb,
    parametricApoFilters: state.parametricApoFilters,
    graphicApoFilters: state.graphicApoFilters,
  };

  localStorage.setItem(ACTIVE_CONFIG_STORAGE_KEY, JSON.stringify(payload));
}

function getPreferredInputDeviceId(): string {
  return (
    microphoneSelect.value ||
    microphoneSelect.dataset.storedDeviceId ||
    localStorage.getItem(INPUT_DEVICE_STORAGE_KEY) ||
    ''
  );
}

function getPreferredOutputDeviceId(): string {
  return (
    outputSelect.value ||
    outputSelect.dataset.storedDeviceId ||
    localStorage.getItem(OUTPUT_DEVICE_STORAGE_KEY) ||
    ''
  );
}

function getSelectedMeasurementBackend(): MeasurementBackend {
  return measurementBackendSelect.value === 'sox' ? 'sox' : 'web-audio';
}

async function importReferenceFiles(files: File[]): Promise<void> {
  if (state.busy || files.length === 0) {
    return;
  }

  const importedReferences: ReferenceCurve[] = [];
  const importFailures: string[] = [];

  try {
    setBusy(true);
    setStatus('Importing reference curves...', 'working');

    for (const file of files) {
      try {
        const contents = await file.text();
        const imported = parseImportedMeasurementFile(file, contents);
        importedReferences.push(takeReferenceCurve(imported));
      } catch (error) {
        importFailures.push(`${file.name}: ${getErrorMessage(error)}`);
      }
    }

    for (const referenceCurve of importedReferences) {
      addReferenceCurve(referenceCurve);
    }

    if (importedReferences.length > 0) {
      setStatus(
        `Imported ${importedReferences.length} reference curve${importedReferences.length === 1 ? '' : 's'}.`,
        'success',
      );
      appendLog(
        `Imported ${importedReferences.length} reference curve${importedReferences.length === 1 ? '' : 's'} for target overlay and normalization.`,
        'success',
      );
    }

    if (importFailures.length > 0) {
      for (const failure of importFailures) {
        appendLog(`Reference import failed: ${failure}`, 'error');
      }

      if (importedReferences.length === 0) {
        setStatus('Unable to import the selected reference curves.', 'error');
      }
    }
  } finally {
    setBusy(false);
  }
}

async function saveConfiguration(): Promise<void> {
  if (state.busy) {
    return;
  }

  try {
    setBusy(true);
    setStatus('Saving configuration...', 'working');

    const payload = {
      savedAt: new Date().toISOString(),
      backend: getSelectedMeasurementBackend(),
      measurementKeepCount: state.measurementKeepCount,
      sampleRate: getSelectedSampleRate(),
      inputChannel: getSelectedChannel(inputChannelSelect),
      outputChannel: getSelectedChannel(outputChannelSelect),
      inputDeviceId: microphoneSelect.value,
      inputDeviceLabel: microphoneSelect.selectedOptions[0]?.textContent ?? null,
      outputDeviceId: outputSelect.value,
      outputDeviceLabel: outputSelect.selectedOptions[0]?.textContent ?? null,
      startFrequency: Number(startFrequencyInput.value),
      endFrequency: Number(endFrequencyInput.value),
      durationSeconds: Number(durationInput.value),
      sweepLevelDb: Number(volumeInput.value),
      splOffsetDb: state.splOffsetDb,
      smoothingMode: getSelectedSmoothingMode(),
      normalizePlot: normalizePlotToggle.checked,
      apoEqMode: state.apoEqMode,
      automationAlgorithm: state.automationAlgorithm,
      automationDelaySeconds: state.automationDelaySeconds,
      proportionalP: state.proportionalP,
      dynamicProportionalP: state.dynamicProportionalP,
      automationStopOnTolerance: state.automationStopOnTolerance,
      automationBandTolerances: state.automationBandTolerances,
      automationRegressionLimit: state.automationRegressionLimit,
      apoSelectedMeasurementId: state.apoSelectedMeasurementId,
      apoSelectedReferenceId: state.apoSelectedReferenceId,
      parametricApoMaxFilters: state.parametricApoMaxFilters,
      graphicApoMaxFilters: state.graphicApoMaxFilters,
      apoMaxBoostDb: state.apoMaxBoostDb,
      apoMaxCutDb: state.apoMaxCutDb,
      parametricApoFilters: state.parametricApoFilters,
      graphicApoFilters: state.graphicApoFilters,
    };

    const saveResult = await window.freakishEars.saveFileAs({
      title: 'Save configuration',
      suggestedName: `measurement-config-${formatTimestampForPath(new Date())}.json`,
      defaultFolderPath: state.outputFolder,
      contents: new TextEncoder().encode(JSON.stringify(payload, null, 2)),
    });

    if (saveResult.canceled || !saveResult.filePath) {
      setStatus('Configuration save cancelled.', 'idle');
      return;
    }

    setStatus('Configuration saved.', 'success');
    appendLog(`Saved configuration to ${saveResult.filePath}.`, 'success');
    showToast({
      message: 'Configuration saved',
      actionLabel: 'View in Finder',
      actionPath: saveResult.filePath,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`Configuration save failed: ${message}`, 'error');
    appendLog(`Configuration save failed: ${message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function importConfiguration(file: File): Promise<void> {
  if (state.busy) {
    return;
  }

  try {
    setBusy(true);
    setStatus('Importing configuration...', 'working');

    const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
    applyImportedConfiguration(parsed);

    setStatus('Configuration imported.', 'success');
    appendLog(`Imported configuration from ${file.name}.`, 'success');
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`Configuration import failed: ${message}`, 'error');
    appendLog(`Configuration import failed: ${message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function applyImportedConfiguration(config: Record<string, unknown>, persist = true): void {
  const backend = config.backend === 'sox' ? 'sox' : 'web-audio';
  measurementBackendSelect.value = backend;
  state.measurementBackend = backend;
  localStorage.setItem(MEASUREMENT_BACKEND_STORAGE_KEY, backend);

  const sampleRate = Number(config.sampleRate);
  if (Number.isFinite(sampleRate)) {
    sampleRateSelect.value = String(sampleRate);
    localStorage.setItem(SAMPLE_RATE_STORAGE_KEY, String(sampleRate));
  }

  state.measurementKeepCount = normalizeMeasurementKeepCount(config.measurementKeepCount);
  localStorage.setItem(MEASUREMENT_KEEP_COUNT_STORAGE_KEY, String(state.measurementKeepCount));

  inputChannelSelect.value =
    config.inputChannel === 'left' || config.inputChannel === 'right'
      ? String(config.inputChannel)
      : 'both';
  localStorage.setItem(INPUT_CHANNEL_STORAGE_KEY, inputChannelSelect.value);
  outputChannelSelect.value =
    config.outputChannel === 'left' || config.outputChannel === 'right'
      ? String(config.outputChannel)
      : 'both';
  localStorage.setItem(OUTPUT_CHANNEL_STORAGE_KEY, outputChannelSelect.value);

  const importedInputDeviceId = String(config.inputDeviceId ?? '');
  const importedOutputDeviceId = String(config.outputDeviceId ?? '');
  selectOptionIfPresent(microphoneSelect, importedInputDeviceId);
  selectOptionIfPresent(outputSelect, importedOutputDeviceId);
  microphoneSelect.dataset.storedDeviceId = importedInputDeviceId;
  outputSelect.dataset.storedDeviceId = importedOutputDeviceId;
  localStorage.setItem(INPUT_DEVICE_STORAGE_KEY, importedInputDeviceId);
  localStorage.setItem(OUTPUT_DEVICE_STORAGE_KEY, importedOutputDeviceId);

  setNumericInputValue(startFrequencyInput, config.startFrequency);
  setNumericInputValue(endFrequencyInput, config.endFrequency);
  setNumericInputValue(durationInput, config.durationSeconds);
  setNumericInputValue(volumeInput, config.sweepLevelDb);
  setNumericInputValue(volumeNumberInput, config.sweepLevelDb);
  localStorage.setItem(START_FREQUENCY_STORAGE_KEY, startFrequencyInput.value);
  localStorage.setItem(END_FREQUENCY_STORAGE_KEY, endFrequencyInput.value);
  localStorage.setItem(DURATION_STORAGE_KEY, durationInput.value);
  localStorage.setItem(SWEEP_LEVEL_STORAGE_KEY, volumeInput.value);
  state.splOffsetDb = 0;

  smoothingModeSelect.value = isSmoothingMode(String(config.smoothingMode ?? ''))
    ? String(config.smoothingMode)
    : DEFAULT_SMOOTHING_MODE;
  state.smoothingMode = getSelectedSmoothingMode();
  localStorage.setItem(SMOOTHING_MODE_STORAGE_KEY, state.smoothingMode);

  state.normalizePlot = typeof config.normalizePlot === 'boolean' ? config.normalizePlot : true;
  normalizePlotToggle.checked = state.normalizePlot;
  localStorage.setItem(NORMALIZE_PLOT_STORAGE_KEY, String(state.normalizePlot));

  state.apoEqMode = isApoEqMode(config.apoEqMode) ? config.apoEqMode : DEFAULT_APO_EQ_MODE;
  state.automationAlgorithm = isAutomationAlgorithm(config.automationAlgorithm)
    ? config.automationAlgorithm
    : DEFAULT_AUTOMATION_ALGORITHM;
  state.automationDelaySeconds = clamp(
    Number.isFinite(Number(config.automationDelaySeconds))
      ? Number(config.automationDelaySeconds)
      : DEFAULT_AUTOMATION_DELAY_SECONDS,
    0,
    3600,
  );
  const importedProportionalP = Number(config.proportionalP);
  state.proportionalP = clamp(
    Number.isFinite(importedProportionalP) ? importedProportionalP : DEFAULT_PROPORTIONAL_P,
    0,
    1,
  );
  state.dynamicProportionalP =
    typeof config.dynamicProportionalP === 'boolean'
      ? config.dynamicProportionalP
      : DEFAULT_DYNAMIC_PROPORTIONAL_P;
  state.automationStopOnTolerance =
    typeof config.automationStopOnTolerance === 'boolean'
      ? config.automationStopOnTolerance
      : DEFAULT_AUTOMATION_STOP_ON_TOLERANCE;
  state.automationBandTolerances = normalizeAutomationBandTolerances(
    config.automationBandTolerances,
  );
  state.automationRegressionLimit = clamp(
    Number.isFinite(Number(config.automationRegressionLimit))
      ? Number(config.automationRegressionLimit)
      : DEFAULT_AUTOMATION_REGRESSION_LIMIT,
    0,
    20,
  );
  const importedApoFilters = normalizeImportedApoFilterSets(config, state.apoEqMode);
  state.parametricApoFilters = importedApoFilters.parametric;
  state.graphicApoFilters = importedApoFilters.graphic;
  state.apoSelectedMeasurementId = toOptionalString(config.apoSelectedMeasurementId);
  state.apoSelectedReferenceId = toOptionalString(config.apoSelectedReferenceId);
  const importedApoMaxFilters = normalizeImportedApoMaxFilterCounts(config);
  state.parametricApoMaxFilters = importedApoMaxFilters.parametric;
  state.graphicApoMaxFilters = importedApoMaxFilters.graphic;
  if (state.parametricApoFilters.length > 0 || state.parametricApoMaxFilters === 0) {
    syncParametricApoFilterCountToFilters();
  }
  state.apoMaxBoostDb = clamp(
    Number(config.apoMaxBoostDb) || DEFAULT_APO_MAX_BOOST_DB,
    0,
    24,
  );
  state.apoMaxCutDb = clamp(
    Number(config.apoMaxCutDb) || DEFAULT_APO_MAX_CUT_DB,
    0,
    24,
  );
  state.nextApoFilterIndex =
    [...state.parametricApoFilters, ...state.graphicApoFilters].reduce((maxId, filter) => {
      const numericId = Number(filter.id.replace('apo-filter-', ''));
      return Number.isFinite(numericId) ? Math.max(maxId, numericId) : maxId;
    }, 0) + 1;
  persistApoState();
  if (persist) {
    persistActiveConfiguration();
  }
  apoMaxFiltersInput.value = String(getActiveApoMaxFilters());
  automationDelayInput.value = state.automationDelaySeconds.toFixed(1);
  dynamicProportionalPToggle.checked = state.dynamicProportionalP;
  automationStopOnToleranceToggle.checked = state.automationStopOnTolerance;
  automationRegressionLimitInput.value = String(state.automationRegressionLimit);
  persistAutomationSettings();
  updateAutomationUi();

  syncVolumeControls('slider');
  updateMeasurementBackendUi();
  const prunedMeasurements = pruneMeasurementsToKeepCount();
  if (prunedMeasurements.length > 0) {
    appendMeasurementPruneLog(prunedMeasurements);
  }
  renderMeasurements();
}

function pruneMeasurementsToKeepCount(): LoadedMeasurement[] {
  const unstarredMeasurements = state.measurements.filter((measurement) => !measurement.starred);
  const overflowCount = unstarredMeasurements.length - state.measurementKeepCount;

  if (overflowCount <= 0) {
    return [];
  }

  const removedIds = new Set(
    unstarredMeasurements.slice(0, overflowCount).map((measurement) => measurement.id),
  );
  const removedMeasurements = state.measurements.filter((measurement) => removedIds.has(measurement.id));

  state.measurements = state.measurements.filter((measurement) => !removedIds.has(measurement.id));

  if (state.focusedMeasurementId && removedIds.has(state.focusedMeasurementId)) {
    state.focusedMeasurementId = state.measurements.at(-1)?.id ?? null;
  }

  if (state.apoSelectedMeasurementId && removedIds.has(state.apoSelectedMeasurementId)) {
    state.apoSelectedMeasurementId = state.measurements.at(-1)?.id ?? null;
    persistApoSelections();
  }

  return removedMeasurements;
}

function appendMeasurementPruneLog(removedMeasurements: LoadedMeasurement[]): void {
  if (removedMeasurements.length === 0) {
    return;
  }

  const removedNames = removedMeasurements.map((measurement) => measurement.name).join(', ');
  appendLog(
    `Auto-removed ${removedMeasurements.length === 1 ? 'oldest unstarred measurement' : 'oldest unstarred measurements'} ${removedNames} to keep ${state.measurementKeepCount}.`,
  );
}

function setNumericInputValue(input: HTMLInputElement, value: unknown): void {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    input.value = String(numericValue);
  }
}

function selectOptionIfPresent(select: HTMLSelectElement, value: string): void {
  if (Array.from(select.options).some((option) => option.value === value)) {
    select.value = value;
  }
}

function getSelectedSampleRate(): number {
  const sampleRate = Number(sampleRateSelect.value);
  return Number.isFinite(sampleRate) ? sampleRate : DEFAULT_SAMPLE_RATE;
}

function getSelectedAutomationAlgorithm(): AutomationAlgorithm {
  return automationAlgorithmSelect.value === 'proportional'
    ? automationAlgorithmSelect.value
    : DEFAULT_AUTOMATION_ALGORITHM;
}

function createDefaultAutomationBandTolerances(): AutomationBandTolerances {
  return AUTOMATION_TOLERANCE_BANDS.reduce(
    (tolerances, band) => ({
      ...tolerances,
      [band.key]: band.defaultToleranceDb,
    }),
    {} as AutomationBandTolerances,
  );
}

function normalizeAutomationToleranceInputValue(
  value: string,
  fallback: number,
): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 24) : fallback;
}

function normalizeAutomationBandTolerances(value: unknown): AutomationBandTolerances {
  const defaults = createDefaultAutomationBandTolerances();

  if (!value || typeof value !== 'object') {
    return defaults;
  }

  return AUTOMATION_TOLERANCE_BANDS.reduce(
    (tolerances, band) => {
      const rawValue = (value as Record<string, unknown>)[band.key];
      const parsed = Number(rawValue);

      return {
        ...tolerances,
        [band.key]: Number.isFinite(parsed)
          ? clamp(parsed, 0, 24)
          : defaults[band.key],
      };
    },
    defaults,
  );
}

function readStoredAutomationBandTolerances(): AutomationBandTolerances {
  const stored = localStorage.getItem(AUTOMATION_BAND_TOLERANCES_STORAGE_KEY);
  if (!stored) {
    return createDefaultAutomationBandTolerances();
  }

  try {
    return normalizeAutomationBandTolerances(JSON.parse(stored));
  } catch {
    return createDefaultAutomationBandTolerances();
  }
}

function getSelectedChannel(
  select: HTMLSelectElement,
): MeasurementChannelSelection {
  return select.value === 'left' || select.value === 'right' ? select.value : 'both';
}

function readStoredSmoothingMode(): MeasurementSmoothingMode {
  const stored = localStorage.getItem(SMOOTHING_MODE_STORAGE_KEY);
  return isSmoothingMode(stored)
    ? stored
    : DEFAULT_SMOOTHING_MODE;
}

function getSelectedSmoothingMode(): MeasurementSmoothingMode {
  return isSmoothingMode(smoothingModeSelect.value)
    ? smoothingModeSelect.value
    : DEFAULT_SMOOTHING_MODE;
}

function isSmoothingMode(value: string | null): value is MeasurementSmoothingMode {
  return value !== null && SMOOTHING_MODE_OPTIONS.includes(value as typeof SMOOTHING_MODE_OPTIONS[number]);
}

function formatSmoothingModeLabel(value: MeasurementSmoothingMode): string {
  return value === 'raw' ? 'Off' : `${value} oct`;
}

function readStoredApoFilterSets(): { parametric: ApoFilter[]; graphic: ApoFilter[] } {
  const stored = localStorage.getItem(APO_FILTERS_STORAGE_KEY);

  if (!stored) {
    return { parametric: [], graphic: [] };
  }

  try {
    return normalizeImportedApoFilterSets(JSON.parse(stored), readStoredApoEqMode());
  } catch {
    return { parametric: [], graphic: [] };
  }
}

function readStoredApoMaxFilterCounts(): { parametric: number; graphic: number } {
  const stored = localStorage.getItem(APO_MAX_FILTERS_STORAGE_KEY);

  if (!stored) {
    return {
      parametric: clamp(DEFAULT_APO_MAX_FILTERS, 0, 256),
      graphic: clamp(DEFAULT_APO_MAX_FILTERS, 1, 256),
    };
  }

  try {
    return normalizeImportedApoMaxFilterCounts(JSON.parse(stored));
  } catch {
    const legacyValue = readStoredNumber(APO_MAX_FILTERS_STORAGE_KEY, DEFAULT_APO_MAX_FILTERS);
    const normalizedLegacyValue = clamp(legacyValue, 0, 256);
    return { parametric: normalizedLegacyValue, graphic: normalizedLegacyValue };
  }
}

function readStoredApoEqMode(): ApoEqMode {
  const stored = localStorage.getItem(APO_EQ_MODE_STORAGE_KEY);
  return isApoEqMode(stored) ? stored : DEFAULT_APO_EQ_MODE;
}

function readStoredAutomationAlgorithm(): AutomationAlgorithm {
  const stored = localStorage.getItem(AUTOMATION_ALGORITHM_STORAGE_KEY);
  return isAutomationAlgorithm(stored) ? stored : DEFAULT_AUTOMATION_ALGORITHM;
}

function normalizeApoFilters(value: unknown): ApoFilter[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const frequencyHz = clamp(Number(record.frequencyHz), 20, 20000);
    const gainDb = clamp(Number(record.gainDb), -24, 24);
    const q = clamp(Number(record.q), 0.1, 10);

    if (!Number.isFinite(frequencyHz) || !Number.isFinite(gainDb) || !Number.isFinite(q)) {
      return [];
    }

      return [
        {
          id:
            typeof record.id === 'string' && record.id.length > 0
              ? record.id
              : `apo-filter-${index + 1}`,
          enabled: record.enabled !== false,
          kind: isApoFilterKind(record.kind) ? record.kind : 'PK',
          frequencyHz,
          gainDb,
          q,
        },
    ];
  });
}

function normalizeImportedApoFilterSets(
  value: unknown,
  selectedMode: ApoEqMode,
): { parametric: ApoFilter[]; graphic: ApoFilter[] } {
  if (Array.isArray(value)) {
    const legacyFilters = normalizeApoFilters(value);
    return selectedMode === 'graphic'
      ? { parametric: [], graphic: legacyFilters }
      : { parametric: legacyFilters, graphic: [] };
  }

  if (!value || typeof value !== 'object') {
    return { parametric: [], graphic: [] };
  }

  const record = value as Record<string, unknown>;
  return {
    parametric: normalizeApoFilters(record.parametricApoFilters ?? record.parametric),
    graphic: normalizeApoFilters(record.graphicApoFilters ?? record.graphic),
  };
}

function normalizeImportedApoMaxFilterCounts(
  value: unknown,
): { parametric: number; graphic: number } {
  if (typeof value === 'number' || typeof value === 'string') {
    const legacyValue = clamp(Number(value) || DEFAULT_APO_MAX_FILTERS, 0, 256);
    return { parametric: legacyValue, graphic: legacyValue };
  }

  if (!value || typeof value !== 'object') {
    const fallback = clamp(DEFAULT_APO_MAX_FILTERS, 0, 256);
    return { parametric: fallback, graphic: fallback };
  }

  const record = value as Record<string, unknown>;
  return {
      parametric: clamp(Number(record.parametricApoMaxFilters) || DEFAULT_APO_MAX_FILTERS, 0, 256),
      graphic: clamp(Number(record.graphicApoMaxFilters) || DEFAULT_APO_MAX_FILTERS, 1, 256),
  };
}

function isApoEqMode(value: unknown): value is ApoEqMode {
  return value === 'parametric' || value === 'graphic';
}

function isApoFilterKind(value: unknown): value is ApoFilterKind {
  return PARAMETRIC_APO_FILTER_KIND_OPTIONS.some((option) => option.value === value);
}

function apoFilterKindUsesGain(kind: ApoFilterKind): boolean {
  return kind === 'PK' || kind === 'LS' || kind === 'HS';
}

function buildApoFilterConfigLine(filter: ApoFilter, index: number): string {
  const prefix = `Filter ${index + 1}: ON ${filter.kind} Fc ${filter.frequencyHz.toFixed(1)} Hz`;

  if (apoFilterKindUsesGain(filter.kind)) {
    return `${prefix} Gain ${filter.gainDb.toFixed(1)} dB Q ${filter.q.toFixed(2)}`;
  }

  return `${prefix} Q ${filter.q.toFixed(2)}`;
}

function isAutomationAlgorithm(value: unknown): value is AutomationAlgorithm {
  return value === 'proportional';
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function persistApoSelections(): void {
  if (state.apoSelectedMeasurementId) {
    localStorage.setItem(APO_SELECTED_MEASUREMENT_STORAGE_KEY, state.apoSelectedMeasurementId);
  } else {
    localStorage.removeItem(APO_SELECTED_MEASUREMENT_STORAGE_KEY);
  }

  if (state.apoSelectedReferenceId) {
    localStorage.setItem(APO_SELECTED_REFERENCE_STORAGE_KEY, state.apoSelectedReferenceId);
  } else {
    localStorage.removeItem(APO_SELECTED_REFERENCE_STORAGE_KEY);
  }
}

function persistApoState(): void {
  localStorage.setItem(
    APO_FILTERS_STORAGE_KEY,
    JSON.stringify({
      parametricApoFilters: state.parametricApoFilters,
      graphicApoFilters: state.graphicApoFilters,
    }),
  );
  localStorage.setItem(APO_EQ_MODE_STORAGE_KEY, state.apoEqMode);
  localStorage.setItem(
    APO_MAX_FILTERS_STORAGE_KEY,
    JSON.stringify({
      parametricApoMaxFilters: state.parametricApoMaxFilters,
      graphicApoMaxFilters: state.graphicApoMaxFilters,
    }),
  );
  localStorage.setItem(APO_MAX_BOOST_STORAGE_KEY, String(state.apoMaxBoostDb));
  localStorage.setItem(APO_MAX_CUT_STORAGE_KEY, String(state.apoMaxCutDb));
  persistApoSelections();
}

function persistAutomationSettings(): void {
  localStorage.setItem(AUTOMATION_ALGORITHM_STORAGE_KEY, state.automationAlgorithm);
  localStorage.setItem(
    AUTOMATION_DELAY_SECONDS_STORAGE_KEY,
    String(state.automationDelaySeconds),
  );
  localStorage.setItem(PROPORTIONAL_P_STORAGE_KEY, String(state.proportionalP));
  localStorage.setItem(
    DYNAMIC_PROPORTIONAL_P_STORAGE_KEY,
    String(state.dynamicProportionalP),
  );
  localStorage.setItem(
    AUTOMATION_STOP_ON_TOLERANCE_STORAGE_KEY,
    String(state.automationStopOnTolerance),
  );
  localStorage.setItem(
    AUTOMATION_BAND_TOLERANCES_STORAGE_KEY,
    JSON.stringify(state.automationBandTolerances),
  );
  localStorage.setItem(
    AUTOMATION_REGRESSION_LIMIT_STORAGE_KEY,
    String(state.automationRegressionLimit),
  );
}

function handleApoFilterDrag(
  filterId: string,
  frequencyHz: number,
  gainDb: number,
  axis: ApoDragAxis,
): void {
  setActiveApoFilters(getActiveApoFilters().map((filter) => {
    if (filter.id !== filterId) {
      return filter;
    }

    const nextFrequencyHz =
      state.apoEqMode === 'graphic' || axis === 'vertical'
        ? filter.frequencyHz
        : roundTo(frequencyHz, 1);
    const nextGainDb =
      axis === 'horizontal' || !apoFilterKindUsesGain(filter.kind)
        ? filter.gainDb
        : roundTo(gainDb, 0.1);

    return {
      ...filter,
      frequencyHz: nextFrequencyHz,
      gainDb: nextGainDb,
    };
  }));
  persistApoState();
  persistActiveConfiguration();
  renderPlotCard(
    state.measurements.filter((measurement) => measurement.visible),
    state.referenceCurves.filter((referenceCurve) => referenceCurve.visible),
  );
  apoConfigPreview.value = buildApoConfigText();
}

function handleApoFilterDragEnd(): void {
  renderApoSection();
}

function syncApoGenerationSettings(normalize: boolean): void {
  const parsedMaxFilters = Number(apoMaxFiltersInput.value);
  const minimumFilters = state.apoEqMode === 'graphic' ? 1 : 0;

  if (Number.isFinite(parsedMaxFilters)) {
    setActiveApoMaxFilters(clamp(Math.round(parsedMaxFilters), minimumFilters, 256));
  }

  if (normalize) {
    apoMaxFiltersInput.value = String(getActiveApoMaxFilters());
  }

  if (state.apoEqMode === 'graphic') {
    syncGraphicEqFiltersToBandCount();
  } else {
    syncParametricFiltersToCount();
  }

  persistApoState();
  persistActiveConfiguration();

  renderApoSection();
}

function syncAutomationSettings(normalize: boolean): void {
  const previousStopOnTolerance = state.automationStopOnTolerance;
  const previousDynamicProportionalP = state.dynamicProportionalP;
  const parsedDelaySeconds = Number(automationDelayInput.value);
  const parsedProportionalP = Number(proportionalPInput.value);
  const parsedRegressionLimit = Number(automationRegressionLimitInput.value);
  const nextDynamicProportionalP = dynamicProportionalPToggle.checked;

  if (Number.isFinite(parsedDelaySeconds)) {
    state.automationDelaySeconds = clamp(parsedDelaySeconds, 0, 3600);
  }

  if (!previousDynamicProportionalP && !nextDynamicProportionalP && Number.isFinite(parsedProportionalP)) {
    state.proportionalP = clamp(parsedProportionalP, 0, 1);
  }

  if (Number.isFinite(parsedRegressionLimit)) {
    state.automationRegressionLimit = clamp(Math.round(parsedRegressionLimit), 0, 20);
  }

  state.dynamicProportionalP = nextDynamicProportionalP;
  state.automationStopOnTolerance = automationStopOnToleranceToggle.checked;

  state.automationBandTolerances = AUTOMATION_TOLERANCE_BANDS.reduce(
    (tolerances, band) => ({
      ...tolerances,
      [band.key]: normalizeAutomationToleranceInputValue(
        automationToleranceInputs[band.key].value,
        band.defaultToleranceDb,
      ),
    }),
    createDefaultAutomationBandTolerances(),
  );

  if (state.automationStopOnTolerance) {
    updateLatestAutomationToleranceStatus(
      getSelectedApoMeasurement(),
      getSelectedApoReference(),
    );
  } else if (previousStopOnTolerance) {
    state.latestAutomationToleranceStatus = null;
  }

  if (normalize) {
    automationDelayInput.value = state.automationDelaySeconds.toFixed(1);
    proportionalPInput.value = state.proportionalP.toFixed(2);
    dynamicProportionalPToggle.checked = state.dynamicProportionalP;
    automationStopOnToleranceToggle.checked = state.automationStopOnTolerance;
    automationRegressionLimitInput.value = String(state.automationRegressionLimit);
    for (const band of AUTOMATION_TOLERANCE_BANDS) {
      automationToleranceInputs[band.key].value = state.automationBandTolerances[band.key].toFixed(1);
    }
  }

  persistAutomationSettings();
  persistActiveConfiguration();

  if (state.measurements.length > 0 || state.referenceCurves.length > 0) {
    renderMeasurements();
  }
}

function renderApoSection(): void {
  syncApoEqModeToggle();
  apoMaxFiltersInput.min = state.apoEqMode === 'graphic' ? '1' : '0';
  apoMaxFiltersInput.value = String(getActiveApoMaxFilters());
  syncApoSelectionOptions();
  apoFilterList.innerHTML = renderApoFilterList();
  apoConfigPreview.value = buildApoConfigText();
  apoApplyStatus.textContent = getApoApplyStatusText();
  apoApplyWarning.hidden = !state.equalizerApoStatus?.peaceRunning;
  renderPlotCard(
    state.measurements.filter((measurement) => measurement.visible),
    state.referenceCurves.filter((referenceCurve) => referenceCurve.visible),
  );
  updateAutomationUi();
  updateMeasurementActionState();
}

function syncApoEqModeToggle(): void {
  const isGraphic = state.apoEqMode === 'graphic';

  apoEqModeToggle.dataset.mode = state.apoEqMode;
  apoCard.classList.toggle('is-graphic', isGraphic);
  apoEqModeParametricButton.dataset.active = String(!isGraphic);
  apoEqModeGraphicButton.dataset.active = String(isGraphic);
  apoEqModeParametricButton.setAttribute('aria-selected', String(!isGraphic));
  apoEqModeGraphicButton.setAttribute('aria-selected', String(isGraphic));
}

function getApoApplyStatusText(): string {
  const enabledFilterCount = getActiveApoFilters().filter((filter) => filter.enabled).length;

  if (enabledFilterCount === 0) {
    return 'Enable at least one filter to apply APO.';
  }

  const status = state.equalizerApoStatus;

  if (!status) {
    return 'Checking Equalizer APO status...';
  }

  if (!status.installed) {
    return 'Equalizer APO not detected in the default install path.';
  }

  if (status.peaceRunning) {
    return 'PEACE is running. Apply APO is still available, but PEACE may override the active profile until it is closed.';
  }

  if (status.peaceIncludedInConfig) {
    return 'PEACE is included in config.txt. Apply APO will still update FreakishEars.txt.';
  }

  if (status.freakishEarsIncludedInConfig) {
    return `Apply APO writes to ${status.profilePath ?? 'FreakishEars.txt'} and is currently enabled in Equalizer APO.`;
  }

  return `Apply APO writes to ${status.profilePath ?? 'FreakishEars.txt'} and will enable it in Equalizer APO.`;
}

function syncApoSelectionOptions(): void {
  const measurementOptions = state.measurements
    .map(
      (measurement) =>
        `<option value="${escapeHtml(measurement.id)}">${escapeHtml(measurement.name)}</option>`,
    )
    .join('');
  const referenceOptions = state.referenceCurves
    .map(
      (referenceCurve) =>
        `<option value="${escapeHtml(referenceCurve.id)}">${escapeHtml(referenceCurve.name)}</option>`,
    )
    .join('');

  apoMeasurementSelect.innerHTML = `<option value="">Select measurement</option>${measurementOptions}`;
  apoReferenceSelect.innerHTML = `<option value="">Select target</option>${referenceOptions}`;

  if (
    state.apoSelectedMeasurementId &&
    state.measurements.some((measurement) => measurement.id === state.apoSelectedMeasurementId)
  ) {
    apoMeasurementSelect.value = state.apoSelectedMeasurementId;
  } else {
    state.apoSelectedMeasurementId = state.measurements.at(-1)?.id ?? null;
    apoMeasurementSelect.value = state.apoSelectedMeasurementId ?? '';
  }

  if (
    state.apoSelectedReferenceId &&
    state.referenceCurves.some((referenceCurve) => referenceCurve.id === state.apoSelectedReferenceId)
  ) {
    apoReferenceSelect.value = state.apoSelectedReferenceId;
  } else {
    state.apoSelectedReferenceId = state.referenceCurves.find((referenceCurve) => referenceCurve.visible)?.id ?? state.referenceCurves.at(-1)?.id ?? null;
    apoReferenceSelect.value = state.apoSelectedReferenceId ?? '';
  }

  persistApoSelections();
}

function renderApoFilterList(): string {
  const activeApoFilters = getActiveApoFilters();

  if (activeApoFilters.length === 0) {
    return state.apoEqMode === 'graphic'
      ? '<div class="measurement-empty">No graphic EQ bands yet. Increase the filter count to create fixed bands.</div>'
      : '<div class="measurement-empty">No APO filters yet. Generate from a target curve or add one manually.</div>';
  }

  const sortedFilters = [...activeApoFilters].sort(
    (aFilter, bFilter) => aFilter.frequencyHz - bFilter.frequencyHz,
  );

  return sortedFilters
    .map(
      (filter, index) => `
        <div class="apo-filter-row${filter.enabled ? '' : ' is-hidden'}">
          <label class="apo-filter-enabled">
            <input type="checkbox" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="enabled" ${filter.enabled ? 'checked' : ''} ${state.busy ? 'disabled' : ''} />
            <span>F${index + 1}</span>
          </label>
          ${state.apoEqMode === 'graphic'
            ? ''
            : `<select data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="kind" ${state.busy ? 'disabled' : ''}>
            ${PARAMETRIC_APO_FILTER_KIND_OPTIONS.map(
              (option) => `<option value="${option.value}" ${filter.kind === option.value ? 'selected' : ''}>${option.label}</option>`,
            ).join('')}
          </select>`}
          <input type="number" min="20" max="20000" step="1" value="${filter.frequencyHz.toFixed(0)}" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="frequencyHz" ${(state.busy || state.apoEqMode === 'graphic') ? 'disabled' : ''} />
          <input type="number" min="-24" max="24" step="0.1" value="${filter.gainDb.toFixed(1)}" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="gainDb" ${(state.busy || !apoFilterKindUsesGain(filter.kind)) ? 'disabled' : ''} />
          <input class="apo-filter-q" type="number" min="0.1" max="10" step="0.05" value="${filter.q.toFixed(2)}" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="q" ${(state.busy || state.apoEqMode === 'graphic') ? 'disabled' : ''} />
          <button class="btn btn-secondary measurement-remove-button" type="button" data-apo-filter-remove="${escapeHtml(filter.id)}" ${(state.busy || state.apoEqMode === 'graphic') ? 'disabled' : ''}>Remove</button>
        </div>
      `,
    )
    .join('');
}

function addApoFilter(partial: Partial<ApoFilter> = {}): void {
  if (state.apoEqMode === 'graphic') {
    return;
  }

  const nextFrequencyHz = partial.frequencyHz ?? findNextParametricFilterFrequency();

  setActiveApoFilters([
    ...getActiveApoFilters(),
    {
      id: `apo-filter-${state.nextApoFilterIndex}`,
      enabled: partial.enabled ?? true,
      kind: 'PK',
      frequencyHz: nextFrequencyHz,
      gainDb: partial.gainDb ?? 0,
      q: partial.q ?? 1.41,
    },
  ]);
  syncParametricApoFilterCountToFilters();
  state.nextApoFilterIndex += 1;
  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
}

function findNextParametricFilterFrequency(filters: ApoFilter[] = getActiveApoFilters()): number {
  const sortedFrequencies = filters
    .map((filter) => clamp(filter.frequencyHz, DEFAULT_START_FREQUENCY, DEFAULT_END_FREQUENCY))
    .sort((left, right) => left - right);

  if (sortedFrequencies.length === 0) {
    return 1000;
  }

  const boundaries = [DEFAULT_START_FREQUENCY, ...sortedFrequencies, DEFAULT_END_FREQUENCY];
  let widestGapIndex = 0;
  let widestGapOctaves = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startFrequencyHz = boundaries[index];
    const endFrequencyHz = boundaries[index + 1];
    const gapOctaves = Math.log2(endFrequencyHz / startFrequencyHz);

    if (gapOctaves > widestGapOctaves) {
      widestGapOctaves = gapOctaves;
      widestGapIndex = index;
    }
  }

  const gapStartFrequencyHz = boundaries[widestGapIndex];
  const gapEndFrequencyHz = boundaries[widestGapIndex + 1];
  return roundTo(Math.sqrt(gapStartFrequencyHz * gapEndFrequencyHz), 1);
}

function clearApoFilters(): void {
  if (state.apoEqMode === 'graphic') {
    const graphicFilters = buildGraphicEqFilters(getActiveApoMaxFilters());
    setActiveApoFilters(graphicFilters);
    state.nextApoFilterIndex = graphicFilters.length + 1;
  } else {
    setActiveApoFilters([]);
    syncParametricApoFilterCountToFilters();
    state.nextApoFilterIndex = 1;
  }
  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
  appendLog(
    state.apoEqMode === 'graphic' ? 'Reset graphic EQ bands to flat.' : 'Cleared all APO filters.',
    'neutral',
  );
}

function removeApoFilter(filterId: string): void {
  if (state.apoEqMode === 'graphic') {
    return;
  }

  setActiveApoFilters(getActiveApoFilters().filter((filter) => filter.id !== filterId));
  syncParametricApoFilterCountToFilters();
  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
}

function updateApoFilter(filterId: string, field: string, value: string | boolean): void {
  setActiveApoFilters(getActiveApoFilters().map((filter) => {
    if (filter.id !== filterId) {
      return filter;
    }

    if (field === 'enabled' && typeof value === 'boolean') {
      return { ...filter, enabled: value };
    }

    if (field === 'kind' && typeof value === 'string' && isApoFilterKind(value)) {
      return {
        ...filter,
        kind: value,
        gainDb: apoFilterKindUsesGain(value) ? filter.gainDb : 0,
      };
    }

    if (field === 'frequencyHz') {
      if (state.apoEqMode === 'graphic') {
        return filter;
      }

      const frequencyHz = clamp(Number(value), 20, 20000);
      return Number.isFinite(frequencyHz) ? { ...filter, frequencyHz } : filter;
    }

    if (field === 'gainDb') {
      if (!apoFilterKindUsesGain(filter.kind)) {
        return filter;
      }

      const gainDb = clamp(Number(value), -24, 24);
      return Number.isFinite(gainDb) ? { ...filter, gainDb } : filter;
    }

    if (field === 'q') {
      if (state.apoEqMode === 'graphic') {
        return filter;
      }

      const q = clamp(Number(value), 0.1, 10);
      return Number.isFinite(q) ? { ...filter, q } : filter;
    }

    return filter;
  }));

  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
}

async function generateApoFilters(
  measurementOverride: LoadedMeasurement | null = null,
  useAutomationAlgorithm = false,
): Promise<boolean> {
  const measurement = measurementOverride ?? getSelectedApoMeasurement();
  const referenceCurve = getSelectedApoReference();

  if (!measurement || !referenceCurve) {
    setStatus('Load a measurement and target before generating APO filters.', 'error');
    appendLog('APO generation aborted because a measurement or target curve is missing.', 'error');
    return false;
  }

  try {
    setBusy(true);
    setStatus(
      useAutomationAlgorithm
        ? `Generating Equalizer APO filters with ${formatAutomationAlgorithmLabel(state.automationAlgorithm)}...`
        : 'Generating Equalizer APO filters...',
      'working',
    );

    const generatedFilters = useAutomationAlgorithm
      ? buildFiltersForSelectedAlgorithm(measurement, referenceCurve)
      : buildApoFiltersFromCurves(measurement, referenceCurve);
    setActiveApoFilters(generatedFilters);
    if (state.apoEqMode === 'parametric') {
      syncParametricApoFilterCountToFilters();
    }
    state.nextApoFilterIndex = generatedFilters.length + 1;
    persistApoState();
    persistActiveConfiguration();
    renderApoSection();

    setStatus(`Generated ${generatedFilters.length} APO filter${generatedFilters.length === 1 ? '' : 's'}.`, 'success');
    appendLog(
      useAutomationAlgorithm
        ? `Generated ${generatedFilters.length} ${state.apoEqMode === 'graphic' ? 'graphic EQ band' : 'APO filter'}${generatedFilters.length === 1 ? '' : 's'} from ${measurement.name} to ${referenceCurve.name} with the ${formatAutomationAlgorithmLabel(state.automationAlgorithm)} algorithm.`
        : `Generated ${generatedFilters.length} ${state.apoEqMode === 'graphic' ? 'graphic EQ band' : 'APO filter'}${generatedFilters.length === 1 ? '' : 's'} from ${measurement.name} to ${referenceCurve.name}.`,
      'success',
    );
    return true;
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`APO generation failed: ${message}`, 'error');
    appendLog(`APO generation failed: ${message}`, 'error');
    return false;
  } finally {
    setBusy(false);
  }
}

function buildFiltersForSelectedAlgorithm(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
): ApoFilter[] {
  if (state.automationAlgorithm === 'proportional') {
    return buildProportionalApoFilters(measurement, referenceCurve);
  }

  return buildApoFiltersFromCurves(measurement, referenceCurve);
}

function buildProportionalApoFilters(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
): ApoFilter[] {
  const proportionalP = getCurrentAutomationProportionalP(measurement, referenceCurve) ?? state.proportionalP;

  if (state.apoEqMode === 'graphic') {
    return buildProportionalGraphicEqFilters(measurement, referenceCurve, proportionalP);
  }

  const activeApoFilters = getActiveApoFilters();

  if (activeApoFilters.length === 0) {
    return buildApoFiltersFromCurves(measurement, referenceCurve).map((filter) => ({
      ...filter,
      gainDb: roundTo(
        clamp(getProportionalAdjustmentDb(filter.gainDb, proportionalP), -state.apoMaxCutDb, state.apoMaxBoostDb),
        0.1,
      ),
    }));
  }

  const measurementPoints = getAutomationMeasurementPoints(measurement, referenceCurve);
  const referencePoints = getDisplayedReferencePoints(referenceCurve);

  return activeApoFilters.map((filter) => {
    const measurementPoint = findClosestPoint(measurementPoints, filter.frequencyHz);
    const referencePoint = findClosestPoint(referencePoints, filter.frequencyHz);
    const adjustmentDb = getProportionalAdjustmentDb(
      referencePoint.smoothedMagnitudeDbRelative - measurementPoint.smoothedMagnitudeDbRelative,
      proportionalP,
    );

    return {
      ...filter,
      gainDb: roundTo(
        clamp(filter.gainDb + adjustmentDb, -state.apoMaxCutDb, state.apoMaxBoostDb),
        0.1,
      ),
    };
  });
}

function buildProportionalGraphicEqFilters(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
  proportionalP: number,
): ApoFilter[] {
  const measurementPoints = getAutomationMeasurementPoints(measurement, referenceCurve);
  const referencePoints = getDisplayedReferencePoints(referenceCurve);
  const filterCount = clamp(state.graphicApoMaxFilters, 1, 256);
  const expectedFrequencies = getGraphicEqFrequencies(filterCount);
  const baseFilters = state.graphicApoFilters.length === filterCount
    ? state.graphicApoFilters.map((filter, index) => ({
        ...filter,
        frequencyHz: expectedFrequencies[index] ?? filter.frequencyHz,
        q: roundTo(getGraphicEqQ(expectedFrequencies, index), 0.01),
      }))
    : buildGraphicEqFilters(filterCount);

  return baseFilters.map((filter) => {
    const measurementPoint = findClosestPoint(measurementPoints, filter.frequencyHz);
    const referencePoint = findClosestPoint(referencePoints, filter.frequencyHz);
    const adjustmentDb = getProportionalAdjustmentDb(
      referencePoint.smoothedMagnitudeDbRelative - measurementPoint.smoothedMagnitudeDbRelative,
      proportionalP,
    );

    return {
      ...filter,
      gainDb: roundTo(
        clamp(filter.gainDb + adjustmentDb, -state.apoMaxCutDb, state.apoMaxBoostDb),
        0.1,
      ),
    };
  });
}

function getProportionalAdjustmentDb(errorDb: number, proportionalP: number): number {
  return errorDb * proportionalP;
}

function getCurrentAutomationProportionalP(
  measurement: LoadedMeasurement | null,
  referenceCurve: ReferenceCurve | null,
): number | null {
  if (!state.dynamicProportionalP) {
    return state.proportionalP;
  }

  if (!measurement || !referenceCurve) {
    return null;
  }

  return getDynamicProportionalPForErrorScore(
    getAutomationErrorScoreDb(measurement, referenceCurve),
  );
}

function getDynamicProportionalPForErrorScore(errorScoreDb: number): number {
  const scaledError = clamp(
    errorScoreDb / DYNAMIC_PROPORTIONAL_P_FULL_SCALE_ERROR_DB,
    0,
    1,
  );
  const scale =
    DYNAMIC_PROPORTIONAL_P_MIN_SCALE +
    (DYNAMIC_PROPORTIONAL_P_MAX_SCALE - DYNAMIC_PROPORTIONAL_P_MIN_SCALE) * scaledError;
  return clamp(state.proportionalP * scale, 0, 1);
}

function getAutomationErrorScoreDb(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
): number {
  const measurementPoints = getAutomationMeasurementPoints(measurement, referenceCurve);
  const referencePoints = getDisplayedReferencePoints(referenceCurve);
  let totalAbsoluteErrorDb = 0;

  for (const measurementPoint of measurementPoints) {
    const referencePoint = findClosestPoint(referencePoints, measurementPoint.frequencyHz);
    totalAbsoluteErrorDb += Math.abs(
      referencePoint.smoothedMagnitudeDbRelative - measurementPoint.smoothedMagnitudeDbRelative,
    );
  }

  return measurementPoints.length > 0 ? totalAbsoluteErrorDb / measurementPoints.length : 0;
}

function formatAutomationAlgorithmLabel(algorithm: AutomationAlgorithm): string {
  return algorithm === 'proportional' ? 'proportional' : algorithm;
}

function buildApoFiltersFromCurves(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
): ApoFilter[] {
  if (state.apoEqMode === 'graphic') {
    return buildGraphicEqFiltersFromCurves(measurement, referenceCurve);
  }

  const measurementPoints = getDisplayedMeasurementPoints(measurement, referenceCurve);
  const referencePoints = getDisplayedReferencePoints(referenceCurve);
  const samplePoints = buildApoSamplePoints(measurementPoints, referencePoints);

  if (samplePoints.length === 0) {
    throw new Error('There are not enough overlapping points to fit APO filters.');
  }

  const residuals = samplePoints.map((point) => point.targetGainDb);
  const filters: ApoFilter[] = [];

  for (let index = 0; index < state.parametricApoMaxFilters; index += 1) {
    let dominantIndex = -1;
    let dominantMagnitude = 0;

    for (let sampleIndex = 0; sampleIndex < residuals.length; sampleIndex += 1) {
      const magnitude = Math.abs(residuals[sampleIndex] ?? 0);
      if (magnitude > dominantMagnitude) {
        dominantMagnitude = magnitude;
        dominantIndex = sampleIndex;
      }
    }

    if (dominantIndex < 0 || dominantMagnitude < 1) {
      break;
    }

    const dominantPoint = samplePoints[dominantIndex];
    const unclampedGainDb = residuals[dominantIndex] ?? 0;
    const gainDb = clamp(
      unclampedGainDb,
      -state.apoMaxCutDb,
      state.apoMaxBoostDb,
    );

    if (Math.abs(gainDb) < 0.5) {
      break;
    }

    const q = estimateApoFilterQ(samplePoints, residuals, dominantIndex);
    const filter: ApoFilter = {
      id: `apo-filter-${index + 1}`,
      enabled: true,
      kind: 'PK',
      frequencyHz: dominantPoint.frequencyHz,
      gainDb: roundTo(gainDb, 0.1),
      q: roundTo(q, 0.01),
    };

    filters.push(filter);

    for (let sampleIndex = 0; sampleIndex < samplePoints.length; sampleIndex += 1) {
      residuals[sampleIndex] -= getApoFilterResponseDb(filter, samplePoints[sampleIndex].frequencyHz);
    }
  }

  return filters;
}

function buildGraphicEqFiltersFromCurves(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
): ApoFilter[] {
  const measurementPoints = getDisplayedMeasurementPoints(measurement, referenceCurve);
  const referencePoints = getDisplayedReferencePoints(referenceCurve);
  const filterCount = clamp(state.graphicApoMaxFilters, 1, 256);
  const frequencies = getGraphicEqFrequencies(filterCount);

  return frequencies.map((frequencyHz, index) => {
    const measurementPoint = findClosestPoint(measurementPoints, frequencyHz);
    const referencePoint = findClosestPoint(referencePoints, frequencyHz);
    const unclampedGainDb =
      referencePoint.smoothedMagnitudeDbRelative - measurementPoint.smoothedMagnitudeDbRelative;
    const gainDb = clamp(unclampedGainDb, -state.apoMaxCutDb, state.apoMaxBoostDb);

    return {
      id: `apo-filter-${index + 1}`,
      enabled: true,
      kind: 'PK',
      frequencyHz,
      gainDb: roundTo(gainDb, 0.1),
      q: roundTo(getGraphicEqQ(frequencies, index), 0.01),
    };
  });
}

function buildApoSamplePoints(
  measurementPoints: ReturnType<typeof getDisplayedMeasurementPoints>,
  referencePoints: ReturnType<typeof getDisplayedReferencePoints>,
): Array<{ frequencyHz: number; targetGainDb: number }> {
  const minimumFrequency = Math.max(
    measurementPoints[0]?.frequencyHz ?? DEFAULT_START_FREQUENCY,
    referencePoints[0]?.frequencyHz ?? DEFAULT_START_FREQUENCY,
    20,
  );
  const maximumFrequency = Math.min(
    measurementPoints.at(-1)?.frequencyHz ?? DEFAULT_END_FREQUENCY,
    referencePoints.at(-1)?.frequencyHz ?? DEFAULT_END_FREQUENCY,
    20000,
  );

  if (maximumFrequency <= minimumFrequency) {
    return [];
  }

  return Array.from({ length: 96 }, (_unused, index) => {
    const ratio = index / 95;
    const frequencyHz = minimumFrequency * Math.pow(maximumFrequency / minimumFrequency, ratio);
    const measurementPoint = findClosestPoint(measurementPoints, frequencyHz);
    const referencePoint = findClosestPoint(referencePoints, frequencyHz);
    return {
      frequencyHz,
      targetGainDb: referencePoint.smoothedMagnitudeDbRelative - measurementPoint.smoothedMagnitudeDbRelative,
    };
  });
}

function estimateApoFilterQ(
  samplePoints: Array<{ frequencyHz: number; targetGainDb: number }>,
  residuals: number[],
  dominantIndex: number,
): number {
  const dominantGainDb = residuals[dominantIndex] ?? 0;
  const dominantSign = Math.sign(dominantGainDb) || 1;
  const thresholdDb = Math.abs(dominantGainDb) * 0.5;
  let leftIndex = dominantIndex;
  let rightIndex = dominantIndex;

  while (leftIndex > 0) {
    const candidate = residuals[leftIndex - 1] ?? 0;
    if (Math.sign(candidate) !== dominantSign || Math.abs(candidate) < thresholdDb) {
      break;
    }

    leftIndex -= 1;
  }

  while (rightIndex < residuals.length - 1) {
    const candidate = residuals[rightIndex + 1] ?? 0;
    if (Math.sign(candidate) !== dominantSign || Math.abs(candidate) < thresholdDb) {
      break;
    }

    rightIndex += 1;
  }

  const leftFrequency = samplePoints[leftIndex]?.frequencyHz ?? samplePoints[dominantIndex].frequencyHz / Math.SQRT2;
  const rightFrequency = samplePoints[rightIndex]?.frequencyHz ?? samplePoints[dominantIndex].frequencyHz * Math.SQRT2;
  const bandwidthOctaves = clamp(Math.log2(rightFrequency / leftFrequency), 0.1, 4);
  const bandwidthRatio = Math.pow(2, bandwidthOctaves);
  const q = Math.sqrt(bandwidthRatio) / (bandwidthRatio - 1);

  return clamp(q, 0.3, 6);
}

function getDisplayedMeasurementPoints(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve | null,
) {
  const referenceNormalizationDb = referenceCurve
    ? findClosestPoint(getDisplayedReferencePoints(referenceCurve), 1000)
        .smoothedMagnitudeDbRelative
    : null;

  return getMeasurementPointsForDisplay(
    measurement.plotPoints,
    measurement,
    state.normalizePlot,
    state.splOffsetDb,
    state.smoothingMode,
    referenceNormalizationDb,
  );
}

function getAutomationMeasurementPoints(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
) {
  const referenceNormalizationDb = findClosestPoint(
    getDisplayedReferencePoints(referenceCurve),
    PLOT_NORMALIZATION_FREQUENCY_HZ,
  ).smoothedMagnitudeDbRelative;

  return getMeasurementPointsForDisplay(
    measurement.plotPoints,
    measurement,
    true,
    state.splOffsetDb,
    state.smoothingMode,
    referenceNormalizationDb,
  );
}

function evaluateAutomationTolerance(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
): {
  satisfied: boolean;
  bandSummaries: string[];
  scoreDb: number;
} {
  const measurementPoints = getDisplayedMeasurementPoints(measurement, referenceCurve);
  const referencePoints = getDisplayedReferencePoints(referenceCurve);
  const overlapMinimumHz = Math.max(
    measurementPoints[0]?.frequencyHz ?? DEFAULT_START_FREQUENCY,
    referencePoints[0]?.frequencyHz ?? DEFAULT_START_FREQUENCY,
  );
  const overlapMaximumHz = Math.min(
    measurementPoints.at(-1)?.frequencyHz ?? DEFAULT_END_FREQUENCY,
    referencePoints.at(-1)?.frequencyHz ?? DEFAULT_END_FREQUENCY,
  );
  const bandSummaries: string[] = [];
  let satisfied = true;
  let totalAbsoluteErrorDb = 0;
  let scoredPointCount = 0;

  for (const band of AUTOMATION_TOLERANCE_BANDS) {
    const minimumHz = Math.max(band.minimumFrequencyHz, overlapMinimumHz);
    const maximumHz = Math.min(band.maximumFrequencyHz, overlapMaximumHz);

    if (maximumHz <= minimumHz) {
      continue;
    }

    const bandMeasurementPoints = measurementPoints.filter(
      (point) => point.frequencyHz >= minimumHz && point.frequencyHz <= maximumHz,
    );
    let maximumErrorDb = 0;

    for (const measurementPoint of bandMeasurementPoints) {
      const referencePoint = findClosestPoint(referencePoints, measurementPoint.frequencyHz);
      const errorDb =
        referencePoint.smoothedMagnitudeDbRelative -
        measurementPoint.smoothedMagnitudeDbRelative;
      const absoluteErrorDb = Math.abs(errorDb);

      maximumErrorDb = Math.max(maximumErrorDb, absoluteErrorDb);
      totalAbsoluteErrorDb += absoluteErrorDb;
      scoredPointCount += 1;
    }

    const toleranceDb = state.automationBandTolerances[band.key];
    const withinTolerance = maximumErrorDb <= toleranceDb;
    satisfied &&= withinTolerance;
    bandSummaries.push(
      `${band.label} ${maximumErrorDb.toFixed(1)}/${toleranceDb.toFixed(1)} dB`,
    );
  }

  return {
    satisfied,
    bandSummaries,
    scoreDb: scoredPointCount > 0 ? totalAbsoluteErrorDb / scoredPointCount : 0,
  };
}

function updateLatestAutomationToleranceStatus(
  measurement: LoadedMeasurement | null,
  referenceCurve: ReferenceCurve | null,
): ReturnType<typeof evaluateAutomationTolerance> | null {
  if (!state.automationStopOnTolerance || !measurement || !referenceCurve) {
    state.latestAutomationToleranceStatus = null;
    return null;
  }

  const toleranceResult = evaluateAutomationTolerance(measurement, referenceCurve);
  state.latestAutomationToleranceStatus = `Tolerance: ${toleranceResult.bandSummaries.join(', ')}`;
  return toleranceResult;
}

function cloneApoFilters(filters: ApoFilter[]): ApoFilter[] {
  return filters.map((filter) => ({ ...filter }));
}

function getDisplayedReferencePoints(referenceCurve: ReferenceCurve) {
  return getMeasurementPointsForDisplay(
    referenceCurve.plotPoints,
    referenceCurve,
    false,
    0,
    state.smoothingMode,
    null,
  );
}

function getSelectedApoMeasurement(): LoadedMeasurement | null {
  return state.measurements.find(
    (measurement) => measurement.id === state.apoSelectedMeasurementId,
  ) ?? null;
}

function getSelectedApoReference(): ReferenceCurve | null {
  return state.referenceCurves.find(
    (referenceCurve) => referenceCurve.id === state.apoSelectedReferenceId,
  ) ?? null;
}

function getApoFilterResponseDb(filter: ApoFilter, frequencyHz: number): number {
  if (filter.kind === 'PK') {
    const distanceOctaves = Math.log2(frequencyHz / filter.frequencyHz);
    const sigma = 0.6 / Math.sqrt(filter.q);
    return filter.gainDb * Math.exp(-(distanceOctaves * distanceOctaves) / (2 * sigma * sigma));
  }

  const sampleRate = getSelectedSampleRate();
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

function getCombinedApoResponseDb(frequencyHz: number): number {
  return getCombinedApoResponseDbForFilters(getActiveApoFilters(), frequencyHz);
}

function getCombinedApoResponseDbForFilters(filters: ApoFilter[], frequencyHz: number): number {
  return filters.reduce((total, filter) => {
    if (!filter.enabled) {
      return total;
    }

    return total + getApoFilterResponseDb(filter, frequencyHz);
  }, 0);
}

function buildApoConfigText(): string {
  const enabledFilters = getActiveApoFilters().filter((filter) => filter.enabled);
  const measurement = getSelectedApoMeasurement();
  const referenceCurve = getSelectedApoReference();
  const normalizationDb = getCombinedApoResponseDb(PLOT_NORMALIZATION_FREQUENCY_HZ);
  const preampDb = -roundTo(normalizationDb, 0.1);
  const lines = [
    '# Equalizer APO config generated by Freakish Ears',
    measurement ? `# Measurement: ${measurement.name}` : '# Measurement: none selected',
    referenceCurve ? `# Target: ${referenceCurve.name}` : '# Target: none selected',
    `Preamp: ${preampDb.toFixed(1)} dB`,
  ];

  if (enabledFilters.length === 0) {
    lines.push('# No enabled filters');
  } else if (state.apoEqMode === 'graphic') {
    lines.push(
      `GraphicEQ: ${enabledFilters
        .map((filter) => `${filter.frequencyHz.toFixed(1)} ${filter.gainDb.toFixed(1)}`)
        .join('; ')}`,
    );
  } else {
    enabledFilters.forEach((filter, index) => {
      lines.push(buildApoFilterConfigLine(filter, index));
    });
  }

  return lines.join('\n');
}

function getGraphicEqFrequencies(filterCount: number): number[] {
  const normalizedCount = clamp(Math.round(filterCount), 1, 256);

  if (normalizedCount === 1) {
    return [1000];
  }

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const ratio = index / (normalizedCount - 1);
    const frequencyHz =
      DEFAULT_START_FREQUENCY * Math.pow(DEFAULT_END_FREQUENCY / DEFAULT_START_FREQUENCY, ratio);
    return roundTo(frequencyHz, 1);
  });
}

function getGraphicEqQ(frequencies: number[], index: number): number {
  if (frequencies.length <= 1) {
    return 1.41;
  }

  const frequencyHz = frequencies[index] ?? frequencies[0];
  const previousFrequencyHz = frequencies[index - 1] ?? null;
  const nextFrequencyHz = frequencies[index + 1] ?? null;
  const leftRatio = previousFrequencyHz
    ? frequencyHz / previousFrequencyHz
    : (nextFrequencyHz ?? frequencyHz) / frequencyHz;
  const rightRatio = nextFrequencyHz
    ? nextFrequencyHz / frequencyHz
    : frequencyHz / (previousFrequencyHz ?? frequencyHz);
  const leftEdgeHz = frequencyHz / Math.sqrt(leftRatio);
  const rightEdgeHz = frequencyHz * Math.sqrt(rightRatio);
  const bandwidthOctaves = clamp(Math.log2(rightEdgeHz / leftEdgeHz), 0.1, 4);
  const bandwidthRatio = Math.pow(2, bandwidthOctaves);

  return clamp(Math.sqrt(bandwidthRatio) / (bandwidthRatio - 1), 0.3, 6);
}

function buildGraphicEqFilters(filterCount: number, sourceFilters: ApoFilter[] = []): ApoFilter[] {
  const frequencies = getGraphicEqFrequencies(filterCount);

  return frequencies.map((frequencyHz, index) => ({
    id: `apo-filter-${index + 1}`,
    enabled: true,
    kind: 'PK',
    frequencyHz,
    gainDb: roundTo(getCombinedApoResponseDbForFilters(sourceFilters, frequencyHz), 0.1),
    q: roundTo(getGraphicEqQ(frequencies, index), 0.01),
  }));
}

function syncGraphicEqFiltersToBandCount(): void {
  state.graphicApoFilters = buildGraphicEqFilters(state.graphicApoMaxFilters, state.graphicApoFilters);
  state.nextApoFilterIndex = state.graphicApoFilters.length + 1;
}

async function exportApoConfig(): Promise<void> {
  if (state.busy) {
    return;
  }

  try {
    setBusy(true);
    setStatus('Exporting Equalizer APO config...', 'working');

    const saveResult = await window.freakishEars.saveFileAs({
      title: 'Export Equalizer APO config',
      suggestedName: `equalizer-apo-${formatTimestampForPath(new Date())}.txt`,
      defaultFolderPath: state.outputFolder,
      contents: new TextEncoder().encode(buildApoConfigText()),
    });

    if (saveResult.canceled || !saveResult.filePath) {
      setStatus('Equalizer APO export cancelled.', 'idle');
      return;
    }

    setStatus('Equalizer APO config exported.', 'success');
    appendLog(`Exported Equalizer APO config to ${saveResult.filePath}.`, 'success');
    showToast({
      message: 'Equalizer APO config exported',
      actionLabel: 'View in Finder',
      actionPath: saveResult.filePath,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`APO export failed: ${message}`, 'error');
    appendLog(`APO export failed: ${message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function refreshEqualizerApoStatus(): Promise<void> {
  try {
    state.equalizerApoStatus = await window.freakishEars.getEqualizerApoStatus();
  } catch (error) {
    appendLog(`Unable to read Equalizer APO status: ${getErrorMessage(error)}`, 'error');
    state.equalizerApoStatus = null;
  }

  renderApoSection();
}

async function applyApoConfig(options?: { continueOnBusyFileError?: boolean }): Promise<boolean> {
  const status = state.equalizerApoStatus;

  if (state.busy) {
    return false;
  }

  if (!status?.installed) {
    setStatus('Equalizer APO was not detected in the default install path.', 'error');
    appendLog('Apply APO aborted because Equalizer APO is not installed in the default path.', 'error');
    return false;
  }

  try {
    setBusy(true);
    setStatus('Applying Equalizer APO profile...', 'working');

    const result = await window.freakishEars.applyEqualizerApoConfig({
      configText: buildApoConfigText(),
    });

    await refreshEqualizerApoStatus();
    setStatus('Equalizer APO profile applied.', 'success');
    appendLog(`Applied Equalizer APO profile to ${result.profilePath}.`, 'success');
    showToast({
      message: 'Equalizer APO profile applied',
      actionLabel: 'View in Finder',
      actionPath: result.profilePath,
    });
    return true;
  } catch (error) {
    const message = getErrorMessage(error);
    await refreshEqualizerApoStatus();

    if (options?.continueOnBusyFileError && isBusyFileError(error)) {
      appendLog(`Apply APO skipped because Equalizer APO config is locked: ${message}`);
      return true;
    }

    setStatus(`Apply APO failed: ${message}`, 'error');
    appendLog(`Apply APO failed: ${message}`, 'error');
    return false;
  } finally {
    setBusy(false);
  }
}

async function toggleAutomationLoop(): Promise<void> {
  if (state.automationRunning) {
    state.automationStopRequested = true;
    updateAutomationUi();
    setStatus('Stopping automation after the current step...', 'working');
    appendLog('Automation stop requested. Waiting for the current step to finish.');
    return;
  }

  if (state.busy) {
    return;
  }

  state.automationRunning = true;
  state.automationStopRequested = false;
  updateAutomationUi();
  appendLog(`Started ${formatAutomationAlgorithmLabel(state.automationAlgorithm)} automation.`, 'success');
  let completedWithinTolerance = false;
  let toleranceSummary = '';
  let bestScoreDb = Number.POSITIVE_INFINITY;
  let bestFilters = cloneApoFilters(getActiveApoFilters());
  let consecutiveRegressionCount = 0;

  try {
    while (state.automationRunning) {
      const measurement = await runMeasurement();
      if (!measurement || state.automationStopRequested) {
        break;
      }

      state.apoSelectedMeasurementId = measurement.id;
      persistApoSelections();
      renderApoSection();

      const referenceCurve = getSelectedApoReference();
      if (referenceCurve) {
        const toleranceResult = state.automationStopOnTolerance
          ? updateLatestAutomationToleranceStatus(measurement, referenceCurve)
          : evaluateAutomationTolerance(measurement, referenceCurve);

        if (toleranceResult && toleranceResult.scoreDb < bestScoreDb - 0.01) {
          bestScoreDb = toleranceResult.scoreDb;
          bestFilters = cloneApoFilters(getActiveApoFilters());
          consecutiveRegressionCount = 0;
        } else if (
          toleranceResult &&
          state.automationRegressionLimit > 0 &&
          toleranceResult.scoreDb > bestScoreDb + 0.01
        ) {
          consecutiveRegressionCount += 1;
          appendLog(
            `Automation regression ${consecutiveRegressionCount}/${state.automationRegressionLimit}: score ${toleranceResult.scoreDb.toFixed(2)} dB vs best ${bestScoreDb.toFixed(2)} dB.`,
          );

          if (consecutiveRegressionCount >= state.automationRegressionLimit) {
            setActiveApoFilters(cloneApoFilters(bestFilters));
            state.nextApoFilterIndex = bestFilters.length + 1;
            persistApoState();
            persistActiveConfiguration();
            renderApoSection();

            appendLog(
              `Reverted to the best automation result after ${consecutiveRegressionCount} consecutive regressions and reapplied it.`,
              'success',
            );
            setStatus('Automation reverted to previous best result.', 'working');

            const reverted = await applyApoConfig({ continueOnBusyFileError: true });
            if (!reverted || state.automationStopRequested) {
              break;
            }

            consecutiveRegressionCount = 0;

            if (state.automationDelaySeconds > 0) {
              appendLog(`Waiting ${state.automationDelaySeconds.toFixed(1)}s before the next automation run.`);
              const completedDelay = await waitForAutomationDelay();
              if (!completedDelay || state.automationStopRequested) {
                break;
              }
            }

            continue;
          }
        } else if (toleranceResult) {
          consecutiveRegressionCount = 0;
        }

        if (state.automationStopOnTolerance && toleranceResult?.satisfied) {
          completedWithinTolerance = true;
          toleranceSummary = toleranceResult.bandSummaries.join(', ');
          break;
        }
      }

      const generated = await generateApoFilters(measurement, true);
      if (!generated || state.automationStopRequested) {
        break;
      }

      const applied = await applyApoConfig({ continueOnBusyFileError: true });
      if (!applied || state.automationStopRequested) {
        break;
      }

      if (state.automationDelaySeconds > 0) {
        appendLog(`Waiting ${state.automationDelaySeconds.toFixed(1)}s before the next automation run.`);
        const completedDelay = await waitForAutomationDelay();
        if (!completedDelay || state.automationStopRequested) {
          break;
        }
      }
    }
  } finally {
    const stopRequested = state.automationStopRequested;
    state.automationRunning = false;
    state.automationStopRequested = false;
    updateAutomationUi();

    if (stopRequested) {
      setStatus('Automation stopped.', 'idle');
      appendLog('Automation stopped.');
    } else if (completedWithinTolerance) {
      setStatus('Automation completed within tolerance.', 'success');
      appendLog(
        `Automation stopped because the measured response is within tolerance${toleranceSummary ? `: ${toleranceSummary}.` : '.'}`,
        'success',
      );
    }
  }
}

async function waitForAutomationDelay(): Promise<boolean> {
  let remainingMs = Math.round(state.automationDelaySeconds * 1000);

  while (remainingMs > 0) {
    if (state.automationStopRequested) {
      return false;
    }

    const nextSliceMs = Math.min(remainingMs, 100);
    await wait(nextSliceMs);
    remainingMs -= nextSliceMs;
  }

  return !state.automationStopRequested;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
