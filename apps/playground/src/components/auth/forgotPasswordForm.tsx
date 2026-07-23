'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForgotPassword } from 'najm-auth/client/react';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});

type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const { forgotPassword, isLoading, isSuccess, error, reset } = useForgotPassword();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = (values: Values) => {
    forgotPassword({ email: values.email });
  };

  if (isSuccess) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Check your email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          If an account exists with that email, we've sent a password reset link.
        </p>
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => {
            reset();
            form.reset();
          }}
        >
          Try another email
        </Button>
      </div>
    );
  }

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

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
