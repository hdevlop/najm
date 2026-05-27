// Boot Module Types

// ============================================================================
// CORE SERVICE TYPES
// ============================================================================

export interface CoreService {
   scan?: () => Promise<void>;
   configure?: () => Promise<void>;
   activate?: () => Promise<void>;
   onReady?: () => Promise<void>;
   onDestroy?: () => Promise<void>;
}
