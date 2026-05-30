import { createContext } from 'react';
import type { StudioContextValue } from '../providers/types';

export const StudioContext = createContext<StudioContextValue | null>(null);

export { useStudio } from '../providers';
