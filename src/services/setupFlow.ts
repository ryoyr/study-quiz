import { SaveInitialSetupUseCase } from '../application/setup/SaveInitialSetupUseCase';
import type { Setup } from '../types/Setup';
import { createDefaultSetup } from '../types/Setup';
import { loadSetup } from './setupStorage';

export interface SetupFlowState {
  setup: Setup;
  requiresInitialSetup: boolean;
}

export const loadSetupFlowState = async (): Promise<SetupFlowState> => {
  const stored = await loadSetup();
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

export const completeInitialSetup = async (setup: Setup): Promise<Setup> =>
  new SaveInitialSetupUseCase().execute(setup);
