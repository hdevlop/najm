import React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  NButton,
  IconButton,
} from 'najm-kit';
import {
  Archive,
  Bell,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileText,
  FolderInput,
  Link,
  LogOut,
  Mail,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Settings,
  Share2,
  Trash2,
  User,
} from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

function PreviewBox({ children, className = 'max-w-sm' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex w-full ${className} items-center justify-center`}>{children}</div>;
}

export function DropdownPage() {
  const [showActivity, setShowActivity] = React.useState(true);
  const [showFavorites, setShowFavorites] = React.useState(false);
  const [density, setDensity] = React.useState('comfortable');
  const [theme, setTheme] = React.useState('system');

  return (
    <ComponentPage
      title="Dropdown Menu"
      description="Action menus and option menus with labels, separators, shortcuts, checkboxes, radio items, submenus, and destructive actions."
      category="Overlays"
    >
      <Example
        title="Basic Actions"
        description="A labeled menu for account-level actions."
        center={false}
        previewHeight="h-56"
        code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <NButton variant="outline">
      Options <ChevronDown size={14} />
    </NButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-52" align="start">
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>
      <User /> Profile
    </DropdownMenuItem>
    <DropdownMenuItem>
      <Settings /> Settings
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">
      <LogOut /> Log out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`}
      >
        <PreviewBox>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <NButton variant="outline">
                Options <ChevronDown size={14} />
              </NButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52" align="start">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <LogOut /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PreviewBox>
      </Example>

      <Example
        title="Row Actions"
        description="Use an icon-only trigger for dense table rows and card lists."
        center={false}
        previewHeight="h-56"
        code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <IconButton variant="ghost" aria-label="Row actions">
      <MoreHorizontal size={16} />
    </IconButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-44">
    <DropdownMenuItem>
      <Pencil /> Edit
    </DropdownMenuItem>
    <DropdownMenuItem>
      <Copy /> Duplicate
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">
      <Trash2 /> Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`}
      >
        <PreviewBox>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" aria-label="Row actions">
                <MoreHorizontal size={16} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PreviewBox>
      </Example>

      <Example
        title="Keyboard Shortcuts"
        description="Use DropdownMenuShortcut for discoverable command hints."
        center={false}
        previewHeight="h-64"
        code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <NButton variant="outline">
      File <ChevronDown size={14} />
    </NButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56" align="start">
    <DropdownMenuItem>
      <Plus /> New file
      <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuItem>
      <Download /> Export
      <DropdownMenuShortcut>Ctrl+E</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuItem disabled>
      <Archive /> Archive
      <DropdownMenuShortcut>Ctrl+A</DropdownMenuShortcut>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`}
      >
        <PreviewBox>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <NButton variant="outline">
                File <ChevronDown size={14} />
              </NButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuItem>
                <Plus /> New file
                <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download /> Export
                <DropdownMenuShortcut>Ctrl+E</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Archive /> Archive
                <DropdownMenuShortcut>Ctrl+A</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PreviewBox>
      </Example>

      <Example
        title="Grouped Menu"
        description="Group related actions under labels and separators."
        center={false}
        previewHeight="h-72"
        code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <NButton variant="outline">Document</NButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>Document</DropdownMenuLabel>
    <DropdownMenuGroup>
      <DropdownMenuItem>
        <Eye /> Preview
      </DropdownMenuItem>
      <DropdownMenuItem>
        <FileText /> Rename
      </DropdownMenuItem>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <DropdownMenuItem>
        <FolderInput /> Move to folder
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Link /> Copy link
      </DropdownMenuItem>
    </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>`}
      >
        <PreviewBox>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <NButton variant="outline">Document</NButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Document</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Eye /> Preview
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileText /> Rename
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <FolderInput /> Move to folder
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link /> Copy link
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </PreviewBox>
      </Example>

      <Example
        title="Checkbox Items"
        description="Use checkbox items for independent display preferences."
        center={false}
        previewHeight="h-56"
        code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <NButton variant="outline">View options</NButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>Visible panels</DropdownMenuLabel>
    <DropdownMenuCheckboxItem
      checked={showActivity}
      onCheckedChange={setShowActivity}
    >
      Activity panel
    </DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem
      checked={showFavorites}
      onCheckedChange={setShowFavorites}
    >
      Favorites panel
    </DropdownMenuCheckboxItem>
  </DropdownMenuContent>
</DropdownMenu>`}
      >
        <PreviewBox>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <NButton variant="outline">View options</NButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Visible panels</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={showActivity} onCheckedChange={setShowActivity}>
                Activity panel
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showFavorites} onCheckedChange={setShowFavorites}>
                Favorites panel
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PreviewBox>
      </Example>

      <Example
        title="Radio Items"
        description="Use radio groups when exactly one option should be active."
        center={false}
        previewHeight="h-72"
        code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <NButton variant="outline">Density</NButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>Table density</DropdownMenuLabel>
    <DropdownMenuRadioGroup
      value={density}
      onValueChange={setDensity}
    >
      <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="spacious">Spacious</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>`}
      >
        <PreviewBox>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <NButton variant="outline">Density</NButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Table density</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={density} onValueChange={setDensity}>
                <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="spacious">Spacious</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </PreviewBox>
      </Example>

      <Example
        title="Submenus"
        description="Use submenus for secondary choices that would make the main menu too long."
        center={false}
        previewHeight="h-72"
        code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <NButton variant="outline">Share</NButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuItem>
      <Share2 /> Copy public link
    </DropdownMenuItem>
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Mail /> Send to
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-44">
        <DropdownMenuItem>Teammate</DropdownMenuItem>
        <DropdownMenuItem>Client</DropdownMenuItem>
        <DropdownMenuItem>External reviewer</DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  </DropdownMenuContent>
</DropdownMenu>`}
      >
        <PreviewBox>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <NButton variant="outline">Share</NButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuItem>
                <Share2 /> Copy public link
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Mail /> Send to
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  <DropdownMenuItem>Teammate</DropdownMenuItem>
                  <DropdownMenuItem>Client</DropdownMenuItem>
                  <DropdownMenuItem>External reviewer</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </PreviewBox>
      </Example>

      <Example
        title="Theme Picker"
        description="A realistic settings menu that combines icons, radio items, and separators."
        center={false}
        previewHeight="h-72"
        code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <NButton variant="outline">
      <Palette size={14} /> Theme
    </NButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-52">
    <DropdownMenuLabel>Theme</DropdownMenuLabel>
    <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
      <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>`}
      >
        <PreviewBox>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <NButton variant="outline">
                <Palette size={14} /> Theme
              </NButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52">
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </PreviewBox>
      </Example>

      <Example
        title="Notifications Menu"
        description="A compact icon trigger with mixed item types."
        center={false}
        previewHeight="h-64"
        code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <IconButton variant="ghost" aria-label="Notifications">
      <Bell size={16} />
    </IconButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-64">
    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>
      <Mail /> Invite accepted
    </DropdownMenuItem>
    <DropdownMenuItem>
      <FileText /> Report is ready
    </DropdownMenuItem>
    <DropdownMenuItem disabled>
      No more notifications
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`}
      >
        <PreviewBox>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" aria-label="Notifications">
                <Bell size={16} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Mail /> Invite accepted
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileText /> Report is ready
              </DropdownMenuItem>
              <DropdownMenuItem disabled>No more notifications</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PreviewBox>
      </Example>

      <Example
        title="Destructive Confirmation Entry"
        description="Prefer the destructive variant for dangerous menu actions."
        center={false}
        previewHeight="h-56"
        code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <NButton variant="outline">Danger zone</NButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuItem>
      <Archive /> Archive project
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">
      <Trash2 /> Delete project
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`}
      >
        <PreviewBox>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <NButton variant="outline">Danger zone</NButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuItem>
                <Archive /> Archive project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2 /> Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PreviewBox>
      </Example>

      <Example
        title="Inset Items"
        description="Use inset items when some rows do not have icons but should align with rows that do."
        center={false}
        previewHeight="h-64"
        code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <NButton variant="outline">Mixed content</NButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-52">
    <DropdownMenuLabel>Project</DropdownMenuLabel>
    <DropdownMenuItem>
      <Settings /> Settings
    </DropdownMenuItem>
    <DropdownMenuItem inset>Billing</DropdownMenuItem>
    <DropdownMenuItem inset>Members</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`}
      >
        <PreviewBox>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <NButton variant="outline">Mixed content</NButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52">
              <DropdownMenuLabel>Project</DropdownMenuLabel>
              <DropdownMenuItem>
                <Settings /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem inset>Billing</DropdownMenuItem>
              <DropdownMenuItem inset>Members</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}
