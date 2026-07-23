'use client';

import { useQuery } from '@tanstack/react-query';
import { usersService } from '@/services/api/users';

export function useAdminUsersQuery(enabled = true) {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersService.listAll(),
    enabled,
  });
}
