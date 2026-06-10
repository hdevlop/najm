import React, { useState } from 'react';
import { toast } from 'sonner';
import { Toaster, NButton } from 'najm-kit';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Bell,
  Heart,
  Mail,
  Download,
  Trash2,
  UserPlus,
  Settings,
  Rocket,
  X,
} from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ToastPage() {
  const [darkPosition, setDarkPosition] = useState<'top-right' | 'top-center' | 'bottom-right'>('top-right');

  return (
    <ComponentPage
      title="Toast"
      description="Non-intrusive notifications for success, error, warning, info, and promise-based feedback. Built on sonner."
      category="Feedback"
    >
      <Example
        title="Basic toast"
        description="Show a simple text notification using toast()."
        code={`import { toast } from 'sonner';

toast('Event created successfully');`}
      >
        <NButton onClick={() => toast('Event created successfully')}>
          <Bell size={16} /> Show toast
        </NButton>
      </Example>

      <Example
        title="Success toast"
        description="Green-accented toast for positive outcomes."
        code={`toast.success('Changes saved');`}
      >
        <NButton onClick={() => toast.success('Changes saved successfully')}>
          <CheckCircle size={16} /> Success
        </NButton>
      </Example>

      <Example
        title="Error toast"
        description="Red-accented toast for failures and errors."
        code={`toast.error('Failed to save changes');`}
      >
        <NButton variant="destructive" onClick={() => toast.error('Failed to save changes')}>
          <XCircle size={16} /> Error
        </NButton>
      </Example>

      <Example
        title="Warning toast"
        description="Amber-accented toast for caution states."
        code={`toast.warning('Your session will expire in 5 minutes');`}
      >
        <NButton onClick={() => toast.warning('Your session will expire in 5 minutes')}>
          <AlertTriangle size={16} /> Warning
        </NButton>
      </Example>

      <Example
        title="Info toast"
        description="Blue-accented toast for informational messages."
        code={`toast.info('A new version is available');`}
      >
        <NButton variant="outline" onClick={() => toast.info('A new version is available')}>
          <Info size={16} /> Info
        </NButton>
      </Example>

      <Example
        title="With description"
        description="Add a description below the title for more context."
        code={`toast.success('Profile updated', {
  description: 'Your changes have been saved to the server.',
});`}
      >
        <NButton onClick={() => toast.success('Profile updated', {
          description: 'Your changes have been saved to the server.',
        })}>
          <Settings size={16} /> With description
        </NButton>
      </Example>

      <Example
        title="With action button"
        description="Add an action button to let the user respond directly from the toast."
        code={`toast('File uploaded successfully', {
  action: {
    label: 'View file',
    onClick: () => console.log('View file'),
  },
});`}
      >
        <NButton onClick={() => toast('File uploaded successfully', {
          action: {
            label: 'View file',
            onClick: () => alert('Opening file...'),
          },
        })}>
          <Download size={16} /> With action
        </NButton>
      </Example>

      <Example
        title="With cancel button"
        description="Add a cancel button alongside an action for destructive confirmations."
        code={`toast.error('Item deleted', {
  description: 'This item has been removed from your account.',
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo delete'),
  },
  cancel: {
    label: 'Dismiss',
    onClick: () => console.log('Dismissed'),
  },
});`}
      >
        <NButton variant="destructive" onClick={() => toast.error('Item deleted', {
          description: 'This item has been removed from your account.',
          action: {
            label: 'Undo',
            onClick: () => toast.success('Item restored'),
          },
        })}>
          <Trash2 size={16} /> Delete with undo
        </NButton>
      </Example>

      <Example
        title="Custom duration"
        description="Set how long the toast stays visible. Default is 4000ms. Use Infinity for persistent toasts."
        code={`toast('Saved as draft', { duration: 2000 });

toast('Important notice', { duration: Infinity });`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <NButton variant="outline" onClick={() => toast('This disappears in 2 seconds', { duration: 2000 })}>
            2s duration
          </NButton>
          <NButton variant="outline" onClick={() => toast('Click X to dismiss', { duration: Infinity })}>
            Persistent
          </NButton>
        </div>
      </Example>

      <Example
        title="Promise toast"
        description="Show loading, success, and error states automatically from a promise."
        code={`const fetchData = () => new Promise((resolve) =>
  setTimeout(resolve, 2000)
);

toast.promise(fetchData(), {
  loading: 'Loading data...',
  success: 'Data loaded successfully!',
  error: 'Failed to load data',
});`}
      >
        <NButton onClick={() => {
          const fetchData = () => delay(2000);
          toast.promise(fetchData(), {
            loading: 'Loading data...',
            success: 'Data loaded successfully!',
            error: 'Failed to load data',
          });
        }}>
          <Rocket size={16} /> Promise toast
        </NButton>
      </Example>

      <Example
        title="Promise with data"
        description="Access the resolved value to build dynamic success messages."
        code={`const fetchUser = () =>
  new Promise<{ name: string }>((resolve) =>
    setTimeout(() => resolve({ name: 'John' }), 2000)
  );

toast.promise(fetchUser(), {
  loading: 'Fetching user...',
  success: (data) => \`Welcome back, \${data.name}!\`,
  error: 'Failed to fetch user',
});`}
      >
        <NButton onClick={() => {
          const fetchUser = () =>
            new Promise<{ name: string }>((resolve) =>
              setTimeout(() => resolve({ name: 'John' }), 2000)
            );
          toast.promise(fetchUser(), {
            loading: 'Fetching user...',
            success: (data) => `Welcome back, ${data.name}!`,
            error: 'Failed to fetch user',
          });
        }}>
          <UserPlus size={16} /> Promise with data
        </NButton>
      </Example>

      <Example
        title="Loading toast"
        description="Manually show a loading toast and update it later."
        code={`const toastId = toast.loading('Uploading file...');

// Later, when done:
toast.success('File uploaded!', { id: toastId });

// Or on error:
toast.error('Upload failed', { id: toastId });`}
      >
        <NButton onClick={() => {
          const toastId = toast.loading('Uploading file...');
          setTimeout(() => {
            toast.success('File uploaded!', { id: toastId });
          }, 2500);
        }}>
          <Download size={16} /> Loading then success
        </NButton>
      </Example>

      <Example
        title="Dismiss all toasts"
        description="Programmatically dismiss all active toasts."
        code={`import { toast } from 'sonner';

toast.dismiss();`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <NButton variant="outline" onClick={() => {
            toast('First notification');
            toast.success('Second notification');
            toast.info('Third notification');
          }}>
            <Bell size={16} /> Show 3 toasts
          </NButton>
          <NButton variant="ghost" onClick={() => toast.dismiss()}>
            <X size={16} /> Dismiss all
          </NButton>
        </div>
      </Example>

      <Example
        title="Custom toast"
        description="Render a completely custom component as a toast."
        code={`toast.custom((t) => (
  <div className="flex items-center gap-3 rounded-lg border bg-background p-4 shadow-lg">
    <Heart className="text-pink-500" />
    <div>
      <p className="font-medium">Someone liked your post</p>
      <p className="text-sm text-muted-foreground">Click to view</p>
    </div>
    <NButton onClick={() => toast.dismiss(t)}>✕</NButton>
  </div>
), { duration: 5000 });`}
      >
        <NButton onClick={() => {
          toast.custom((t) => (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4 shadow-lg w-full max-w-sm">
              <Heart className="text-pink-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Someone liked your post</p>
                <p className="text-xs text-muted-foreground">Click to view</p>
              </div>
              <NButton
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => toast.dismiss(t)}
              >
                <X size={14} />
              </NButton>
            </div>
          ), { duration: 5000 });
        }}>
          <Heart size={16} className="text-pink-500" /> Custom toast
        </NButton>
      </Example>

      <Example
        title="Toast all types"
        description="Fire all toast types at once to preview the visual differences."
        code={`toast('Basic notification');
toast.success('Operation succeeded');
toast.error('Something went wrong');
toast.warning('Proceed with caution');
toast.info('For your information');`}
      >
        <NButton onClick={() => {
          toast('Basic notification');
          toast.success('Operation succeeded');
          toast.error('Something went wrong');
          toast.warning('Proceed with caution');
          toast.info('For your information');
        }}>
          <Bell size={16} /> Show all types
        </NButton>
      </Example>

      <Example
        title="Setup — Toaster in layout"
        description="Place the Toaster component once in your root layout. It renders the toast container."
        center={false}
        code={`import { Toaster } from 'najm-kit';

// In your root layout (App.tsx or layout.tsx):
export default function Layout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}`}
      >
        <div className="w-full rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Layout setup</p>
          <p>Add <code className="text-xs bg-muted px-1.5 py-0.5 rounded">&lt;Toaster /&gt;</code> once in your root layout file.</p>
          <p>The playground already includes <code className="text-xs bg-muted px-1.5 py-0.5 rounded">&lt;Toaster /&gt;</code> — all toast examples above render into it.</p>
        </div>
      </Example>
    </ComponentPage>
  );
}
