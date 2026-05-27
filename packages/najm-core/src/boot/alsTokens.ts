import { createAlsToken } from 'diject';

export const REQUEST_ID = createAlsToken<string>('requestId');