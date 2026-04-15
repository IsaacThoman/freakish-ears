import './index.css';
import logoUrl from './assets/dutocal-logo.webp';

import {
  ACTIVE_CONFIG_STORAGE_KEY,
  APO_CHANNEL_PROFILE_STORAGE_KEY,
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
  applyMicrophoneCalibration,
  buildMeasurementCsv,
  buildMeasurementJson,
  buildRewMeasurementText,
  createReferenceCurve,
  createLoadedMeasurement,
  createMeasurementFromAnalysis,
  getMeasurementPointsForDisplay,
  normalizeImportedMeasurement,
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
  ApoChannelProfile,
  ApoChannelProfileState,
  ApoEqMode,
  ApoFilter,
  ApoModeState,
  ApoFilterKind,
  AppState,
  AutomationAlgorithm,
  AutomationBandTolerances,
  AutomationToleranceBand,
  LoadedMeasurement,
  LogTone,
  MeasurementBackend,
  MeasurementChannelSelection,
  MeasurementImport,
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
import type {
  AutomationItemSelector,
  AutomationVirtualFile,
  RendererAutomationAction,
  RendererAutomationElementBounds,
  RendererAutomationSnapshot,
} from './shared/automation';

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
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>

        <div class="field">
          <select id="microphoneSelect"></select>
        </div>

        <div class="folder-row">
          <button id="importLeftCalibrationButton" class="btn btn-secondary" type="button">
            Left Cal
          </button>
          <div id="leftCalibrationValue" class="folder-chip">
            <span id="leftCalibrationName" class="folder-chip-label">None</span>
            <button
              id="clearLeftCalibrationButton"
              class="folder-chip-clear"
              type="button"
              aria-label="Clear left microphone calibration"
              title="Clear left microphone calibration"
            >
              &times;
            </button>
          </div>
        </div>

        <div class="folder-row">
          <button id="importRightCalibrationButton" class="btn btn-secondary" type="button">
            Right Cal
          </button>
          <div id="rightCalibrationValue" class="folder-chip">
            <span id="rightCalibrationName" class="folder-chip-label">None</span>
            <button
              id="clearRightCalibrationButton"
              class="folder-chip-clear"
              type="button"
              aria-label="Clear right microphone calibration"
              title="Clear right microphone calibration"
            >
              &times;
            </button>
          </div>
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

        <div class="folder-row folder-row-actions">
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
          <div class="automation-progress" aria-live="polite">
            <div class="automation-progress-item">
              <span class="automation-progress-label">Iterations</span>
              <span id="automationIterationValue" class="automation-progress-value">0</span>
            </div>
            <div class="automation-progress-item">
              <span class="automation-progress-label">Elapsed</span>
              <span id="automationElapsedValue" class="automation-progress-value">00:00</span>
            </div>
          </div>
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
            <div class="apo-apply-anchor">
              <div id="apoEnableToggle" class="segmented-toggle apo-enable-toggle" role="tablist" aria-label="EQ enable selector">
                <button id="apoEnableOffButton" class="segmented-toggle-option" type="button" data-apo-enabled="false" role="tab" aria-selected="true">EQ Off</button>
                <button id="apoEnableOnButton" class="segmented-toggle-option" type="button" data-apo-enabled="true" role="tab" aria-selected="false">EQ On</button>
                <span class="segmented-toggle-thumb" aria-hidden="true"></span>
              </div>
              <div id="apoApplyWarning" class="apo-apply-warning" hidden>
                <span>PEACE is running</span>
              </div>
            </div>
            <div id="apoChannelProfileToggle" class="segmented-toggle" role="tablist" aria-label="EQ channel selector">
              <button id="apoChannelProfileAllButton" class="segmented-toggle-option" type="button" data-apo-channel-profile="all" role="tab" aria-selected="true">All</button>
              <button id="apoChannelProfileLeftButton" class="segmented-toggle-option" type="button" data-apo-channel-profile="left" role="tab" aria-selected="false">Left</button>
              <button id="apoChannelProfileRightButton" class="segmented-toggle-option" type="button" data-apo-channel-profile="right" role="tab" aria-selected="false">Right</button>
              <span class="segmented-toggle-thumb" aria-hidden="true"></span>
            </div>
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
          <input id="leftCalibrationFileInput" type="file" accept=".txt,.csv,.json,.targetcurve,text/plain,application/json" hidden />
          <input id="rightCalibrationFileInput" type="file" accept=".txt,.csv,.json,.targetcurve,text/plain,application/json" hidden />
          <input id="configFileInput" type="file" accept=".json,application/json,text/plain" hidden />
          <input id="apoConfigFileInput" type="file" accept=".txt,.peace,.peq,.ini,text/plain" hidden />

          <div id="measurementsPlotCard" class="plot-card">
            <span style="color:var(--text-muted);font-size:11px">Run or import measurements to plot response</span>
          </div>
          <div class="apo-plot-stack">
            <div id="apoPlotCard" class="plot-card">
              <span style="color:var(--text-muted);font-size:11px">Enable filters to see EQ graph</span>
            </div>
            <div class="apo-preview-divider" aria-hidden="true"></div>
            <div class="field apo-config-preview-field">
              <label for="apoConfigPreview">APO Config Preview</label>
              <textarea id="apoConfigPreview" class="apo-config-preview" readonly></textarea>
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
              <div id="apoPresetMenuAnchor" class="apo-preset-menu-anchor">
                <button
                  id="selectApoPresetButton"
                  class="btn btn-secondary"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded="false"
                >
                  Select Preset
                </button>
                <div id="apoPresetMenu" class="apo-preset-menu" role="menu" hidden></div>
              </div>
              <button id="importApoConfigButton" class="btn btn-secondary" type="button">
                Import EQ
              </button>
              <button id="exportApoConfigButton" class="btn btn-secondary" type="button">
                Export EQ
              </button>
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

          <div id="apoPreampMeter" class="apo-control-group apo-preamp-control" aria-live="polite">
            <label for="apoPreampInput">Preamp</label>
            <div class="apo-preamp-inputs">
              <div class="apo-preamp-slider-group">
                <input id="apoPreampInput" class="apo-preamp-range range-input" type="range" min="-24" max="24" step="0.1" value="0" />
                <div id="apoPreampTicks" class="apo-preamp-ticks" aria-hidden="true"></div>
              </div>
              <div class="number-input-row">
                <input id="apoPreampNumberInput" class="apo-preamp-number-input level-number-input" type="number" min="-24" max="24" step="0.1" value="0.0" />
                <span class="value-chip">dB</span>
              </div>
            </div>
            <span id="apoPreampHint" class="apo-hint">Imports the profile preamp from PEACE and Equalizer APO files when present.</span>
          </div>

          <div class="apo-filter-header">
            <span class="apo-filter-header-cell">On</span>
            <span class="apo-filter-header-cell apo-filter-header-type">Type</span>
            <span class="apo-filter-header-cell">Freq (Hz)</span>
            <span class="apo-filter-header-cell">Gain (dB)</span>
            <span class="apo-filter-header-cell apo-filter-header-q">Q / Order / Slope</span>
            <span class="apo-filter-header-cell">Action</span>
          </div>

          <div id="apoFilterList" class="apo-filter-list"></div>

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
const importLeftCalibrationButton = getElement<HTMLButtonElement>('importLeftCalibrationButton');
const importRightCalibrationButton = getElement<HTMLButtonElement>('importRightCalibrationButton');
const leftCalibrationValue = getElement<HTMLDivElement>('leftCalibrationValue');
const rightCalibrationValue = getElement<HTMLDivElement>('rightCalibrationValue');
const leftCalibrationName = getElement<HTMLSpanElement>('leftCalibrationName');
const rightCalibrationName = getElement<HTMLSpanElement>('rightCalibrationName');
const clearLeftCalibrationButton = getElement<HTMLButtonElement>('clearLeftCalibrationButton');
const clearRightCalibrationButton = getElement<HTMLButtonElement>('clearRightCalibrationButton');
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
const automationIterationValue = getElement<HTMLSpanElement>('automationIterationValue');
const automationElapsedValue = getElement<HTMLSpanElement>('automationElapsedValue');
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
const leftCalibrationFileInput = getElement<HTMLInputElement>('leftCalibrationFileInput');
const rightCalibrationFileInput = getElement<HTMLInputElement>('rightCalibrationFileInput');
const configFileInput = getElement<HTMLInputElement>('configFileInput');
const apoConfigFileInput = getElement<HTMLInputElement>('apoConfigFileInput');
const plotsContainer = getElement<HTMLDivElement>('plotsContainer');
const measurementsPlotCard = getElement<HTMLDivElement>('measurementsPlotCard');
const apoChannelProfileToggle = getElement<HTMLDivElement>('apoChannelProfileToggle');
const apoChannelProfileAllButton = getElement<HTMLButtonElement>('apoChannelProfileAllButton');
const apoChannelProfileLeftButton = getElement<HTMLButtonElement>('apoChannelProfileLeftButton');
const apoChannelProfileRightButton = getElement<HTMLButtonElement>('apoChannelProfileRightButton');
const apoEqModeToggle = getElement<HTMLDivElement>('apoEqModeToggle');
const apoEqModeParametricButton = getElement<HTMLButtonElement>('apoEqModeParametricButton');
const apoEqModeGraphicButton = getElement<HTMLButtonElement>('apoEqModeGraphicButton');
const apoPlotCard = getElement<HTMLDivElement>('apoPlotCard');
const apoCard = getElement<HTMLDivElement>('apoCard');
const generateApoFiltersButton = getElement<HTMLButtonElement>('generateApoFiltersButton');
const addApoFilterButton = getElement<HTMLButtonElement>('addApoFilterButton');
const clearApoFiltersButton = getElement<HTMLButtonElement>('clearApoFiltersButton');
const apoPresetMenuAnchor = getElement<HTMLDivElement>('apoPresetMenuAnchor');
const selectApoPresetButton = getElement<HTMLButtonElement>('selectApoPresetButton');
const apoPresetMenu = getElement<HTMLDivElement>('apoPresetMenu');
const importApoConfigButton = getElement<HTMLButtonElement>('importApoConfigButton');
const exportApoConfigButton = getElement<HTMLButtonElement>('exportApoConfigButton');
const apoEnableToggle = getElement<HTMLDivElement>('apoEnableToggle');
const apoEnableOffButton = getElement<HTMLButtonElement>('apoEnableOffButton');
const apoEnableOnButton = getElement<HTMLButtonElement>('apoEnableOnButton');
const apoApplyWarning = getElement<HTMLDivElement>('apoApplyWarning');
const apoMeasurementSelect = getElement<HTMLSelectElement>('apoMeasurementSelect');
const apoReferenceSelect = getElement<HTMLSelectElement>('apoReferenceSelect');
const apoPreampInput = getElement<HTMLInputElement>('apoPreampInput');
const apoPreampNumberInput = getElement<HTMLInputElement>('apoPreampNumberInput');
const apoPreampTicks = getElement<HTMLDivElement>('apoPreampTicks');
const apoPreampHint = getElement<HTMLSpanElement>('apoPreampHint');
const apoMaxFiltersInput = getElement<HTMLInputElement>('apoMaxFiltersInput');
const apoFilterList = getElement<HTMLDivElement>('apoFilterList');
const apoConfigPreview = getElement<HTMLTextAreaElement>('apoConfigPreview');
const apoApplyStatus = getElement<HTMLSpanElement>('apoApplyStatus');
const logList = getElement<HTMLUListElement>('logList');
const toastButton = getElement<HTMLButtonElement>('toastButton');

const PLOT_ASPECT_RATIO = DEFAULT_PLOT_WIDTH / DEFAULT_PLOT_HEIGHT;
const PLOTS_GAP_PX = 12;
const MIN_SPLIT_PLOT_HEIGHT_PX = 220;
const APO_PREAMP_MIN_DB = -24;
const APO_PREAMP_MAX_DB = 24;
const APO_CHANNEL_PROFILES: ApoChannelProfile[] = ['all', 'left', 'right'];
const storedApoFilters = readStoredApoFilterSets();
const storedApoEqModes = readStoredApoEqModes();
const storedApoMaxFilterCounts = readStoredApoMaxFilterCounts();
const storedApoImportedPreampDb = readStoredApoImportedPreampDb();
const storedApoImportedBlockRepeatCount = readStoredApoImportedBlockRepeatCount();

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
  leftMicrophoneCalibration: null,
  rightMicrophoneCalibration: null,
  focusedMeasurementId: null,
  nextMeasurementIndex: 1,
  nextReferenceIndex: 1,
  apoEqModes: storedApoEqModes,
  apoChannelProfile: readStoredApoChannelProfile(),
  apoFilters: storedApoFilters,
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
  automationDisplayedPassCount: 0,
  automationStartedAtMs: null,
  automationElapsedMs: 0,
  automationTimerId: 0,
  automationPidIntegralByBand: {},
  automationPidPreviousErrorByBand: {},
  automationMomentumByBand: {},
  apoSelectedMeasurementId: localStorage.getItem(APO_SELECTED_MEASUREMENT_STORAGE_KEY),
  apoSelectedReferenceId: localStorage.getItem(APO_SELECTED_REFERENCE_STORAGE_KEY),
  apoMaxFilters: storedApoMaxFilterCounts,
  apoImportedPreampDb: storedApoImportedPreampDb,
  apoImportedBlockRepeatCount: storedApoImportedBlockRepeatCount,
  // These caps are fixed now that the UI setting is gone.
  apoMaxBoostDb: DEFAULT_APO_MAX_BOOST_DB,
  apoMaxCutDb: DEFAULT_APO_MAX_CUT_DB,
  nextApoFilterIndex: 1,
  apoFilterListPage: 1,
  apoFilterListPageSize: APO_FILTER_LIST_PAGE_SIZE,
  latestStatusMessage: 'Ready',
  latestStatusTone: 'idle',
  equalizerApoStatus: null,
  peacePresets: [],
  apoPresetMenuOpen: false,
  toast: null,
  toastTimeoutId: 0,
};

function getApoFilters(
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
  eqMode: ApoEqMode = getActiveApoEqMode(),
): ApoFilter[] {
  return state.apoFilters[channelProfile][eqMode];
}

function setApoFilters(
  filters: ApoFilter[],
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
  eqMode: ApoEqMode = getActiveApoEqMode(),
): void {
  state.apoFilters[channelProfile][eqMode] = filters;
}

function getApoEqMode(channelProfile: ApoChannelProfile = state.apoChannelProfile): ApoEqMode {
  return state.apoEqModes[channelProfile];
}

function setApoEqMode(
  eqMode: ApoEqMode,
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
): void {
  state.apoEqModes[channelProfile] = eqMode;
}

function getActiveApoEqMode(): ApoEqMode {
  return getApoEqMode();
}

function setActiveApoEqMode(eqMode: ApoEqMode): void {
  setApoEqMode(eqMode);
}

function getActiveApoFilters(): ApoFilter[] {
  return getApoFilters();
}

function setActiveApoFilters(filters: ApoFilter[]): void {
  setApoFilters(filters);
}

function getApoMaxFilters(
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
  eqMode: ApoEqMode = getActiveApoEqMode(),
): number {
  return state.apoMaxFilters[channelProfile][eqMode];
}

function setApoMaxFilters(
  value: number,
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
  eqMode: ApoEqMode = getActiveApoEqMode(),
): void {
  state.apoMaxFilters[channelProfile][eqMode] = value;
}

function getActiveApoMaxFilters(): number {
  return getApoMaxFilters();
}

function setActiveApoMaxFilters(value: number): void {
  setApoMaxFilters(value);
}

function getImportedApoPreampDb(
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
  eqMode: ApoEqMode = getActiveApoEqMode(),
): number | null {
  return state.apoImportedPreampDb[channelProfile][eqMode];
}

function setImportedApoPreampDb(
  value: number | null,
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
  eqMode: ApoEqMode = getActiveApoEqMode(),
): void {
  state.apoImportedPreampDb[channelProfile][eqMode] = value;
}

function getActiveImportedApoPreampDb(): number | null {
  return getImportedApoPreampDb();
}

function setActiveImportedApoPreampDb(value: number | null): void {
  setImportedApoPreampDb(value);
}

function clearActiveImportedApoPreamp(): void {
  setActiveImportedApoPreampDb(null);
}

function getImportedApoBlockRepeatCount(
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
  eqMode: ApoEqMode = getActiveApoEqMode(),
): number | null {
  return state.apoImportedBlockRepeatCount[channelProfile][eqMode];
}

function setImportedApoBlockRepeatCount(
  value: number | null,
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
  eqMode: ApoEqMode = getActiveApoEqMode(),
): void {
  state.apoImportedBlockRepeatCount[channelProfile][eqMode] = value;
}

function getActiveImportedApoBlockRepeatCount(): number | null {
  return getImportedApoBlockRepeatCount();
}

function setActiveImportedApoBlockRepeatCount(value: number | null): void {
  setImportedApoBlockRepeatCount(value);
}

function clearActiveImportedApoBlockRepeatCount(): void {
  setActiveImportedApoBlockRepeatCount(null);
}

function getAllApoFilters(): ApoFilter[] {
  return APO_CHANNEL_PROFILES.flatMap((channelProfile) => [
    ...state.apoFilters[channelProfile].parametric,
    ...state.apoFilters[channelProfile].graphic,
  ]);
}

state.nextApoFilterIndex =
  getAllApoFilters().reduce((maxId, filter) => {
    const numericId = Number(filter.id.replace('apo-filter-', ''));
    return Number.isFinite(numericId) ? Math.max(maxId, numericId) : maxId;
  }, 0) + 1;

function syncParametricApoFilterCountToFilters(
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
): void {
  setApoMaxFilters(
    clamp(getApoFilters(channelProfile, 'parametric').length, 1, MAX_PARAMETRIC_APO_FILTERS),
    channelProfile,
    'parametric',
  );
}

function syncParametricFiltersToCount(
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
): void {
  const targetCount = clamp(getApoMaxFilters(channelProfile, 'parametric'), 1, MAX_PARAMETRIC_APO_FILTERS);
  const currentFilters = [...getApoFilters(channelProfile, 'parametric')].sort(
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

    setApoFilters(nextFilters, channelProfile, 'parametric');
    return;
  }

  if (currentFilters.length > targetCount) {
    setApoFilters(currentFilters.slice(0, targetCount), channelProfile, 'parametric');
  }
}

for (const channelProfile of APO_CHANNEL_PROFILES) {
  if (getApoFilters(channelProfile, 'parametric').length === 0 && getApoMaxFilters(channelProfile, 'parametric') > 0) {
    syncParametricFiltersToCount(channelProfile);
  }

  if (getApoFilters(channelProfile, 'graphic').length === 0 && getApoMaxFilters(channelProfile, 'graphic') > 0) {
    syncGraphicEqFiltersToBandCount(channelProfile);
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

importLeftCalibrationButton.addEventListener('click', () => {
  leftCalibrationFileInput.click();
});

importRightCalibrationButton.addEventListener('click', () => {
  rightCalibrationFileInput.click();
});

clearLeftCalibrationButton.addEventListener('click', () => {
  clearMicrophoneCalibration('left');
});

clearRightCalibrationButton.addEventListener('click', () => {
  clearMicrophoneCalibration('right');
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

leftCalibrationFileInput.addEventListener('change', () => {
  const file = leftCalibrationFileInput.files?.[0] ?? null;
  leftCalibrationFileInput.value = '';

  if (file) {
    void importMicrophoneCalibrationFile(file, 'left');
  }
});

rightCalibrationFileInput.addEventListener('change', () => {
  const file = rightCalibrationFileInput.files?.[0] ?? null;
  rightCalibrationFileInput.value = '';

  if (file) {
    void importMicrophoneCalibrationFile(file, 'right');
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
  if (event.key === 'Escape' && state.apoPresetMenuOpen) {
    state.apoPresetMenuOpen = false;
    renderApoSection();
    return;
  }

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

document.addEventListener('click', (event) => {
  if (!state.apoPresetMenuOpen) {
    return;
  }

  const target = event.target;
  if (target instanceof Node && apoPresetMenuAnchor.contains(target)) {
    return;
  }

  state.apoPresetMenuOpen = false;
  renderApoSection();
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
  const measurementId = removeButton?.getAttribute('data-measurement-remove') ?? undefined;
  const exportButton = target.closest('[data-measurement-export]');
  const exportMeasurementId =
    exportButton?.getAttribute('data-measurement-export') ?? undefined;
  const starButton = target.closest('[data-measurement-star]');
  const starMeasurementId = starButton?.getAttribute('data-measurement-star') ?? undefined;
  const referenceRemoveButton = target.closest('[data-reference-remove]');
  const referenceId = referenceRemoveButton?.getAttribute('data-reference-remove') ?? undefined;

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

selectApoPresetButton.addEventListener('click', () => {
  if (state.busy || state.peacePresets.length === 0) {
    return;
  }

  state.apoPresetMenuOpen = !state.apoPresetMenuOpen;
  renderApoSection();
});

apoPresetMenu.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const presetButton = target.closest<HTMLButtonElement>('[data-apo-preset-file-name]');
  const fileName = presetButton?.dataset.apoPresetFileName;
  if (!fileName) {
    return;
  }

  void importPeacePreset(fileName);
});

importApoConfigButton.addEventListener('click', () => {
  apoConfigFileInput.click();
});

exportApoConfigButton.addEventListener('click', () => {
  void exportApoConfig();
});

apoEnableToggle.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const enableValue = target.dataset.apoEnabled;
  if (enableValue !== 'true' && enableValue !== 'false') {
    return;
  }

  void applyApoConfig({ enableProfile: enableValue === 'true' });
});

apoChannelProfileToggle.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const nextChannelProfile = target.dataset.apoChannelProfile;
  if (!isApoChannelProfile(nextChannelProfile) || state.apoChannelProfile === nextChannelProfile) {
    return;
  }

  state.apoChannelProfile = nextChannelProfile;
  apoMaxFiltersInput.value = String(getActiveApoMaxFilters());
  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
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

  if (getActiveApoEqMode() === nextMode) {
    return;
  }

  setActiveApoEqMode(nextMode);
  apoMaxFiltersInput.value = String(getActiveApoMaxFilters());
  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
  reapplyApoConfigIfEnabled();
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

apoMaxFiltersInput.addEventListener('change', () => {
  syncApoGenerationSettings(false);
});

apoMaxFiltersInput.addEventListener('blur', () => {
  syncApoGenerationSettings(true);
});

apoPreampInput.addEventListener('input', () => {
  syncApoPreampSettings(apoPreampInput.value, false);
});

apoPreampNumberInput.addEventListener('input', () => {
  syncApoPreampSettings(apoPreampNumberInput.value, false);
});

apoPreampNumberInput.addEventListener('blur', () => {
  syncApoPreampSettings(apoPreampNumberInput.value, true);
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
updateMicrophoneCalibrationLabels();
updateMeasurementActionState();
updateAutomationUi();
renderApoSection();
appendLog('Click Refresh to access microphones and outputs.');
void refreshEqualizerApoStatus();
void refreshMicrophones(false);

window.freakishEarsAutomation = {
  runAction,
  getSnapshot: getRendererAutomationSnapshot,
  getElementBounds: getRendererAutomationElementBounds,
};

function getElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`);
  }

  return element as TElement;
}

async function runAction(action: RendererAutomationAction): Promise<RendererAutomationSnapshot> {
  switch (action.type) {
    case 'set-output-folder':
      state.outputFolder = action.folderPath;
      updateSelectedFolder();
      break;
    case 'apply-configuration':
      applyImportedConfiguration(action.config, {
        persist: action.persist,
        includeMeasurementSweepSettings: action.includeMeasurementSweepSettings,
        includeApoState: action.includeApoState,
      });
      break;
    case 'import-measurements':
      await importMeasurementFiles(action.files.map(createAutomationFile));
      break;
    case 'import-references':
      await importReferenceFiles(action.files.map(createAutomationFile));
      break;
    case 'import-microphone-calibration':
      await importMicrophoneCalibrationFile(createAutomationFile(action.file), action.channel);
      break;
    case 'set-plot-options':
      applyAutomationPlotOptions(action);
      break;
    case 'set-automation-options':
      applyAutomationOptions(action);
      break;
    case 'select-apo-measurement': {
      const measurement = selectAutomationItem(state.measurements, action.selector);
      if (!measurement) {
        throw new Error('Unable to find the requested measurement.');
      }
      state.apoSelectedMeasurementId = measurement.id;
      persistApoSelections();
      renderApoSection();
      break;
    }
    case 'select-apo-reference': {
      const referenceCurve = selectAutomationItem(state.referenceCurves, action.selector);
      if (!referenceCurve) {
        throw new Error('Unable to find the requested reference curve.');
      }
      state.apoSelectedReferenceId = referenceCurve.id;
      persistApoSelections();
      renderApoSection();
      break;
    }
    case 'set-measurement-visibility': {
      const measurement = selectAutomationItem(state.measurements, action.selector);
      if (!measurement) {
        throw new Error('Unable to find the requested measurement.');
      }
      setMeasurementVisibility(measurement.id, action.visible);
      break;
    }
    case 'set-reference-visibility': {
      const referenceCurve = selectAutomationItem(state.referenceCurves, action.selector);
      if (!referenceCurve) {
        throw new Error('Unable to find the requested reference curve.');
      }
      setReferenceVisibility(referenceCurve.id, action.visible);
      break;
    }
    case 'set-measurement-starred': {
      const measurement = selectAutomationItem(state.measurements, action.selector);
      if (!measurement) {
        throw new Error('Unable to find the requested measurement.');
      }
      const current = state.measurements.find((entry) => entry.id === measurement.id);
      if (!!current?.starred !== action.starred) {
        toggleMeasurementStar(measurement.id);
      }
      break;
    }
    case 'set-apo-mode':
      applyAutomationApoMode(action);
      break;
    case 'set-apo-filters':
      setActiveApoFilters(cloneApoFilters(action.filters));
      clearActiveImportedApoPreamp();
      clearActiveImportedApoBlockRepeatCount();
      if (getActiveApoEqMode() === 'graphic') {
        setActiveApoMaxFilters(clamp(action.filters.length || 1, 1, MAX_GRAPHIC_APO_FILTERS));
        syncGraphicEqFiltersToBandCount();
      } else {
        syncParametricApoFilterCountToFilters();
      }
      state.nextApoFilterIndex = getNextApoFilterIndex();
      persistApoState();
      persistActiveConfiguration();
      renderApoSection();
      break;
    case 'generate-apo-filters':
      await generateApoFilters(null, action.useAutomationAlgorithm);
      break;
    case 'import-eq-profile':
      await importEqProfile(createAutomationFile(action.file));
      break;
    case 'import-peace-preset':
      await importPeacePreset(action.fileName);
      break;
    case 'refresh-equalizer-apo-status':
      await refreshEqualizerApoStatus();
      break;
    case 'apply-apo-config':
      await applyApoConfig({ enableProfile: action.enableProfile });
      break;
    case 'disable-peace':
      await window.freakishEars.disablePeace();
      await refreshEqualizerApoStatus();
      break;
    case 'run-measurement':
      await runMeasurement();
      break;
    case 'toggle-automation':
      await toggleAutomationLoop();
      break;
    case 'wait':
      await wait(Math.max(0, Math.round(action.ms)));
      break;
    case 'wait-for-idle':
      await waitForRendererIdle(action.timeoutMs);
      break;
    default:
      throw new Error(`Unsupported automation action: ${(action as { type: string }).type}`);
  }

  return getRendererAutomationSnapshot();
}

function createAutomationFile(file: AutomationVirtualFile): File {
  const automationFile = new File([file.contents ?? ''], file.name, { type: 'text/plain' }) as File & {
    path?: string;
  };

  if (file.path) {
    Object.defineProperty(automationFile, 'path', {
      value: file.path,
      configurable: true,
    });
  }

  return automationFile;
}

function applyAutomationPlotOptions(action: Extract<RendererAutomationAction, { type: 'set-plot-options' }>): void {
  if (typeof action.normalizePlot === 'boolean') {
    state.normalizePlot = action.normalizePlot;
    normalizePlotToggle.checked = action.normalizePlot;
    localStorage.setItem(NORMALIZE_PLOT_STORAGE_KEY, String(action.normalizePlot));
  }

  if (action.smoothingMode && isSmoothingMode(action.smoothingMode)) {
    state.smoothingMode = action.smoothingMode;
    smoothingModeSelect.value = action.smoothingMode;
    localStorage.setItem(SMOOTHING_MODE_STORAGE_KEY, action.smoothingMode);
  }

  if (state.measurements.length > 0 || state.referenceCurves.length > 0) {
    renderMeasurements();
  }
}

function applyAutomationOptions(
  action: Extract<RendererAutomationAction, { type: 'set-automation-options' }>,
): void {
  if (action.algorithm && isAutomationAlgorithm(action.algorithm)) {
    state.automationAlgorithm = action.algorithm;
    automationAlgorithmSelect.value = action.algorithm;
  }

  if (Number.isFinite(action.delaySeconds)) {
    automationDelayInput.value = Number(action.delaySeconds).toFixed(1);
  }

  if (Number.isFinite(action.proportionalP)) {
    proportionalPInput.value = Number(action.proportionalP).toFixed(2);
  }

  if (typeof action.dynamicProportionalP === 'boolean') {
    dynamicProportionalPToggle.checked = action.dynamicProportionalP;
  }

  if (Number.isFinite(action.pidProportionalGain)) {
    pidProportionalGainInput.value = Number(action.pidProportionalGain).toFixed(2);
  }

  if (Number.isFinite(action.pidIntegralGain)) {
    pidIntegralGainInput.value = Number(action.pidIntegralGain).toFixed(2);
  }

  if (Number.isFinite(action.pidDerivativeGain)) {
    pidDerivativeGainInput.value = Number(action.pidDerivativeGain).toFixed(2);
  }

  if (Number.isFinite(action.dampedRefitBlend)) {
    dampedRefitBlendInput.value = Number(action.dampedRefitBlend).toFixed(2);
  }

  if (Number.isFinite(action.momentumBlend)) {
    momentumBlendInput.value = Number(action.momentumBlend).toFixed(2);
  }

  if (Number.isFinite(action.momentumDecay)) {
    momentumDecayInput.value = Number(action.momentumDecay).toFixed(2);
  }

  if (typeof action.stopOnTolerance === 'boolean') {
    automationStopOnToleranceToggle.checked = action.stopOnTolerance;
  }

  if (Number.isFinite(action.toleranceMaxAcceptableErrorWidthHz)) {
    automationToleranceMaxAcceptableErrorWidthInput.value = String(
      Math.round(Number(action.toleranceMaxAcceptableErrorWidthHz)),
    );
  }

  if (Number.isFinite(action.regressionLimit)) {
    automationRegressionLimitInput.value = String(Math.round(Number(action.regressionLimit)));
  }

  if (action.bandTolerances) {
    for (const band of AUTOMATION_TOLERANCE_BANDS) {
      const tolerance = action.bandTolerances[band.key];
      if (Number.isFinite(tolerance)) {
        automationToleranceInputs[band.key].value = Number(tolerance).toFixed(1);
      }
    }
  }

  syncAutomationSettings(true);
  updateAutomationUi();
}

function applyAutomationApoMode(action: Extract<RendererAutomationAction, { type: 'set-apo-mode' }>): void {
  if (action.channelProfile && isApoChannelProfile(action.channelProfile)) {
    state.apoChannelProfile = action.channelProfile;
  }

  if (action.eqMode && isApoEqMode(action.eqMode)) {
    setActiveApoEqMode(action.eqMode);
  }

  if (Number.isFinite(action.maxFilters)) {
    setActiveApoMaxFilters(
      clamp(
        Math.round(Number(action.maxFilters)),
        1,
        getActiveApoEqMode() === 'graphic' ? MAX_GRAPHIC_APO_FILTERS : MAX_PARAMETRIC_APO_FILTERS,
      ),
    );
    if (getActiveApoEqMode() === 'graphic') {
      syncGraphicEqFiltersToBandCount();
    } else {
      syncParametricFiltersToCount();
    }
  }

  if (Number.isFinite(action.preampDb)) {
    setActiveImportedApoPreampDb(roundTo(clamp(Number(action.preampDb), APO_PREAMP_MIN_DB, APO_PREAMP_MAX_DB), 0.1));
  }

  state.nextApoFilterIndex = getNextApoFilterIndex();
  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
}

function selectAutomationItem<TItem extends { id: string; name: string }>(
  items: TItem[],
  selector: AutomationItemSelector,
): TItem | null {
  if (selector.id) {
    return items.find((item) => item.id === selector.id) ?? null;
  }

  if (selector.name) {
    return items.find((item) => item.name === selector.name) ?? null;
  }

  if (Number.isInteger(selector.index)) {
    return items[selector.index as number] ?? null;
  }

  if (selector.strategy === 'first') {
    return items[0] ?? null;
  }

  return getLastItem(items) ?? null;
}

async function waitForRendererIdle(timeoutMs: number | undefined): Promise<void> {
  const timeoutAt = Date.now() + Math.max(1000, Math.round(timeoutMs ?? 30000));

  while (Date.now() < timeoutAt) {
    if (!state.busy && !state.automationRunning) {
      return;
    }

    await wait(100);
  }

  throw new Error('Renderer did not become idle in time.');
}

function getRendererAutomationSnapshot(): RendererAutomationSnapshot {
  return {
    busy: state.busy,
    automationRunning: state.automationRunning,
    latestStatusMessage: state.latestStatusMessage,
    latestStatusTone: state.latestStatusTone,
    measurementCount: state.measurements.length,
    referenceCount: state.referenceCurves.length,
    selectedApoMeasurementId: state.apoSelectedMeasurementId,
    selectedApoReferenceId: state.apoSelectedReferenceId,
    apoChannelProfile: state.apoChannelProfile,
    apoEqMode: getActiveApoEqMode(),
    apoFilterCount: getActiveApoFilters().length,
  };
}

function getRendererAutomationElementBounds(selector: string): RendererAutomationElementBounds {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    return null;
  }

  const bounds = element.getBoundingClientRect();
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

function getLastItem<TValue>(items: TValue[]): TValue | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined;
}

function setBusy(isBusy: boolean): void {
  state.busy = isBusy;

  sampleRateSelect.disabled = isBusy;
  inputChannelSelect.disabled = isBusy;
  importLeftCalibrationButton.disabled = isBusy;
  importRightCalibrationButton.disabled = isBusy;
  clearLeftCalibrationButton.disabled = isBusy || state.leftMicrophoneCalibration === null;
  clearRightCalibrationButton.disabled = isBusy || state.rightMicrophoneCalibration === null;
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
  leftCalibrationFileInput.disabled = isBusy;
  rightCalibrationFileInput.disabled = isBusy;
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
  selectApoPresetButton.disabled = isBusy || state.peacePresets.length === 0;
  importApoConfigButton.disabled = isBusy;
  exportApoConfigButton.disabled = isBusy;
  apoEnableOffButton.disabled = isBusy;
  apoEnableOnButton.disabled = isBusy;
  apoChannelProfileAllButton.disabled = isBusy;
  apoChannelProfileLeftButton.disabled = isBusy;
  apoChannelProfileRightButton.disabled = isBusy;
  apoEqModeParametricButton.disabled = isBusy;
  apoEqModeGraphicButton.disabled = isBusy;
  apoMeasurementSelect.disabled = isBusy;
  apoReferenceSelect.disabled = isBusy;
  apoPreampInput.disabled = isBusy;
  apoPreampNumberInput.disabled = isBusy;
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

function updateMicrophoneCalibrationLabels(): void {
  const hasLeftCalibration = state.leftMicrophoneCalibration !== null;
  const hasRightCalibration = state.rightMicrophoneCalibration !== null;

  leftCalibrationName.textContent = state.leftMicrophoneCalibration?.name ?? 'None';
  leftCalibrationValue.title = state.leftMicrophoneCalibration?.sourcePath ?? '';
  clearLeftCalibrationButton.disabled = state.busy || !hasLeftCalibration;
  clearLeftCalibrationButton.hidden = !hasLeftCalibration;

  rightCalibrationName.textContent = state.rightMicrophoneCalibration?.name ?? 'None';
  rightCalibrationValue.title = state.rightMicrophoneCalibration?.sourcePath ?? '';
  clearRightCalibrationButton.disabled = state.busy || !hasRightCalibration;
  clearRightCalibrationButton.hidden = !hasRightCalibration;
}

function updateMeasurementActionState(): void {
  importMeasurementsButton.disabled = state.busy;
  importReferenceButton.disabled = state.busy;
  importLeftCalibrationButton.disabled = state.busy;
  importRightCalibrationButton.disabled = state.busy;
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
  addApoFilterButton.disabled = state.busy || getActiveApoEqMode() === 'graphic';
  clearApoFiltersButton.disabled = state.busy || getActiveApoFilters().length === 0;
  selectApoPresetButton.disabled = state.busy || state.peacePresets.length === 0;
  importApoConfigButton.disabled = state.busy;
  exportApoConfigButton.disabled = state.busy || !state.outputFolder;
  const enabledFilterCount = getActiveApoFilters().filter((filter) => filter.enabled).length;
  const apoInstalled = state.equalizerApoStatus?.installed ?? false;
  const apoProfileEnabled = state.equalizerApoStatus?.freakishEarsIncludedInConfig ?? false;
  apoEnableOffButton.disabled = state.busy || !apoInstalled;
  apoEnableOnButton.disabled = (state.busy || !apoInstalled || enabledFilterCount === 0) && !apoProfileEnabled;
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

function formatElapsedDuration(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getCurrentAutomationElapsedMs(): number {
  if (!state.automationRunning || state.automationStartedAtMs === null) {
    return state.automationElapsedMs;
  }

  return state.automationElapsedMs + (Date.now() - state.automationStartedAtMs);
}

function updateAutomationProgressUi(): void {
  automationIterationValue.textContent = String(state.automationDisplayedPassCount);
  automationElapsedValue.textContent = formatElapsedDuration(getCurrentAutomationElapsedMs());
}

function stopAutomationTimer(): void {
  if (state.automationTimerId) {
    window.clearInterval(state.automationTimerId);
    state.automationTimerId = 0;
  }

  if (state.automationStartedAtMs !== null) {
    state.automationElapsedMs += Date.now() - state.automationStartedAtMs;
    state.automationStartedAtMs = null;
  }

  updateAutomationProgressUi();
}

function startAutomationTimer(): void {
  stopAutomationTimer();
  state.automationElapsedMs = 0;
  state.automationStartedAtMs = Date.now();
  state.automationTimerId = window.setInterval(() => {
    updateAutomationProgressUi();
  }, 1000);
  updateAutomationProgressUi();
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
  updateAutomationProgressUi();
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

  inputChannelSelect.value = 'left';
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

  state.apoEqModes = createDefaultApoEqModes();
  state.apoChannelProfile = 'all';
  state.apoMaxFilters = createDefaultApoMaxFilterCounts();
  state.apoImportedPreampDb = createDefaultApoImportedPreampDb();
  state.apoImportedBlockRepeatCount = createDefaultApoImportedBlockRepeatCount();
  state.apoFilters = createDefaultApoFilterSets();
  state.nextApoFilterIndex = 1;
  for (const channelProfile of APO_CHANNEL_PROFILES) {
    syncParametricFiltersToCount(channelProfile);
    syncGraphicEqFiltersToBandCount(channelProfile);
  }
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
  const inputChannel = getSelectedInputChannel();
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
    const activeMicrophoneCalibration = getActiveMicrophoneCalibration(inputChannel);
    const calibratedAnalysis = activeMicrophoneCalibration
      ? applyMicrophoneCalibration(analysis, activeMicrophoneCalibration.points)
      : analysis;

    if (activeMicrophoneCalibration) {
      appendLog(
        `Applied ${inputChannel} microphone calibration from ${activeMicrophoneCalibration.name} to this measurement.`,
      );
    }

    if (options?.discardIf?.()) {
      setStatus('Measurement stopped. Discarded the current sweep result.', 'idle');
      appendLog('Discarded the current sweep result because stop was requested.');
      return null;
    }

    const sessionName = `measurement-${formatTimestampForPath(new Date())}`;
    const measurementJson = buildMeasurementJson({
      analysis: calibratedAnalysis,
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
        microphoneCalibrationName: activeMicrophoneCalibration?.name ?? null,
        microphoneCalibrationSourcePath: activeMicrophoneCalibration?.sourcePath ?? null,
      },
      preRollSeconds: PRE_ROLL_SECONDS,
      postRollSeconds: POST_ROLL_SECONDS,
      splOffsetDb: state.splOffsetDb,
    });
    const measurementCsv = buildMeasurementCsv(calibratedAnalysis.points);

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

    const measurement = takeMeasurementFromAnalysis(
      calibratedAnalysis,
      saveResult.sessionDirectory,
    );
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

function getActiveMicrophoneCalibration(
  inputChannel: 'left' | 'right',
): MeasurementImport | null {
  return inputChannel === 'right'
    ? state.rightMicrophoneCalibration
    : state.leftMicrophoneCalibration;
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
    : getLastItem(state.measurements)?.id ?? null;
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
    state.focusedMeasurementId = getLastItem(state.measurements)?.id ?? null;
  }

  if (state.apoSelectedMeasurementId === measurementId) {
    state.apoSelectedMeasurementId = getLastItem(state.measurements)?.id ?? null;
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
    state.apoSelectedReferenceId = getLastItem(state.referenceCurves)?.id ?? null;
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
    state.focusedMeasurementId = getLastItem(state.measurements)?.id ?? null;
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
      state.automationStopOnTolerance && getLastItem(state.measurements) && getSelectedApoReference()
        ? {
            measurementId: getLastItem(state.measurements)?.id ?? '',
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
    eqMode: getActiveApoEqMode(),
    sampleRate: getSelectedSampleRate(),
    responseMultiplier: getActiveImportedApoBlockRepeatCount() ?? 1,
    preampDb: getPlotAppliedApoPreampDb(),
    measurementName: measurement?.name ?? null,
    targetName: referenceCurve?.name ?? null,
    compact: apoCompact,
    containerWidth: apoContainerWidth > 0 ? apoContainerWidth : DEFAULT_PLOT_WIDTH,
  });

  attachApoPlotInteractions({
    plotCard: apoPlotCard,
    filters: activeApoFilters,
    eqMode: getActiveApoEqMode(),
    sampleRate: getSelectedSampleRate(),
    responseMultiplier: getActiveImportedApoBlockRepeatCount() ?? 1,
    preampDb: getPlotAppliedApoPreampDb(),
    lockFrequency: getActiveApoEqMode() === 'graphic',
    onFilterDrag: handleApoFilterDrag,
    onDragEnd: handleApoFilterDragEnd,
    onAddFilter: addApoFilterAtPoint,
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

  return getLastItem(state.measurements) ?? null;
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

  if (storedInputChannel === 'left' || storedInputChannel === 'right') {
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
    inputChannel: getSelectedInputChannel(),
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
    apoEqModes: state.apoEqModes,
    apoEqMode: getActiveApoEqMode(),
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
    apoChannelProfile: state.apoChannelProfile,
    apoSelectedMeasurementId: state.apoSelectedMeasurementId,
    apoSelectedReferenceId: state.apoSelectedReferenceId,
    apoMaxFilters: state.apoMaxFilters,
    apoImportedPreampDb: state.apoImportedPreampDb,
    apoImportedBlockRepeatCount: state.apoImportedBlockRepeatCount,
    apoMaxBoostDb: state.apoMaxBoostDb,
    apoMaxCutDb: state.apoMaxCutDb,
    apoFilters: state.apoFilters,
    leftMicrophoneCalibration: state.leftMicrophoneCalibration,
    rightMicrophoneCalibration: state.rightMicrophoneCalibration,
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

async function importMicrophoneCalibrationFile(
  file: File,
  channel: 'left' | 'right',
): Promise<void> {
  if (state.busy) {
    return;
  }

  try {
    setBusy(true);
    setStatus(`Importing ${channel} microphone calibration...`, 'working');

    const contents = await file.text();
    const importedCalibration = parseImportedMeasurementFile(file, contents);

    if (channel === 'left') {
      state.leftMicrophoneCalibration = importedCalibration;
    } else {
      state.rightMicrophoneCalibration = importedCalibration;
    }

    updateMicrophoneCalibrationLabels();
    persistActiveConfiguration();
    setStatus(`Imported ${channel} microphone calibration.`, 'success');
    appendLog(
      `Imported ${channel} microphone calibration from ${file.name}. Future ${channel} input measurements will be corrected using this curve.`,
      'success',
    );
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`Unable to import ${channel} microphone calibration: ${message}`, 'error');
    appendLog(`Calibration import failed for ${file.name}: ${message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function clearMicrophoneCalibration(channel: 'left' | 'right'): void {
  if (state.busy) {
    return;
  }

  if (channel === 'left') {
    if (state.leftMicrophoneCalibration === null) {
      return;
    }

    state.leftMicrophoneCalibration = null;
  } else {
    if (state.rightMicrophoneCalibration === null) {
      return;
    }

    state.rightMicrophoneCalibration = null;
  }

  updateMicrophoneCalibrationLabels();
  persistActiveConfiguration();
  setStatus(`Cleared ${channel} microphone calibration.`, 'success');
  appendLog(`Cleared ${channel} microphone calibration.`, 'success');
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
      inputChannel: getSelectedInputChannel(),
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
      leftMicrophoneCalibration: state.leftMicrophoneCalibration,
      rightMicrophoneCalibration: state.rightMicrophoneCalibration,
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
      : 'left';
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

  state.leftMicrophoneCalibration = normalizeImportedMeasurement(
    config.leftMicrophoneCalibration,
  );
  state.rightMicrophoneCalibration = normalizeImportedMeasurement(
    config.rightMicrophoneCalibration,
  );
  updateMicrophoneCalibrationLabels();

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
    const hasImportedApoEqModes = hasOwnConfigProperty(config, 'apoEqModes');
    const hasImportedApoEqMode = hasOwnConfigProperty(config, 'apoEqMode');
    const hasImportedApoChannelProfile = hasOwnConfigProperty(config, 'apoChannelProfile');
    const hasImportedApoFilters =
      hasOwnConfigProperty(config, 'apoFilters') ||
      hasOwnConfigProperty(config, 'parametricApoFilters') ||
      hasOwnConfigProperty(config, 'graphicApoFilters') ||
      hasOwnConfigProperty(config, 'parametric') ||
      hasOwnConfigProperty(config, 'graphic') ||
      hasOwnConfigProperty(config, 'all') ||
      hasOwnConfigProperty(config, 'left') ||
      hasOwnConfigProperty(config, 'right');
    const hasImportedApoMaxFilters =
      hasOwnConfigProperty(config, 'apoMaxFilters') ||
      hasOwnConfigProperty(config, 'parametricApoMaxFilters') ||
      hasOwnConfigProperty(config, 'graphicApoMaxFilters');
    const hasImportedApoSelectedMeasurementId = hasOwnConfigProperty(config, 'apoSelectedMeasurementId');
    const hasImportedApoSelectedReferenceId = hasOwnConfigProperty(config, 'apoSelectedReferenceId');
    const hasImportedApoPreampDb =
      hasOwnConfigProperty(config, 'apoImportedPreampDb') ||
      hasOwnConfigProperty(config, 'parametricApoImportedPreampDb') ||
      hasOwnConfigProperty(config, 'graphicApoImportedPreampDb');
    const hasImportedApoBlockRepeatCount =
      hasOwnConfigProperty(config, 'apoImportedBlockRepeatCount') ||
      hasOwnConfigProperty(config, 'parametricApoImportedBlockRepeatCount') ||
      hasOwnConfigProperty(config, 'graphicApoImportedBlockRepeatCount');

    if (hasImportedApoEqModes) {
      state.apoEqModes = normalizeImportedApoEqModes(config.apoEqModes);
    }

    if (hasImportedApoEqMode && isApoEqMode(config.apoEqMode)) {
      setActiveApoEqMode(config.apoEqMode);
    }

    if (hasImportedApoChannelProfile && isApoChannelProfile(config.apoChannelProfile)) {
      state.apoChannelProfile = config.apoChannelProfile;
    }

    if (hasImportedApoFilters) {
      state.apoFilters = normalizeImportedApoChannelFilterSets(
        hasOwnConfigProperty(config, 'apoFilters') ? config.apoFilters : config,
        getActiveApoEqMode(),
      );
    }
    if (hasImportedApoSelectedMeasurementId) {
      state.apoSelectedMeasurementId = toOptionalString(config.apoSelectedMeasurementId);
    }
    if (hasImportedApoSelectedReferenceId) {
      state.apoSelectedReferenceId = toOptionalString(config.apoSelectedReferenceId);
    }
    if (hasImportedApoMaxFilters) {
      state.apoMaxFilters = normalizeImportedApoChannelMaxFilterCounts(
        hasOwnConfigProperty(config, 'apoMaxFilters') ? config.apoMaxFilters : config,
      );
    }
    if (hasImportedApoPreampDb) {
      state.apoImportedPreampDb = normalizeImportedApoChannelPreampDb(
        hasOwnConfigProperty(config, 'apoImportedPreampDb') ? config.apoImportedPreampDb : config,
      );
    }
    if (hasImportedApoBlockRepeatCount) {
      state.apoImportedBlockRepeatCount = normalizeImportedApoChannelBlockRepeatCounts(
        hasOwnConfigProperty(config, 'apoImportedBlockRepeatCount') ? config.apoImportedBlockRepeatCount : config,
      );
    }

    for (const channelProfile of APO_CHANNEL_PROFILES) {
      if (hasImportedApoMaxFilters) {
        if (
          getApoFilters(channelProfile, 'parametric').length > 0 ||
          getApoEqMode(channelProfile) === 'parametric'
        ) {
          syncParametricFiltersToCount(channelProfile);
        }

        if (
          getApoFilters(channelProfile, 'graphic').length > 0 ||
          getApoEqMode(channelProfile) === 'graphic'
        ) {
          syncGraphicEqFiltersToBandCount(channelProfile);
        }
        continue;
      }

      const importedParametricFilters = getApoFilters(channelProfile, 'parametric');
      if (importedParametricFilters.length > 0) {
        syncParametricApoFilterCountToFilters(channelProfile);
      } else if (hasImportedApoFilters) {
        setApoMaxFilters(1, channelProfile, 'parametric');
        syncParametricFiltersToCount(channelProfile);
      }

      const importedGraphicFilters = getApoFilters(channelProfile, 'graphic');
      if (importedGraphicFilters.length > 0) {
        setApoMaxFilters(
          clamp(importedGraphicFilters.length, 1, MAX_GRAPHIC_APO_FILTERS),
          channelProfile,
          'graphic',
        );
      } else if (hasImportedApoFilters) {
        setApoMaxFilters(1, channelProfile, 'graphic');
        syncGraphicEqFiltersToBandCount(channelProfile);
      }
    }
  }
  state.apoMaxBoostDb = DEFAULT_APO_MAX_BOOST_DB;
  state.apoMaxCutDb = DEFAULT_APO_MAX_CUT_DB;
  state.nextApoFilterIndex = getNextApoFilterIndex();
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
    state.focusedMeasurementId = getLastItem(state.measurements)?.id ?? null;
  }

  if (state.apoSelectedMeasurementId && removedIds.has(state.apoSelectedMeasurementId)) {
    state.apoSelectedMeasurementId = getLastItem(state.measurements)?.id ?? null;
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

function getSelectedInputChannel(): 'left' | 'right' {
  return inputChannelSelect.value === 'right' ? 'right' : 'left';
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

function createDefaultApoFilterSets(): ApoChannelProfileState<ApoModeState<ApoFilter[]>> {
  return {
    all: { parametric: [], graphic: [] },
    left: { parametric: [], graphic: [] },
    right: { parametric: [], graphic: [] },
  };
}

function createDefaultApoEqModes(): ApoChannelProfileState<ApoEqMode> {
  return {
    all: DEFAULT_APO_EQ_MODE,
    left: DEFAULT_APO_EQ_MODE,
    right: DEFAULT_APO_EQ_MODE,
  };
}

function createDefaultApoMaxFilterCounts(): ApoChannelProfileState<ApoModeState<number>> {
  return {
    all: {
      parametric: clamp(DEFAULT_APO_MAX_FILTERS, 1, MAX_PARAMETRIC_APO_FILTERS),
      graphic: clamp(DEFAULT_GRAPHIC_APO_MAX_FILTERS, 1, MAX_GRAPHIC_APO_FILTERS),
    },
    left: {
      parametric: clamp(DEFAULT_APO_MAX_FILTERS, 1, MAX_PARAMETRIC_APO_FILTERS),
      graphic: clamp(DEFAULT_GRAPHIC_APO_MAX_FILTERS, 1, MAX_GRAPHIC_APO_FILTERS),
    },
    right: {
      parametric: clamp(DEFAULT_APO_MAX_FILTERS, 1, MAX_PARAMETRIC_APO_FILTERS),
      graphic: clamp(DEFAULT_GRAPHIC_APO_MAX_FILTERS, 1, MAX_GRAPHIC_APO_FILTERS),
    },
  };
}

function createDefaultApoImportedPreampDb(): ApoChannelProfileState<ApoModeState<number | null>> {
  return {
    all: { parametric: null, graphic: null },
    left: { parametric: null, graphic: null },
    right: { parametric: null, graphic: null },
  };
}

function createDefaultApoImportedBlockRepeatCount(): ApoChannelProfileState<
  ApoModeState<number | null>
> {
  return {
    all: { parametric: null, graphic: null },
    left: { parametric: null, graphic: null },
    right: { parametric: null, graphic: null },
  };
}

function readStoredApoFilterSets(): ApoChannelProfileState<ApoModeState<ApoFilter[]>> {
  const stored = localStorage.getItem(APO_FILTERS_STORAGE_KEY);

  if (!stored) {
    return createDefaultApoFilterSets();
  }

  try {
    return normalizeImportedApoChannelFilterSets(JSON.parse(stored), readStoredApoEqModes().all);
  } catch {
    return createDefaultApoFilterSets();
  }
}

function readStoredApoMaxFilterCounts(): ApoChannelProfileState<ApoModeState<number>> {
  const stored = localStorage.getItem(APO_MAX_FILTERS_STORAGE_KEY);

  if (!stored) {
    return createDefaultApoMaxFilterCounts();
  }

  try {
    return normalizeImportedApoChannelMaxFilterCounts(JSON.parse(stored));
  } catch {
    const legacyValue = readStoredNumber(APO_MAX_FILTERS_STORAGE_KEY, DEFAULT_APO_MAX_FILTERS);
    return {
      all: {
        parametric: clamp(legacyValue, 1, MAX_PARAMETRIC_APO_FILTERS),
        graphic: clamp(legacyValue, 1, MAX_GRAPHIC_APO_FILTERS),
      },
      left: {
        parametric: clamp(DEFAULT_APO_MAX_FILTERS, 1, MAX_PARAMETRIC_APO_FILTERS),
        graphic: clamp(DEFAULT_GRAPHIC_APO_MAX_FILTERS, 1, MAX_GRAPHIC_APO_FILTERS),
      },
      right: {
        parametric: clamp(DEFAULT_APO_MAX_FILTERS, 1, MAX_PARAMETRIC_APO_FILTERS),
        graphic: clamp(DEFAULT_GRAPHIC_APO_MAX_FILTERS, 1, MAX_GRAPHIC_APO_FILTERS),
      },
    };
  }
}

function readStoredApoImportedPreampDb(): ApoChannelProfileState<ApoModeState<number | null>> {
  const stored = readPersistedActiveConfiguration();
  return normalizeImportedApoChannelPreampDb(stored ?? null);
}

function readStoredApoImportedBlockRepeatCount(): ApoChannelProfileState<
  ApoModeState<number | null>
> {
  const stored = readPersistedActiveConfiguration();
  return normalizeImportedApoChannelBlockRepeatCounts(stored ?? null);
}

function readStoredApoEqModes(): ApoChannelProfileState<ApoEqMode> {
  const stored = localStorage.getItem(APO_EQ_MODE_STORAGE_KEY);

  if (!stored) {
    return createDefaultApoEqModes();
  }

  try {
    return normalizeImportedApoEqModes(JSON.parse(stored));
  } catch {
    return {
      all: isApoEqMode(stored) ? stored : DEFAULT_APO_EQ_MODE,
      left: DEFAULT_APO_EQ_MODE,
      right: DEFAULT_APO_EQ_MODE,
    };
  }
}

function readStoredApoChannelProfile(): ApoChannelProfile {
  const stored = localStorage.getItem(APO_CHANNEL_PROFILE_STORAGE_KEY);
  return isApoChannelProfile(stored) ? stored : 'all';
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

function normalizeImportedApoChannelFilterSets(
  value: unknown,
  selectedMode: ApoEqMode,
): ApoChannelProfileState<ApoModeState<ApoFilter[]>> {
  const defaults = createDefaultApoFilterSets();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ...defaults,
      all: normalizeImportedApoFilterSets(value, selectedMode),
    };
  }

  const record = value as Record<string, unknown>;
  const hasChannelProfiles =
    hasOwnConfigProperty(record, 'all') ||
    hasOwnConfigProperty(record, 'left') ||
    hasOwnConfigProperty(record, 'right');

  if (!hasChannelProfiles) {
    return {
      ...defaults,
      all: normalizeImportedApoFilterSets(record, selectedMode),
    };
  }

  return {
    all: normalizeImportedApoFilterSets(record.all, selectedMode),
    left: normalizeImportedApoFilterSets(record.left, selectedMode),
    right: normalizeImportedApoFilterSets(record.right, selectedMode),
  };
}

function normalizeImportedApoEqModes(value: unknown): ApoChannelProfileState<ApoEqMode> {
  const defaults = createDefaultApoEqModes();

  if (isApoEqMode(value)) {
    return {
      ...defaults,
      all: value,
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }

  const record = value as Record<string, unknown>;
  return {
    all: isApoEqMode(record.all) ? record.all : defaults.all,
    left: isApoEqMode(record.left) ? record.left : defaults.left,
    right: isApoEqMode(record.right) ? record.right : defaults.right,
  };
}

function normalizeImportedApoMaxFilterCounts(
  value: unknown,
): { parametric: number; graphic: number } {
  if (typeof value === 'number' || typeof value === 'string') {
    const legacyValue = Number(value) || DEFAULT_APO_MAX_FILTERS;
    return {
      parametric: clamp(legacyValue, 1, MAX_PARAMETRIC_APO_FILTERS),
      graphic: clamp(legacyValue, 1, MAX_GRAPHIC_APO_FILTERS),
    };
  }

  if (!value || typeof value !== 'object') {
      return {
      parametric: clamp(DEFAULT_APO_MAX_FILTERS, 1, MAX_PARAMETRIC_APO_FILTERS),
      graphic: clamp(DEFAULT_GRAPHIC_APO_MAX_FILTERS, 1, MAX_GRAPHIC_APO_FILTERS),
    };
  }

  const record = value as Record<string, unknown>;
  return {
      parametric: clamp(Number(record.parametricApoMaxFilters) || DEFAULT_APO_MAX_FILTERS, 1, MAX_PARAMETRIC_APO_FILTERS),
      graphic: clamp(Number(record.graphicApoMaxFilters) || DEFAULT_GRAPHIC_APO_MAX_FILTERS, 1, MAX_GRAPHIC_APO_FILTERS),
  };
}

function normalizeImportedApoChannelMaxFilterCounts(
  value: unknown,
): ApoChannelProfileState<ApoModeState<number>> {
  const defaults = createDefaultApoMaxFilterCounts();
  if (!value || typeof value !== 'object' || typeof value === 'string' || typeof value === 'number') {
    return {
      ...defaults,
      all: normalizeImportedApoMaxFilterCounts(value),
    };
  }

  const record = value as Record<string, unknown>;
  const hasChannelProfiles =
    hasOwnConfigProperty(record, 'all') ||
    hasOwnConfigProperty(record, 'left') ||
    hasOwnConfigProperty(record, 'right');

  if (!hasChannelProfiles) {
    return {
      ...defaults,
      all: normalizeImportedApoMaxFilterCounts(record),
    };
  }

  return {
    all: normalizeImportedApoMaxFilterCounts(record.all),
    left: normalizeImportedApoMaxFilterCounts(record.left),
    right: normalizeImportedApoMaxFilterCounts(record.right),
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

function normalizeImportedApoChannelPreampDb(
  value: unknown,
): ApoChannelProfileState<ApoModeState<number | null>> {
  const defaults = createDefaultApoImportedPreampDb();
  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const record = value as Record<string, unknown>;
  const hasChannelProfiles =
    hasOwnConfigProperty(record, 'all') ||
    hasOwnConfigProperty(record, 'left') ||
    hasOwnConfigProperty(record, 'right');

  if (!hasChannelProfiles) {
    return {
      ...defaults,
      all: {
        parametric: normalizeImportedApoPreamp(record.parametricApoImportedPreampDb),
        graphic: normalizeImportedApoPreamp(record.graphicApoImportedPreampDb),
      },
    };
  }

  const normalizeProfile = (profileValue: unknown): ApoModeState<number | null> => {
    const profileRecord = profileValue && typeof profileValue === 'object'
      ? (profileValue as Record<string, unknown>)
      : {};
    return {
      parametric: normalizeImportedApoPreamp(profileRecord.parametric),
      graphic: normalizeImportedApoPreamp(profileRecord.graphic),
    };
  };

  return {
    all: normalizeProfile(record.all),
    left: normalizeProfile(record.left),
    right: normalizeProfile(record.right),
  };
}

function normalizeImportedApoChannelBlockRepeatCounts(
  value: unknown,
): ApoChannelProfileState<ApoModeState<number | null>> {
  const defaults = createDefaultApoImportedBlockRepeatCount();
  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const record = value as Record<string, unknown>;
  const hasChannelProfiles =
    hasOwnConfigProperty(record, 'all') ||
    hasOwnConfigProperty(record, 'left') ||
    hasOwnConfigProperty(record, 'right');

  if (!hasChannelProfiles) {
    return {
      ...defaults,
      all: {
        parametric: normalizeImportedApoBlockRepeatCount(record.parametricApoImportedBlockRepeatCount),
        graphic: normalizeImportedApoBlockRepeatCount(record.graphicApoImportedBlockRepeatCount),
      },
    };
  }

  const normalizeProfile = (profileValue: unknown): ApoModeState<number | null> => {
    const profileRecord = profileValue && typeof profileValue === 'object'
      ? (profileValue as Record<string, unknown>)
      : {};
    return {
      parametric: normalizeImportedApoBlockRepeatCount(profileRecord.parametric),
      graphic: normalizeImportedApoBlockRepeatCount(profileRecord.graphic),
    };
  };

  return {
    all: normalizeProfile(record.all),
    left: normalizeProfile(record.left),
    right: normalizeProfile(record.right),
  };
}

function isApoEqMode(value: unknown): value is ApoEqMode {
  return value === 'parametric' || value === 'graphic';
}

function isApoChannelProfile(value: unknown): value is ApoChannelProfile {
  return value === 'all' || value === 'left' || value === 'right';
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
  localStorage.setItem(APO_FILTERS_STORAGE_KEY, JSON.stringify(state.apoFilters));
  localStorage.setItem(APO_EQ_MODE_STORAGE_KEY, JSON.stringify(state.apoEqModes));
  localStorage.setItem(APO_CHANNEL_PROFILE_STORAGE_KEY, state.apoChannelProfile);
  localStorage.setItem(APO_MAX_FILTERS_STORAGE_KEY, JSON.stringify(state.apoMaxFilters));
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
      getActiveApoEqMode() === 'graphic' || axis === 'vertical'
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
  clearActiveImportedApoBlockRepeatCount();
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
  reapplyApoConfigIfEnabled();
}

function reapplyApoConfigIfEnabled(): void {
  if (!state.equalizerApoStatus?.freakishEarsIncludedInConfig) {
    return;
  }

  void applyApoConfig({ continueOnBusyFileError: true });
}

function syncApoGenerationSettings(normalize: boolean): void {
  const parsedMaxFilters = Number(apoMaxFiltersInput.value);
  const minimumFilters = 1;

  if (Number.isFinite(parsedMaxFilters)) {
    setActiveApoMaxFilters(
      clamp(
        Math.round(parsedMaxFilters),
        minimumFilters,
        getActiveApoEqMode() === 'graphic' ? MAX_GRAPHIC_APO_FILTERS : MAX_PARAMETRIC_APO_FILTERS,
      ),
    );
  }

  if (normalize) {
    apoMaxFiltersInput.value = String(getActiveApoMaxFilters());
  }

  if (getActiveApoEqMode() === 'graphic') {
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
  reapplyApoConfigIfEnabled();
}

function syncApoPreampSettings(value: string, normalize: boolean): void {
  const parsedPreampDb = Number(value);

  if (!Number.isFinite(parsedPreampDb)) {
    if (normalize) {
      const normalizedPreampDb = getActiveImportedApoPreampDb() ?? 0;
      apoPreampInput.value = normalizedPreampDb.toFixed(1);
      apoPreampNumberInput.value = normalizedPreampDb.toFixed(1);
    }

    return;
  }

  setActiveImportedApoPreampDb(roundTo(clamp(parsedPreampDb, APO_PREAMP_MIN_DB, APO_PREAMP_MAX_DB), 0.1));
  persistApoState();
  persistActiveConfiguration();

  if (normalize) {
    const normalizedPreampDb = getActiveImportedApoPreampDb() ?? 0;
    apoPreampInput.value = normalizedPreampDb.toFixed(1);
    apoPreampNumberInput.value = normalizedPreampDb.toFixed(1);
  }

  renderApoSection();
  reapplyApoConfigIfEnabled();
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
  syncApoChannelProfileToggle();
  syncApoEqModeToggle();
  syncApoPreampMeter();
  apoMaxFiltersInput.min = '1';
  apoMaxFiltersInput.max = String(
    getActiveApoEqMode() === 'graphic' ? MAX_GRAPHIC_APO_FILTERS : MAX_PARAMETRIC_APO_FILTERS,
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
  syncApoEnableToggle();
  apoApplyStatus.textContent = getApoApplyStatusText();
  apoApplyWarning.hidden = !state.equalizerApoStatus?.peaceRunning;
  renderApoPresetMenu();
  renderPlotCard(
    state.measurements.filter((measurement) => measurement.visible),
    state.referenceCurves.filter((referenceCurve) => referenceCurve.visible),
  );
  updateAutomationUi();
  updateMeasurementActionState();
}

function syncApoChannelProfileToggle(): void {
  const channelProfileButtons: Record<ApoChannelProfile, HTMLButtonElement> = {
    all: apoChannelProfileAllButton,
    left: apoChannelProfileLeftButton,
    right: apoChannelProfileRightButton,
  };

  apoChannelProfileToggle.style.setProperty('--segmented-count', '3');
  apoChannelProfileToggle.style.setProperty(
    '--segmented-index',
    String(APO_CHANNEL_PROFILES.indexOf(state.apoChannelProfile)),
  );

  for (const channelProfile of APO_CHANNEL_PROFILES) {
    const button = channelProfileButtons[channelProfile];
    const isActive = state.apoChannelProfile === channelProfile;
    button.dataset.active = String(isActive);
    button.setAttribute('aria-selected', String(isActive));
  }
}

function syncApoEqModeToggle(): void {
  const isGraphic = getActiveApoEqMode() === 'graphic';

  apoEqModeToggle.style.setProperty('--segmented-count', '2');
  apoEqModeToggle.style.setProperty('--segmented-index', isGraphic ? '1' : '0');
  apoCard.classList.toggle('is-graphic', isGraphic);
  apoEqModeParametricButton.dataset.active = String(!isGraphic);
  apoEqModeGraphicButton.dataset.active = String(isGraphic);
  apoEqModeParametricButton.setAttribute('aria-selected', String(!isGraphic));
  apoEqModeGraphicButton.setAttribute('aria-selected', String(isGraphic));
}

function syncApoPreampMeter(): void {
  const importedPreampDb = getActiveImportedApoPreampDb();
  const displayPreampDb = roundTo(importedPreampDb === null ? 0 : importedPreampDb, 0.1);

  apoPreampInput.value = displayPreampDb.toFixed(1);
  renderApoPreampTicks();
  apoPreampInput.setAttribute(
    'aria-label',
    importedPreampDb === null
      ? 'Preamp 0.0 dB. No imported profile preamp is active.'
      : `Preamp ${displayPreampDb >= 0 ? '+' : ''}${displayPreampDb.toFixed(1)} dB imported from the active profile.`,
  );
  apoPreampNumberInput.value = displayPreampDb.toFixed(1);
  apoPreampHint.textContent = importedPreampDb === null
    ? 'No imported profile preamp is active for this channel and mode.'
    : 'Imported profile preamp applied to this channel and mode.';
}

function renderApoPreampTicks(): void {
  const sliderWidth = Math.max(apoPreampInput.clientWidth, 0);
  const intervalDb = getApoPreampTickIntervalDb(sliderWidth);
  const tickValues: number[] = [];

  for (let valueDb = APO_PREAMP_MIN_DB; valueDb <= APO_PREAMP_MAX_DB; valueDb += intervalDb) {
    tickValues.push(valueDb);
  }

  apoPreampTicks.innerHTML = tickValues
    .map((valueDb, index) => {
      const positionPercent = ((valueDb - APO_PREAMP_MIN_DB) / (APO_PREAMP_MAX_DB - APO_PREAMP_MIN_DB)) * 100;
      const edge = index === 0 ? 'start' : index === tickValues.length - 1 ? 'end' : 'middle';
      const label = valueDb > 0 ? `+${valueDb}` : String(valueDb);
      return `<span class="apo-preamp-tick" data-edge="${edge}" style="--tick-position:${positionPercent.toFixed(4)}%">${label}</span>`;
    })
    .join('');
}

function getApoPreampTickIntervalDb(sliderWidth: number): number {
  const availableTickCount = Math.max(5, Math.floor(sliderWidth / 54) + 1);
  const candidateIntervals = [1, 2, 3, 4, 6, 8, 12, 24];

  for (const intervalDb of candidateIntervals) {
    const tickCount = Math.floor((APO_PREAMP_MAX_DB - APO_PREAMP_MIN_DB) / intervalDb) + 1;
    if (tickCount <= availableTickCount) {
      return intervalDb;
    }
  }

  return 24;
}

function syncApoEnableToggle(): void {
  const isEnabled = state.equalizerApoStatus?.freakishEarsIncludedInConfig ?? false;

  apoEnableToggle.style.setProperty('--segmented-count', '2');
  apoEnableToggle.style.setProperty('--segmented-index', isEnabled ? '1' : '0');
  apoEnableOffButton.dataset.active = String(!isEnabled);
  apoEnableOnButton.dataset.active = String(isEnabled);
  apoEnableOffButton.setAttribute('aria-selected', String(!isEnabled));
  apoEnableOnButton.setAttribute('aria-selected', String(isEnabled));
}

function getApoApplyStatusText(): string {
  const enabledFilterCount = APO_CHANNEL_PROFILES.reduce(
    (count, channelProfile) =>
      count + getApoFilters(channelProfile, getApoEqMode(channelProfile)).filter((filter) => filter.enabled).length,
    0,
  );

  if (enabledFilterCount === 0) {
    return state.equalizerApoStatus?.freakishEarsIncludedInConfig
      ? 'No APO filters are enabled. Turn the APO profile off or enable at least one filter.'
      : 'Enable at least one filter to turn the APO profile on.';
  }

  const status = state.equalizerApoStatus;

  if (!status) {
    return 'Checking Equalizer APO status...';
  }

  if (!status.installed) {
    return 'Equalizer APO not detected in the default install path.';
  }

  if (status.peaceRunning) {
    return 'PEACE is running. The APO profile toggle still works, but PEACE may override the active profile until it is closed.';
  }

  if (status.peaceIncludedInConfig) {
    return 'PEACE is included in config.txt. The APO profile toggle will still update FreakishEars.txt.';
  }

  if (status.freakishEarsIncludedInConfig) {
    return `The APO profile writes to ${status.profilePath ?? 'FreakishEars.txt'} and is currently enabled in Equalizer APO.`;
  }

  return `The APO profile writes to ${status.profilePath ?? 'FreakishEars.txt'} and is currently disabled in Equalizer APO.`;
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
    state.apoSelectedMeasurementId = getLastItem(state.measurements)?.id ?? null;
    apoMeasurementSelect.value = state.apoSelectedMeasurementId ?? '';
  }

  if (
    state.apoSelectedReferenceId &&
    state.referenceCurves.some((referenceCurve) => referenceCurve.id === state.apoSelectedReferenceId)
  ) {
    apoReferenceSelect.value = state.apoSelectedReferenceId;
  } else {
    state.apoSelectedReferenceId = state.referenceCurves.find((referenceCurve) => referenceCurve.visible)?.id ?? getLastItem(state.referenceCurves)?.id ?? null;
    apoReferenceSelect.value = state.apoSelectedReferenceId ?? '';
  }

  persistApoSelections();
}

function renderApoFilterList(): string {
  const activeApoFilters = getActiveApoFilters();

  if (activeApoFilters.length === 0) {
    return getActiveApoEqMode() === 'graphic'
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
          ${getActiveApoEqMode() === 'graphic'
            ? ''
            : `<select data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="kind" ${state.busy ? 'disabled' : ''}>
             ${PARAMETRIC_APO_FILTER_KIND_OPTIONS.map(
               (option) => `<option value="${option.value}" ${filter.kind === option.value ? 'selected' : ''}>${option.label}</option>`,
             ).join('')}
           </select>`}
          <input type="number" min="20" max="20000" step="1" value="${filter.frequencyHz.toFixed(0)}" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="frequencyHz" ${(state.busy || getActiveApoEqMode() === 'graphic') ? 'disabled' : ''} />
          <input type="number" min="-24" max="24" step="0.1" value="${filter.gainDb.toFixed(1)}" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="gainDb" ${(state.busy || !apoFilterKindUsesGain(filter.kind)) ? 'disabled' : ''} />
          ${renderApoFilterShapeInput(filter)}
          <button class="btn btn-secondary measurement-remove-button" type="button" data-apo-filter-remove="${escapeHtml(filter.id)}" ${(state.busy || getActiveApoEqMode() === 'graphic' || activeApoFilters.length <= 1) ? 'disabled' : ''}>Remove</button>
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
  if (getActiveApoEqMode() === 'graphic' || !apoFilterKindUsesShape(filter.kind)) {
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
  if (getActiveApoEqMode() === 'graphic') {
    return;
  }

  if (getApoFilters(state.apoChannelProfile, 'parametric').length >= MAX_PARAMETRIC_APO_FILTERS) {
    appendLog(`Parametric APO filters are limited to ${MAX_PARAMETRIC_APO_FILTERS}.`, 'neutral');
    renderApoSection();
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
  reapplyApoConfigIfEnabled();
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
  if (getActiveApoEqMode() === 'graphic') {
    const graphicFilters = buildGraphicEqFilters(getActiveApoMaxFilters());
    setActiveApoFilters(graphicFilters);
    state.nextApoFilterIndex = graphicFilters.length + 1;
  } else {
    setActiveApoFilters([
      {
        id: 'apo-filter-1',
        enabled: true,
        kind: 'PK',
        frequencyHz: findNextParametricFilterFrequency([]),
        gainDb: 0,
        q: getDefaultApoFilterQ('PK'),
        order: null,
        slopeDbPerOct: null,
      },
    ]);
    syncParametricApoFilterCountToFilters();
    state.nextApoFilterIndex = 2;
  }
  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
  reapplyApoConfigIfEnabled();
  appendLog(
    getActiveApoEqMode() === 'graphic'
      ? 'Reset graphic EQ bands to flat.'
      : 'Cleared parametric APO filters back to one centered peak filter.',
    'neutral',
  );
}

function removeApoFilter(filterId: string): void {
  if (getActiveApoEqMode() === 'graphic') {
    return;
  }

  if (getApoFilters(state.apoChannelProfile, 'parametric').length <= 1) {
    appendLog('Parametric EQ requires at least one filter.', 'neutral');
    renderApoSection();
    return;
  }

  setActiveApoFilters(getActiveApoFilters().filter((filter) => filter.id !== filterId));
  clearActiveImportedApoPreamp();
  clearActiveImportedApoBlockRepeatCount();
  syncParametricApoFilterCountToFilters();
  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
  reapplyApoConfigIfEnabled();
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
      if (getActiveApoEqMode() === 'graphic') {
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
      if (getActiveApoEqMode() === 'graphic') {
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
  reapplyApoConfigIfEnabled();
}

function addApoFilterAtPoint(frequencyHz: number, gainDb: number): void {
  const clampedFrequencyHz = clamp(frequencyHz, DEFAULT_START_FREQUENCY, DEFAULT_END_FREQUENCY);
  const clampedGainDb = clamp(gainDb, -24, 24);

  if (getActiveApoEqMode() === 'graphic') {
    if (getApoFilters(state.apoChannelProfile, 'graphic').length >= MAX_GRAPHIC_APO_FILTERS) {
      appendLog(`Graphic EQ bands are limited to ${MAX_GRAPHIC_APO_FILTERS}.`, 'neutral');
      renderApoSection();
      return;
    }

    const sourceFilters: ApoFilter[] = [
      ...getApoFilters(state.apoChannelProfile, 'graphic'),
      {
        id: `apo-filter-${state.nextApoFilterIndex}`,
        enabled: true,
        kind: 'PK',
        frequencyHz: clampedFrequencyHz,
        gainDb: clampedGainDb,
        q: getDefaultApoFilterQ('PK'),
        order: null,
        slopeDbPerOct: null,
      },
    ];
    const nextBandCount = clamp(getApoMaxFilters(state.apoChannelProfile, 'graphic') + 1, 1, MAX_GRAPHIC_APO_FILTERS);
    const nextFilters = buildGraphicEqFilters(nextBandCount, sourceFilters);
    const nearestFilter = nextFilters.reduce<ApoFilter | null>((closest, filter) => {
      if (!closest) {
        return filter;
      }

      return Math.abs(filter.frequencyHz - clampedFrequencyHz) <
        Math.abs(closest.frequencyHz - clampedFrequencyHz)
        ? filter
        : closest;
    }, null);

    setApoMaxFilters(nextBandCount, state.apoChannelProfile, 'graphic');
    setApoFilters(nextFilters.map((filter) =>
      nearestFilter && filter.id === nearestFilter.id ? { ...filter, gainDb: clampedGainDb } : filter,
    ), state.apoChannelProfile, 'graphic');
    clearActiveImportedApoPreamp();
    clearActiveImportedApoBlockRepeatCount();
    state.nextApoFilterIndex = getNextApoFilterIndex();
    persistApoState();
    persistActiveConfiguration();
    renderApoSection();
    reapplyApoConfigIfEnabled();
    return;
  }

  addApoFilter({ frequencyHz: clampedFrequencyHz, gainDb: clampedGainDb });
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
    if (getActiveApoEqMode() === 'parametric') {
      syncParametricApoFilterCountToFilters();
    }
    state.nextApoFilterIndex = generatedFilters.length + 1;
    persistApoState();
    persistActiveConfiguration();
    renderApoSection();
    reapplyApoConfigIfEnabled();

    setStatus(`Generated ${generatedFilters.length} APO filter${generatedFilters.length === 1 ? '' : 's'}.`, 'success');
    appendLog(
      useAutomationAlgorithm
        ? `Generated ${generatedFilters.length} ${getActiveApoEqMode() === 'graphic' ? 'graphic EQ band' : 'APO filter'}${generatedFilters.length === 1 ? '' : 's'} from ${measurement.name} to ${referenceCurve.name} with the ${formatAutomationAlgorithmLabel(state.automationAlgorithm)} algorithm.`
        : `Generated ${generatedFilters.length} ${getActiveApoEqMode() === 'graphic' ? 'graphic EQ band' : 'APO filter'}${generatedFilters.length === 1 ? '' : 's'} from ${measurement.name} to ${referenceCurve.name}.`,
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

function renderApoPresetMenu(): void {
  const presets = state.peacePresets;

  if (presets.length === 0) {
    state.apoPresetMenuOpen = false;
  }

  selectApoPresetButton.setAttribute('aria-expanded', String(state.apoPresetMenuOpen));
  apoPresetMenuAnchor.classList.toggle('is-open', state.apoPresetMenuOpen);
  apoPresetMenu.hidden = !state.apoPresetMenuOpen;
  apoPresetMenu.innerHTML = presets.length
    ? presets
        .map(
          (preset) =>
            `<button class="apo-preset-menu-item" type="button" role="menuitem" data-apo-preset-file-name="${escapeHtml(preset.fileName)}">${escapeHtml(preset.displayName)}</button>`,
        )
        .join('')
    : '<div class="apo-preset-menu-empty">No PEACE presets found.</div>';
}

function buildProportionalApoFilters(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
): ApoFilter[] {
  const proportionalP = getCurrentAutomationProportionalP(measurement, referenceCurve) ?? state.proportionalP;

  if (getActiveApoEqMode() === 'graphic') {
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
  if (getActiveApoEqMode() !== 'graphic') {
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
  if (getActiveApoEqMode() !== 'graphic') {
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
  if (getActiveApoEqMode() !== 'graphic') {
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
  const filterCount = clamp(getApoMaxFilters(state.apoChannelProfile, 'graphic'), 1, MAX_GRAPHIC_APO_FILTERS);
  const expectedFrequencies = getGraphicEqFrequencies(filterCount);
  const graphicFilters = getApoFilters(state.apoChannelProfile, 'graphic');

  return graphicFilters.length === filterCount
    ? graphicFilters.map((filter, index) => ({
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
  if (getActiveApoEqMode() === 'graphic') {
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

  for (let index = 0; index < getApoMaxFilters(state.apoChannelProfile, 'parametric'); index += 1) {
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
  const filterCount = clamp(getApoMaxFilters(state.apoChannelProfile, 'graphic'), 1, MAX_GRAPHIC_APO_FILTERS);
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
    getLastItem(measurementPoints)?.frequencyHz ?? DEFAULT_END_FREQUENCY,
    getLastItem(referencePoints)?.frequencyHz ?? DEFAULT_END_FREQUENCY,
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
    getLastItem(measurementPoints)?.frequencyHz ?? DEFAULT_END_FREQUENCY,
    getLastItem(referencePoints)?.frequencyHz ?? DEFAULT_END_FREQUENCY,
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
    getAllApoFilters().reduce((maxId, filter) => {
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

function getCombinedApoResponseDbForFilters(
  filters: ApoFilter[],
  frequencyHz: number,
  eqMode: ApoEqMode = getActiveApoEqMode(),
  responseMultiplier: number = getActiveImportedApoBlockRepeatCount() ?? 1,
): number {
  const totalResponseDb = filters.reduce((total, filter) => {
    if (!filter.enabled) {
      return total;
    }

    return total + getApoFilterResponseDbForCurrentSampleRate(filter, frequencyHz);
  }, 0);

  return totalResponseDb * (eqMode === 'parametric' ? responseMultiplier : 1);
}

function getPlotAppliedApoPreampDb(): number {
  const importedPreampDb = getActiveImportedApoPreampDb();
  return importedPreampDb === null ? 0 : roundTo(importedPreampDb, 0.1);
}

function buildApoConfigText(): string {
  const measurement = getSelectedApoMeasurement();
  const referenceCurve = getSelectedApoReference();
  const headerLines = [
    '# Equalizer APO config generated by autocal',
    measurement ? `# Measurement: ${measurement.name}` : '# Measurement: none selected',
    referenceCurve ? `# Target: ${referenceCurve.name}` : '# Target: none selected',
  ];

  const lines = [...headerLines];

  const channelTargets: Record<ApoChannelProfile, string> = {
    all: 'all',
    left: 'L',
    right: 'R',
  };

  const channelLabels: Record<ApoChannelProfile, string> = {
    all: 'All channels',
    left: 'Left channel',
    right: 'Right channel',
  };

  const buildFilterBlockLines = (channelProfile: ApoChannelProfile, eqMode: ApoEqMode): string[] => {
    const enabledFilters = getApoFilters(channelProfile, eqMode).filter((filter) => filter.enabled);
    const importedPreampDb = getImportedApoPreampDb(channelProfile, eqMode);
    const preampDb = importedPreampDb === null
      ? 0
      : roundTo(importedPreampDb, 0.1);
    const blockLines = [
      `Channel: ${channelTargets[channelProfile]}`,
      `# ${channelLabels[channelProfile]}`,
      `# Mode: ${eqMode}`,
      `Preamp: ${preampDb.toFixed(1)} dB`,
    ];

    if (enabledFilters.length === 0) {
      blockLines.push('# No enabled filters');
    } else if (eqMode === 'graphic') {
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

  for (const channelProfile of APO_CHANNEL_PROFILES) {
    if (lines.length > headerLines.length) {
      lines.push('');
    }

    const eqMode = getApoEqMode(channelProfile);
    const blockRepeatCount = eqMode === 'parametric'
      ? getImportedApoBlockRepeatCount(channelProfile, 'parametric') ?? 1
      : 1;

    for (let index = 0; index < blockRepeatCount; index += 1) {
      if (index > 0) {
        lines.push('');
      }
      lines.push(...buildFilterBlockLines(channelProfile, eqMode));
    }
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

function syncGraphicEqFiltersToBandCount(
  channelProfile: ApoChannelProfile = state.apoChannelProfile,
): void {
  const maxFilters = getApoMaxFilters(channelProfile, 'graphic');
  const graphicFilters = getApoFilters(channelProfile, 'graphic');
  setApoFilters(buildGraphicEqFilters(maxFilters, graphicFilters), channelProfile, 'graphic');
  state.nextApoFilterIndex = getNextApoFilterIndex();
}

function resetGraphicEqFiltersToFlat(): void {
  setApoFilters(buildGraphicEqFilters(getActiveApoMaxFilters()), state.apoChannelProfile, 'graphic');
  state.nextApoFilterIndex = getNextApoFilterIndex();
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

type ImportedEqProfileSet = {
  profiles: Partial<Record<ApoChannelProfile, ImportedEqProfile>>;
  applyToActiveChannelOnly: boolean;
};

async function importEqProfile(file: File): Promise<void> {
  if (state.busy) {
    return;
  }

  try {
    setBusy(true);
    setStatus('Importing EQ profile...', 'working');

    const contents = await file.text();
    applyImportedEqProfileSet(parseImportedEqProfileSet(contents), file.name);
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`EQ import failed: ${message}`, 'error');
    appendLog(`EQ import failed for ${file.name}: ${message}`, 'error');
  } finally {
    setBusy(false);
    renderApoSection();
  }
}

async function importPeacePreset(fileName: string): Promise<void> {
  if (state.busy) {
    return;
  }

  state.apoPresetMenuOpen = false;
  renderApoSection();

  try {
    setBusy(true);
    setStatus('Importing PEACE preset...', 'working');

    const preset = await window.freakishEars.readPeacePreset(fileName);
    applyImportedEqProfileSet(parseImportedEqProfileSet(preset.contents), preset.fileName);
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`PEACE preset import failed: ${message}`, 'error');
    appendLog(`PEACE preset import failed for ${fileName}: ${message}`, 'error');
  } finally {
    setBusy(false);
    renderApoSection();
  }
}

function applyImportedEqProfileSet(importedProfileSet: ImportedEqProfileSet, sourceLabel: string): void {
  const channelProfiles = importedProfileSet.applyToActiveChannelOnly
    ? [state.apoChannelProfile]
    : APO_CHANNEL_PROFILES.filter((channelProfile) => importedProfileSet.profiles[channelProfile]);

  if (channelProfiles.length === 0) {
    throw new Error('No supported EQ filters were found in the selected profile.');
  }

  const importSummaries: string[] = [];

  for (const channelProfile of channelProfiles) {
    const importedProfile = importedProfileSet.applyToActiveChannelOnly
      ? importedProfileSet.profiles.all
      : importedProfileSet.profiles[channelProfile];

    if (!importedProfile) {
      continue;
    }

    const maxFilterCount =
      importedProfile.mode === 'graphic' ? MAX_GRAPHIC_APO_FILTERS : MAX_PARAMETRIC_APO_FILTERS;
    const importedFilters = cloneApoFilters(importedProfile.filters.slice(0, maxFilterCount));

    setApoEqMode(importedProfile.mode, channelProfile);
    setApoFilters(importedFilters, channelProfile, importedProfile.mode);
    setApoMaxFilters(
      clamp(importedFilters.length || 1, 1, maxFilterCount),
      channelProfile,
      importedProfile.mode,
    );
    setImportedApoPreampDb(importedProfile.preampDb, channelProfile, importedProfile.mode);
    setImportedApoBlockRepeatCount(
      importedProfile.blockRepeatCount,
      channelProfile,
      importedProfile.mode,
    );

    const importSummary =
      importedProfile.mode === 'graphic'
        ? importedFilters.length === 0
          ? 'Imported an empty graphic EQ profile'
          : `Imported ${importedFilters.length} graphic EQ band${importedFilters.length === 1 ? '' : 's'}`
        : importedFilters.length === 0
          ? 'Imported an empty parametric profile'
          : `Imported ${importedFilters.length} parametric filter${importedFilters.length === 1 ? '' : 's'}`;
    const channelSummary = channelProfile === 'all' ? 'all channels' : `${channelProfile} channel`;
    const truncated = importedProfile.filters.length > importedFilters.length;
    const modeLabel = importedProfile.mode === 'graphic' ? 'Graphic' : 'Parametric';
    importSummaries.push(
      `${importSummary} into the ${channelSummary} profile from ${sourceLabel} and switched to ${modeLabel} mode${truncated ? ` (limited to ${maxFilterCount})` : ''}`,
    );
  }

  state.nextApoFilterIndex = getNextApoFilterIndex();

  persistApoState();
  persistActiveConfiguration();
  renderApoSection();
  reapplyApoConfigIfEnabled();

  setStatus(importSummaries[0] ?? 'Imported EQ profile.', 'success');
  for (const summary of importSummaries) {
    appendLog(`${summary}.`, 'success');
  }
}

function parseImportedEqProfileSet(contents: string): ImportedEqProfileSet {
  const apoChannelProfiles = parseEqualizerApoChannelProfiles(contents);
  if (apoChannelProfiles) {
    return {
      profiles: apoChannelProfiles,
      applyToActiveChannelOnly: false,
    };
  }

  const peaceParametricFilters = parsePeaceParametricEqFilters(contents);
  if (peaceParametricFilters.length > 0) {
    return {
      profiles: {
        all: {
          mode: 'parametric',
          filters: normalizeImportedEqFilters(peaceParametricFilters, 'parametric'),
          preampDb: parsePeacePreampDb(contents),
          blockRepeatCount: 2,
        },
      },
      applyToActiveChannelOnly: true,
    };
  }

  const parametricFilters = parseParametricEqFilters(contents);
  if (parametricFilters.length > 0) {
    return {
      profiles: {
        all: {
          mode: 'parametric',
          filters: normalizeImportedEqFilters(parametricFilters, 'parametric'),
          preampDb: parseEqualizerApoPreampDb(contents),
          blockRepeatCount: 1,
        },
      },
      applyToActiveChannelOnly: true,
    };
  }

  const graphicFilters = parseGraphicEqFilters(contents);
  if (graphicFilters.length > 0) {
    return {
      profiles: {
        all: {
          mode: 'parametric',
          filters: normalizeImportedEqFilters(graphicFilters, 'parametric'),
          preampDb: parseEqualizerApoPreampDb(contents),
          blockRepeatCount: 1,
        },
      },
      applyToActiveChannelOnly: true,
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

function parseEqualizerApoChannelProfiles(
  contents: string,
): Partial<Record<ApoChannelProfile, ImportedEqProfile>> | null {
  const blocks = contents.split(/(?=^Channel:\s*(?:all|L|R)\s*$)/gimu)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && /^Channel:\s*(?:all|L|R)\s*$/imu.test(block));

  if (blocks.length === 0) {
    return null;
  }

  const profiles: Partial<Record<ApoChannelProfile, ImportedEqProfile>> = {};

  for (const block of blocks) {
    const channelMatch = block.match(/^Channel:\s*(all|L|R)\s*$/imu);
    if (!channelMatch) {
      continue;
    }

    const channelProfile = mapImportedApoChannel(channelMatch[1]);
    const mode = parseEqualizerApoBlockMode(block);
    const filters = mode === 'graphic'
      ? normalizeImportedEqFilters(parseGraphicEqFilters(block), 'graphic')
      : normalizeImportedEqFilters(parseParametricEqFilters(block), 'parametric');
    const preampDb = parseEqualizerApoPreampDb(block);
    const nextProfile: ImportedEqProfile = {
      mode,
      filters,
      preampDb,
      blockRepeatCount: mode === 'parametric' ? 1 : 1,
    };
    const existingProfile = profiles[channelProfile];

    if (
      existingProfile &&
      existingProfile.mode === nextProfile.mode &&
      importedEqFiltersMatch(existingProfile.filters, nextProfile.filters) &&
      Math.abs(existingProfile.preampDb - nextProfile.preampDb) < 0.05
    ) {
      existingProfile.blockRepeatCount += 1;
      continue;
    }

    profiles[channelProfile] = nextProfile;
  }

  return Object.keys(profiles).length > 0 ? profiles : null;
}

function mapImportedApoChannel(value: string): ApoChannelProfile {
  switch (value.toUpperCase()) {
    case 'L':
      return 'left';
    case 'R':
      return 'right';
    default:
      return 'all';
  }
}

function parseEqualizerApoBlockMode(contents: string): ApoEqMode {
  const modeMatch = contents.match(/^#\s*Mode:\s*(parametric|graphic)\s*$/imu);
  const parsedMode = modeMatch?.[1]?.toLowerCase();
  if (parsedMode && isApoEqMode(parsedMode)) {
    return parsedMode;
  }

  return 'parametric';
}

function importedEqFiltersMatch(left: ApoFilter[], right: ApoFilter[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftFilter, index) => {
    const rightFilter = right[index];
    if (!rightFilter) {
      return false;
    }

    return leftFilter.enabled === rightFilter.enabled &&
      leftFilter.kind === rightFilter.kind &&
      Math.abs(leftFilter.frequencyHz - rightFilter.frequencyHz) < 0.05 &&
      Math.abs(leftFilter.gainDb - rightFilter.gainDb) < 0.05 &&
      Math.abs(leftFilter.q - rightFilter.q) < 0.01 &&
      leftFilter.order === rightFilter.order &&
      leftFilter.slopeDbPerOct === rightFilter.slopeDbPerOct;
  });
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
  const [statusResult, presetResult] = await Promise.allSettled([
    window.freakishEars.getEqualizerApoStatus(),
    window.freakishEars.listPeacePresets(),
  ]);

  if (statusResult.status === 'fulfilled') {
    state.equalizerApoStatus = statusResult.value;
  } else {
    appendLog(`Unable to read Equalizer APO status: ${getErrorMessage(statusResult.reason)}`, 'error');
    state.equalizerApoStatus = null;
  }

  if (presetResult.status === 'fulfilled') {
    state.peacePresets = presetResult.value;
  } else {
    appendLog(`Unable to load PEACE presets: ${getErrorMessage(presetResult.reason)}`, 'error');
    state.peacePresets = [];
  }

  renderApoSection();
}

async function applyApoConfig(options?: { continueOnBusyFileError?: boolean; enableProfile?: boolean }): Promise<boolean> {
  const status = state.equalizerApoStatus;
  const enableProfile = options?.enableProfile ?? true;

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
    setStatus(enableProfile ? 'Enabling Equalizer APO profile...' : 'Disabling Equalizer APO profile...', 'working');

    const result = await window.freakishEars.applyEqualizerApoConfig({
      configText: buildApoConfigText(),
      enableProfile,
    });

    await refreshEqualizerApoStatus();
    setStatus(enableProfile ? 'Equalizer APO profile enabled.' : 'Equalizer APO profile disabled.', 'success');
    appendLog(`${enableProfile ? 'Enabled' : 'Disabled'} Equalizer APO profile at ${result.profilePath}.`, 'success');
    showToast({
      message: enableProfile ? 'Equalizer APO profile enabled' : 'Equalizer APO profile disabled',
      actionLabel: 'View in Finder',
      actionPath: result.profilePath,
    });
    return true;
  } catch (error) {
    const message = getErrorMessage(error);
    await refreshEqualizerApoStatus();

    if (options?.continueOnBusyFileError && isBusyFileError(error)) {
      appendLog(`Equalizer APO profile update skipped because the config is locked: ${message}`);
      return true;
    }

    setStatus(`Equalizer APO profile update failed: ${message}`, 'error');
    appendLog(`Equalizer APO profile update failed: ${message}`, 'error');
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
  state.automationDisplayedPassCount = 0;
  state.automationPidIntegralByBand = {};
  state.automationPidPreviousErrorByBand = {};
  state.automationMomentumByBand = {};
  startAutomationTimer();
  setActiveApoEqMode('graphic');
  resetGraphicEqFiltersToFlat();
  persistApoState();
  persistActiveConfiguration();
  updateAutomationUi();
  renderApoSection();

  const appliedFlatProfile = await applyApoConfig({ continueOnBusyFileError: true });
  if (!appliedFlatProfile) {
    stopAutomationTimer();
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

      state.automationDisplayedPassCount += 1;
      updateAutomationProgressUi();

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
    stopAutomationTimer();
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
