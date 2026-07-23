'use client';

import { usePermissions, PermissionList, Can, Role } from 'najm-auth/client/react';
import { NBadge } from 'najm-kit';
import { Separator } from '@/components/ui/separator';

export function PermissionsSection() {
  const { roles, permissions } = usePermissions();

  return (
    <div className="space-y-6">
      {/* Roles */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Roles</h3>
        {roles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <NBadge key={role} color="neutral" look="soft">
                {role}
              </NBadge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No roles assigned.</p>
        )}
      </div>

      <Separator />

      {/* Permissions */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Permissions</h3>
        <div className="flex flex-wrap gap-2">
          <PermissionList fallback={<p className="text-sm text-muted-foreground">No permissions.</p>}>
            {(perm) => (
              <NBadge key={perm} color="neutral" look="outline">
                {perm}
              </NBadge>
            )}
          </PermissionList>
        </div>
      </div>

      <Separator />

      {/* Gate demos */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Gate Demos</h3>
        <p className="text-xs text-muted-foreground">
          These sections render conditionally based on your role and permissions.
        </p>

        <div className="grid gap-2 text-sm">
          <Role is="admin" fallback={<GateRow label="Role: admin" granted={false} />}>
            <GateRow label="Role: admin" granted />
          </Role>

          <Role is="user" fallback={<GateRow label="Role: user" granted={false} />}>
            <GateRow label="Role: user" granted />
          </Role>

          <Can permission="create:products" fallback={<GateRow label="Can create:products" granted={false} />}>
            <GateRow label="Can create:products" granted />
          </Can>

          <Can permission="delete:products" fallback={<GateRow label="Can delete:products" granted={false} />}>
            <GateRow label="Can delete:products" granted />
          </Can>

          <Can permission="read:products" fallback={<GateRow label="Can read:products" granted={false} />}>
            <GateRow label="Can read:products" granted />
          </Can>
        </div>
      </div>
    </div>
  );
}

function GateRow({ label, granted }: { label: string; granted: boolean }) {
  return (
    <div className="flex items-center justify-between rounded border px-3 py-2">
      <span className="font-mono text-xs">{label}</span>
      <NBadge color={granted ? 'success' : 'neutral'} look="solid">{granted ? 'Granted' : 'Denied'}</NBadge>
    </div>
  );
}
