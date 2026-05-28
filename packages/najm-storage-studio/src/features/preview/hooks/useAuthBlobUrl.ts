import { useEffect, useRef, useState } from 'react';
import { useStudio } from '../../../providers';

export function useAuthBlobUrl(url: string | undefined, enabled: boolean = true) {
  const { getAuthHeaders } = useStudio();
  const [blobUrl, setBlobUrl] = useState<string | undefined>(url);
  const activeUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const previousUrl = activeUrlRef.current;
    activeUrlRef.current = undefined;

    if (!enabled || !url) {
      setBlobUrl(url);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return;
    }

    const headers = getAuthHeaders();
    if (!Object.keys(headers).length) {
      setBlobUrl(url);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | undefined;

    fetch(url, { headers, credentials: 'same-origin', signal: controller.signal })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        activeUrlRef.current = objectUrl;
        setBlobUrl(objectUrl);
        if (previousUrl) URL.revokeObjectURL(previousUrl);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setBlobUrl(url);
        if (previousUrl) URL.revokeObjectURL(previousUrl);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (activeUrlRef.current === objectUrl) activeUrlRef.current = undefined;
    };
  }, [url, enabled, getAuthHeaders]);

  useEffect(() => {
    return () => {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = undefined;
      }
    };
  }, []);

  return blobUrl;
}
