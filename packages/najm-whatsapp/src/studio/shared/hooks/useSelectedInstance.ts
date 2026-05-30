import { useStudio } from '@/lib/context';

export function useSelectedInstance() {
  const { selectedInstanceId, setSelectedInstanceId } = useStudio();
  return { instanceId: selectedInstanceId, setInstanceId: setSelectedInstanceId };
}
