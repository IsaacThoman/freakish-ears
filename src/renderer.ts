import './index.css';

type FolderSelectionResult = {
  canceled: boolean;
  folderPath: string | null;
};

type SaveMeasurementFile = {
  name: string;
  contents: Uint8Array;
};

type SaveMeasurementPayload = {
  folderPath: string;
  sessionName: string;
  files: SaveMeasurementFile[];
};

type SaveMeasurementResult = {
  sessionDirectory: string;
  filePaths: string[];
};

declare global {
  interface Window {
    freakishEars: {
      selectOutputFolder: () => Promise<FolderSelectionResult>;
      saveMeasurementSession: (
        payload: SaveMeasurementPayload,
      ) => Promise<SaveMeasurementResult>;
    };
  }
}

type MeasurementPoint = {
  frequencyHz: number;
  magnitudeDbRelative: number;
  smoothedMagnitudeDbRelative: number;
};

type MeasurementAnalysis = {
  sampleRate: number;
  sweepStartSample: number;
  latencyMs: number;
  recordingLengthSeconds: number;
  peakDbfs: number;
  rmsDbfs: number;
  points: MeasurementPoint[];
};

type ResponsePlotGeometry = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  minFrequency: number;
  maxFrequency: number;
  minDb: number;
  maxDb: number;
};

type MeasurementCapture = {
  recording: Float32Array;
  sweep: Float32Array;
  sampleRate: number;
  preRollSamples: number;
};

type LogTone = 'neutral' | 'success' | 'error';
type StatusTone = 'idle' | 'working' | 'success' | 'error';

const STORAGE_KEY = 'freakish-ears-output-folder';
const DEFAULT_START_FREQUENCY = 20;
const DEFAULT_END_FREQUENCY = 20000;
const DEFAULT_DURATION_SECONDS = 8;
const MIN_SWEEP_LEVEL_DB = -60;
const MAX_SWEEP_LEVEL_DB = 0;
const DEFAULT_SWEEP_LEVEL_DB = -6;
const DEFAULT_SWEEP_AMPLITUDE = 0.72;
const PRE_ROLL_SECONDS = 0.35;
const POST_ROLL_SECONDS = 0.55;
const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Unable to find the app root.');
}

app.innerHTML = `
  <main class="shell">
    <header class="header">
      <h1>Freakish Ears</h1>
    </header>

    <section class="grid">
      <section class="panel section">
        <span class="section-title">Input</span>

        <div class="field">
          <select id="microphoneSelect"></select>
        </div>

        <button id="refreshDevicesButton" class="btn btn-secondary" type="button">
          Refresh
        </button>

        <span class="section-title">Output</span>

        <div class="field">
          <select id="outputSelect"></select>
        </div>

        <div class="folder-row">
          <button id="chooseFolderButton" class="btn btn-secondary" type="button">
            Folder
          </button>
          <div id="selectedFolder" class="folder-chip">None</div>
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

        <div id="plotCard" class="plot-card">
          <span style="color:var(--text-muted);font-size:11px">Run to plot response</span>
        </div>

        <span class="section-title">Log</span>
        <ul id="logList" class="log-list"></ul>
      </section>
    </section>
  </main>
`;

const microphoneSelect = getElement<HTMLSelectElement>('microphoneSelect');
const refreshDevicesButton = getElement<HTMLButtonElement>('refreshDevicesButton');
const chooseFolderButton = getElement<HTMLButtonElement>('chooseFolderButton');
const selectedFolder = getElement<HTMLDivElement>('selectedFolder');
const outputSelect = getElement<HTMLSelectElement>('outputSelect');
const startFrequencyInput = getElement<HTMLInputElement>('startFrequencyInput');
const endFrequencyInput = getElement<HTMLInputElement>('endFrequencyInput');
const durationInput = getElement<HTMLInputElement>('durationInput');
const volumeInput = getElement<HTMLInputElement>('volumeInput');
const volumeNumberInput = getElement<HTMLInputElement>('volumeNumberInput');
const runMeasurementButton = getElement<HTMLButtonElement>('runMeasurementButton');
const statusPill = getElement<HTMLDivElement>('statusPill');
const latencyValue = getElement<HTMLSpanElement>('latencyValue');
const peakValue = getElement<HTMLSpanElement>('peakValue');
const rmsValue = getElement<HTMLSpanElement>('rmsValue');
const savedPathValue = getElement<HTMLSpanElement>('savedPathValue');
const plotCard = getElement<HTMLDivElement>('plotCard');
const logList = getElement<HTMLUListElement>('logList');

const state = {
  busy: false,
  outputFolder: localStorage.getItem(STORAGE_KEY),
};

chooseFolderButton.addEventListener('click', () => {
  void chooseOutputFolder();
});

refreshDevicesButton.addEventListener('click', () => {
  void refreshMicrophones(true);
});

runMeasurementButton.addEventListener('click', () => {
  void runMeasurement();
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

navigator.mediaDevices?.addEventListener?.('devicechange', () => {
  void refreshMicrophones(false);
});

updateSelectedFolder();
syncVolumeControls('slider');
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

  microphoneSelect.disabled = isBusy;
  refreshDevicesButton.disabled = isBusy;
  chooseFolderButton.disabled = isBusy;
  outputSelect.disabled = isBusy;
  startFrequencyInput.disabled = isBusy;
  endFrequencyInput.disabled = isBusy;
  durationInput.disabled = isBusy;
  volumeInput.disabled = isBusy;
  volumeNumberInput.disabled = isBusy;
  runMeasurementButton.disabled = isBusy;
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
}

function syncVolumeControls(
  source: 'slider' | 'number',
  normalize = true,
): void {
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

async function chooseOutputFolder(): Promise<void> {
  const result = await window.freakishEars.selectOutputFolder();

  if (result.folderPath) {
    state.outputFolder = result.folderPath;
    localStorage.setItem(STORAGE_KEY, result.folderPath);
    updateSelectedFolder();
    appendLog(`Save folder set to ${result.folderPath}.`, 'success');
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
    const microphones = devices.filter(
      (device) => device.kind === 'audioinput',
    );
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

    const selectionStillExists = microphones.some(
      (microphone) => microphone.deviceId === priorSelection,
    );

    if (selectionStillExists) {
      microphoneSelect.value = priorSelection;
    }

    const outputSelectionStillExists = Array.from(outputSelect.options).some(
      (option) => option.value === priorOutputSelection,
    );

    if (outputSelectionStillExists) {
      outputSelect.value = priorOutputSelection;
    }

    appendLog(
      `Loaded ${microphones.length} microphone input(s) and ${seenOutputIds.size + 1} output option(s).`,
      'success',
    );
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

  if (!deviceId) {
    setStatus('Select a microphone before measuring.', 'error');
    appendLog('Measurement aborted because no microphone is selected.', 'error');
    return;
  }

  if (
    !Number.isFinite(startFrequency) ||
    !Number.isFinite(endFrequency) ||
    !Number.isFinite(durationSeconds) ||
    !Number.isFinite(sweepLevelDb) ||
    startFrequency < 10 ||
    endFrequency <= startFrequency ||
    endFrequency > 22000 ||
    durationSeconds < 2 ||
    durationSeconds > 30 ||
    sweepLevelDb < MIN_SWEEP_LEVEL_DB ||
    sweepLevelDb > MAX_SWEEP_LEVEL_DB
  ) {
    setStatus('Sweep settings are invalid.', 'error');
    appendLog('Sweep settings must be numeric, ordered, and within range.', 'error');
    return;
  }

  try {
    setBusy(true);
    setStatus('Capturing sweep measurement...', 'working');
    appendLog('Opening the selected microphone and preparing the sweep.');

    const capture = await recordSweepMeasurement({
      deviceId,
      outputDeviceId,
      startFrequency,
      endFrequency,
      durationSeconds,
      sweepLevelDb,
    });

    setStatus('Processing response values...', 'working');
    appendLog('Captured raw PCM. Aligning the sweep and computing the response.');

    const analysis = analyzeMeasurement(
      capture,
      startFrequency,
      endFrequency,
    );

    const microphoneLabel =
      microphoneSelect.selectedOptions[0]?.textContent ?? 'Unknown microphone';
    const outputDeviceLabel =
      outputSelect.selectedOptions[0]?.textContent ?? 'System default';
    const sessionName = `measurement-${formatTimestampForPath(new Date())}`;
    const measurementJson = buildMeasurementJson(
      analysis,
      capture,
      microphoneLabel,
      outputDeviceLabel,
      { startFrequency, endFrequency, durationSeconds, sweepLevelDb },
    );
    const measurementCsv = buildMeasurementCsv(analysis.points);
    const captureWav = encodeWavFile(capture.recording, capture.sampleRate);

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

    renderMeasurement(analysis, saveResult.sessionDirectory);
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

async function recordSweepMeasurement(settings: {
  deviceId: string;
  outputDeviceId: string;
  startFrequency: number;
  endFrequency: number;
  durationSeconds: number;
  sweepLevelDb: number;
}): Promise<MeasurementCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: settings.deviceId },
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });

  const audioContext = new AudioContext({ latencyHint: 'interactive' });
  const sampleRate = audioContext.sampleRate;
  const sweep = createLogSweep(
    sampleRate,
    settings.durationSeconds,
    settings.startFrequency,
    settings.endFrequency,
  );
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
  const mutedGain = audioContext.createGain();
  const playbackGain = audioContext.createGain();
  const playbackDestination = audioContext.createMediaStreamDestination();
  mutedGain.gain.value = 0;
  playbackGain.gain.value = Math.pow(10, settings.sweepLevelDb / 20);

  const chunks: Float32Array[] = [];
  let sampleCount = 0;

  processorNode.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(input.length);
    copy.set(input);
    chunks.push(copy);
    sampleCount += copy.length;
  };

  sourceNode.connect(processorNode);
  processorNode.connect(mutedGain);
  mutedGain.connect(audioContext.destination);
  playbackGain.connect(playbackDestination);

  const sweepBuffer = audioContext.createBuffer(1, sweep.length, sampleRate);
  sweepBuffer.copyToChannel(sweep, 0);

  const sweepNode = audioContext.createBufferSource();
  sweepNode.buffer = sweepBuffer;
  sweepNode.connect(playbackGain);

  const outputElement = await createOutputPlaybackElement(
    playbackDestination.stream,
    settings.outputDeviceId,
  );

  await audioContext.resume();

  const sweepStartTime = audioContext.currentTime + PRE_ROLL_SECONDS;
  sweepNode.start(sweepStartTime);

  await wait(
    (PRE_ROLL_SECONDS + settings.durationSeconds + POST_ROLL_SECONDS) * 1000 +
      120,
  );

  processorNode.disconnect();
  mutedGain.disconnect();
  playbackGain.disconnect();
  sourceNode.disconnect();
  outputElement.pause();
  outputElement.srcObject = null;

  for (const track of stream.getTracks()) {
    track.stop();
  }

  await audioContext.close();

  return {
    recording: flattenChunks(chunks, sampleCount),
    sweep,
    sampleRate,
    preRollSamples: Math.round(PRE_ROLL_SECONDS * sampleRate),
  };
}

function createLogSweep(
  sampleRate: number,
  durationSeconds: number,
  startFrequency: number,
  endFrequency: number,
): Float32Array {
  const length = Math.max(1, Math.round(sampleRate * durationSeconds));
  const sweep = new Float32Array(length);
  const ratio = endFrequency / startFrequency;
  const phaseScale =
    (2 * Math.PI * startFrequency * durationSeconds) / Math.log(ratio);
  const fadeSampleCount = Math.max(32, Math.round(sampleRate * 0.02));

  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate;
    const exponentialTerm = Math.pow(ratio, time / durationSeconds);
    let sample = Math.sin(phaseScale * (exponentialTerm - 1));

    if (index < fadeSampleCount) {
      sample *= 0.5 - 0.5 * Math.cos((Math.PI * index) / fadeSampleCount);
    }

    const fadeOutIndex = length - index - 1;
    if (fadeOutIndex < fadeSampleCount) {
      sample *=
        0.5 - 0.5 * Math.cos((Math.PI * fadeOutIndex) / fadeSampleCount);
    }

    sweep[index] = sample * DEFAULT_SWEEP_AMPLITUDE;
  }

  return sweep;
}

function flattenChunks(chunks: Float32Array[], totalLength: number): Float32Array {
  const flattened = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    flattened.set(chunk, offset);
    offset += chunk.length;
  }

  return flattened;
}

function analyzeMeasurement(
  capture: MeasurementCapture,
  startFrequency: number,
  endFrequency: number,
): MeasurementAnalysis {
  const sweepStartSample = locateSweepStart(capture.recording, capture.sweep);
  const alignedRecording = extractSegment(
    capture.recording,
    sweepStartSample,
    capture.sweep.length,
  );
  const fftSize = nextPowerOfTwo(capture.sweep.length);
  const sourceReal = new Float64Array(fftSize);
  const sourceImag = new Float64Array(fftSize);
  const recordingReal = new Float64Array(fftSize);
  const recordingImag = new Float64Array(fftSize);

  sourceReal.set(capture.sweep);
  recordingReal.set(alignedRecording);

  fft(sourceReal, sourceImag, false);
  fft(recordingReal, recordingImag, false);

  const responseReal = new Float64Array(fftSize / 2);
  const responseImag = new Float64Array(fftSize / 2);
  const epsilon = 1e-12;

  for (let index = 0; index < responseReal.length; index += 1) {
    const denominator =
      sourceReal[index] * sourceReal[index] +
      sourceImag[index] * sourceImag[index] +
      epsilon;

    responseReal[index] =
      (recordingReal[index] * sourceReal[index] +
        recordingImag[index] * sourceImag[index]) /
      denominator;
    responseImag[index] =
      (recordingImag[index] * sourceReal[index] -
        recordingReal[index] * sourceImag[index]) /
      denominator;
  }

  const points = buildMeasurementPoints(
    responseReal,
    responseImag,
    capture.sampleRate,
    fftSize,
    startFrequency,
    endFrequency,
  );

  return {
    sampleRate: capture.sampleRate,
    sweepStartSample,
    latencyMs:
      ((sweepStartSample - capture.preRollSamples) / capture.sampleRate) * 1000,
    recordingLengthSeconds: capture.recording.length / capture.sampleRate,
    peakDbfs: calculatePeakDbfs(alignedRecording),
    rmsDbfs: calculateRmsDbfs(alignedRecording),
    points,
  };
}

function locateSweepStart(
  recording: Float32Array,
  sweep: Float32Array,
): number {
  if (recording.length <= sweep.length) {
    return 0;
  }

  const coarseFactor = Math.max(1, Math.floor(sweep.length / 4096));
  const coarseSweep = decimate(sweep, coarseFactor);
  const coarseRecording = decimate(recording, coarseFactor);
  const coarseOffset = scanForBestOffset(coarseRecording, coarseSweep, 1);
  const approximateOffset = coarseOffset * coarseFactor;
  const searchRadius = coarseFactor * 3;
  const refinedStart = Math.max(0, approximateOffset - searchRadius);
  const refinedEnd = Math.min(
    recording.length - sweep.length,
    approximateOffset + searchRadius,
  );

  return scanForBestOffset(
    recording,
    sweep,
    Math.max(1, Math.floor(sweep.length / 16000)),
    refinedStart,
    refinedEnd,
  );
}

function decimate(source: Float32Array, factor: number): Float32Array {
  const length = Math.ceil(source.length / factor);
  const output = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    output[index] = source[index * factor] ?? 0;
  }

  return output;
}

function scanForBestOffset(
  recording: Float32Array,
  sweep: Float32Array,
  sampleStride: number,
  startOffset = 0,
  endOffset = recording.length - sweep.length,
): number {
  let bestOffset = startOffset;
  let bestScore = Number.NEGATIVE_INFINITY;
  let sweepEnergy = 0;

  for (let index = 0; index < sweep.length; index += sampleStride) {
    const sample = sweep[index];
    sweepEnergy += sample * sample;
  }

  for (let offset = startOffset; offset <= endOffset; offset += 1) {
    let dot = 0;
    let recordingEnergy = 0;

    for (let index = 0; index < sweep.length; index += sampleStride) {
      const recordingSample = recording[offset + index] ?? 0;
      const sweepSample = sweep[index];
      dot += recordingSample * sweepSample;
      recordingEnergy += recordingSample * recordingSample;
    }

    const score = dot / Math.sqrt(recordingEnergy * sweepEnergy + 1e-12);
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  return bestOffset;
}

function extractSegment(
  source: Float32Array,
  start: number,
  length: number,
): Float32Array {
  const output = new Float32Array(length);
  const clampedStart = Math.max(0, start);
  const availableLength = Math.max(
    0,
    Math.min(length, source.length - clampedStart),
  );

  output.set(source.subarray(clampedStart, clampedStart + availableLength));
  return output;
}

function nextPowerOfTwo(value: number): number {
  let size = 1;

  while (size < value) {
    size <<= 1;
  }

  return size;
}

function fft(
  real: Float64Array,
  imag: Float64Array,
  inverse: boolean,
): void {
  const size = real.length;
  let reversedIndex = 0;

  for (let index = 1; index < size; index += 1) {
    let bit = size >> 1;

    while (reversedIndex & bit) {
      reversedIndex ^= bit;
      bit >>= 1;
    }

    reversedIndex ^= bit;

    if (index < reversedIndex) {
      swap(real, index, reversedIndex);
      swap(imag, index, reversedIndex);
    }
  }

  for (let blockSize = 2; blockSize <= size; blockSize <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / blockSize;
    const twiddleReal = Math.cos(angle);
    const twiddleImag = Math.sin(angle);

    for (let blockStart = 0; blockStart < size; blockStart += blockSize) {
      let wReal = 1;
      let wImag = 0;

      for (let offset = 0; offset < blockSize / 2; offset += 1) {
        const evenIndex = blockStart + offset;
        const oddIndex = evenIndex + blockSize / 2;
        const oddReal =
          real[oddIndex] * wReal - imag[oddIndex] * wImag;
        const oddImag =
          real[oddIndex] * wImag + imag[oddIndex] * wReal;

        real[oddIndex] = real[evenIndex] - oddReal;
        imag[oddIndex] = imag[evenIndex] - oddImag;
        real[evenIndex] += oddReal;
        imag[evenIndex] += oddImag;

        const nextWReal = wReal * twiddleReal - wImag * twiddleImag;
        wImag = wReal * twiddleImag + wImag * twiddleReal;
        wReal = nextWReal;
      }
    }
  }

  if (inverse) {
    for (let index = 0; index < size; index += 1) {
      real[index] /= size;
      imag[index] /= size;
    }
  }
}

function swap(values: Float64Array, left: number, right: number): void {
  const temporary = values[left];
  values[left] = values[right];
  values[right] = temporary;
}

function buildMeasurementPoints(
  responseReal: Float64Array,
  responseImag: Float64Array,
  sampleRate: number,
  fftSize: number,
  startFrequency: number,
  endFrequency: number,
): MeasurementPoint[] {
  const points: MeasurementPoint[] = [];
  const pointCount = 256;
  const binWidth = sampleRate / fftSize;
  const highestBin = responseReal.length - 1;
  const nyquistLimitedEndFrequency = sampleRate * 0.45;
  const effectiveEndFrequency = Math.min(
    endFrequency * 0.97,
    nyquistLimitedEndFrequency,
  );

  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const position = pointIndex / (pointCount - 1);
    const frequencyHz =
      startFrequency *
      Math.pow(effectiveEndFrequency / startFrequency, position);
    const centerBin = clamp(
      Math.round(frequencyHz / binWidth),
      1,
      highestBin,
    );
    const magnitude = Math.hypot(
      responseReal[centerBin],
      responseImag[centerBin],
    );
    const smoothingWidth = Math.pow(2, 1 / 24);
    const lowBin = clamp(
      Math.floor((frequencyHz / smoothingWidth) / binWidth),
      1,
      highestBin,
    );
    const highBin = clamp(
      Math.ceil((frequencyHz * smoothingWidth) / binWidth),
      1,
      highestBin,
    );
    let powerSum = 0;
    let binCount = 0;

    for (let bin = lowBin; bin <= highBin; bin += 1) {
      const binMagnitude = Math.hypot(responseReal[bin], responseImag[bin]);
      powerSum += binMagnitude * binMagnitude;
      binCount += 1;
    }

    points.push({
      frequencyHz,
      magnitudeDbRelative: 20 * Math.log10(magnitude + 1e-12),
      smoothedMagnitudeDbRelative:
        10 * Math.log10(powerSum / Math.max(1, binCount) + 1e-18),
    });
  }

  return points;
}

function calculatePeakDbfs(samples: Float32Array): number {
  let peak = 0;

  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }

  return 20 * Math.log10(peak + 1e-12);
}

function calculateRmsDbfs(samples: Float32Array): number {
  let sum = 0;

  for (const sample of samples) {
    sum += sample * sample;
  }

  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  return 20 * Math.log10(rms + 1e-12);
}

function buildMeasurementJson(
  analysis: MeasurementAnalysis,
  capture: MeasurementCapture,
  microphoneLabel: string,
  outputDeviceLabel: string,
  settings: {
    startFrequency: number;
    endFrequency: number;
    durationSeconds: number;
    sweepLevelDb: number;
  },
): string {
  return JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      microphoneLabel,
      outputDeviceLabel,
      settings: {
        ...settings,
        preRollSeconds: PRE_ROLL_SECONDS,
        postRollSeconds: POST_ROLL_SECONDS,
        captureFormat: 'mono pcm 16-bit wav export',
        magnitudeUnits: 'relative dB',
      },
      sampleRate: analysis.sampleRate,
      sweepStartSample: analysis.sweepStartSample,
      latencyMs: analysis.latencyMs,
      recordingLengthSeconds: analysis.recordingLengthSeconds,
      peakDbfs: analysis.peakDbfs,
      rmsDbfs: analysis.rmsDbfs,
      sampleCount: capture.recording.length,
      responsePoints: analysis.points,
    },
    null,
    2,
  );
}

function buildMeasurementCsv(points: MeasurementPoint[]): string {
  const header =
    'frequency_hz,magnitude_db_relative,smoothed_magnitude_db_relative';
  const rows = points.map(
    (point) =>
      `${point.frequencyHz.toFixed(3)},${point.magnitudeDbRelative.toFixed(4)},${point.smoothedMagnitudeDbRelative.toFixed(4)}`,
  );

  return [header, ...rows].join('\n');
}

function encodeWavFile(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function renderMeasurement(
  analysis: MeasurementAnalysis,
  sessionDirectory: string,
): void {
  latencyValue.textContent = `${analysis.latencyMs.toFixed(1)} ms`;
  peakValue.textContent = `${analysis.peakDbfs.toFixed(1)} dBFS`;
  rmsValue.textContent = `${analysis.rmsDbfs.toFixed(1)} dBFS`;
  savedPathValue.textContent = sessionDirectory;

  plotCard.innerHTML = renderResponsePlot(analysis.points);
  attachPlotInteractions(analysis.points);
}

function renderResponsePlot(points: MeasurementPoint[]): string {
  const geometry = getResponsePlotGeometry(points);
  const xTicks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter(
    (frequency) =>
      frequency >= geometry.minFrequency && frequency <= geometry.maxFrequency,
  );
  const yTicks = Array.from({ length: 5 }, (_unused, index) => {
    const ratio = index / 4;
    return geometry.maxDb - (geometry.maxDb - geometry.minDb) * ratio;
  });

  const path = points
    .map((point) => {
      const x = getPlotX(point.frequencyHz, geometry);
      const y = getPlotY(point.smoothedMagnitudeDbRelative, geometry);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const xAxisY = geometry.height - geometry.bottom;
  const yAxisX = geometry.left;

  return `
    <div class="plot-hover" id="plotHover">Hover: --</div>
    <svg id="responsePlot" viewBox="0 0 ${geometry.width} ${geometry.height}" role="img" aria-label="Measured frequency response with logarithmic frequency axis">
      <rect x="0" y="0" width="${geometry.width}" height="${geometry.height}" rx="4" fill="rgba(255,255,255,0.02)"></rect>
      ${yTicks
        .map((value) => {
          const y = getPlotY(value, geometry);
          return `<line x1="${geometry.left}" y1="${y.toFixed(1)}" x2="${geometry.width - geometry.right}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.07)" />`;
        })
        .join('')}
      ${xTicks
        .map((frequency) => {
          const x = getPlotX(frequency, geometry);
          return `<line x1="${x.toFixed(1)}" y1="${geometry.top}" x2="${x.toFixed(1)}" y2="${xAxisY}" stroke="rgba(255,255,255,0.06)" />`;
        })
        .join('')}
      <line x1="${yAxisX}" y1="${xAxisY}" x2="${geometry.width - geometry.right}" y2="${xAxisY}" stroke="rgba(170,190,228,0.28)" />
      <line x1="${yAxisX}" y1="${geometry.top}" x2="${yAxisX}" y2="${xAxisY}" stroke="rgba(170,190,228,0.28)" />
      <polyline points="${path}" fill="none" stroke="#7ee7ff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></polyline>
      <line id="plotHoverLine" x1="0" y1="${geometry.top}" x2="0" y2="${xAxisY}" stroke="#7ee7ff" stroke-width="1" opacity="0"></line>
      <circle id="plotHoverDot" cx="0" cy="0" r="4" fill="#7ee7ff" opacity="0"></circle>
      ${yTicks
        .map((value) => {
          const y = getPlotY(value, geometry);
          return `<text x="${geometry.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="plot-axis-text">${formatDbLabel(value)}</text>`;
        })
        .join('')}
      ${xTicks
        .map((frequency) => {
          const x = getPlotX(frequency, geometry);
          return `<text x="${x.toFixed(1)}" y="${geometry.height - 10}" text-anchor="middle" class="plot-axis-text">${formatFrequencyLabel(frequency)}</text>`;
        })
        .join('')}
      <text x="${(geometry.left + (geometry.width - geometry.right)) / 2}" y="${geometry.height - 12}" text-anchor="middle" class="plot-axis-label">Frequency (Hz, log)</text>
      <text x="22" y="${(geometry.top + (geometry.height - geometry.bottom)) / 2}" text-anchor="middle" transform="rotate(-90 22 ${(geometry.top + (geometry.height - geometry.bottom)) / 2})" class="plot-axis-label">Relative response (dB)</text>
    </svg>
  `;
}

function attachPlotInteractions(points: MeasurementPoint[]): void {
  const svg = plotCard.querySelector<SVGSVGElement>('#responsePlot');
  const hoverLine = plotCard.querySelector<SVGLineElement>('#plotHoverLine');
  const hoverDot = plotCard.querySelector<SVGCircleElement>('#plotHoverDot');
  const hoverLabel = plotCard.querySelector<HTMLDivElement>('#plotHover');

  if (!svg || !hoverLine || !hoverDot || !hoverLabel || points.length === 0) {
    return;
  }

  const geometry = getResponsePlotGeometry(points);

  const updateHover = (clientX: number) => {
    const bounds = svg.getBoundingClientRect();
    const plotX =
      ((clientX - bounds.left) / bounds.width) * geometry.width;
    let closestPoint = points[0];
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const point of points) {
      const pointX = getPlotX(point.frequencyHz, geometry);
      const distance = Math.abs(pointX - plotX);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = point;
      }
    }

    const x = getPlotX(closestPoint.frequencyHz, geometry);
    const y = getPlotY(closestPoint.smoothedMagnitudeDbRelative, geometry);

    hoverLine.setAttribute('x1', x.toFixed(1));
    hoverLine.setAttribute('x2', x.toFixed(1));
    hoverLine.setAttribute('opacity', '1');
    hoverDot.setAttribute('cx', x.toFixed(1));
    hoverDot.setAttribute('cy', y.toFixed(1));
    hoverDot.setAttribute('opacity', '1');
    hoverLabel.textContent = `Hover: ${formatFrequencyDetailed(closestPoint.frequencyHz)}, ${closestPoint.smoothedMagnitudeDbRelative.toFixed(1)} dB`;
  };

  svg.addEventListener('pointermove', (event) => {
    updateHover(event.clientX);
  });

  svg.addEventListener('pointerleave', () => {
    hoverLine.setAttribute('opacity', '0');
    hoverDot.setAttribute('opacity', '0');
    hoverLabel.textContent = 'Hover: --';
  });
}

function getResponsePlotGeometry(points: MeasurementPoint[]): ResponsePlotGeometry {
  const smoothedValues = points.map((point) => point.smoothedMagnitudeDbRelative);
  const measuredTop = Math.max(...smoothedValues) + 3;
  const measuredBottom = Math.min(...smoothedValues) - 3;
  const minDb = measuredBottom;
  const maxDb = measuredBottom + Math.max(24, measuredTop - measuredBottom);

  return {
    width: 960,
    height: 320,
    left: 72,
    right: 24,
    top: 18,
    bottom: 56,
    minFrequency: points[0]?.frequencyHz ?? DEFAULT_START_FREQUENCY,
    maxFrequency: points.at(-1)?.frequencyHz ?? DEFAULT_END_FREQUENCY,
    minDb,
    maxDb,
  };
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

function formatFrequencyLabel(frequencyHz: number): string {
  if (frequencyHz >= 1000) {
    return `${(frequencyHz / 1000).toFixed(frequencyHz >= 10000 ? 0 : 1)}k`;
  }

  return frequencyHz.toFixed(0);
}

function formatFrequencyDetailed(frequencyHz: number): string {
  if (frequencyHz >= 1000) {
    return `${(frequencyHz / 1000).toFixed(2)} kHz`;
  }

  return `${frequencyHz.toFixed(1)} Hz`;
}

function formatDbLabel(valueDb: number): string {
  return `${valueDb.toFixed(0)} dB`;
}

async function createOutputPlaybackElement(
  stream: MediaStream,
  outputDeviceId: string,
): Promise<HTMLAudioElement> {
  const audioElement = new Audio();
  const sinkAudioElement = audioElement as HTMLAudioElement & {
    setSinkId?: (sinkId: string) => Promise<void>;
  };

  audioElement.autoplay = true;
  audioElement.volume = 1;
  audioElement.srcObject = stream;

  if (outputDeviceId) {
    if (!sinkAudioElement.setSinkId) {
      throw new Error('Output device selection is not supported on this platform.');
    }

    await sinkAudioElement.setSinkId(outputDeviceId);
  }

  await audioElement.play();
  return audioElement;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatTimestampForPath(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
