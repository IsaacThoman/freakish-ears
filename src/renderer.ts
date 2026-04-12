import './index.css';
import logoUrl from './assets/dutocal-logo.webp';

import {
  DEFAULT_MEASUREMENT_BACKEND,
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
  parseImportedMeasurementFile,
} from './renderer/measurements';
import { attachPlotInteractions, renderResponsePlot } from './renderer/plot';
import type {
  AppState,
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
          <span class="section-title">Measurements</span>
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
const measurementFileInput = getElement<HTMLInputElement>('measurementFileInput');
const referenceFileInput = getElement<HTMLInputElement>('referenceFileInput');
const configFileInput = getElement<HTMLInputElement>('configFileInput');
const plotCard = getElement<HTMLDivElement>('plotCard');
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
  toast: null,
  toastTimeoutId: 0,
};

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
hideToast();
updateMeasurementActionState();
appendLog('Click Refresh to access microphones and outputs.');
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
  renderMeasurements();
}

function addReferenceCurve(referenceCurve: ReferenceCurve): void {
  state.referenceCurves = [
    ...state.referenceCurves.map((entry) => ({ ...entry, visible: false })),
    referenceCurve,
  ];
  renderMeasurements();
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

  renderMeasurements();
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

  renderMeasurements();
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
  updateMeasurementSummary();
  updateMeasurementActionState();
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
