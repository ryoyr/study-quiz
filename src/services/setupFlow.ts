
import type { Setup } from '../types/Setup';
import { createDefaultSetup } from '../types/Setup';
import { loadSetup, saveSetup } from './setupStorage';

export interface SetupFlowState {
  setup: Setup;
  requiresInitialSetup: boolean;
}

export const loadSetupFlowState = (): SetupFlowState => {
  const stored = loadSetup();
  if (!stored) {
    return {
      setup: createDefaultSetup(),
      requiresInitialSetup: true,
    };
  }
  return {
    setup: stored,
    requiresInitialSetup: stored.setupCompleted !== true,
  };
};

export const completeInitialSetup = (setup: Setup): Setup => {
  const completed: Setup = {
    ...setup,
    setupCompleted: true,
    updatedAt: new Date().toISOString(),
  };
  saveSetup(completed);
  return completed;
};
