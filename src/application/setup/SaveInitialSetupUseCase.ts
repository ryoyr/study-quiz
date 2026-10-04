
import { persistSetup } from '../../infrastructure/repositories/setupRepository';
import type { Setup } from '../../types/Setup';
import { validateSetup, type SetupErrors } from '../../services/setupValidation';

export class ValidationError extends Error {
  readonly errors: SetupErrors;

  constructor(errors: SetupErrors) {
    super('入力内容を確認してください。');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class SaveInitialSetupUseCase {
  validate(input: Setup): void {
    const errors = validateSetup(input);
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  async execute(input: Setup): Promise<Setup> {
    const now = new Date().toISOString();
    const setup: Setup = {
      ...input,
      name: input.name.trim(),
      setupCompleted: true,
      createdAt: input.createdAt || now,
      updatedAt: now,
    };
    this.validate(setup);
    await persistSetup(setup);
    return setup;
  }
}
