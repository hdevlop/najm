'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from 'najm-auth/client/react';
import { ProfileSection } from './profileSection';
import { SecuritySection } from './securitySection';
import { PermissionsSection } from './permissionsSection';
import { EventLogSection } from './eventLogSection';

export function AccountDashboard() {
  const user = useUser();
  if (!user) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <Tabs defaultValue="profile">
        <TabsList className="mb-6 w-full justify-start border-b border-border bg-transparent p-0">
          <TabsTrigger value="profile" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            Security
          </TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            Permissions
          </TabsTrigger>
          <TabsTrigger value="events" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            Events
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileSection />
        </TabsContent>
        <TabsContent value="security">
          <SecuritySection />
        </TabsContent>
        <TabsContent value="permissions">
          <PermissionsSection />
        </TabsContent>
        <TabsContent value="events">
          <EventLogSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
