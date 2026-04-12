export const STORAGE_KEY = 'freakish-ears-output-folder';
export const MEASUREMENT_BACKEND_STORAGE_KEY = 'freakish-ears-measurement-backend';
export const SPL_OFFSET_STORAGE_KEY = 'freakish-ears-spl-offset-db';
export const NORMALIZE_PLOT_STORAGE_KEY = 'freakish-ears-normalize-plot';
export const DEFAULT_MEASUREMENT_BACKEND = 'web-audio';
export const DEFAULT_SAMPLE_RATE = 48000;
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
export const SAMPLE_RATE_OPTIONS = [44100, 48000, 96000] as const;
export const PLOT_COLORS = [
  '#7ee7ff',
  '#ff8fab',
  '#8fe388',
  '#ffcc66',
  '#c7a6ff',
  '#ff9e64',
];
