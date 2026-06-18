import * as React from 'react';

const PORTAL_LAYER_STYLE_ID = 'najm-kit-portal-layer-styles';

export function useNajmPortalLayerStyles() {
  React.useInsertionEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(PORTAL_LAYER_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = PORTAL_LAYER_STYLE_ID;
    style.textContent = `[data-radix-popper-content-wrapper]{z-index:var(--portal-z-index,10000)!important;}`;
    document.head.appendChild(style);
  }, []);
}
