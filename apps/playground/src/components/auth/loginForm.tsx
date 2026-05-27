'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useLogin } from 'najm-auth/client/react';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();

  const { login, isLoading, error } = useLogin({
    onSuccess: () => router.replace('/dashboard'),
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (values: Values) => {
    login({ email: values.email, password: values.password });
  };

  const errorMsg = error ? error.message : null;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {errorMsg ? (
            <Alert variant="destructive">
              <AlertTitle>Login failed</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
