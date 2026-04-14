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
  AUTOMATION_TOLERANCE_MAX_ACCEPTABLE_ERROR_WIDTH_STORAGE_KEY,
  DAMPED_REFIT_BLEND_STORAGE_KEY,
  DEFAULT_DYNAMIC_PROPORTIONAL_P,
  DEFAULT_DAMPED_REFIT_BLEND,
  DEFAULT_MOMENTUM_BLEND,
  DEFAULT_MOMENTUM_DECAY,
  DEFAULT_PID_DERIVATIVE_GAIN,
  DEFAULT_PID_INTEGRAL_GAIN,
  DEFAULT_PID_PROPORTIONAL_GAIN,
  DEFAULT_APO_EQ_MODE,
  DEFAULT_GRAPHIC_APO_MAX_FILTERS,
  DEFAULT_MEASUREMENT_BACKEND,
  DEFAULT_MEASUREMENT_KEEP_COUNT,
  DEFAULT_APO_MAX_BOOST_DB,
  DEFAULT_APO_MAX_CUT_DB,
  DEFAULT_APO_MAX_FILTERS,
  MAX_GRAPHIC_APO_FILTERS,
  MAX_PARAMETRIC_APO_FILTERS,
  APO_FILTER_LIST_PAGE_SIZE,
  DEFAULT_AUTOMATION_ALGORITHM,
  DEFAULT_AUTOMATION_DELAY_SECONDS,
  DEFAULT_AUTOMATION_REGRESSION_LIMIT,
  DEFAULT_AUTOMATION_STOP_ON_TOLERANCE,
  DEFAULT_AUTOMATION_TOLERANCE_MAX_ACCEPTABLE_ERROR_WIDTH_HZ,
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
  MOMENTUM_BLEND_STORAGE_KEY,
  MOMENTUM_DECAY_STORAGE_KEY,
  MAX_SWEEP_LEVEL_DB,
  MIN_SWEEP_LEVEL_DB,
  NORMALIZE_PLOT_STORAGE_KEY,
  OUTPUT_CHANNEL_STORAGE_KEY,
  OUTPUT_DEVICE_STORAGE_KEY,
  POST_ROLL_SECONDS,
  PRE_ROLL_SECONDS,
  PID_DERIVATIVE_GAIN_STORAGE_KEY,
  PID_INTEGRAL_GAIN_STORAGE_KEY,
  PID_PROPORTIONAL_GAIN_STORAGE_KEY,
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
  PARAMETRIC_APO_FILTER_KIND_OPTIONS,
  apoFilterKindUsesGain,
  apoFilterKindUsesOrder,
  apoFilterKindUsesQ,
  apoFilterKindUsesShape,
  apoFilterKindUsesSlopeDb,
  buildApoFilterConfigLines,
  getApoFilterResponseDb,
  getDefaultApoFilterOrder,
  getDefaultApoFilterQ,
  getDefaultApoFilterSlopeDbPerOct,
  getExpandedApoSectionCount,
  getApoFilterShapeLabel,
  isApoFilterKind,
  normalizeApoFilterOrder,
  normalizeApoFilterSlopeDbPerOct,
  parseLogicalApoFilterComment,
} from './renderer/apo';
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
  getToleranceFailureSegments,
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
    label: 'Upper mid',
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

const DYNAMIC_PROPORTIONAL_P_FULL_SCALE_ERROR_DB = 12;
const PID_INTEGRAL_ERROR_LIMIT_DB = 120;

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
              <option value="pid">PID</option>
              <option value="damped-refit">Damped Refit</option>
              <option value="momentum">Momentum</option>
            </select>
          </div>

          <div class="automation-fields">
            <div class="field">
              <label for="automationDelayInput">Delay Between Runs</label>
              <div class="number-input-row">
                <input id="automationDelayInput" class="level-number-input" type="number" min="0" max="3600" step="0.1" value="${DEFAULT_AUTOMATION_DELAY_SECONDS.toFixed(1)}" />
                <span>s</span>
              </div>
            </div>
          </div>

          <div id="proportionalAutomationFields" class="automation-fields">
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
            <span class="automation-hint">Each pass measures the current response, adds (target - measured) * P to the current APO correction, then applies the updated APO config.</span>
          </div>

          <div id="pidAutomationFields" class="automation-fields" hidden>
            <div class="field">
              <label for="pidProportionalGainInput">P Value</label>
              <div class="number-input-row">
                <input id="pidProportionalGainInput" class="level-number-input" type="number" min="0" max="1" step="0.01" value="${DEFAULT_PID_PROPORTIONAL_GAIN.toFixed(2)}" />
              </div>
            </div>
            <div class="field">
              <label for="pidIntegralGainInput">I Value</label>
              <div class="number-input-row">
                <input id="pidIntegralGainInput" class="level-number-input" type="number" min="0" max="1" step="0.01" value="${DEFAULT_PID_INTEGRAL_GAIN.toFixed(2)}" />
              </div>
            </div>
            <div class="field">
              <label for="pidDerivativeGainInput">D Value</label>
              <div class="number-input-row">
                <input id="pidDerivativeGainInput" class="level-number-input" type="number" min="0" max="1" step="0.01" value="${DEFAULT_PID_DERIVATIVE_GAIN.toFixed(2)}" />
              </div>
            </div>
            <span class="automation-hint">Each pass updates the current APO correction with proportional, accumulated, and change-rate error terms.</span>
          </div>

          <div id="dampedRefitAutomationFields" class="automation-fields" hidden>
            <div class="field">
              <label for="dampedRefitBlendInput">Blend</label>
              <div class="number-input-row">
                <input id="dampedRefitBlendInput" class="level-number-input" type="number" min="0" max="1" step="0.01" value="${DEFAULT_DAMPED_REFIT_BLEND.toFixed(2)}" />
              </div>
            </div>
            <span class="automation-hint">Each pass computes a fresh graphic EQ fit and blends part of it into the current correction.</span>
          </div>

          <div id="momentumAutomationFields" class="automation-fields" hidden>
            <div class="field">
              <label for="momentumBlendInput">Blend</label>
              <div class="number-input-row">
                <input id="momentumBlendInput" class="level-number-input" type="number" min="0" max="1" step="0.01" value="${DEFAULT_MOMENTUM_BLEND.toFixed(2)}" />
              </div>
            </div>
            <div class="field">
              <label for="momentumDecayInput">Decay</label>
              <div class="number-input-row">
                <input id="momentumDecayInput" class="level-number-input" type="number" min="0" max="1" step="0.01" value="${DEFAULT_MOMENTUM_DECAY.toFixed(2)}" />
              </div>
            </div>
            <span class="automation-hint">Each pass blends toward a fresh fit while carrying forward part of the previous step.</span>
          </div>

          <div class="automation-fields">
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
              <div class="field">
                <label for="automationToleranceMaxAcceptableErrorWidthInput">Max Acceptable Error Width</label>
                <div class="number-input-row">
                  <input id="automationToleranceMaxAcceptableErrorWidthInput" class="level-number-input" type="number" min="0" max="5000" step="1" value="${DEFAULT_AUTOMATION_TOLERANCE_MAX_ACCEPTABLE_ERROR_WIDTH_HZ.toFixed(0)}" />
                  <span>Hz</span>
                </div>
              </div>
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
          </div>
          <button id="runAutomationButton" class="btn btn-primary automation-run-button" type="button">
            Run Automatic Calibration
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
              <input id="apoMaxFiltersInput" type="number" min="1" max="${MAX_PARAMETRIC_APO_FILTERS}" step="1" value="${DEFAULT_APO_MAX_FILTERS}" />
            </label>
          </div>

          <input id="measurementFileInput" type="file" accept=".txt,.csv,.json,.targetcurve,text/plain,application/json" multiple hidden />
          <input id="referenceFileInput" type="file" accept=".txt,.csv,.targetcurve,text/plain" multiple hidden />
          <input id="configFileInput" type="file" accept=".json,application/json,text/plain" hidden />
          <input id="apoConfigFileInput" type="file" accept=".txt,.peace,.peq,.ini,text/plain" hidden />

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
              <button id="importApoConfigButton" class="btn btn-secondary" type="button">
                Import EQ
              </button>
              <button id="exportApoConfigButton" class="btn btn-secondary" type="button">
                Export EQ
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
            <span class="apo-filter-header-cell apo-filter-header-q">Q / Order / Slope</span>
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
const pidAutomationFields = getElement<HTMLDivElement>('pidAutomationFields');
const dampedRefitAutomationFields = getElement<HTMLDivElement>('dampedRefitAutomationFields');
const momentumAutomationFields = getElement<HTMLDivElement>('momentumAutomationFields');
const automationDelayInput = getElement<HTMLInputElement>('automationDelayInput');
const proportionalPField = getElement<HTMLDivElement>('proportionalPField');
const proportionalPInput = getElement<HTMLInputElement>('proportionalPInput');
const dynamicProportionalPToggle = getElement<HTMLInputElement>('dynamicProportionalPToggle');
const pidProportionalGainInput = getElement<HTMLInputElement>('pidProportionalGainInput');
const pidIntegralGainInput = getElement<HTMLInputElement>('pidIntegralGainInput');
const pidDerivativeGainInput = getElement<HTMLInputElement>('pidDerivativeGainInput');
const dampedRefitBlendInput = getElement<HTMLInputElement>('dampedRefitBlendInput');
const momentumBlendInput = getElement<HTMLInputElement>('momentumBlendInput');
const momentumDecayInput = getElement<HTMLInputElement>('momentumDecayInput');
const automationStopOnToleranceToggle = getElement<HTMLInputElement>('automationStopOnToleranceToggle');
const automationRegressionLimitInput = getElement<HTMLInputElement>('automationRegressionLimitInput');
const automationToleranceFields = getElement<HTMLDivElement>('automationToleranceFields');
const automationToleranceMaxAcceptableErrorWidthInput = getElement<HTMLInputElement>('automationToleranceMaxAcceptableErrorWidthInput');
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
const apoConfigFileInput = getElement<HTMLInputElement>('apoConfigFileInput');
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
const importApoConfigButton = getElement<HTMLButtonElement>('importApoConfigButton');
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
  pidProportionalGain: clamp(
    readStoredNumber(PID_PROPORTIONAL_GAIN_STORAGE_KEY, DEFAULT_PID_PROPORTIONAL_GAIN),
    0,
    1,
  ),
  pidIntegralGain: clamp(
    readStoredNumber(PID_INTEGRAL_GAIN_STORAGE_KEY, DEFAULT_PID_INTEGRAL_GAIN),
    0,
    1,
  ),
  pidDerivativeGain: clamp(
    readStoredNumber(PID_DERIVATIVE_GAIN_STORAGE_KEY, DEFAULT_PID_DERIVATIVE_GAIN),
    0,
    1,
  ),
  dampedRefitBlend: clamp(
    readStoredNumber(DAMPED_REFIT_BLEND_STORAGE_KEY, DEFAULT_DAMPED_REFIT_BLEND),
    0,
    1,
  ),
  momentumBlend: clamp(
    readStoredNumber(MOMENTUM_BLEND_STORAGE_KEY, DEFAULT_MOMENTUM_BLEND),
    0,
    1,
  ),
  momentumDecay: clamp(
    readStoredNumber(MOMENTUM_DECAY_STORAGE_KEY, DEFAULT_MOMENTUM_DECAY),
    0,
    1,
  ),
  automationStopOnTolerance:
    localStorage.getItem(AUTOMATION_STOP_ON_TOLERANCE_STORAGE_KEY) === 'true'
      ? true
      : DEFAULT_AUTOMATION_STOP_ON_TOLERANCE,
  automationBandTolerances: readStoredAutomationBandTolerances(),
  automationToleranceMaxAcceptableErrorWidthHz: clamp(
    readStoredNumber(
      AUTOMATION_TOLERANCE_MAX_ACCEPTABLE_ERROR_WIDTH_STORAGE_KEY,
      DEFAULT_AUTOMATION_TOLERANCE_MAX_ACCEPTABLE_ERROR_WIDTH_HZ,
    ),
    0,
    5000,
  ),
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
  automationPassCount: 0,
  automationPidIntegralByBand: {},
  automationPidPreviousErrorByBand: {},
  automationMomentumByBand: {},
  apoSelectedMeasurementId: localStorage.getItem(APO_SELECTED_MEASUREMENT_STORAGE_KEY),
  apoSelectedReferenceId: localStorage.getItem(APO_SELECTED_REFERENCE_STORAGE_KEY),
  parametricApoMaxFilters: storedApoMaxFilterCounts.parametric,
  graphicApoMaxFilters: storedApoMaxFilterCounts.graphic,
  parametricApoImportedPreampDb: null,
  graphicApoImportedPreampDb: null,
  parametricApoImportedBlockRepeatCount: null,
  graphicApoImportedBlockRepeatCount: null,
  // These caps are fixed now that the UI setting is gone.
  apoMaxBoostDb: DEFAULT_APO_MAX_BOOST_DB,
  apoMaxCutDb: DEFAULT_APO_MAX_CUT_DB,
  nextApoFilterIndex: 1,
  apoFilterListPage: 1,
  apoFilterListPageSize: APO_FILTER_LIST_PAGE_SIZE,
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

if (state.parametricApoFilters.length === 0 && state.parametricApoMaxFilters > 0) {
  syncParametricFiltersToCount();
}

if (state.graphicApoFilters.length === 0 && state.graphicApoMaxFilters > 0) {
  syncGraphicEqFiltersToBandCount();
}

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

function getActiveImportedApoPreampDb(): number | null {
  return state.apoEqMode === 'graphic'
    ? state.graphicApoImportedPreampDb
    : state.parametricApoImportedPreampDb;
}

function setActiveImportedApoPreampDb(value: number | null): void {
  if (state.apoEqMode === 'graphic') {
    state.graphicApoImportedPreampDb = value;
    return;
  }

  state.parametricApoImportedPreampDb = value;
}

function clearActiveImportedApoPreamp(): void {
  setActiveImportedApoPreampDb(null);
}

function getActiveImportedApoBlockRepeatCount(): number | null {
  return state.apoEqMode === 'graphic'
    ? state.graphicApoImportedBlockRepeatCount
    : state.parametricApoImportedBlockRepeatCount;
}

function setActiveImportedApoBlockRepeatCount(value: number | null): void {
  if (state.apoEqMode === 'graphic') {
    state.graphicApoImportedBlockRepeatCount = value;
    return;
  }

  state.parametricApoImportedBlockRepeatCount = value;
}

function clearActiveImportedApoBlockRepeatCount(): void {
  setActiveImportedApoBlockRepeatCount(null);
}

function syncParametricApoFilterCountToFilters(): void {
  state.parametricApoMaxFilters = clamp(state.parametricApoFilters.length, 0, MAX_PARAMETRIC_APO_FILTERS);
}

function syncParametricFiltersToCount(): void {
  const targetCount = clamp(state.parametricApoMaxFilters, 0, MAX_PARAMETRIC_APO_FILTERS);
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
          q: getDefaultApoFilterQ('PK'),
          order: null,
          slopeDbPerOct: null,
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

apoConfigFileInput.addEventListener('change', () => {
  const file = apoConfigFileInput.files?.[0] ?? null;
  apoConfigFileInput.value = '';

  if (file) {
    void importEqProfile(file);
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
    event.key.toLowerCase() === 's' &&
    event.ctrlKey &&
    event.shiftKey &&
    !event.altKey &&
    !event.metaKey &&
    state.automationRunning
  ) {
    event.preventDefault();
    requestAutomationStop();
    return;
  }

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

dynamicProportionalPToggle.addEventListener('change', () => {
  syncAutomationSettings(true);
  updateAutomationUi();
});

pidProportionalGainInput.addEventListener('input', () => {
  syncAutomationSettings(false);
});

pidProportionalGainInput.addEventListener('blur', () => {
  syncAutomationSettings(true);
});

pidIntegralGainInput.addEventListener('input', () => {
  syncAutomationSettings(false);
});

pidIntegralGainInput.addEventListener('blur', () => {
  syncAutomationSettings(true);
});

pidDerivativeGainInput.addEventListener('input', () => {
  syncAutomationSettings(false);
});

pidDerivativeGainInput.addEventListener('blur', () => {
  syncAutomationSettings(true);
});

dampedRefitBlendInput.addEventListener('input', () => {
  syncAutomationSettings(false);
});

dampedRefitBlendInput.addEventListener('blur', () => {
  syncAutomationSettings(true);
});

momentumBlendInput.addEventListener('input', () => {
  syncAutomationSettings(false);
});

momentumBlendInput.addEventListener('blur', () => {
  syncAutomationSettings(true);
});

momentumDecayInput.addEventListener('input', () => {
  syncAutomationSettings(false);
});

momentumDecayInput.addEventListener('blur', () => {
  syncAutomationSettings(true);
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

automationToleranceMaxAcceptableErrorWidthInput.addEventListener('input', () => {
  syncAutomationSettings(false);
});

automationToleranceMaxAcceptableErrorWidthInput.addEventListener('blur', () => {
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

importApoConfigButton.addEventListener('click', () => {
  apoConfigFileInput.click();
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
    return;
  }

  const pageButton = target.closest<HTMLButtonElement>('[data-apo-filter-page]');
  const pageAction = pageButton?.dataset.apoFilterPage;

  if (pageAction && !state.busy) {
    if (pageAction === 'jump') {
      const pageInput = apoFilterList.querySelector<HTMLInputElement>('[data-apo-filter-page-input]');
      if (pageInput) {
        handleApoFilterPageJump(pageInput);
      }
    } else {
      handleApoFilterPageChange(pageAction);
    }
  }
});

apoFilterList.addEventListener('keydown', (event) => {
  const target = event.target;

  if (target instanceof HTMLSelectElement && target.dataset.apoFilterPageSize) {
    return;
  }

  // Handle page jump input Enter key
  if (target instanceof HTMLInputElement && target.dataset.apoFilterPageInput) {
    if (event.key === 'Enter' && !state.busy) {
      event.preventDefault();
      handleApoFilterPageJump(target);
    }
    return;
  }

  // Handle arrow key navigation for pagination
  if (state.busy) {
    return;
  }

  const activeApoFilters = getActiveApoFilters();
  const totalPages = Math.ceil(activeApoFilters.length / state.apoFilterListPageSize);

  if (totalPages <= 1) {
    return;
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    handleApoFilterPageChange('prev');
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    handleApoFilterPageChange('next');
  } else if (event.key === 'Home') {
    event.preventDefault();
    handleApoFilterPageChange('first');
  } else if (event.key === 'End') {
    event.preventDefault();
    handleApoFilterPageChange('last');
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
dynamicProportionalPToggle.checked = state.dynamicProportionalP;
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
  apoConfigFileInput.disabled = isBusy;
  measurementBackendSelect.disabled = isBusy;
  automationAlgorithmSelect.disabled = isBusy;
  automationDelayInput.disabled = isBusy;
  dynamicProportionalPToggle.disabled = isBusy;
  pidProportionalGainInput.disabled = isBusy;
  pidIntegralGainInput.disabled = isBusy;
  pidDerivativeGainInput.disabled = isBusy;
  dampedRefitBlendInput.disabled = isBusy;
  momentumBlendInput.disabled = isBusy;
  momentumDecayInput.disabled = isBusy;
  automationStopOnToleranceToggle.disabled = isBusy;
  automationRegressionLimitInput.disabled = isBusy;
  updateProportionalPControlState();
  updateAutomationToleranceFieldState();
  smoothingModeSelect.disabled = isBusy;
  generateApoFiltersButton.disabled = isBusy;
  addApoFilterButton.disabled = isBusy;
  clearApoFiltersButton.disabled = isBusy;
  importApoConfigButton.disabled = isBusy;
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
      : 'Run Automatic Calibration';
  generateApoFiltersButton.disabled =
    state.busy || !state.apoSelectedMeasurementId || !state.apoSelectedReferenceId;
  addApoFilterButton.disabled = state.busy || state.apoEqMode === 'graphic';
  clearApoFiltersButton.disabled = state.busy || getActiveApoFilters().length === 0;
  importApoConfigButton.disabled = state.busy;
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
  automationToleranceMaxAcceptableErrorWidthInput.disabled = toleranceFieldsDisabled;

  for (const input of Object.values(automationToleranceInputs)) {
    input.disabled = toleranceFieldsDisabled;
  }
}

function updateAutomationUi(): void {
  const isProportional = state.automationAlgorithm === 'proportional';
  const isPid = state.automationAlgorithm === 'pid';
  const isDampedRefit = state.automationAlgorithm === 'damped-refit';
  const isMomentum = state.automationAlgorithm === 'momentum';
  automationAlgorithmSelect.value = state.automationAlgorithm;
  automationDelayInput.value = state.automationDelaySeconds.toFixed(1);
  proportionalAutomationFields.hidden = !isProportional;
  pidAutomationFields.hidden = !isPid;
  dampedRefitAutomationFields.hidden = !isDampedRefit;
  momentumAutomationFields.hidden = !isMomentum;
  dynamicProportionalPToggle.checked = state.dynamicProportionalP;
  updateProportionalPControlState();
  pidProportionalGainInput.value = state.pidProportionalGain.toFixed(2);
  pidIntegralGainInput.value = state.pidIntegralGain.toFixed(2);
  pidDerivativeGainInput.value = state.pidDerivativeGain.toFixed(2);
  dampedRefitBlendInput.value = state.dampedRefitBlend.toFixed(2);
  momentumBlendInput.value = state.momentumBlend.toFixed(2);
  momentumDecayInput.value = state.momentumDecay.toFixed(2);
  automationStopOnToleranceToggle.checked = state.automationStopOnTolerance;
  automationToleranceMaxAcceptableErrorWidthInput.value = String(
    Math.round(state.automationToleranceMaxAcceptableErrorWidthHz),
  );
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
  state.pidProportionalGain = DEFAULT_PID_PROPORTIONAL_GAIN;
  state.pidIntegralGain = DEFAULT_PID_INTEGRAL_GAIN;
  state.pidDerivativeGain = DEFAULT_PID_DERIVATIVE_GAIN;
  state.dampedRefitBlend = DEFAULT_DAMPED_REFIT_BLEND;
  state.momentumBlend = DEFAULT_MOMENTUM_BLEND;
  state.momentumDecay = DEFAULT_MOMENTUM_DECAY;
  state.automationStopOnTolerance = DEFAULT_AUTOMATION_STOP_ON_TOLERANCE;
  state.automationBandTolerances = createDefaultAutomationBandTolerances();
  state.automationToleranceMaxAcceptableErrorWidthHz =
    DEFAULT_AUTOMATION_TOLERANCE_MAX_ACCEPTABLE_ERROR_WIDTH_HZ;
  state.automationRegressionLimit = DEFAULT_AUTOMATION_REGRESSION_LIMIT;
  state.latestAutomationToleranceStatus = null;
  state.automationPidIntegralByBand = {};
  state.automationPidPreviousErrorByBand = {};
  state.automationMomentumByBand = {};
  persistAutomationSettings();

  state.apoEqMode = DEFAULT_APO_EQ_MODE;
  state.parametricApoMaxFilters = DEFAULT_APO_MAX_FILTERS;
  state.graphicApoMaxFilters = DEFAULT_GRAPHIC_APO_MAX_FILTERS;
  state.parametricApoImportedPreampDb = null;
  state.graphicApoImportedPreampDb = null;
  state.parametricApoImportedBlockRepeatCount = null;
  state.graphicApoImportedBlockRepeatCount = null;
  state.parametricApoFilters = [];
  state.graphicApoFilters = [];
  state.nextApoFilterIndex = 1;
  syncParametricFiltersToCount();
  syncGraphicEqFiltersToBandCount();
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

async function runMeasurement(options?: {
  discardIf?: () => boolean;
}): Promise<LoadedMeasurement | null> {
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

    if (options?.discardIf?.()) {
      setStatus('Measurement stopped. Discarded the current sweep result.', 'idle');
      appendLog('Discarded the current sweep result because stop was requested.');
      return null;
    }

    setStatus('Processing response values...', 'working');
    appendLog('Captured raw PCM. Aligning the sweep and computing the response.');

    const analysis = analyzeMeasurement(capture, startFrequency, endFrequency);

    if (options?.discardIf?.()) {
      setStatus('Measurement stopped. Discarded the current sweep result.', 'idle');
      appendLog('Discarded the current sweep result because stop was requested.');
      return null;
    }

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

    if (options?.discardIf?.()) {
      await window.freakishEars.deleteMeasurementSession(saveResult.sessionDirectory);
      setStatus('Measurement stopped. Discarded the current sweep result.', 'idle');
      appendLog('Discarded the current sweep result because stop was requested.');
      return null;
    }

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
            maxAcceptableErrorWidthHz: state.automationToleranceMaxAcceptableErrorWidthHz,
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
    responseMultiplier: getActiveImportedApoBlockRepeatCount() ?? 1,
    preampDb: getAppliedApoPreampDb(),
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
    responseMultiplier: getActiveImportedApoBlockRepeatCount() ?? 1,
    preampDb: getAppliedApoPreampDb(),
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
    applyImportedConfiguration(persistedConfig, { persist: false });
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
    pidProportionalGain: state.pidProportionalGain,
    pidIntegralGain: state.pidIntegralGain,
    pidDerivativeGain: state.pidDerivativeGain,
    dampedRefitBlend: state.dampedRefitBlend,
    momentumBlend: state.momentumBlend,
    momentumDecay: state.momentumDecay,
    automationStopOnTolerance: state.automationStopOnTolerance,
    automationBandTolerances: state.automationBandTolerances,
    automationToleranceMaxAcceptableErrorWidthHz: state.automationToleranceMaxAcceptableErrorWidthHz,
    automationRegressionLimit: state.automationRegressionLimit,
    apoFilterListPageSize: state.apoFilterListPageSize,
    apoSelectedMeasurementId: state.apoSelectedMeasurementId,
    apoSelectedReferenceId: state.apoSelectedReferenceId,
    parametricApoMaxFilters: state.parametricApoMaxFilters,
    graphicApoMaxFilters: state.graphicApoMaxFilters,
    parametricApoImportedPreampDb: state.parametricApoImportedPreampDb,
    graphicApoImportedPreampDb: state.graphicApoImportedPreampDb,
    parametricApoImportedBlockRepeatCount: state.parametricApoImportedBlockRepeatCount,
    graphicApoImportedBlockRepeatCount: state.graphicApoImportedBlockRepeatCount,
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
      smoothingMode: getSelectedSmoothingMode(),
      normalizePlot: normalizePlotToggle.checked,
      automationAlgorithm: state.automationAlgorithm,
      automationDelaySeconds: state.automationDelaySeconds,
      proportionalP: state.proportionalP,
      dynamicProportionalP: state.dynamicProportionalP,
      pidProportionalGain: state.pidProportionalGain,
      pidIntegralGain: state.pidIntegralGain,
      pidDerivativeGain: state.pidDerivativeGain,
      dampedRefitBlend: state.dampedRefitBlend,
      momentumBlend: state.momentumBlend,
      momentumDecay: state.momentumDecay,
      automationStopOnTolerance: state.automationStopOnTolerance,
      automationBandTolerances: state.automationBandTolerances,
      automationToleranceMaxAcceptableErrorWidthHz: state.automationToleranceMaxAcceptableErrorWidthHz,
      automationRegressionLimit: state.automationRegressionLimit,
      apoFilterListPageSize: state.apoFilterListPageSize,
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
    applyImportedConfiguration(parsed, {
      persist: true,
      includeApoState: false,
    });

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

type ImportedConfigurationOptions = {
  persist?: boolean;
  includeMeasurementSweepSettings?: boolean;
  includeApoState?: boolean;
};

function applyImportedConfiguration(
  config: Record<string, unknown>,
  options: ImportedConfigurationOptions = {},
): void {
  const persist = options.persist ?? true;
  const includeMeasurementSweepSettings = options.includeMeasurementSweepSettings ?? true;
  const includeApoState = options.includeApoState ?? true;
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

  if (includeMeasurementSweepSettings) {
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
  }

  smoothingModeSelect.value = isSmoothingMode(String(config.smoothingMode ?? ''))
    ? String(config.smoothingMode)
    : DEFAULT_SMOOTHING_MODE;
  state.smoothingMode = getSelectedSmoothingMode();
  localStorage.setItem(SMOOTHING_MODE_STORAGE_KEY, state.smoothingMode);

  state.normalizePlot = typeof config.normalizePlot === 'boolean' ? config.normalizePlot : true;
  normalizePlotToggle.checked = state.normalizePlot;
  localStorage.setItem(NORMALIZE_PLOT_STORAGE_KEY, String(state.normalizePlot));

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
  state.pidProportionalGain = clamp(
    Number.isFinite(Number(config.pidProportionalGain))
      ? Number(config.pidProportionalGain)
      : DEFAULT_PID_PROPORTIONAL_GAIN,
    0,
    1,
  );
  state.pidIntegralGain = clamp(
    Number.isFinite(Number(config.pidIntegralGain))
      ? Number(config.pidIntegralGain)
      : DEFAULT_PID_INTEGRAL_GAIN,
    0,
    1,
  );
  state.pidDerivativeGain = clamp(
    Number.isFinite(Number(config.pidDerivativeGain))
      ? Number(config.pidDerivativeGain)
      : DEFAULT_PID_DERIVATIVE_GAIN,
    0,
    1,
  );
  state.dampedRefitBlend = clamp(
    Number.isFinite(Number(config.dampedRefitBlend))
      ? Number(config.dampedRefitBlend)
      : DEFAULT_DAMPED_REFIT_BLEND,
    0,
    1,
  );
  state.momentumBlend = clamp(
    Number.isFinite(Number(config.momentumBlend))
      ? Number(config.momentumBlend)
      : DEFAULT_MOMENTUM_BLEND,
    0,
    1,
  );
  state.momentumDecay = clamp(
    Number.isFinite(Number(config.momentumDecay))
      ? Number(config.momentumDecay)
      : DEFAULT_MOMENTUM_DECAY,
    0,
    1,
  );
  state.automationStopOnTolerance =
    typeof config.automationStopOnTolerance === 'boolean'
      ? config.automationStopOnTolerance
      : DEFAULT_AUTOMATION_STOP_ON_TOLERANCE;
  state.automationBandTolerances = normalizeAutomationBandTolerances(
    config.automationBandTolerances,
  );
  state.automationToleranceMaxAcceptableErrorWidthHz = clamp(
    Number.isFinite(Number(config.automationToleranceMaxAcceptableErrorWidthHz))
      ? Number(config.automationToleranceMaxAcceptableErrorWidthHz)
      : DEFAULT_AUTOMATION_TOLERANCE_MAX_ACCEPTABLE_ERROR_WIDTH_HZ,
    0,
    5000,
  );
  state.automationRegressionLimit = clamp(
    Number.isFinite(Number(config.automationRegressionLimit))
      ? Number(config.automationRegressionLimit)
      : DEFAULT_AUTOMATION_REGRESSION_LIMIT,
    0,
    20,
  );
  state.apoFilterListPageSize = clamp(
    Number.isFinite(Number(config.apoFilterListPageSize))
      ? Math.round(Number(config.apoFilterListPageSize))
      : state.apoFilterListPageSize,
    1,
    MAX_GRAPHIC_APO_FILTERS,
  );
  state.apoFilterListPage = 1;
  state.automationPidIntegralByBand = {};
  state.automationPidPreviousErrorByBand = {};
  state.automationMomentumByBand = {};
  if (includeApoState) {
    const hasImportedApoEqMode = hasOwnConfigProperty(config, 'apoEqMode');
    const hasImportedParametricApoFilters =
      hasOwnConfigProperty(config, 'parametricApoFilters') || hasOwnConfigProperty(config, 'parametric');
    const hasImportedGraphicApoFilters =
      hasOwnConfigProperty(config, 'graphicApoFilters') || hasOwnConfigProperty(config, 'graphic');
    const hasImportedParametricApoMaxFilters = hasOwnConfigProperty(config, 'parametricApoMaxFilters');
    const hasImportedGraphicApoMaxFilters = hasOwnConfigProperty(config, 'graphicApoMaxFilters');
    const hasImportedApoSelectedMeasurementId = hasOwnConfigProperty(config, 'apoSelectedMeasurementId');
    const hasImportedApoSelectedReferenceId = hasOwnConfigProperty(config, 'apoSelectedReferenceId');
    const hasImportedParametricApoPreampDb = hasOwnConfigProperty(config, 'parametricApoImportedPreampDb');
    const hasImportedGraphicApoPreampDb = hasOwnConfigProperty(config, 'graphicApoImportedPreampDb');
    const hasImportedParametricApoBlockRepeatCount = hasOwnConfigProperty(
      config,
      'parametricApoImportedBlockRepeatCount',
    );
    const hasImportedGraphicApoBlockRepeatCount = hasOwnConfigProperty(
      config,
      'graphicApoImportedBlockRepeatCount',
    );

    if (hasImportedApoEqMode && isApoEqMode(config.apoEqMode)) {
      state.apoEqMode = config.apoEqMode;
    }

    const importedApoFilters = normalizeImportedApoFilterSets(config, state.apoEqMode);
    if (hasImportedParametricApoFilters) {
      state.parametricApoFilters = importedApoFilters.parametric;
    }
    if (hasImportedGraphicApoFilters) {
      state.graphicApoFilters = importedApoFilters.graphic;
    }
    if (hasImportedApoSelectedMeasurementId) {
      state.apoSelectedMeasurementId = toOptionalString(config.apoSelectedMeasurementId);
    }
    if (hasImportedApoSelectedReferenceId) {
      state.apoSelectedReferenceId = toOptionalString(config.apoSelectedReferenceId);
    }
    const importedApoMaxFilters = normalizeImportedApoMaxFilterCounts(config);
    if (hasImportedParametricApoMaxFilters) {
      state.parametricApoMaxFilters = importedApoMaxFilters.parametric;
    }
    if (hasImportedGraphicApoMaxFilters) {
      state.graphicApoMaxFilters = importedApoMaxFilters.graphic;
    }
    if (hasImportedParametricApoPreampDb) {
      state.parametricApoImportedPreampDb = normalizeImportedApoPreamp(config.parametricApoImportedPreampDb);
    }
    if (hasImportedGraphicApoPreampDb) {
      state.graphicApoImportedPreampDb = normalizeImportedApoPreamp(config.graphicApoImportedPreampDb);
    }
    if (hasImportedParametricApoBlockRepeatCount) {
      state.parametricApoImportedBlockRepeatCount = normalizeImportedApoBlockRepeatCount(config.parametricApoImportedBlockRepeatCount);
    }
    if (hasImportedGraphicApoBlockRepeatCount) {
      state.graphicApoImportedBlockRepeatCount = normalizeImportedApoBlockRepeatCount(config.graphicApoImportedBlockRepeatCount);
    }
    if (
      (hasImportedParametricApoFilters || hasImportedParametricApoMaxFilters) &&
      (state.parametricApoFilters.length > 0 || state.parametricApoMaxFilters === 0)
    ) {
      syncParametricApoFilterCountToFilters();
    }
  }
  state.apoMaxBoostDb = DEFAULT_APO_MAX_BOOST_DB;
  state.apoMaxCutDb = DEFAULT_APO_MAX_CUT_DB;
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
  proportionalPInput.value = state.proportionalP.toFixed(2);
  dynamicProportionalPToggle.checked = state.dynamicProportionalP;
  pidProportionalGainInput.value = state.pidProportionalGain.toFixed(2);
  pidIntegralGainInput.value = state.pidIntegralGain.toFixed(2);
  pidDerivativeGainInput.value = state.pidDerivativeGain.toFixed(2);
  dampedRefitBlendInput.value = state.dampedRefitBlend.toFixed(2);
  momentumBlendInput.value = state.momentumBlend.toFixed(2);
  momentumDecayInput.value = state.momentumDecay.toFixed(2);
  automationStopOnToleranceToggle.checked = state.automationStopOnTolerance;
  automationToleranceMaxAcceptableErrorWidthInput.value = String(
    Math.round(state.automationToleranceMaxAcceptableErrorWidthHz),
  );
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

function hasOwnConfigProperty(config: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(config, key);
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
  return isAutomationAlgorithm(automationAlgorithmSelect.value)
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
        parametric: clamp(DEFAULT_APO_MAX_FILTERS, 0, MAX_PARAMETRIC_APO_FILTERS),
        graphic: clamp(DEFAULT_GRAPHIC_APO_MAX_FILTERS, 1, MAX_GRAPHIC_APO_FILTERS),
      };
  }

  try {
    return normalizeImportedApoMaxFilterCounts(JSON.parse(stored));
  } catch {
    const legacyValue = readStoredNumber(APO_MAX_FILTERS_STORAGE_KEY, DEFAULT_APO_MAX_FILTERS);
    return {
      parametric: clamp(legacyValue, 0, MAX_PARAMETRIC_APO_FILTERS),
      graphic: clamp(legacyValue, 1, MAX_GRAPHIC_APO_FILTERS),
    };
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
    const kind = isApoFilterKind(record.kind) ? record.kind : 'PK';
    const frequencyHz = clamp(Number(record.frequencyHz), 20, 20000);
    const gainDb = clamp(Number(record.gainDb), -24, 24);
    const defaultQ = getDefaultApoFilterQ(kind);
    const q = clamp(Number(record.q) || defaultQ, 0.1, 10);
    const order = normalizeApoFilterOrder(record.order, kind);
    const slopeDbPerOct = normalizeApoFilterSlopeDbPerOct(record.slopeDbPerOct, kind);

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
          kind,
          frequencyHz,
          gainDb,
          q,
          order,
          slopeDbPerOct,
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
    const legacyValue = Number(value) || DEFAULT_APO_MAX_FILTERS;
    return {
      parametric: clamp(legacyValue, 0, MAX_PARAMETRIC_APO_FILTERS),
      graphic: clamp(legacyValue, 1, MAX_GRAPHIC_APO_FILTERS),
    };
  }

  if (!value || typeof value !== 'object') {
      return {
      parametric: clamp(DEFAULT_APO_MAX_FILTERS, 0, MAX_PARAMETRIC_APO_FILTERS),
      graphic: clamp(DEFAULT_GRAPHIC_APO_MAX_FILTERS, 1, MAX_GRAPHIC_APO_FILTERS),
    };
  }

  const record = value as Record<string, unknown>;
  return {
      parametric: clamp(Number(record.parametricApoMaxFilters) || DEFAULT_APO_MAX_FILTERS, 0, MAX_PARAMETRIC_APO_FILTERS),
      graphic: clamp(Number(record.graphicApoMaxFilters) || DEFAULT_GRAPHIC_APO_MAX_FILTERS, 1, MAX_GRAPHIC_APO_FILTERS),
  };
}

function normalizeImportedApoPreamp(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, -60, 20) : null;
}

function normalizeImportedApoBlockRepeatCount(value: unknown): number | null {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? clamp(parsed, 1, 8) : null;
}

function isApoEqMode(value: unknown): value is ApoEqMode {
  return value === 'parametric' || value === 'graphic';
}

function isAutomationAlgorithm(value: unknown): value is AutomationAlgorithm {
  return (
    value === 'proportional' ||
    value === 'pid' ||
    value === 'damped-refit' ||
    value === 'momentum'
  );
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
    PID_PROPORTIONAL_GAIN_STORAGE_KEY,
    String(state.pidProportionalGain),
  );
  localStorage.setItem(
    PID_INTEGRAL_GAIN_STORAGE_KEY,
    String(state.pidIntegralGain),
  );
  localStorage.setItem(
    PID_DERIVATIVE_GAIN_STORAGE_KEY,
    String(state.pidDerivativeGain),
  );
  localStorage.setItem(
    DAMPED_REFIT_BLEND_STORAGE_KEY,
    String(state.dampedRefitBlend),
  );
  localStorage.setItem(
    MOMENTUM_BLEND_STORAGE_KEY,
    String(state.momentumBlend),
  );
  localStorage.setItem(
    MOMENTUM_DECAY_STORAGE_KEY,
    String(state.momentumDecay),
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
    AUTOMATION_TOLERANCE_MAX_ACCEPTABLE_ERROR_WIDTH_STORAGE_KEY,
    String(state.automationToleranceMaxAcceptableErrorWidthHz),
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
  clearActiveImportedApoPreamp();
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
    setActiveApoMaxFilters(
      clamp(
        Math.round(parsedMaxFilters),
        minimumFilters,
        state.apoEqMode === 'graphic' ? MAX_GRAPHIC_APO_FILTERS : MAX_PARAMETRIC_APO_FILTERS,
      ),
    );
  }

  if (normalize) {
    apoMaxFiltersInput.value = String(getActiveApoMaxFilters());
  }

  if (state.apoEqMode === 'graphic') {
    clearActiveImportedApoPreamp();
    clearActiveImportedApoBlockRepeatCount();
    syncGraphicEqFiltersToBandCount();
  } else {
    clearActiveImportedApoPreamp();
    clearActiveImportedApoBlockRepeatCount();
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
  const parsedPidProportionalGain = Number(pidProportionalGainInput.value);
  const parsedPidIntegralGain = Number(pidIntegralGainInput.value);
  const parsedPidDerivativeGain = Number(pidDerivativeGainInput.value);
  const parsedDampedRefitBlend = Number(dampedRefitBlendInput.value);
  const parsedMomentumBlend = Number(momentumBlendInput.value);
  const parsedMomentumDecay = Number(momentumDecayInput.value);
  const parsedMaxAcceptableErrorWidthHz = Number(
    automationToleranceMaxAcceptableErrorWidthInput.value,
  );
  const parsedRegressionLimit = Number(automationRegressionLimitInput.value);
  const nextDynamicProportionalP = dynamicProportionalPToggle.checked;

  if (Number.isFinite(parsedDelaySeconds)) {
    state.automationDelaySeconds = clamp(parsedDelaySeconds, 0, 3600);
  }

  if (!previousDynamicProportionalP && !nextDynamicProportionalP && Number.isFinite(parsedProportionalP)) {
    state.proportionalP = clamp(parsedProportionalP, 0, 1);
  }

  state.dynamicProportionalP = dynamicProportionalPToggle.checked;

  if (Number.isFinite(parsedPidProportionalGain)) {
    state.pidProportionalGain = clamp(parsedPidProportionalGain, 0, 1);
  }

  if (Number.isFinite(parsedPidIntegralGain)) {
    state.pidIntegralGain = clamp(parsedPidIntegralGain, 0, 1);
  }

  if (Number.isFinite(parsedPidDerivativeGain)) {
    state.pidDerivativeGain = clamp(parsedPidDerivativeGain, 0, 1);
  }

  if (Number.isFinite(parsedDampedRefitBlend)) {
    state.dampedRefitBlend = clamp(parsedDampedRefitBlend, 0, 1);
  }

  if (Number.isFinite(parsedMomentumBlend)) {
    state.momentumBlend = clamp(parsedMomentumBlend, 0, 1);
  }

  if (Number.isFinite(parsedMomentumDecay)) {
    state.momentumDecay = clamp(parsedMomentumDecay, 0, 1);
  }

  if (Number.isFinite(parsedMaxAcceptableErrorWidthHz)) {
    state.automationToleranceMaxAcceptableErrorWidthHz = clamp(
      Math.round(parsedMaxAcceptableErrorWidthHz),
      0,
      5000,
    );
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
    pidProportionalGainInput.value = state.pidProportionalGain.toFixed(2);
    pidIntegralGainInput.value = state.pidIntegralGain.toFixed(2);
    pidDerivativeGainInput.value = state.pidDerivativeGain.toFixed(2);
    dampedRefitBlendInput.value = state.dampedRefitBlend.toFixed(2);
    momentumBlendInput.value = state.momentumBlend.toFixed(2);
    momentumDecayInput.value = state.momentumDecay.toFixed(2);
    automationStopOnToleranceToggle.checked = state.automationStopOnTolerance;
    automationToleranceMaxAcceptableErrorWidthInput.value = String(
      Math.round(state.automationToleranceMaxAcceptableErrorWidthHz),
    );
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
  apoMaxFiltersInput.max = String(
    state.apoEqMode === 'graphic' ? MAX_GRAPHIC_APO_FILTERS : MAX_PARAMETRIC_APO_FILTERS,
  );
  apoMaxFiltersInput.value = String(getActiveApoMaxFilters());
  syncApoSelectionOptions();

  // Normalize page number to ensure it's within valid bounds
  const activeApoFilters = getActiveApoFilters();
  const totalPages = Math.ceil(activeApoFilters.length / state.apoFilterListPageSize);
  if (totalPages > 0) {
    state.apoFilterListPage = Math.max(1, Math.min(state.apoFilterListPage, totalPages));
  } else {
    state.apoFilterListPage = 1;
  }

  apoFilterList.innerHTML = renderApoFilterList();
  const apoFilterPageSizeSelect = apoFilterList.querySelector<HTMLSelectElement>('[data-apo-filter-page-size]');
  if (apoFilterPageSizeSelect) {
    apoFilterPageSizeSelect.addEventListener('change', () => {
      if (state.busy) {
        return;
      }

      handleApoFilterPageSizeChange(apoFilterPageSizeSelect);
    });
  }
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

  const totalPages = Math.ceil(sortedFilters.length / state.apoFilterListPageSize);
  const currentPage = Math.max(1, Math.min(state.apoFilterListPage, totalPages));
  const startIndex = (currentPage - 1) * state.apoFilterListPageSize;
  const endIndex = Math.min(startIndex + state.apoFilterListPageSize, sortedFilters.length);
  const pagedFilters = sortedFilters.slice(startIndex, endIndex);

  const filterRows = pagedFilters
    .map(
      (filter, index) => `
        <div class="apo-filter-row${filter.enabled ? '' : ' is-hidden'}">
          <label class="apo-filter-enabled">
            <input type="checkbox" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="enabled" ${filter.enabled ? 'checked' : ''} ${state.busy ? 'disabled' : ''} />
            <span>F${startIndex + index + 1}</span>
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
          ${renderApoFilterShapeInput(filter)}
          <button class="btn btn-secondary measurement-remove-button" type="button" data-apo-filter-remove="${escapeHtml(filter.id)}" ${(state.busy || state.apoEqMode === 'graphic') ? 'disabled' : ''}>Remove</button>
        </div>
      `,
    )
    .join('');

  if (totalPages <= 1) {
    return filterRows;
  }

  const paginationControls = renderApoFilterPagination(currentPage, totalPages);
  return `${filterRows}${paginationControls}`;
}

function renderApoFilterPagination(currentPage: number, totalPages: number): string {
  const prevDisabled = currentPage <= 1 || state.busy ? 'disabled' : '';
  const nextDisabled = currentPage >= totalPages || state.busy ? 'disabled' : '';
  const jumpDisabled = state.busy ? 'disabled' : '';

  const visiblePageButtonCount = getApoPaginationVisiblePageButtonCount(totalPages);
  const pages = buildCompactPagination(currentPage, totalPages, visiblePageButtonCount);

  // Generate page buttons
  const pageButtons = pages.map((page) => {
    if (page === '...') {
      return `<span class="apo-filter-pagination-ellipsis">…</span>`;
    }
    const pageNum = page as number;
    const isActive = pageNum === currentPage;
    const activeClass = isActive ? ' btn-primary' : ' btn-secondary';
    const disabledAttr = isActive || state.busy ? 'disabled' : '';
    return `<button class="btn${activeClass} btn-small" type="button" data-apo-filter-page="${pageNum}" ${disabledAttr}>${pageNum}</button>`;
  }).join('');

  return `
    <div class="apo-filter-pagination">
      <div class="apo-filter-pagination-nav">
        <button class="btn btn-secondary btn-small" type="button" data-apo-filter-page="first" ${jumpDisabled} title="First page">⏮</button>
        <button class="btn btn-secondary btn-small" type="button" data-apo-filter-page="prev" ${prevDisabled} title="Previous page">←</button>
        <div class="apo-filter-page-buttons">${pageButtons}</div>
        <button class="btn btn-secondary btn-small" type="button" data-apo-filter-page="next" ${nextDisabled} title="Next page">→</button>
        <button class="btn btn-secondary btn-small" type="button" data-apo-filter-page="last" ${jumpDisabled} title="Last page">⏭</button>
      </div>
      <div class="apo-filter-pagination-jump">
        <span class="apo-filter-page-info">${currentPage} / ${totalPages}</span>
        <label class="apo-filter-page-size-label">
          <span>Per page</span>
          <select class="apo-filter-page-size-select" data-apo-filter-page-size ${jumpDisabled}>
            ${[12, 24, 48, 96]
              .map(
                (pageSize) =>
                  `<option value="${pageSize}" ${pageSize === state.apoFilterListPageSize ? 'selected' : ''}>${pageSize}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="apo-filter-page-jump-label">
          <span>Jump</span>
        </label>
        <input type="number" min="1" max="${totalPages}" value="" placeholder="#" class="apo-filter-page-input" data-apo-filter-page-input ${jumpDisabled} />
        <button class="btn btn-secondary btn-small" type="button" data-apo-filter-page="jump" ${jumpDisabled}>Go</button>
      </div>
    </div>
  `;
}

function getApoPaginationVisiblePageButtonCount(totalPages: number): number {
  const containerWidth = Math.max(apoFilterList.clientWidth, apoCard.clientWidth, 0);
  const pageDigits = String(totalPages).length;
  const navButtonWidthPx = 40;
  const ellipsisWidthPx = 32;
  const pageButtonWidthPx = 30 + pageDigits * 8;
  const gapWidthPx = 4;
  const jumpInfoWidthPx = 54;
  const pageSizeLabelWidthPx = 116;
  const pageInputWidthPx = 50;
  const goButtonWidthPx = 40;
  const reservedWidthPx =
    navButtonWidthPx * 4 +
    gapWidthPx * 8 +
    ellipsisWidthPx +
    jumpInfoWidthPx +
    pageSizeLabelWidthPx +
    pageInputWidthPx +
    goButtonWidthPx;
  const availableWidthPx = Math.max(containerWidth - reservedWidthPx, pageButtonWidthPx * 3);
  const measuredCount = Math.floor((availableWidthPx + gapWidthPx) / (pageButtonWidthPx + gapWidthPx));

  return clamp(measuredCount, 3, totalPages);
}

function buildCompactPagination(
  currentPage: number,
  totalPages: number,
  maxSlots: number,
): Array<string | number> {
  if (totalPages <= maxSlots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const windowStart = clamp(
    currentPage - Math.floor(maxSlots / 2),
    1,
    totalPages - maxSlots + 1,
  );
  const windowEnd = windowStart + maxSlots - 1;
  const windowPages = Array.from({ length: maxSlots }, (_unused, index) => windowStart + index);

  if (windowStart === 1) {
    return [...windowPages, '...'];
  }

  if (windowEnd === totalPages) {
    return ['...', ...windowPages];
  }

  const midpoint = (totalPages + 1) / 2;
  return currentPage <= midpoint ? [...windowPages, '...'] : ['...', ...windowPages];
}

function renderApoFilterShapeInput(filter: ApoFilter): string {
  if (state.apoEqMode === 'graphic' || !apoFilterKindUsesShape(filter.kind)) {
    return `<input class="apo-filter-shape" type="number" value="" placeholder="-" disabled />`;
  }

  const disabledAttribute = state.busy ? 'disabled' : '';

  if (apoFilterKindUsesOrder(filter.kind)) {
    return `<input class="apo-filter-shape" type="number" min="${filter.kind === 'LPBW' || filter.kind === 'HPBW' ? '2' : '4'}" max="20" step="2" value="${String(normalizeApoFilterOrder(filter.order, filter.kind) ?? getDefaultApoFilterOrder(filter.kind) ?? 4)}" title="${escapeHtml(getApoFilterShapeLabel(filter.kind))}" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="shapeValue" ${disabledAttribute} />`;
  }

  if (apoFilterKindUsesSlopeDb(filter.kind)) {
    return `<input class="apo-filter-shape" type="number" min="0.1" max="60" step="0.1" value="${(normalizeApoFilterSlopeDbPerOct(filter.slopeDbPerOct, filter.kind) ?? getDefaultApoFilterSlopeDbPerOct(filter.kind) ?? 6).toFixed(1)}" title="${escapeHtml(getApoFilterShapeLabel(filter.kind))}" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="shapeValue" ${disabledAttribute} />`;
  }

  return `<input class="apo-filter-shape" type="number" min="0.1" max="10" step="0.05" value="${filter.q.toFixed(2)}" title="${escapeHtml(getApoFilterShapeLabel(filter.kind))}" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="shapeValue" ${disabledAttribute} />`;
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
      q: partial.q ?? getDefaultApoFilterQ('PK'),
      order: partial.order ?? null,
      slopeDbPerOct: partial.slopeDbPerOct ?? null,
    },
  ]);
  clearActiveImportedApoPreamp();
  clearActiveImportedApoBlockRepeatCount();
  syncParametricApoFilterCountToFilters();
  state.nextApoFilterIndex += 1;
  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
}

function handleApoFilterPageChange(action: string): void {
  const activeApoFilters = getActiveApoFilters();
  const totalPages = Math.ceil(activeApoFilters.length / state.apoFilterListPageSize);

  let newPage = state.apoFilterListPage;

  if (action === 'first') {
    newPage = 1;
  } else if (action === 'last') {
    newPage = totalPages;
  } else if (action === 'prev') {
    newPage = Math.max(1, state.apoFilterListPage - 1);
  } else if (action === 'next') {
    newPage = Math.min(totalPages, state.apoFilterListPage + 1);
  } else if (action === 'jump') {
    // Handled separately via the input field
    return;
  } else {
    const parsedPage = Number(action);
    if (Number.isFinite(parsedPage)) {
      newPage = Math.max(1, Math.min(totalPages, parsedPage));
    }
  }

  if (newPage !== state.apoFilterListPage) {
    state.apoFilterListPage = newPage;
    renderApoSection();
  }
}

function handleApoFilterPageJump(input: HTMLInputElement): void {
  const activeApoFilters = getActiveApoFilters();
  const totalPages = Math.ceil(activeApoFilters.length / state.apoFilterListPageSize);

  const parsedPage = Number(input.value);
  if (!Number.isFinite(parsedPage)) {
    return;
  }

  const newPage = Math.max(1, Math.min(totalPages, Math.round(parsedPage)));

  if (newPage !== state.apoFilterListPage) {
    state.apoFilterListPage = newPage;
    renderApoSection();
  }
}

function handleApoFilterPageSizeChange(input: HTMLSelectElement): void {
  const parsedPageSize = Number(input.value);
  if (!Number.isFinite(parsedPageSize)) {
    return;
  }

  state.apoFilterListPageSize = clamp(Math.round(parsedPageSize), 1, MAX_GRAPHIC_APO_FILTERS);
  state.apoFilterListPage = 1;
  renderApoSection();
}

function findNextParametricFilterFrequency(filters: ApoFilter[] = getActiveApoFilters()): number {
  const sortedFrequencies = filters
    .map((filter) => clamp(filter.frequencyHz, DEFAULT_START_FREQUENCY, DEFAULT_END_FREQUENCY))
    .sort((left, right) => left - right);

  if (sortedFrequencies.length === 0) {
    return roundTo(Math.sqrt(DEFAULT_START_FREQUENCY * DEFAULT_END_FREQUENCY), 0.1);
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
  clearActiveImportedApoPreamp();
  clearActiveImportedApoBlockRepeatCount();
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
  clearActiveImportedApoPreamp();
  clearActiveImportedApoBlockRepeatCount();
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
      const nextKind = value;
      return {
        ...filter,
        kind: nextKind,
        gainDb: apoFilterKindUsesGain(nextKind) ? filter.gainDb : 0,
        q: apoFilterKindUsesQ(nextKind) ? filter.q || getDefaultApoFilterQ(nextKind) : getDefaultApoFilterQ(nextKind),
        order: normalizeApoFilterOrder(filter.order, nextKind),
        slopeDbPerOct: normalizeApoFilterSlopeDbPerOct(filter.slopeDbPerOct, nextKind),
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

    if (field === 'shapeValue') {
      if (state.apoEqMode === 'graphic') {
        return filter;
      }

      if (apoFilterKindUsesOrder(filter.kind)) {
        return {
          ...filter,
          order: normalizeApoFilterOrder(value, filter.kind),
        };
      }

      if (apoFilterKindUsesSlopeDb(filter.kind)) {
        return {
          ...filter,
          slopeDbPerOct: normalizeApoFilterSlopeDbPerOct(value, filter.kind),
        };
      }

      if (apoFilterKindUsesQ(filter.kind)) {
        const q = clamp(Number(value), 0.1, 10);
        return Number.isFinite(q) ? { ...filter, q } : filter;
      }

      return filter;
    }

    return filter;
  }));

  clearActiveImportedApoPreamp();
  clearActiveImportedApoBlockRepeatCount();
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

    if (
      useAutomationAlgorithm &&
      state.automationAlgorithm === 'proportional' &&
      state.dynamicProportionalP
    ) {
      const dynamicProportionalP = getCurrentAutomationProportionalP(measurement, referenceCurve);
      appendLog(
        `Dynamic P selected ${(dynamicProportionalP ?? state.proportionalP).toFixed(2)} for automation pass ${state.automationPassCount + 1}.`,
      );
    }

    const generatedFilters = useAutomationAlgorithm
      ? buildFiltersForSelectedAlgorithm(measurement, referenceCurve)
      : buildApoFiltersFromCurves(measurement, referenceCurve);
    setActiveApoFilters(generatedFilters);
    clearActiveImportedApoPreamp();
    clearActiveImportedApoBlockRepeatCount();
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

  if (state.automationAlgorithm === 'pid') {
    return buildPidApoFilters(measurement, referenceCurve);
  }

  if (state.automationAlgorithm === 'damped-refit') {
    return buildDampedRefitApoFilters(measurement, referenceCurve);
  }

  if (state.automationAlgorithm === 'momentum') {
    return buildMomentumApoFilters(measurement, referenceCurve);
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
  const baseFilters = getAutomationGraphicEqBaseFilters();

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

function buildPidApoFilters(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
): ApoFilter[] {
  if (state.apoEqMode !== 'graphic') {
    return buildApoFiltersFromCurves(measurement, referenceCurve);
  }

  const measurementPoints = getAutomationMeasurementPoints(measurement, referenceCurve);
  const referencePoints = getDisplayedReferencePoints(referenceCurve);
  const baseFilters = getAutomationGraphicEqBaseFilters();
  const nextIntegralByBand: Record<string, number> = {};
  const nextPreviousErrorByBand: Record<string, number> = {};

  const nextFilters = baseFilters.map((filter) => {
    const bandKey = getAutomationPidBandKey(filter.frequencyHz);
    const measurementPoint = findClosestPoint(measurementPoints, filter.frequencyHz);
    const referencePoint = findClosestPoint(referencePoints, filter.frequencyHz);
    const errorDb =
      referencePoint.smoothedMagnitudeDbRelative - measurementPoint.smoothedMagnitudeDbRelative;
    const integralErrorDb = clamp(
      (state.automationPidIntegralByBand[bandKey] ?? 0) + errorDb,
      -PID_INTEGRAL_ERROR_LIMIT_DB,
      PID_INTEGRAL_ERROR_LIMIT_DB,
    );
    const previousErrorDb = state.automationPidPreviousErrorByBand[bandKey];
    const derivativeErrorDb = previousErrorDb === undefined ? 0 : errorDb - previousErrorDb;
    const adjustmentDb =
      errorDb * state.pidProportionalGain +
      integralErrorDb * state.pidIntegralGain +
      derivativeErrorDb * state.pidDerivativeGain;

    nextIntegralByBand[bandKey] = integralErrorDb;
    nextPreviousErrorByBand[bandKey] = errorDb;

    return {
      ...filter,
      gainDb: roundTo(
        clamp(filter.gainDb + adjustmentDb, -state.apoMaxCutDb, state.apoMaxBoostDb),
        0.1,
      ),
    };
  });

  state.automationPidIntegralByBand = nextIntegralByBand;
  state.automationPidPreviousErrorByBand = nextPreviousErrorByBand;

  return nextFilters;
}

function buildDampedRefitApoFilters(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
): ApoFilter[] {
  if (state.apoEqMode !== 'graphic') {
    return buildApoFiltersFromCurves(measurement, referenceCurve);
  }

  const baseFilters = getAutomationGraphicEqBaseFilters();
  const refitFilters = buildGraphicEqFiltersFromCurves(measurement, referenceCurve);

  return baseFilters.map((filter, index) => {
    const targetFilter = refitFilters[index] ?? filter;
    const blendedGainDb = filter.gainDb + (targetFilter.gainDb - filter.gainDb) * state.dampedRefitBlend;

    return {
      ...filter,
      gainDb: roundTo(clamp(blendedGainDb, -state.apoMaxCutDb, state.apoMaxBoostDb), 0.1),
    };
  });
}

function buildMomentumApoFilters(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
): ApoFilter[] {
  if (state.apoEqMode !== 'graphic') {
    return buildApoFiltersFromCurves(measurement, referenceCurve);
  }

  const baseFilters = getAutomationGraphicEqBaseFilters();
  const refitFilters = buildGraphicEqFiltersFromCurves(measurement, referenceCurve);
  const nextMomentumByBand: Record<string, number> = {};

  const nextFilters = baseFilters.map((filter, index) => {
    const bandKey = getAutomationPidBandKey(filter.frequencyHz);
    const targetFilter = refitFilters[index] ?? filter;
    const targetDeltaDb = targetFilter.gainDb - filter.gainDb;
    const momentumDb =
      (state.automationMomentumByBand[bandKey] ?? 0) * state.momentumDecay +
      targetDeltaDb * state.momentumBlend;

    nextMomentumByBand[bandKey] = momentumDb;

    return {
      ...filter,
      gainDb: roundTo(
        clamp(filter.gainDb + momentumDb, -state.apoMaxCutDb, state.apoMaxBoostDb),
        0.1,
      ),
    };
  });

  state.automationMomentumByBand = nextMomentumByBand;

  return nextFilters;
}

function getAutomationGraphicEqBaseFilters(): ApoFilter[] {
  const filterCount = clamp(state.graphicApoMaxFilters, 1, MAX_GRAPHIC_APO_FILTERS);
  const expectedFrequencies = getGraphicEqFrequencies(filterCount);

  return state.graphicApoFilters.length === filterCount
    ? state.graphicApoFilters.map((filter, index) => ({
        ...filter,
        frequencyHz: expectedFrequencies[index] ?? filter.frequencyHz,
        q: roundTo(getGraphicEqQ(expectedFrequencies, index), 0.01),
      }))
    : buildGraphicEqFilters(filterCount);
}

function getAutomationPidBandKey(frequencyHz: number): string {
  return frequencyHz.toFixed(3);
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

  if (state.automationRunning && state.automationPassCount === 0) {
    return 1;
  }

  return getDynamicProportionalPForErrorScore(
    getAutomationErrorScoreDb(measurement, referenceCurve),
  );
}

function requestAutomationStop(): void {
  if (!state.automationRunning || state.automationStopRequested) {
    return;
  }

  state.automationStopRequested = true;
  updateAutomationUi();
  setStatus('Stopping automation after the current step...', 'working');
  appendLog('Automation stop requested. Waiting for the current step to finish.');
}

function getDynamicProportionalPForErrorScore(errorScoreDb: number): number {
  return clamp(errorScoreDb / DYNAMIC_PROPORTIONAL_P_FULL_SCALE_ERROR_DB, 0.01, 1);
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
  if (algorithm === 'pid') {
    return 'PID';
  }

  if (algorithm === 'damped-refit') {
    return 'damped refit';
  }

  if (algorithm === 'momentum') {
    return 'momentum';
  }

  return 'proportional';
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
      order: null,
      slopeDbPerOct: null,
    };

    filters.push(filter);

    for (let sampleIndex = 0; sampleIndex < samplePoints.length; sampleIndex += 1) {
      residuals[sampleIndex] -= getApoFilterResponseDbForCurrentSampleRate(filter, samplePoints[sampleIndex].frequencyHz);
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
  const filterCount = clamp(state.graphicApoMaxFilters, 1, MAX_GRAPHIC_APO_FILTERS);
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
      order: null,
      slopeDbPerOct: null,
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
  const overlappingBands = AUTOMATION_TOLERANCE_BANDS.map((band) => ({
    minimumFrequencyHz: Math.max(band.minimumFrequencyHz, overlapMinimumHz),
    maximumFrequencyHz: Math.min(band.maximumFrequencyHz, overlapMaximumHz),
    toleranceDb: state.automationBandTolerances[band.key],
  }));
  const failureSegments = getToleranceFailureSegments(
    measurementPoints,
    referencePoints,
    overlappingBands,
  );
  const bandSummaries: string[] = [];
  let satisfied = true;
  let totalAbsoluteErrorDb = 0;
  let scoredPointCount = 0;

  for (const [bandIndex, band] of AUTOMATION_TOLERANCE_BANDS.entries()) {
    const minimumHz = overlappingBands[bandIndex].minimumFrequencyHz;
    const maximumHz = overlappingBands[bandIndex].maximumFrequencyHz;

    if (maximumHz <= minimumHz) {
      continue;
    }

    const bandMeasurementPoints = measurementPoints.filter(
      (point) => point.frequencyHz >= minimumHz && point.frequencyHz <= maximumHz,
    );
    for (const measurementPoint of bandMeasurementPoints) {
      const referencePoint = findClosestPoint(referencePoints, measurementPoint.frequencyHz);
      const errorDb =
        referencePoint.smoothedMagnitudeDbRelative -
        measurementPoint.smoothedMagnitudeDbRelative;
      const absoluteErrorDb = Math.abs(errorDb);

      totalAbsoluteErrorDb += absoluteErrorDb;
      scoredPointCount += 1;
    }

    const toleranceDb = state.automationBandTolerances[band.key];
    const maximumSignificantErrorDb = failureSegments
      .filter(
        (segment) =>
          segment.bandIndex === bandIndex &&
          segment.widthHz >= state.automationToleranceMaxAcceptableErrorWidthHz,
      )
      .reduce((maximumError, segment) => Math.max(maximumError, segment.maximumErrorDb), 0);
    const withinTolerance = maximumSignificantErrorDb <= toleranceDb;
    satisfied &&= withinTolerance;
    bandSummaries.push(
      `${band.label} ${maximumSignificantErrorDb.toFixed(1)}/${toleranceDb.toFixed(1)} dB`,
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

function getNextApoFilterIndex(): number {
  return (
    [...state.parametricApoFilters, ...state.graphicApoFilters].reduce((maxId, filter) => {
      const numericId = Number(filter.id.replace('apo-filter-', ''));
      return Number.isFinite(numericId) ? Math.max(maxId, numericId) : maxId;
    }, 0) + 1
  );
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

function getApoFilterResponseDbForCurrentSampleRate(filter: ApoFilter, frequencyHz: number): number {
  return getApoFilterResponseDb(filter, frequencyHz, getSelectedSampleRate());
}

function getCombinedApoResponseDb(frequencyHz: number): number {
  return getCombinedApoResponseDbForFilters(getActiveApoFilters(), frequencyHz);
}

function getCombinedApoResponseDbForFilters(filters: ApoFilter[], frequencyHz: number): number {
  const totalResponseDb = filters.reduce((total, filter) => {
    if (!filter.enabled) {
      return total;
    }

    return total + getApoFilterResponseDbForCurrentSampleRate(filter, frequencyHz);
  }, 0);

  return totalResponseDb * (state.apoEqMode === 'parametric' ? getActiveImportedApoBlockRepeatCount() ?? 1 : 1);
}

function getAppliedApoPreampDb(): number {
  const importedPreampDb = getActiveImportedApoPreampDb();
  if (importedPreampDb !== null) {
    return roundTo(importedPreampDb, 0.1);
  }

  return -roundTo(getCombinedApoResponseDb(PLOT_NORMALIZATION_FREQUENCY_HZ), 0.1);
}

function buildApoConfigText(): string {
  const enabledFilters = getActiveApoFilters().filter((filter) => filter.enabled);
  const measurement = getSelectedApoMeasurement();
  const referenceCurve = getSelectedApoReference();
  const importedBlockRepeatCount = getActiveImportedApoBlockRepeatCount() ?? 1;
  const preampDb = getAppliedApoPreampDb();
  const headerLines = [
    '# Equalizer APO config generated by autocal',
    measurement ? `# Measurement: ${measurement.name}` : '# Measurement: none selected',
    referenceCurve ? `# Target: ${referenceCurve.name}` : '# Target: none selected',
  ];

  const lines = [...headerLines];

  const buildFilterBlockLines = (): string[] => {
    const blockLines = [`Preamp: ${preampDb.toFixed(1)} dB`];

    if (enabledFilters.length === 0) {
      blockLines.push('# No enabled filters');
    } else if (state.apoEqMode === 'graphic') {
      blockLines.push(
        `GraphicEQ: ${enabledFilters
          .map((filter) => `${filter.frequencyHz.toFixed(1)} ${filter.gainDb.toFixed(1)}`)
          .join('; ')}`,
      );
    } else {
      enabledFilters.forEach((filter, index) => {
        blockLines.push(...buildApoFilterConfigLines(filter, index));
      });
    }

    return blockLines;
  };

  const blockRepeatCount = state.apoEqMode === 'parametric' ? importedBlockRepeatCount : 1;
  for (let index = 0; index < blockRepeatCount; index += 1) {
    if (index > 0) {
      lines.push('');
    }
    lines.push(...buildFilterBlockLines());
  }

  return lines.join('\n');
}

function getGraphicEqFrequencies(filterCount: number): number[] {
  const normalizedCount = clamp(Math.round(filterCount), 1, MAX_GRAPHIC_APO_FILTERS);

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
    order: null,
    slopeDbPerOct: null,
  }));
}

function syncGraphicEqFiltersToBandCount(): void {
  state.graphicApoFilters = buildGraphicEqFilters(state.graphicApoMaxFilters, state.graphicApoFilters);
  state.nextApoFilterIndex = state.graphicApoFilters.length + 1;
}

function resetGraphicEqFiltersToFlat(): void {
  state.graphicApoFilters = buildGraphicEqFilters(state.graphicApoMaxFilters);
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

type ImportedEqProfile = {
  mode: ApoEqMode;
  filters: ApoFilter[];
  preampDb: number;
  blockRepeatCount: number;
};

async function importEqProfile(file: File): Promise<void> {
  if (state.busy) {
    return;
  }

  try {
    setBusy(true);
    setStatus('Importing EQ profile...', 'working');

    const contents = await file.text();
    const importedProfile = parseImportedEqProfile(contents);
    const maxFilterCount =
      importedProfile.mode === 'graphic' ? MAX_GRAPHIC_APO_FILTERS : MAX_PARAMETRIC_APO_FILTERS;
    const importedFilters = cloneApoFilters(importedProfile.filters.slice(0, maxFilterCount));

    if (importedFilters.length === 0) {
      throw new Error('No supported EQ filters were found in the selected profile.');
    }

    state.apoEqMode = importedProfile.mode;

    if (importedProfile.mode === 'graphic') {
      state.graphicApoFilters = importedFilters;
      state.graphicApoMaxFilters = clamp(importedFilters.length, 1, MAX_GRAPHIC_APO_FILTERS);
      state.graphicApoImportedPreampDb = importedProfile.preampDb;
      state.graphicApoImportedBlockRepeatCount = importedProfile.blockRepeatCount;
    } else {
      state.parametricApoFilters = importedFilters;
      state.parametricApoMaxFilters = clamp(importedFilters.length, 0, MAX_PARAMETRIC_APO_FILTERS);
      state.parametricApoImportedPreampDb = importedProfile.preampDb;
      state.parametricApoImportedBlockRepeatCount = importedProfile.blockRepeatCount;
    }

    state.nextApoFilterIndex = getNextApoFilterIndex();

    persistApoState();
    persistActiveConfiguration();
    renderApoSection();

    const importSummary =
      importedProfile.mode === 'graphic'
        ? `Imported ${importedFilters.length} graphic EQ band${importedFilters.length === 1 ? '' : 's'}`
        : `Imported ${importedFilters.length} parametric filter${importedFilters.length === 1 ? '' : 's'}`;
    const truncated = importedProfile.filters.length > importedFilters.length;
    const modeLabel = importedProfile.mode === 'graphic' ? 'Graphic' : 'Parametric';
    setStatus(`${importSummary}.`, 'success');
    appendLog(
      `${importSummary} from ${file.name} and switched to ${modeLabel} mode${truncated ? ` (limited to ${maxFilterCount}).` : '.'}`,
      'success',
    );
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`EQ import failed: ${message}`, 'error');
    appendLog(`EQ import failed for ${file.name}: ${message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function parseImportedEqProfile(contents: string): ImportedEqProfile {
  const peaceParametricFilters = parsePeaceParametricEqFilters(contents);
  if (peaceParametricFilters.length > 0) {
    return {
      mode: 'parametric',
      filters: normalizeImportedEqFilters(peaceParametricFilters, 'parametric'),
      preampDb: parsePeacePreampDb(contents),
      blockRepeatCount: 2,
    };
  }

  const parametricFilters = parseParametricEqFilters(contents);
  if (parametricFilters.length > 0) {
    return {
      mode: 'parametric',
      filters: normalizeImportedEqFilters(parametricFilters, 'parametric'),
      preampDb: parseEqualizerApoPreampDb(contents),
      blockRepeatCount: 1,
    };
  }

  const graphicFilters = parseGraphicEqFilters(contents);
  if (graphicFilters.length > 0) {
    return {
      mode: 'graphic',
      filters: normalizeImportedEqFilters(graphicFilters, 'graphic'),
      preampDb: parseEqualizerApoPreampDb(contents),
      blockRepeatCount: 1,
    };
  }

  throw new Error('The selected file is not a supported Equalizer APO or Peace profile.');
}

function parsePeaceParametricEqFilters(contents: string): ApoFilter[] {
  const sections = parseIniSections(contents);
  const frequencySection = sections.get('frequencies');
  if (!frequencySection) {
    return [];
  }

  const gainsSection = sections.get('gains') ?? new Map<string, string>();
  const qualitiesSection = sections.get('qualities') ?? new Map<string, string>();
  const filtersSection = sections.get('filters') ?? new Map<string, string>();
  const orderedIndexes = Array.from(frequencySection.keys())
    .map((key) => key.match(/^frequency(\d+)$/iu))
    .flatMap((match) => (match ? [Number(match[1])] : []))
    .sort((left, right) => left - right);

  if (orderedIndexes.length === 0) {
    return [];
  }

  return orderedIndexes.flatMap((index) => {
    const frequencyHz = Number(frequencySection.get(`frequency${index}`));
    if (!Number.isFinite(frequencyHz)) {
      return [];
    }

    const gainDb = Number(gainsSection.get(`gain${index}`) ?? '0');
    const q = Number(qualitiesSection.get(`quality${index}`) ?? '1.41');
    return [
      {
        id: `apo-filter-${index}`,
        enabled: true,
        kind: mapPeaceFilterCode(filtersSection.get(`filter${index}`)),
        frequencyHz,
        gainDb: Number.isFinite(gainDb) ? gainDb : 0,
        q: Number.isFinite(q) ? q : 1.41,
        order: null,
        slopeDbPerOct: null,
      },
    ];
  });
}

function parsePeacePreampDb(contents: string): number {
  const sections = parseIniSections(contents);
  const generalSection = sections.get('general');
  if (!generalSection) {
    return 0;
  }

  const parsed = Number(generalSection.get('preamp'));
  return Number.isFinite(parsed) ? clamp(parsed, -60, 20) : 0;
}

function parseGraphicEqFilters(contents: string): ApoFilter[] {
  const graphicEqMatches = Array.from(contents.matchAll(/^GraphicEQ:\s*(.+)$/gimu));
  if (graphicEqMatches.length === 0) {
    return [];
  }

  const entries = graphicEqMatches
    .flatMap((match) => match[1].split(';'))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .flatMap((entry) => {
      const parsedEntry = entry.match(/^([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)$/u);
      if (!parsedEntry) {
        return [];
      }

      return [
        {
          frequencyHz: Number(parsedEntry[1]),
          gainDb: Number(parsedEntry[2]),
        },
      ];
    })
    .filter(
      (entry) => Number.isFinite(entry.frequencyHz) && Number.isFinite(entry.gainDb),
    )
    .sort((left, right) => left.frequencyHz - right.frequencyHz);

  const frequencies = entries.map((entry) => entry.frequencyHz);
  return entries.map((entry, index) => ({
    id: `apo-filter-${index + 1}`,
    enabled: true,
    kind: 'PK',
    frequencyHz: entry.frequencyHz,
    gainDb: entry.gainDb,
    q: roundTo(getGraphicEqQ(frequencies, index), 0.01),
    order: null,
    slopeDbPerOct: null,
  }));
}

function parseParametricEqFilters(contents: string): ApoFilter[] {
  const filters: ApoFilter[] = [];
  let skippedExpandedSectionCount = 0;

  for (const line of contents.split(/\r?\n/u).map((entry) => entry.trim())) {
    if (line.length === 0) {
      continue;
    }

    const logicalFilter = parseLogicalApoFilterComment(line);
    if (logicalFilter) {
      filters.push({
        ...logicalFilter,
        id: `apo-filter-${filters.length + 1}`,
      });
      skippedExpandedSectionCount = getExpandedApoSectionCount(logicalFilter);
      continue;
    }

    const parsedLine = line.match(/^Filter(?:\s+\d+(?:\.\d+)?)?:\s+(ON|OFF)\s+(.+)$/iu);
    if (!parsedLine) {
      continue;
    }

    if (skippedExpandedSectionCount > 0) {
      skippedExpandedSectionCount -= 1;
      continue;
    }

    const remainder = parsedLine[2].trim();
    const frequencyMatch = remainder.match(/\bFc\s+([+-]?\d+(?:\.\d+)?)\s+Hz\b/iu);
    if (!frequencyMatch) {
      continue;
    }

    const frequencyIndex = remainder.search(/\bFc\b/iu);
    const typeSegment = frequencyIndex >= 0 ? remainder.slice(0, frequencyIndex).trim() : remainder;
    const parameterSegment = frequencyIndex >= 0 ? remainder.slice(frequencyIndex) : '';
    const gainMatch = parameterSegment.match(/\bGain\s+([+-]?\d+(?:\.\d+)?)\s+dB\b/iu);
    const qMatch = parameterSegment.match(/\bQ\s+([+-]?\d+(?:\.\d+)?)\b/iu);
    const descriptor = parseImportedFilterDescriptor(typeSegment, qMatch ? Number(qMatch[1]) : null);
    if (!descriptor) {
      continue;
    }

    filters.push({
      id: `apo-filter-${filters.length + 1}`,
      enabled: parsedLine[1].toUpperCase() === 'ON',
      kind: descriptor.kind,
      frequencyHz: Number(frequencyMatch[1]),
      gainDb: gainMatch ? Number(gainMatch[1]) : 0,
      q:
        descriptor.q ??
        (qMatch ? Number(qMatch[1]) : getDefaultApoFilterQ(descriptor.kind)),
      order: descriptor.order,
      slopeDbPerOct: descriptor.slopeDbPerOct,
    });
  }

  return filters;
}

function parseEqualizerApoPreampDb(contents: string): number {
  const preampMatch = contents.match(/^Preamp:\s*([+-]?\d+(?:\.\d+)?)\s*dB$/imu);
  if (!preampMatch) {
    return 0;
  }

  const parsed = Number(preampMatch[1]);
  return Number.isFinite(parsed) ? clamp(parsed, -60, 20) : 0;
}

function normalizeImportedEqFilters(filters: ApoFilter[], mode: ApoEqMode): ApoFilter[] {
  const normalizedFilters = filters
    .map((filter, index) => ({
      id: `apo-filter-${index + 1}`,
      enabled: filter.enabled !== false,
      kind: mode === 'graphic' ? 'PK' : filter.kind,
      frequencyHz: clamp(filter.frequencyHz, 20, 20000),
      gainDb: clamp(filter.gainDb, -24, 24),
      q: clamp(filter.q || getDefaultApoFilterQ(mode === 'graphic' ? 'PK' : filter.kind), 0.1, 10),
      order: normalizeApoFilterOrder(filter.order, mode === 'graphic' ? 'PK' : filter.kind),
      slopeDbPerOct: normalizeApoFilterSlopeDbPerOct(filter.slopeDbPerOct, mode === 'graphic' ? 'PK' : filter.kind),
    }))
    .filter(
      (filter) =>
        Number.isFinite(filter.frequencyHz) &&
        Number.isFinite(filter.gainDb) &&
        Number.isFinite(filter.q),
    )
    .sort((left, right) => left.frequencyHz - right.frequencyHz);

  if (mode !== 'graphic') {
    return normalizedFilters;
  }

  const frequencies = normalizedFilters.map((filter) => filter.frequencyHz);
  return normalizedFilters.map((filter, index) => ({
    ...filter,
    kind: 'PK',
    q: roundTo(getGraphicEqQ(frequencies, index), 0.01),
    order: null,
    slopeDbPerOct: null,
  }));
}

function parseIniSections(contents: string): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>();
  let currentSectionName: string | null = null;

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith(';') || line.startsWith('#')) {
      continue;
    }

    const sectionMatch = line.match(/^\[(.+)\]$/u);
    if (sectionMatch) {
      currentSectionName = sectionMatch[1].trim().toLowerCase();
      if (!sections.has(currentSectionName)) {
        sections.set(currentSectionName, new Map<string, string>());
      }
      continue;
    }

    if (!currentSectionName) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    sections.get(currentSectionName)?.set(key, value);
  }

  return sections;
}

function mapPeaceFilterCode(value: string | undefined): ApoFilterKind {
  switch (value?.trim()) {
    case '14':
      return 'LSCQ';
    case '15':
      return 'HSCQ';
    default:
      return 'PK';
  }
}

function parseImportedFilterDescriptor(
  typeSegment: string,
  parsedQ: number | null,
): {
  kind: ApoFilterKind;
  q: number | null;
  order: number | null;
  slopeDbPerOct: number | null;
} | null {
  const normalizedType = typeSegment.replace(/\s+/gu, ' ').trim().toUpperCase();

  if (normalizedType === 'PK' || normalizedType === 'PEQ') {
    return { kind: 'PK', q: parsedQ, order: null, slopeDbPerOct: null };
  }

  if (normalizedType === 'LP' || normalizedType === 'LPQ') {
    return { kind: 'LP', q: parsedQ ?? getDefaultApoFilterQ('LP'), order: null, slopeDbPerOct: null };
  }

  if (normalizedType === 'HP' || normalizedType === 'HPQ') {
    return { kind: 'HP', q: parsedQ ?? getDefaultApoFilterQ('HP'), order: null, slopeDbPerOct: null };
  }

  if (normalizedType === 'BP') {
    return { kind: 'BP', q: parsedQ ?? getDefaultApoFilterQ('BP'), order: null, slopeDbPerOct: null };
  }

  if (normalizedType === 'NO') {
    return { kind: 'NO', q: parsedQ ?? getDefaultApoFilterQ('NO'), order: null, slopeDbPerOct: null };
  }

  if (normalizedType === 'AP') {
    return { kind: 'AP', q: parsedQ ?? getDefaultApoFilterQ('AP'), order: null, slopeDbPerOct: null };
  }

  if (normalizedType === 'LS') {
    return {
      kind: parsedQ === null ? 'LS' : 'LSQ',
      q: parsedQ,
      order: null,
      slopeDbPerOct: null,
    };
  }

  if (normalizedType === 'HS') {
    return {
      kind: parsedQ === null ? 'HS' : 'HSQ',
      q: parsedQ,
      order: null,
      slopeDbPerOct: null,
    };
  }

  const lscSlopeMatch = normalizedType.match(/^LSC\s+([+-]?\d+(?:\.\d+)?)\s+DB$/u);
  if (lscSlopeMatch) {
    return {
      kind: 'LSC_DB',
      q: null,
      order: null,
      slopeDbPerOct: Number(lscSlopeMatch[1]),
    };
  }

  const hscSlopeMatch = normalizedType.match(/^HSC\s+([+-]?\d+(?:\.\d+)?)\s+DB$/u);
  if (hscSlopeMatch) {
    return {
      kind: 'HSC_DB',
      q: null,
      order: null,
      slopeDbPerOct: Number(hscSlopeMatch[1]),
    };
  }

  if (normalizedType === 'LSC') {
    return { kind: 'LSCQ', q: parsedQ ?? getDefaultApoFilterQ('LSCQ'), order: null, slopeDbPerOct: null };
  }

  if (normalizedType === 'HSC') {
    return { kind: 'HSCQ', q: parsedQ ?? getDefaultApoFilterQ('HSCQ'), order: null, slopeDbPerOct: null };
  }

  if (normalizedType === 'LS 6DB' || normalizedType === 'LS 12DB') {
    return { kind: 'LS', q: null, order: null, slopeDbPerOct: null };
  }

  if (normalizedType === 'HS 6DB' || normalizedType === 'HS 12DB') {
    return { kind: 'HS', q: null, order: null, slopeDbPerOct: null };
  }

  return null;
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
    requestAutomationStop();
    return;
  }

  if (state.busy) {
    return;
  }

  state.automationRunning = true;
  state.automationStopRequested = false;
  state.automationPassCount = 0;
  state.automationPidIntegralByBand = {};
  state.automationPidPreviousErrorByBand = {};
  state.automationMomentumByBand = {};
  state.apoEqMode = 'graphic';
  resetGraphicEqFiltersToFlat();
  persistApoState();
  persistActiveConfiguration();
  updateAutomationUi();
  renderApoSection();

  const appliedFlatProfile = await applyApoConfig({ continueOnBusyFileError: true });
  if (!appliedFlatProfile) {
    state.automationRunning = false;
    state.automationStopRequested = false;
    state.automationPassCount = 0;
    state.automationPidIntegralByBand = {};
    state.automationPidPreviousErrorByBand = {};
    state.automationMomentumByBand = {};
    updateAutomationUi();
    return;
  }

  appendLog(`Started ${formatAutomationAlgorithmLabel(state.automationAlgorithm)} automation.`, 'success');
  let completedWithinTolerance = false;
  let toleranceSummary = '';
  let bestScoreDb = Number.POSITIVE_INFINITY;
  let bestFilters = cloneApoFilters(getActiveApoFilters());
  let consecutiveRegressionCount = 0;

  try {
    while (state.automationRunning) {
      const measurement = await runMeasurement({
        discardIf: () => state.automationStopRequested,
      });
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

        if (state.automationStopOnTolerance && toleranceResult?.satisfied) {
          completedWithinTolerance = true;
          toleranceSummary = toleranceResult.bandSummaries.join(', ');
          break;
        }

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

      }

      const generated = await generateApoFilters(measurement, true);
      if (!generated || state.automationStopRequested) {
        break;
      }

      const applied = await applyApoConfig({ continueOnBusyFileError: true });
      if (!applied || state.automationStopRequested) {
        break;
      }

      state.automationPassCount += 1;

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
    state.automationPassCount = 0;
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
