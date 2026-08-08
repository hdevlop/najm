'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuthClient } from 'najm-auth/client/react';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-zA-Z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number')
      .refine((value) => new TextEncoder().encode(value).length <= 72, 'At most 72 bytes'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type Values = z.infer<typeof schema>;

type SetupStatus =
  | { state: 'checking' }
  | { state: 'pending'; expiresAt: string }
  | { state: 'missing' }
  | { state: 'done' };

/**
 * First-login credential replacement. Authorization is the opaque setup cookie
 * the login response left behind — there is no session to read, so this page
 * asks the server for the pending setup rather than inspecting a cookie name.
 */
export function CredentialSetupForm() {
  const client = useAuthClient();
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus>({ state: 'checking' });
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    client.api
      .get<{ data: { expiresAt: string } }>('/auth/credential-setup/setup', { skipAuth: true })
      .then((res) => {
        if (!cancelled) setStatus({ state: 'pending', expiresAt: res.data.expiresAt });
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: 'missing' });
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: Values) => {
    setFailure(null);
    try {
      await client.api.post('/auth/credential-setup/change', {
        body: { newPassword: values.newPassword },
        skipAuth: true,
      });
      setStatus({ state: 'done' });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    }
  };

  const cancel = async () => {
    await client.api.post('/auth/credential-setup/cancel', { skipAuth: true }).catch(() => { });
    router.replace('/login');
  };

  if (status.state === 'checking') {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Checking your setup session...</p>
      </div>
    );
  }

  if (status.state === 'missing') {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Setup session expired</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in again with your temporary credential to start a new one.
        </p>
        <Button asChild className="mt-4 w-full">
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    );
  }

  if (status.state === 'done') {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Password set</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with your new password to finish.
        </p>
        <Button asChild className="mt-4 w-full">
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="mb-4 text-xs text-muted-foreground">
        Setup session expires at {new Date(status.expiresAt).toLocaleTimeString()}.
      </p>
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {failure ? (
            <Alert variant="destructive">
              <AlertTitle>Could not set the password</AlertTitle>
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Set password'}
          </Button>

          <Button type="button" variant="ghost" className="w-full" onClick={cancel}>
            Cancel
          </Button>
        </form>
      </Form>
    </div>
  );
}
