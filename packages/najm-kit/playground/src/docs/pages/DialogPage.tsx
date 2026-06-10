import React, { useState } from 'react';
import {
  NButton,
  NDialog,
  TextInput,
  SelectInput,
  TextAreaInput,
  useDialog,
} from 'najm-kit';
import { Archive, FileText, Pencil, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

const roles = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
  { value: 'viewer', label: 'Viewer' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function InviteMemberFields() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');

  return (
    <div className="grid gap-4">
      <Field label="Full name">
        <TextInput value={name} onChange={setName} placeholder="Jane Doe" />
      </Field>
      <Field label="Email address">
        <TextInput value={email} onChange={setEmail} placeholder="jane@example.com" />
      </Field>
      <Field label="Role">
        <SelectInput value={role} onChange={setRole} items={roles} />
      </Field>
    </div>
  );
}

function DisplayNameFields() {
  const [name, setName] = useState('Jane Doe');

  return (
    <Field label="Display name">
      <TextInput value={name} onChange={setName} />
    </Field>
  );
}

function ReviewNoteFields() {
  const [note, setNote] = useState('');

  return (
    <Field label="Note">
      <TextAreaInput value={note} onChange={setNote} rows={5} placeholder="Write a short note..." />
    </Field>
  );
}

function TermsContent() {
  return (
    <div className="max-h-64 space-y-3 overflow-y-auto pr-2 text-sm text-muted-foreground">
      {Array.from({ length: 8 }).map((_, i) => (
        <p key={i}>
          {i + 1}. Review the workspace terms, privacy responsibilities, and account usage requirements before continuing.
        </p>
      ))}
    </div>
  );
}

function MembersList() {
  return (
    <div className="divide-y divide-border">
      {[
        { name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin' },
        { name: 'Bob Smith', email: 'bob@example.com', role: 'Member' },
        { name: 'Carol White', email: 'carol@example.com', role: 'Viewer' },
      ].map((member) => (
        <div key={member.email} className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium">{member.name}</p>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{member.role}</span>
        </div>
      ))}
    </div>
  );
}

export function DialogPage() {
  const dialog = useDialog();
  const [result, setResult] = useState('');

  const showResult = (message: string) => {
    setResult(message);
    setTimeout(() => setResult(''), 2000);
  };

  const openBasic = () => {
    void dialog.custom({
      title: 'Edit profile',
      description: 'Make changes to your profile here.',
      children: <p className="text-sm text-muted-foreground">Form fields or any custom React content go here.</p>,
      primaryButton: {
        text: 'Save changes',
        onClick: () => showResult('Profile saved'),
      },
      secondaryButton: { text: 'Cancel' },
      size: 'sm',
    });
  };

  const openInvite = () => {
    void dialog.custom({
      title: 'Invite team member',
      description: 'Send an invitation email to add someone to your team.',
      children: <InviteMemberFields />,
      primaryButton: {
        text: 'Send invitation',
        onClick: () => showResult('Invitation sent'),
      },
      secondaryButton: { text: 'Cancel' },
      size: 'md',
    });
  };

  const openEditName = () => {
    void dialog.custom({
      title: 'Edit display name',
      description: 'This is what other users will see.',
      children: <DisplayNameFields />,
      primaryButton: {
        text: 'Save',
        onClick: () => showResult('Name saved'),
      },
      secondaryButton: { text: 'Cancel' },
      size: 'sm',
    });
  };

  const openTerms = () => {
    void dialog.custom({
      title: 'Terms of Service',
      description: 'Last updated January 2026',
      children: <TermsContent />,
      primaryButton: { text: 'Accept' },
      secondaryButton: { text: 'Close' },
      size: 'md',
    });
  };

  const openMembers = () => {
    void dialog.custom({
      title: 'Team members',
      description: '3 members in your workspace.',
      children: <MembersList />,
      primaryButton: {
        text: 'Invite',
        onClick: () => showResult('Invite flow opened'),
      },
      secondaryButton: { text: 'Close' },
      width: '3xl',
    });
  };

  const openNote = () => {
    void dialog.custom({
      title: 'Add review note',
      description: 'Leave context for the next reviewer.',
      children: <ReviewNoteFields />,
      primaryButton: {
        text: 'Add note',
        onClick: () => showResult('Note added'),
      },
      secondaryButton: { text: 'Cancel' },
      size: 'md',
    });
  };

  const openDelete = () => {
    void dialog.confirmDelete({
      itemName: 'Annual_Report_2026.pdf',
      onConfirm: () => showResult('File deleted'),
    });
  };

  const openArchive = () => {
    void dialog.custom({
      title: 'Archive project?',
      description: 'The project will be hidden from the main list. You can restore it later.',
      primaryButton: {
        text: 'Archive',
        onClick: () => showResult('Project archived'),
      },
      secondaryButton: { text: 'Keep active' },
      size: 'sm',
    });
  };

  const openReset = () => {
    void dialog.custom({
      title: 'Reset settings?',
      description: 'Your configuration will be restored to defaults. This cannot be undone.',
      children: <p className="text-sm text-muted-foreground">The primary button enters a loading state while the async handler runs.</p>,
      primaryButton: {
        text: 'Reset',
        variant: 'destructive',
        loadingText: 'Resetting...',
        onClick: async () => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          showResult('Settings reset');
        },
      },
      secondaryButton: { text: 'Cancel' },
      size: 'sm',
    });
  };

  return (
    <ComponentPage
      title="Dialog"
      description="Optimized Najm dialog API. Use NDialog directly for local dialogs, or mount it once and open dialogs with useDialog for programmatic flows."
      category="Overlays"
    >
      <Example
        title="Setup Once"
        description="Render NDialog once near your app root. Every useDialog call uses this mounted renderer."
        code={`import { NDialog } from 'najm-kit';

export function App() {
  return (
    <>
      <Routes />
      <NDialog />
    </>
  );
}`}
      >
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Add <span className="font-mono text-foreground">NDialog</span> once in your root layout, then trigger dialogs from any child with <span className="font-mono text-foreground">useDialog()</span>.
        </div>
      </Example>

      <Example
        title="Direct Component"
        description="Use NDialog directly when the trigger and content live together. No open state or hook is required."
        code={`<NDialog
  trigger={<NButton variant="outline">Open dialog</NButton>}
  title="Edit profile"
  description="Make changes to your profile here."
  primaryButton={{
    text: 'Save changes',
    onClick: saveProfile,
  }}
  secondaryButton={{ text: 'Cancel' }}
  size="sm"
>
  <p>Form fields or any custom React content go here.</p>
</NDialog>`}
      >
        <NDialog
          trigger={<NButton variant="outline">Open direct dialog</NButton>}
          title="Edit profile"
          description="Make changes to your profile here."
          primaryButton={{
            text: 'Save changes',
            onClick: () => showResult('Direct dialog saved'),
          }}
          secondaryButton={{ text: 'Cancel' }}
          size="sm"
        >
          <p className="text-sm text-muted-foreground">Form fields or any custom React content go here.</p>
        </NDialog>
      </Example>

      <Example
        title="Programmatic Dialog"
        description="Open a full modal with title, description, content, and footer buttons from one function call."
        code={`const dialog = useDialog();

dialog.custom({
  title: 'Edit profile',
  description: 'Make changes to your profile here.',
  children: <p>Form fields go here.</p>,
  primaryButton: {
    text: 'Save changes',
    onClick: saveProfile,
  },
  secondaryButton: { text: 'Cancel' },
});`}
      >
        <div className="flex items-center gap-3">
          <NButton variant="outline" onClick={openBasic}>Open dialog</NButton>
          {result && <span className="text-sm text-green-500">{result}</span>}
        </div>
      </Example>

      <Example
        title="Form Dialog"
        description="Pass form content as children; button wiring and closing are handled by the dialog store."
        code={`dialog.custom({
  title: 'Invite team member',
  description: 'Send an invitation email.',
  children: <InviteMemberFields />,
  primaryButton: {
    text: 'Send invitation',
    onClick: sendInvite,
  },
  secondaryButton: { text: 'Cancel' },
});`}
      >
        <NButton onClick={openInvite}>
          <UserPlus size={16} /> Invite member
        </NButton>
      </Example>

      <Example
        title="Edit Flow"
        description="No local open state is needed for the trigger; useDialog owns the dialog lifecycle."
        code={`dialog.custom({
  title: 'Edit display name',
  description: 'This is what other users will see.',
  children: <DisplayNameFields />,
  primaryButton: {
    text: 'Save',
    onClick: saveName,
  },
  secondaryButton: { text: 'Cancel' },
});`}
      >
        <NButton variant="outline" onClick={openEditName}>
          <Pencil size={16} /> Edit name
        </NButton>
      </Example>

      <Example
        title="Scrollable Content"
        description="Long content can stay inside the dialog body while the footer remains easy to reach."
        code={`dialog.custom({
  title: 'Terms of Service',
  description: 'Last updated January 2026',
  children: <TermsContent />,
  primaryButton: { text: 'Accept' },
  secondaryButton: { text: 'Close' },
});`}
      >
        <NButton variant="outline" onClick={openTerms}>
          <FileText size={16} /> Terms of service
        </NButton>
      </Example>

      <Example
        title="Wide Dialog"
        description="Use width and height options instead of hand-writing content class names."
        code={`dialog.custom({
  title: 'Team members',
  description: '3 members in your workspace.',
  children: <MembersList />,
  width: '3xl',
  primaryButton: { text: 'Invite' },
  secondaryButton: { text: 'Close' },
});`}
      >
        <NButton variant="outline" onClick={openMembers}>
          <Users size={16} /> View members
        </NButton>
      </Example>

      <Example
        title="Custom Content"
        description="Any React node works as children, including local components with their own state."
        code={`dialog.custom({
  title: 'Add review note',
  description: 'Leave context for the next reviewer.',
  children: <ReviewNoteFields />,
  primaryButton: {
    text: 'Add note',
    onClick: addNote,
  },
  secondaryButton: { text: 'Cancel' },
});`}
      >
        <NButton variant="outline" onClick={openNote}>Add review note</NButton>
      </Example>

      <Example
        title="Confirm Delete"
        description="Use confirmDelete for destructive delete flows with a focused warning state."
        code={`dialog.confirmDelete({
  itemName: 'Annual_Report_2026.pdf',
  onConfirm: deleteFile,
});`}
      >
        <NButton variant="destructive" onClick={openDelete}>
          <Trash2 size={16} /> Delete file
        </NButton>
      </Example>

      <Example
        title="Default Confirmation"
        description="For reversible confirmations, use custom with neutral button variants."
        code={`dialog.custom({
  title: 'Archive project?',
  description: 'You can restore it later.',
  primaryButton: {
    text: 'Archive',
    onClick: archiveProject,
  },
  secondaryButton: { text: 'Keep active' },
});`}
      >
        <NButton variant="outline" onClick={openArchive}>
          <Archive size={16} /> Archive project
        </NButton>
      </Example>

      <Example
        title="Async Loading"
        description="Async primary handlers automatically put the primary button into its loading state."
        code={`dialog.custom({
  title: 'Reset settings?',
  description: 'Your configuration will be restored to defaults.',
  primaryButton: {
    text: 'Reset',
    variant: 'destructive',
    loadingText: 'Resetting...',
    onClick: resetSettings,
  },
  secondaryButton: { text: 'Cancel' },
});`}
      >
        <NButton variant="outline" onClick={openReset}>
          <RefreshCw size={16} /> Reset settings
        </NButton>
      </Example>
    </ComponentPage>
  );
}
