import './index.css';
import logoUrl from './assets/dutocal-logo.webp';

import {
  APO_FILTERS_STORAGE_KEY,
  APO_MAX_BOOST_STORAGE_KEY,
  APO_MAX_CUT_STORAGE_KEY,
  APO_MAX_FILTERS_STORAGE_KEY,
  APO_SELECTED_MEASUREMENT_STORAGE_KEY,
  APO_SELECTED_REFERENCE_STORAGE_KEY,
  DEFAULT_MEASUREMENT_BACKEND,
  DEFAULT_APO_MAX_BOOST_DB,
  DEFAULT_APO_MAX_CUT_DB,
  DEFAULT_APO_MAX_FILTERS,
  DEFAULT_DURATION_SECONDS,
  DEFAULT_END_FREQUENCY,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_SMOOTHING_MODE,
  DEFAULT_SPL_OFFSET_DB,
  DEFAULT_START_FREQUENCY,
  DEFAULT_SWEEP_LEVEL_DB,
  MEASUREMENT_BACKEND_STORAGE_KEY,
  MAX_SWEEP_LEVEL_DB,
  MIN_SWEEP_LEVEL_DB,
  NORMALIZE_PLOT_STORAGE_KEY,
  PLOT_VIEW_MODE_STORAGE_KEY,
  POST_ROLL_SECONDS,
  PRE_ROLL_SECONDS,
  SAMPLE_RATE_OPTIONS,
  SMOOTHING_MODE_OPTIONS,
  SMOOTHING_MODE_STORAGE_KEY,
  SPL_OFFSET_STORAGE_KEY,
  STORAGE_KEY,
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
import { attachPlotInteractions, renderApoEqPlot, renderResponsePlot } from './renderer/plot';
import type {
  ApoFilter,
  AppState,
  LoadedMeasurement,
  LogTone,
  MeasurementBackend,
  MeasurementChannelSelection,
  MeasurementSmoothingMode,
  PlotViewMode,
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
} from './renderer/utils';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Unable to find the app root.');
}

app.innerHTML = `
  <main class="shell">
    <header class="header">
      <img class="header-logo" src="${logoUrl}" alt="dutocal" />
    </header>

    <section class="grid">
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

        <div class="field">
          <label for="splOffsetInput">SPL Offset</label>
          <div class="number-input-row">
            <input id="splOffsetInput" class="level-number-input" type="number" min="-120" max="180" step="0.1" value="${DEFAULT_SPL_OFFSET_DB}" />
            <span>dB</span>
          </div>
        </div>

        <button id="runMeasurementButton" class="btn btn-primary" type="button">
          Run
        </button>
      </section>

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

        <div class="plot-toolbar">
          <div class="plot-view-switch" role="tablist" aria-label="Plot views">
            <button id="measurementsViewButton" class="btn btn-secondary plot-view-button" type="button">Measurements</button>
            <button id="apoViewButton" class="btn btn-secondary plot-view-button" type="button">EQ Graph</button>
          </div>
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

        <input id="measurementFileInput" type="file" accept=".txt,.csv,.json,.targetcurve,text/plain,application/json" multiple hidden />
        <input id="referenceFileInput" type="file" accept=".txt,.csv,.targetcurve,text/plain" multiple hidden />
        <input id="configFileInput" type="file" accept=".json,application/json,text/plain" hidden />

        <div id="plotCard" class="plot-card">
          <span style="color:var(--text-muted);font-size:11px">Run or import measurements to plot response</span>
        </div>

        <div class="apo-card">
          <div class="apo-toolbar">
            <span class="section-title">Equalizer APO</span>
            <div class="apo-toolbar-actions">
              <button id="generateApoFiltersButton" class="btn btn-secondary" type="button">
                Generate
              </button>
              <button id="addApoFilterButton" class="btn btn-secondary" type="button">
                Add Filter
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

          <div class="inline-row apo-settings-row">
            <div class="inline-field">
              <label for="apoMaxFiltersInput">Filters</label>
              <input id="apoMaxFiltersInput" type="number" min="1" max="16" step="1" value="${DEFAULT_APO_MAX_FILTERS}" />
            </div>
            <div class="inline-field">
              <label for="apoMaxBoostInput">Max Boost</label>
              <input id="apoMaxBoostInput" type="number" min="0" max="24" step="0.5" value="${DEFAULT_APO_MAX_BOOST_DB}" />
            </div>
            <div class="inline-field">
              <label for="apoMaxCutInput">Max Cut</label>
              <input id="apoMaxCutInput" type="number" min="0" max="24" step="0.5" value="${DEFAULT_APO_MAX_CUT_DB}" />
            </div>
          </div>

          <span class="apo-hint">Generate a basic peaking-EQ set from the difference between the selected measurement and target curve, then fine-tune the filters below.</span>
          <span id="apoApplyStatus" class="apo-hint"></span>

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
const splOffsetInput = getElement<HTMLInputElement>('splOffsetInput');
const runMeasurementButton = getElement<HTMLButtonElement>('runMeasurementButton');
const statusPill = getElement<HTMLDivElement>('statusPill');
const latencyValue = getElement<HTMLSpanElement>('latencyValue');
const peakValue = getElement<HTMLSpanElement>('peakValue');
const rmsValue = getElement<HTMLSpanElement>('rmsValue');
const savedPathValue = getElement<HTMLSpanElement>('savedPathValue');
const importMeasurementsButton = getElement<HTMLButtonElement>('importMeasurementsButton');
const importReferenceButton = getElement<HTMLButtonElement>('importReferenceButton');
const normalizePlotToggle = getElement<HTMLInputElement>('normalizePlotToggle');
const smoothingModeSelect = getElement<HTMLSelectElement>('smoothingModeSelect');
const measurementsViewButton = getElement<HTMLButtonElement>('measurementsViewButton');
const apoViewButton = getElement<HTMLButtonElement>('apoViewButton');
const measurementFileInput = getElement<HTMLInputElement>('measurementFileInput');
const referenceFileInput = getElement<HTMLInputElement>('referenceFileInput');
const configFileInput = getElement<HTMLInputElement>('configFileInput');
const plotCard = getElement<HTMLDivElement>('plotCard');
const generateApoFiltersButton = getElement<HTMLButtonElement>('generateApoFiltersButton');
const addApoFilterButton = getElement<HTMLButtonElement>('addApoFilterButton');
const exportApoConfigButton = getElement<HTMLButtonElement>('exportApoConfigButton');
const applyApoConfigButton = getElement<HTMLButtonElement>('applyApoConfigButton');
const apoApplyWarning = getElement<HTMLDivElement>('apoApplyWarning');
const apoMeasurementSelect = getElement<HTMLSelectElement>('apoMeasurementSelect');
const apoReferenceSelect = getElement<HTMLSelectElement>('apoReferenceSelect');
const apoMaxFiltersInput = getElement<HTMLInputElement>('apoMaxFiltersInput');
const apoMaxBoostInput = getElement<HTMLInputElement>('apoMaxBoostInput');
const apoMaxCutInput = getElement<HTMLInputElement>('apoMaxCutInput');
const apoFilterList = getElement<HTMLDivElement>('apoFilterList');
const apoConfigPreview = getElement<HTMLTextAreaElement>('apoConfigPreview');
const apoApplyStatus = getElement<HTMLSpanElement>('apoApplyStatus');
const logList = getElement<HTMLUListElement>('logList');
const toastButton = getElement<HTMLButtonElement>('toastButton');

const state: AppState = {
  busy: false,
  outputFolder: localStorage.getItem(STORAGE_KEY),
  measurementBackend: readStoredMeasurementBackend(),
  splOffsetDb: readStoredNumber(SPL_OFFSET_STORAGE_KEY, DEFAULT_SPL_OFFSET_DB),
  normalizePlot: localStorage.getItem(NORMALIZE_PLOT_STORAGE_KEY) === 'true',
  smoothingMode: readStoredSmoothingMode(),
  measurements: [],
  referenceCurves: [],
  focusedMeasurementId: null,
  nextMeasurementIndex: 1,
  nextReferenceIndex: 1,
  apoFilters: readStoredApoFilters(),
  apoSelectedMeasurementId: localStorage.getItem(APO_SELECTED_MEASUREMENT_STORAGE_KEY),
  apoSelectedReferenceId: localStorage.getItem(APO_SELECTED_REFERENCE_STORAGE_KEY),
  apoMaxFilters: clamp(
    readStoredNumber(APO_MAX_FILTERS_STORAGE_KEY, DEFAULT_APO_MAX_FILTERS),
    1,
    16,
  ),
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
  plotViewMode: readStoredPlotViewMode(),
  equalizerApoStatus: null,
  toast: null,
  toastTimeoutId: 0,
};

state.nextApoFilterIndex =
  state.apoFilters.reduce((maxId, filter) => {
    const numericId = Number(filter.id.replace('apo-filter-', ''));
    return Number.isFinite(numericId) ? Math.max(maxId, numericId) : maxId;
  }, 0) + 1;

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
});

refreshDevicesButton.addEventListener('click', () => {
  void refreshMicrophones(true);
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

plotCard.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const measurementId = target.dataset.measurementToggle;
  if (measurementId) {
    setMeasurementVisibility(measurementId, target.checked);
    return;
  }

  const referenceId = target.dataset.referenceToggle;
  if (referenceId) {
    setReferenceVisibility(referenceId, target.checked);
  }
});

plotCard.addEventListener('click', (event) => {
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

splOffsetInput.addEventListener('input', () => {
  syncSplOffsetControl(false);
});

splOffsetInput.addEventListener('blur', () => {
  syncSplOffsetControl(true);
});

normalizePlotToggle.addEventListener('change', () => {
  state.normalizePlot = normalizePlotToggle.checked;
  localStorage.setItem(NORMALIZE_PLOT_STORAGE_KEY, String(state.normalizePlot));
  renderMeasurements();
});

smoothingModeSelect.addEventListener('change', () => {
  state.smoothingMode = getSelectedSmoothingMode();
  localStorage.setItem(SMOOTHING_MODE_STORAGE_KEY, state.smoothingMode);
  renderMeasurements();
  renderApoSection();
});

measurementsViewButton.addEventListener('click', () => {
  setPlotViewMode('measurements');
});

apoViewButton.addEventListener('click', () => {
  setPlotViewMode('apo');
});

generateApoFiltersButton.addEventListener('click', () => {
  void generateApoFilters();
});

addApoFilterButton.addEventListener('click', () => {
  addApoFilter();
});

exportApoConfigButton.addEventListener('click', () => {
  void exportApoConfig();
});

applyApoConfigButton.addEventListener('click', () => {
  void applyApoConfig();
});

apoMeasurementSelect.addEventListener('change', () => {
  state.apoSelectedMeasurementId = apoMeasurementSelect.value || null;
  persistApoSelections();
  renderApoSection();
});

apoReferenceSelect.addEventListener('change', () => {
  state.apoSelectedReferenceId = apoReferenceSelect.value || null;
  persistApoSelections();
  renderApoSection();
});

apoMaxFiltersInput.addEventListener('input', () => {
  syncApoGenerationSettings(false);
});

apoMaxFiltersInput.addEventListener('blur', () => {
  syncApoGenerationSettings(true);
});

apoMaxBoostInput.addEventListener('input', () => {
  syncApoGenerationSettings(false);
});

apoMaxBoostInput.addEventListener('blur', () => {
  syncApoGenerationSettings(true);
});

apoMaxCutInput.addEventListener('input', () => {
  syncApoGenerationSettings(false);
});

apoMaxCutInput.addEventListener('blur', () => {
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

updateSelectedFolder();
measurementBackendSelect.value = state.measurementBackend;
updateMeasurementBackendUi();
syncVolumeControls('slider');
syncSplOffsetControl(true);
normalizePlotToggle.checked = state.normalizePlot;
smoothingModeSelect.value = state.smoothingMode;
apoMaxFiltersInput.value = String(state.apoMaxFilters);
apoMaxBoostInput.value = String(state.apoMaxBoostDb);
apoMaxCutInput.value = String(state.apoMaxCutDb);
hideToast();
updateMeasurementActionState();
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
  runMeasurementButton.disabled = isBusy;
  measurementFileInput.disabled = isBusy;
  referenceFileInput.disabled = isBusy;
  configFileInput.disabled = isBusy;
  measurementBackendSelect.disabled = isBusy;
  smoothingModeSelect.disabled = isBusy;
  measurementsViewButton.disabled = isBusy;
  apoViewButton.disabled = isBusy;
  generateApoFiltersButton.disabled = isBusy;
  addApoFilterButton.disabled = isBusy;
  exportApoConfigButton.disabled = isBusy;
  applyApoConfigButton.disabled = isBusy;
  apoMeasurementSelect.disabled = isBusy;
  apoReferenceSelect.disabled = isBusy;
  apoMaxFiltersInput.disabled = isBusy;
  apoMaxBoostInput.disabled = isBusy;
  apoMaxCutInput.disabled = isBusy;
  updateMeasurementBackendUi();

  updateMeasurementActionState();

  if (state.measurements.length > 0 || state.referenceCurves.length > 0) {
    renderMeasurements();
  }
}

function setStatus(message: string, tone: StatusTone): void {
  statusPill.textContent = message;
  statusPill.dataset.tone = tone;
}

function appendLog(message: string, tone: LogTone = 'neutral'): void {
  const item = document.createElement('li');
  item.dataset.tone = tone;
  item.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  logList.prepend(item);
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
  generateApoFiltersButton.disabled =
    state.busy || !state.apoSelectedMeasurementId || !state.apoSelectedReferenceId;
  addApoFilterButton.disabled = state.busy;
  exportApoConfigButton.disabled = state.busy || !state.outputFolder;
  const enabledFilterCount = state.apoFilters.filter((filter) => filter.enabled).length;
  const apoInstalled = state.equalizerApoStatus?.installed ?? false;
  applyApoConfigButton.disabled = state.busy || enabledFilterCount === 0 || !apoInstalled;
}

function updateMeasurementBackendUi(): void {
  const usesSox = state.measurementBackend === 'sox';
  microphoneSelect.disabled = state.busy || usesSox;
  refreshDevicesButton.disabled = state.busy || usesSox;
  outputSelect.disabled = state.busy || usesSox;
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

function syncSplOffsetControl(normalize: boolean): void {
  const parsed = Number(splOffsetInput.value);
  if (!Number.isFinite(parsed)) {
    if (normalize) {
      splOffsetInput.value = state.splOffsetDb.toFixed(1);
    }

    return;
  }

  const nextOffsetDb = clamp(parsed, -120, 180);
  splOffsetInput.value = normalize ? nextOffsetDb.toFixed(1) : String(nextOffsetDb);

  if (nextOffsetDb === state.splOffsetDb) {
    return;
  }

  state.splOffsetDb = nextOffsetDb;
  localStorage.setItem(SPL_OFFSET_STORAGE_KEY, String(nextOffsetDb));

  if (state.measurements.length > 0) {
    renderMeasurements();
  }
}

async function chooseOutputFolder(): Promise<void> {
  const result = await window.freakishEars.selectOutputFolder();

  if (result.folderPath) {
    state.outputFolder = result.folderPath;
    localStorage.setItem(STORAGE_KEY, result.folderPath);
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
    }

    if (Array.from(outputSelect.options).some((option) => option.value === priorOutputSelection)) {
      outputSelect.value = priorOutputSelection;
    }

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

async function runMeasurement(): Promise<void> {
  if (state.busy) {
    return;
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
    return;
  }

  if (measurementBackend === 'web-audio' && !deviceId) {
    setStatus('Select a microphone before measuring.', 'error');
    appendLog('Measurement aborted because no microphone is selected.', 'error');
    return;
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
    return;
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

    addMeasurement(
      takeMeasurementFromAnalysis(analysis, saveResult.sessionDirectory),
    );
    setStatus('Measurement complete.', 'success');
    appendLog(`Measurement saved to ${saveResult.sessionDirectory}.`, 'success');
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`Measurement failed: ${message}`, 'error');
    appendLog(`Measurement failed: ${message}`, 'error');
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
  state.focusedMeasurementId = measurement.id;
  if (!state.apoSelectedMeasurementId) {
    state.apoSelectedMeasurementId = measurement.id;
    persistApoSelections();
  }
  renderMeasurements();
  renderApoSection();
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
  const visibleMeasurements = state.measurements.filter(
    (measurement) => measurement.visible,
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
  updatePlotViewButtons();

  if (state.plotViewMode === 'apo') {
    const measurement = getSelectedApoMeasurement();
    const referenceCurve = getSelectedApoReference();

    plotCard.innerHTML = renderApoEqPlot({
      filters: state.apoFilters,
      measurementName: measurement?.name ?? null,
      targetName: referenceCurve?.name ?? null,
    });
    return;
  }

  plotCard.innerHTML = renderResponsePlot({
    visibleMeasurements,
    allMeasurements: state.measurements,
    visibleReferenceCurves,
    allReferenceCurves: state.referenceCurves,
    normalizePlot: state.normalizePlot,
    smoothingMode: state.smoothingMode,
    splOffsetDb: state.splOffsetDb,
    busy: state.busy,
    outputFolder: state.outputFolder,
  });
  attachPlotInteractions({
    plotCard,
    measurements: visibleMeasurements,
    referenceCurves: visibleReferenceCurves,
    normalizePlot: state.normalizePlot,
    smoothingMode: state.smoothingMode,
    splOffsetDb: state.splOffsetDb,
  });
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

function readStoredPlotViewMode(): PlotViewMode {
  return localStorage.getItem(PLOT_VIEW_MODE_STORAGE_KEY) === 'apo'
    ? 'apo'
    : 'measurements';
}

function setPlotViewMode(viewMode: PlotViewMode): void {
  if (state.plotViewMode === viewMode) {
    return;
  }

  state.plotViewMode = viewMode;
  localStorage.setItem(PLOT_VIEW_MODE_STORAGE_KEY, viewMode);
  renderMeasurements();
}

function updatePlotViewButtons(): void {
  measurementsViewButton.dataset.active = state.plotViewMode === 'measurements' ? 'true' : 'false';
  apoViewButton.dataset.active = state.plotViewMode === 'apo' ? 'true' : 'false';
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

  const outputFolder = state.outputFolder;
  if (!outputFolder) {
    setStatus('Choose a save folder before exporting a config.', 'error');
    appendLog('Config export aborted because no save folder is selected.', 'error');
    return;
  }

  try {
    setBusy(true);
    setStatus('Saving configuration...', 'working');

    const payload = {
      savedAt: new Date().toISOString(),
      backend: getSelectedMeasurementBackend(),
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
      splOffsetDb: Number(splOffsetInput.value),
      smoothingMode: getSelectedSmoothingMode(),
      normalizePlot: normalizePlotToggle.checked,
      plotViewMode: state.plotViewMode,
      apoSelectedMeasurementId: state.apoSelectedMeasurementId,
      apoSelectedReferenceId: state.apoSelectedReferenceId,
      apoMaxFilters: state.apoMaxFilters,
      apoMaxBoostDb: state.apoMaxBoostDb,
      apoMaxCutDb: state.apoMaxCutDb,
      apoFilters: state.apoFilters,
    };

    const saveResult = await window.freakishEars.saveMeasurementSession({
      folderPath: outputFolder,
      sessionName: `configuration-${formatTimestampForPath(new Date())}`,
      files: [
        {
          name: 'measurement-config.json',
          contents: new TextEncoder().encode(JSON.stringify(payload, null, 2)),
        },
      ],
    });

    setStatus('Configuration saved.', 'success');
    appendLog(`Saved configuration to ${saveResult.filePaths[0] ?? saveResult.sessionDirectory}.`, 'success');
    showToast({
      message: 'Configuration saved',
      actionLabel: 'View in Finder',
      actionPath: saveResult.filePaths[0] ?? saveResult.sessionDirectory,
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

function applyImportedConfiguration(config: Record<string, unknown>): void {
  const backend = config.backend === 'sox' ? 'sox' : 'web-audio';
  measurementBackendSelect.value = backend;
  state.measurementBackend = backend;
  localStorage.setItem(MEASUREMENT_BACKEND_STORAGE_KEY, backend);

  const sampleRate = Number(config.sampleRate);
  if (Number.isFinite(sampleRate)) {
    sampleRateSelect.value = String(sampleRate);
  }

  inputChannelSelect.value =
    config.inputChannel === 'left' || config.inputChannel === 'right'
      ? String(config.inputChannel)
      : 'both';
  outputChannelSelect.value =
    config.outputChannel === 'left' || config.outputChannel === 'right'
      ? String(config.outputChannel)
      : 'both';

  selectOptionIfPresent(microphoneSelect, String(config.inputDeviceId ?? ''));
  selectOptionIfPresent(outputSelect, String(config.outputDeviceId ?? ''));

  setNumericInputValue(startFrequencyInput, config.startFrequency);
  setNumericInputValue(endFrequencyInput, config.endFrequency);
  setNumericInputValue(durationInput, config.durationSeconds);
  setNumericInputValue(volumeInput, config.sweepLevelDb);
  setNumericInputValue(volumeNumberInput, config.sweepLevelDb);
  setNumericInputValue(splOffsetInput, config.splOffsetDb);

  smoothingModeSelect.value = isSmoothingMode(String(config.smoothingMode ?? ''))
    ? String(config.smoothingMode)
    : DEFAULT_SMOOTHING_MODE;
  state.smoothingMode = getSelectedSmoothingMode();
  localStorage.setItem(SMOOTHING_MODE_STORAGE_KEY, state.smoothingMode);

  state.normalizePlot = Boolean(config.normalizePlot);
  normalizePlotToggle.checked = state.normalizePlot;
  localStorage.setItem(NORMALIZE_PLOT_STORAGE_KEY, String(state.normalizePlot));

  state.plotViewMode = config.plotViewMode === 'apo' ? 'apo' : 'measurements';
  localStorage.setItem(PLOT_VIEW_MODE_STORAGE_KEY, state.plotViewMode);

  state.apoFilters = normalizeApoFilters(config.apoFilters);
  state.apoSelectedMeasurementId = toOptionalString(config.apoSelectedMeasurementId);
  state.apoSelectedReferenceId = toOptionalString(config.apoSelectedReferenceId);
  state.apoMaxFilters = clamp(
    Number(config.apoMaxFilters) || DEFAULT_APO_MAX_FILTERS,
    1,
    16,
  );
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
    state.apoFilters.reduce((maxId, filter) => {
      const numericId = Number(filter.id.replace('apo-filter-', ''));
      return Number.isFinite(numericId) ? Math.max(maxId, numericId) : maxId;
    }, 0) + 1;
  persistApoState();
  apoMaxFiltersInput.value = String(state.apoMaxFilters);
  apoMaxBoostInput.value = String(state.apoMaxBoostDb);
  apoMaxCutInput.value = String(state.apoMaxCutDb);

  syncVolumeControls('slider');
  syncSplOffsetControl(true);
  updateMeasurementBackendUi();
  renderMeasurements();
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

function readStoredApoFilters(): ApoFilter[] {
  const stored = localStorage.getItem(APO_FILTERS_STORAGE_KEY);

  if (!stored) {
    return [];
  }

  try {
    return normalizeApoFilters(JSON.parse(stored));
  } catch {
    return [];
  }
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
        kind: 'PK',
        frequencyHz,
        gainDb,
        q,
      },
    ];
  });
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
  localStorage.setItem(APO_MAX_FILTERS_STORAGE_KEY, String(state.apoMaxFilters));
  localStorage.setItem(APO_MAX_BOOST_STORAGE_KEY, String(state.apoMaxBoostDb));
  localStorage.setItem(APO_MAX_CUT_STORAGE_KEY, String(state.apoMaxCutDb));
  persistApoSelections();
}

function syncApoGenerationSettings(normalize: boolean): void {
  const parsedMaxFilters = Number(apoMaxFiltersInput.value);
  const parsedMaxBoostDb = Number(apoMaxBoostInput.value);
  const parsedMaxCutDb = Number(apoMaxCutInput.value);

  if (Number.isFinite(parsedMaxFilters)) {
    state.apoMaxFilters = clamp(Math.round(parsedMaxFilters), 1, 16);
  }

  if (Number.isFinite(parsedMaxBoostDb)) {
    state.apoMaxBoostDb = clamp(parsedMaxBoostDb, 0, 24);
  }

  if (Number.isFinite(parsedMaxCutDb)) {
    state.apoMaxCutDb = clamp(parsedMaxCutDb, 0, 24);
  }

  if (normalize) {
    apoMaxFiltersInput.value = String(state.apoMaxFilters);
    apoMaxBoostInput.value = state.apoMaxBoostDb.toFixed(1);
    apoMaxCutInput.value = state.apoMaxCutDb.toFixed(1);
  }

  persistApoState();
}

function renderApoSection(): void {
  updatePlotViewButtons();
  syncApoSelectionOptions();
  apoFilterList.innerHTML = renderApoFilterList();
  apoConfigPreview.value = buildApoConfigText();
  apoApplyStatus.textContent = getApoApplyStatusText();
  apoApplyWarning.hidden = !state.equalizerApoStatus?.peaceRunning;
  if (state.plotViewMode === 'apo') {
    renderPlotCard(
      state.measurements.filter((measurement) => measurement.visible),
      state.referenceCurves.filter((referenceCurve) => referenceCurve.visible),
    );
  }
  updateMeasurementActionState();
}

function getApoApplyStatusText(): string {
  const enabledFilterCount = state.apoFilters.filter((filter) => filter.enabled).length;

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
  if (state.apoFilters.length === 0) {
    return '<div class="measurement-empty">No APO filters yet. Generate from a target curve or add one manually.</div>';
  }

  return state.apoFilters
    .map(
      (filter, index) => `
        <div class="apo-filter-row${filter.enabled ? '' : ' is-hidden'}">
          <label class="apo-filter-enabled">
            <input type="checkbox" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="enabled" ${filter.enabled ? 'checked' : ''} ${state.busy ? 'disabled' : ''} />
            <span>F${index + 1}</span>
          </label>
          <select data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="kind" ${state.busy ? 'disabled' : ''}>
            <option value="PK" selected>PK</option>
          </select>
          <input type="number" min="20" max="20000" step="1" value="${filter.frequencyHz.toFixed(0)}" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="frequencyHz" ${state.busy ? 'disabled' : ''} />
          <input type="number" min="-24" max="24" step="0.1" value="${filter.gainDb.toFixed(1)}" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="gainDb" ${state.busy ? 'disabled' : ''} />
          <input type="number" min="0.1" max="10" step="0.05" value="${filter.q.toFixed(2)}" data-apo-filter-id="${escapeHtml(filter.id)}" data-apo-field="q" ${state.busy ? 'disabled' : ''} />
          <button class="btn btn-secondary measurement-remove-button" type="button" data-apo-filter-remove="${escapeHtml(filter.id)}" ${state.busy ? 'disabled' : ''}>Remove</button>
        </div>
      `,
    )
    .join('');
}

function addApoFilter(partial: Partial<ApoFilter> = {}): void {
  state.apoFilters = [
    ...state.apoFilters,
    {
      id: `apo-filter-${state.nextApoFilterIndex}`,
      enabled: partial.enabled ?? true,
      kind: 'PK',
      frequencyHz: partial.frequencyHz ?? 1000,
      gainDb: partial.gainDb ?? 0,
      q: partial.q ?? 1.41,
    },
  ];
  state.nextApoFilterIndex += 1;
  persistApoState();
  renderApoSection();
}

function removeApoFilter(filterId: string): void {
  state.apoFilters = state.apoFilters.filter((filter) => filter.id !== filterId);
  persistApoState();
  renderApoSection();
}

function updateApoFilter(filterId: string, field: string, value: string | boolean): void {
  state.apoFilters = state.apoFilters.map((filter) => {
    if (filter.id !== filterId) {
      return filter;
    }

    if (field === 'enabled' && typeof value === 'boolean') {
      return { ...filter, enabled: value };
    }

    if (field === 'frequencyHz') {
      const frequencyHz = clamp(Number(value), 20, 20000);
      return Number.isFinite(frequencyHz) ? { ...filter, frequencyHz } : filter;
    }

    if (field === 'gainDb') {
      const gainDb = clamp(Number(value), -24, 24);
      return Number.isFinite(gainDb) ? { ...filter, gainDb } : filter;
    }

    if (field === 'q') {
      const q = clamp(Number(value), 0.1, 10);
      return Number.isFinite(q) ? { ...filter, q } : filter;
    }

    return filter;
  });

  persistApoState();
  renderApoSection();
}

async function generateApoFilters(): Promise<void> {
  const measurement = getSelectedApoMeasurement();
  const referenceCurve = getSelectedApoReference();

  if (!measurement || !referenceCurve) {
    setStatus('Load a measurement and target before generating APO filters.', 'error');
    appendLog('APO generation aborted because a measurement or target curve is missing.', 'error');
    return;
  }

  try {
    setBusy(true);
    setStatus('Generating Equalizer APO filters...', 'working');

    const generatedFilters = buildApoFiltersFromCurves(measurement, referenceCurve);
    state.apoFilters = generatedFilters;
    state.nextApoFilterIndex = generatedFilters.length + 1;
    persistApoState();
    renderApoSection();

    setStatus(`Generated ${generatedFilters.length} APO filter${generatedFilters.length === 1 ? '' : 's'}.`, 'success');
    appendLog(
      `Generated ${generatedFilters.length} APO peaking filter${generatedFilters.length === 1 ? '' : 's'} from ${measurement.name} to ${referenceCurve.name}.`,
      'success',
    );
  } catch (error) {
    const message = getErrorMessage(error);
    setStatus(`APO generation failed: ${message}`, 'error');
    appendLog(`APO generation failed: ${message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function buildApoFiltersFromCurves(
  measurement: LoadedMeasurement,
  referenceCurve: ReferenceCurve,
): ApoFilter[] {
  const measurementPoints = getDisplayedMeasurementPoints(measurement, referenceCurve);
  const referencePoints = getDisplayedReferencePoints(referenceCurve);
  const samplePoints = buildApoSamplePoints(measurementPoints, referencePoints);

  if (samplePoints.length === 0) {
    throw new Error('There are not enough overlapping points to fit APO filters.');
  }

  const residuals = samplePoints.map((point) => point.targetGainDb);
  const filters: ApoFilter[] = [];

  for (let index = 0; index < state.apoMaxFilters; index += 1) {
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
  const distanceOctaves = Math.log2(frequencyHz / filter.frequencyHz);
  const sigma = 0.6 / Math.sqrt(filter.q);
  return filter.gainDb * Math.exp(-(distanceOctaves * distanceOctaves) / (2 * sigma * sigma));
}

function getCombinedApoResponseDb(frequencyHz: number): number {
  return state.apoFilters.reduce((total, filter) => {
    if (!filter.enabled) {
      return total;
    }

    return total + getApoFilterResponseDb(filter, frequencyHz);
  }, 0);
}

function buildApoConfigText(): string {
  const enabledFilters = state.apoFilters.filter((filter) => filter.enabled);
  const measurement = getSelectedApoMeasurement();
  const referenceCurve = getSelectedApoReference();
  const previewFrequencies = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const peakBoostDb = previewFrequencies.reduce(
    (peak, frequencyHz) => Math.max(peak, getCombinedApoResponseDb(frequencyHz)),
    0,
  );
  const preampDb = peakBoostDb > 0 ? -roundTo(peakBoostDb, 0.1) : 0;
  const lines = [
    '# Equalizer APO config generated by Freakish Ears',
    measurement ? `# Measurement: ${measurement.name}` : '# Measurement: none selected',
    referenceCurve ? `# Target: ${referenceCurve.name}` : '# Target: none selected',
    `Preamp: ${preampDb.toFixed(1)} dB`,
  ];

  if (enabledFilters.length === 0) {
    lines.push('# No enabled filters');
  } else {
    enabledFilters.forEach((filter, index) => {
      lines.push(
        `Filter ${index + 1}: ON PK Fc ${filter.frequencyHz.toFixed(1)} Hz Gain ${filter.gainDb.toFixed(1)} dB Q ${filter.q.toFixed(2)}`,
      );
    });
  }

  return lines.join('\n');
}

async function exportApoConfig(): Promise<void> {
  if (state.busy) {
    return;
  }

  if (!state.outputFolder) {
    setStatus('Choose a save folder before exporting an APO config.', 'error');
    appendLog('APO export aborted because no save folder is selected.', 'error');
    return;
  }

  try {
    setBusy(true);
    setStatus('Exporting Equalizer APO config...', 'working');

    const saveResult = await window.freakishEars.saveMeasurementSession({
      folderPath: state.outputFolder,
      sessionName: `equalizer-apo-${formatTimestampForPath(new Date())}`,
      files: [
        {
          name: 'config.txt',
          contents: new TextEncoder().encode(buildApoConfigText()),
        },
      ],
    });

    setStatus('Equalizer APO config exported.', 'success');
    appendLog(`Exported Equalizer APO config to ${saveResult.filePaths[0] ?? saveResult.sessionDirectory}.`, 'success');
    showToast({
      message: 'Equalizer APO config exported',
      actionLabel: 'View in Finder',
      actionPath: saveResult.filePaths[0] ?? saveResult.sessionDirectory,
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

async function applyApoConfig(): Promise<void> {
  const status = state.equalizerApoStatus;

  if (state.busy) {
    return;
  }

  if (!status?.installed) {
    setStatus('Equalizer APO was not detected in the default install path.', 'error');
    appendLog('Apply APO aborted because Equalizer APO is not installed in the default path.', 'error');
    return;
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
  } catch (error) {
    const message = getErrorMessage(error);
    await refreshEqualizerApoStatus();
    setStatus(`Apply APO failed: ${message}`, 'error');
    appendLog(`Apply APO failed: ${message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
