import type { FreakishEarsApi } from '../shared/ipc';
import type {
  RendererAutomationAction,
  RendererAutomationElementBounds,
  RendererAutomationSnapshot,
} from '../shared/automation';

declare global {
  interface Window {
    freakishEars: FreakishEarsApi;
    freakishEarsAutomation: {
      runAction: (action: RendererAutomationAction) => Promise<RendererAutomationSnapshot>;
      getSnapshot: () => RendererAutomationSnapshot;
      getElementBounds: (selector: string) => RendererAutomationElementBounds;
    };
  }
}

export {};
