import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const navbarVariants = cva(
  'flex w-full items-center',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground border-b border-border',
        primary: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        ghost: 'bg-transparent text-foreground',
        bordered: 'bg-card text-card-foreground border border-border',
      },
      sticky: {
        true: 'sticky top-0 z-50',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      sticky: true,
    },
  },
);

const Navbar = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & VariantProps<typeof navbarVariants>
>(({ className, variant, sticky, ...props }, ref) => (
  <nav
    ref={ref}
    className={cn(navbarVariants({ variant, sticky }), className)}
    {...props}
  />
));
Navbar.displayName = 'Navbar';

const NavbarStart = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-1 items-center', className)}
    {...props}
  />
));
NavbarStart.displayName = 'NavbarStart';

const NavbarCenter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-none items-center', className)}
    {...props}
  />
));
NavbarCenter.displayName = 'NavbarCenter';

const NavbarEnd = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-1 items-center justify-end', className)}
    {...props}
  />
));
NavbarEnd.displayName = 'NavbarEnd';

export { Navbar, NavbarStart, NavbarCenter, NavbarEnd, navbarVariants };
