export class NajmNextConfigError extends Error {
  constructor(message: string) {
    super(`[najm-next] ${message}`);
    this.name = 'NajmNextConfigError';
  }
}
