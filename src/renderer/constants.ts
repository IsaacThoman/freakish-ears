export const STORAGE_KEY = 'freakish-ears-output-folder';
export const MEASUREMENT_BACKEND_STORAGE_KEY = 'freakish-ears-measurement-backend';
export const MEASUREMENT_KEEP_COUNT_STORAGE_KEY = 'freakish-ears-measurement-keep-count';
export const SPL_OFFSET_STORAGE_KEY = 'freakish-ears-spl-offset-db';
export const NORMALIZE_PLOT_STORAGE_KEY = 'freakish-ears-normalize-plot';
export const SMOOTHING_MODE_STORAGE_KEY = 'freakish-ears-smoothing-mode';
export const APO_FILTERS_STORAGE_KEY = 'freakish-ears-apo-filters';
export const APO_EQ_MODE_STORAGE_KEY = 'freakish-ears-apo-eq-mode';
export const APO_SELECTED_MEASUREMENT_STORAGE_KEY = 'freakish-ears-apo-selected-measurement';
export const APO_SELECTED_REFERENCE_STORAGE_KEY = 'freakish-ears-apo-selected-reference';
export const APO_MAX_FILTERS_STORAGE_KEY = 'freakish-ears-apo-max-filters';
export const APO_MAX_BOOST_STORAGE_KEY = 'freakish-ears-apo-max-boost-db';
export const APO_MAX_CUT_STORAGE_KEY = 'freakish-ears-apo-max-cut-db';
export const AUTOMATION_ALGORITHM_STORAGE_KEY = 'freakish-ears-automation-algorithm';
export const AUTOMATION_DELAY_SECONDS_STORAGE_KEY = 'freakish-ears-automation-delay-seconds';
export const PROPORTIONAL_P_STORAGE_KEY = 'freakish-ears-proportional-p';
export const AUTOMATION_STOP_ON_TOLERANCE_STORAGE_KEY = 'freakish-ears-automation-stop-on-tolerance';
export const AUTOMATION_BAND_TOLERANCES_STORAGE_KEY = 'freakish-ears-automation-band-tolerances';
export const AUTOMATION_REGRESSION_LIMIT_STORAGE_KEY = 'freakish-ears-automation-regression-limit';
export const PLOT_VIEW_MODE_STORAGE_KEY = 'freakish-ears-plot-view-mode';
export const SAMPLE_RATE_STORAGE_KEY = 'freakish-ears-sample-rate';
export const START_FREQUENCY_STORAGE_KEY = 'freakish-ears-start-frequency';
export const END_FREQUENCY_STORAGE_KEY = 'freakish-ears-end-frequency';
export const DURATION_STORAGE_KEY = 'freakish-ears-duration';
export const SWEEP_LEVEL_STORAGE_KEY = 'freakish-ears-sweep-level';
export const INPUT_CHANNEL_STORAGE_KEY = 'freakish-ears-input-channel';
export const OUTPUT_CHANNEL_STORAGE_KEY = 'freakish-ears-output-channel';
export const INPUT_DEVICE_STORAGE_KEY = 'freakish-ears-input-device';
export const OUTPUT_DEVICE_STORAGE_KEY = 'freakish-ears-output-device';
export const ACTIVE_CONFIG_STORAGE_KEY = 'freakish-ears-active-config';
export const DEFAULT_MEASUREMENT_BACKEND = 'web-audio';
export const DEFAULT_MEASUREMENT_KEEP_COUNT = 5;
export const DEFAULT_SAMPLE_RATE = 48000;
export const DEFAULT_SMOOTHING_MODE = '1/12';
export const DEFAULT_START_FREQUENCY = 20;
export const DEFAULT_END_FREQUENCY = 20000;
export const DEFAULT_DURATION_SECONDS = 2;
export const MIN_SWEEP_LEVEL_DB = -60;
export const MAX_SWEEP_LEVEL_DB = 0;
export const DEFAULT_SWEEP_LEVEL_DB = -6;
export const DEFAULT_SPL_OFFSET_DB = 0;
export const DEFAULT_APO_MAX_FILTERS = 8;
export const DEFAULT_APO_MAX_BOOST_DB = 6;
export const DEFAULT_APO_MAX_CUT_DB = 12;
export const DEFAULT_APO_EQ_MODE = 'parametric';
export const DEFAULT_AUTOMATION_ALGORITHM = 'proportional';
export const DEFAULT_AUTOMATION_DELAY_SECONDS = 1;
export const DEFAULT_PROPORTIONAL_P = 0.1;
export const DEFAULT_AUTOMATION_STOP_ON_TOLERANCE = false;
export const DEFAULT_AUTOMATION_REGRESSION_LIMIT = 0;
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
