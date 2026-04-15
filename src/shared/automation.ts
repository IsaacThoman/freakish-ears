import type {
  ApoChannelProfile,
  ApoEqMode,
  ApoFilter,
  AutomationAlgorithm,
  MeasurementSmoothingMode,
} from '../renderer/types';

export type AutomationVirtualFile = {
  name: string;
  contents?: string;
  path?: string;
};

export type AutomationItemSelector = {
  id?: string;
  name?: string;
  index?: number;
  strategy?: 'first' | 'latest';
};

export type RendererAutomationAction =
  | {
      type: 'set-output-folder';
      folderPath: string | null;
    }
  | {
      type: 'apply-configuration';
      config: Record<string, unknown>;
      persist?: boolean;
      includeMeasurementSweepSettings?: boolean;
      includeApoState?: boolean;
    }
  | {
      type: 'import-measurements';
      files: AutomationVirtualFile[];
    }
  | {
      type: 'import-references';
      files: AutomationVirtualFile[];
    }
  | {
      type: 'import-microphone-calibration';
      channel: 'left' | 'right';
      file: AutomationVirtualFile;
    }
  | {
      type: 'set-plot-options';
      normalizePlot?: boolean;
      smoothingMode?: MeasurementSmoothingMode;
    }
  | {
      type: 'set-automation-options';
      algorithm?: AutomationAlgorithm;
      delaySeconds?: number;
      proportionalP?: number;
      dynamicProportionalP?: boolean;
      pidProportionalGain?: number;
      pidIntegralGain?: number;
      pidDerivativeGain?: number;
      dampedRefitBlend?: number;
      momentumBlend?: number;
      momentumDecay?: number;
      stopOnTolerance?: boolean;
      toleranceMaxAcceptableErrorWidthHz?: number;
      regressionLimit?: number;
      bandTolerances?: Partial<Record<'subBass' | 'bass' | 'lowMid' | 'mid' | 'upMid' | 'presence' | 'brilliance', number>>;
    }
  | {
      type: 'select-apo-measurement';
      selector: AutomationItemSelector;
    }
  | {
      type: 'select-apo-reference';
      selector: AutomationItemSelector;
    }
  | {
      type: 'set-measurement-visibility';
      selector: AutomationItemSelector;
      visible: boolean;
    }
  | {
      type: 'set-reference-visibility';
      selector: AutomationItemSelector;
      visible: boolean;
    }
  | {
      type: 'set-measurement-starred';
      selector: AutomationItemSelector;
      starred: boolean;
    }
  | {
      type: 'set-apo-mode';
      channelProfile?: ApoChannelProfile;
      eqMode?: ApoEqMode;
      maxFilters?: number;
      preampDb?: number;
    }
  | {
      type: 'set-apo-filters';
      filters: ApoFilter[];
    }
  | {
      type: 'generate-apo-filters';
      useAutomationAlgorithm?: boolean;
    }
  | {
      type: 'import-eq-profile';
      file: AutomationVirtualFile;
    }
  | {
      type: 'import-peace-preset';
      fileName: string;
    }
  | {
      type: 'refresh-equalizer-apo-status';
    }
  | {
      type: 'apply-apo-config';
      enableProfile?: boolean;
    }
  | {
      type: 'disable-peace';
    }
  | {
      type: 'run-measurement';
    }
  | {
      type: 'toggle-automation';
    }
  | {
      type: 'wait';
      ms: number;
    }
  | {
      type: 'wait-for-idle';
      timeoutMs?: number;
    };

export type RendererAutomationSnapshot = {
  busy: boolean;
  automationRunning: boolean;
  latestStatusMessage: string;
  latestStatusTone: string;
  measurementCount: number;
  referenceCount: number;
  selectedApoMeasurementId: string | null;
  selectedApoReferenceId: string | null;
  apoChannelProfile: ApoChannelProfile;
  apoEqMode: ApoEqMode;
  apoFilterCount: number;
};

export type RendererAutomationElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio: number;
} | null;

export type HeadlessAutomationStep =
  | {
      type: 'renderer-action';
      action: RendererAutomationAction;
    }
  | {
      type: 'screenshot';
      outputPath: string;
      selector?: string;
    };

export type HeadlessAutomationScript = {
  window?: {
    width?: number;
    height?: number;
  };
  steps: HeadlessAutomationStep[];
};
