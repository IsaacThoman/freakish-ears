import type { FreakishEarsApi } from '../shared/ipc';

declare global {
  interface Window {
    freakishEars: FreakishEarsApi;
  }
}

export {};
