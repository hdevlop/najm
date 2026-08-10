import { defineTheme } from 'najm-theme/theme';

// The canonical factory theme directory, resolved from *this file* rather than
// from a working directory. The production build below is what proves that
// survives Next's server bundling: if `import.meta.url` did not point at this
// source file, the four assets next door would not be found and the build would
// fail while prerendering the pages that read them.
export const appTheme = defineTheme(import.meta.url);
