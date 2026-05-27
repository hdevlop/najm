'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useRegister } from 'najm-auth/client/react';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();

  const { register, isLoading, error } = useRegister({
    onSuccess: () => router.replace('/login'),
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (values: Values) => {
    register({
      email: values.email,
      password: values.password,
    });
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
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {errorMsg ? (
            <Alert variant="destructive">
              <AlertTitle>Registration failed</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
