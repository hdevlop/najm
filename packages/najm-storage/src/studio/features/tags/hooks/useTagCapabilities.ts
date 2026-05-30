import useSWR from 'swr';
import { useTagApi, type Capabilities } from '../api';

const fallback: Capabilities = { tags: false, presign: false, trash: false, buckets: false };

export function useTagCapabilities() {
  const api = useTagApi();

  const { data, ...rest } = useSWR<Capabilities>('storage:capabilities', () => api.getCapabilities());

  return { data: data ?? fallback, ...rest };
}
