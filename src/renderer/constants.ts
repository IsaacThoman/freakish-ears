export const STORAGE_KEY = 'freakish-ears-output-folder';
export const MEASUREMENT_BACKEND_STORAGE_KEY = 'freakish-ears-measurement-backend';
export const SPL_OFFSET_STORAGE_KEY = 'freakish-ears-spl-offset-db';
export const NORMALIZE_PLOT_STORAGE_KEY = 'freakish-ears-normalize-plot';
export const SMOOTHING_MODE_STORAGE_KEY = 'freakish-ears-smoothing-mode';
export const DEFAULT_MEASUREMENT_BACKEND = 'web-audio';
export const DEFAULT_SAMPLE_RATE = 48000;
export const DEFAULT_SMOOTHING_MODE = '1/12';
export const DEFAULT_START_FREQUENCY = 20;
export const DEFAULT_END_FREQUENCY = 20000;
export const DEFAULT_DURATION_SECONDS = 2;
export const MIN_SWEEP_LEVEL_DB = -60;
export const MAX_SWEEP_LEVEL_DB = 0;
export const DEFAULT_SWEEP_LEVEL_DB = -6;
export const DEFAULT_SPL_OFFSET_DB = 0;
export const PRE_ROLL_SECONDS = 0.35;
export const POST_ROLL_SECONDS = 0.55;
export const PLOT_NORMALIZATION_FREQUENCY_HZ = 1000;
export const SAMPLE_RATE_OPTIONS = [44100, 48000, 88200, 96000, 176400, 192000] as const;
export const SMOOTHING_MODE_OPTIONS = [
  'raw',
  '1/48',
  '1/36',
  '1/24',
  '1/18',
  '1/15',
  '1/12',
  '1/9',
  '1/8',
  '1/7',
  '1/6',
  '1/5',
  '1/4',
  '1/3',
  '1/2',
  '1/1',
] as const;
export const PLOT_COLORS = [
  '#f8a145',
  '#f07900',
  '#d35100',
  '#f3c38b',
  '#f5b36a',
  '#ff8b2f',
];
