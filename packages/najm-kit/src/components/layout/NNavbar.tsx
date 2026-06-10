import React from "react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "../Button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Menu, LogOut } from "lucide-react";
import type { NAppShellUser, NAppShellAction, UserMenuAction, NAppShellClassNames } from "./types";

export interface NavbarProps {
  title?: string;
  logo?: ReactNode;
  user?: NAppShellUser;
  actions?: NAppShellAction[];
  userMenuActions?: UserMenuAction[];
  onLogout?: () => void;
  onToggleSidebar?: () => void;
  onToggleMobile?: () => void;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
  classNames?: NAppShellClassNames;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function NNavbar({
  title,
  logo,
  user,
  actions = [],
  userMenuActions = [],
  onLogout,
  onToggleSidebar,
  onToggleMobile,
  leftSlot,
  rightSlot,
  className,
  classNames,
}: NavbarProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between h-14 px-4 bg-card shadow-sm shrink-0",
        classNames?.navbar,
        className
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-3">
        {onToggleMobile && (
          <Button variant="ghost" size="icon" onClick={onToggleMobile} className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        )}
        {onToggleSidebar && (
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="hidden md:flex">
            <Menu className="h-5 w-5" />
          </Button>
        )}
        {logo && <div className="shrink-0 md:hidden">{logo}</div>}
        {leftSlot}
        {title && <h1 className="text-lg font-semibold truncate">{title}</h1>}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {rightSlot}
        {actions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <Button
              key={action.id}
              variant="ghost"
              size="icon"
              onClick={action.onClick}
              title={action.label}
              className={cn(action.hideOnMobile && "hidden md:flex")}
            >
              {ActionIcon && <ActionIcon className="h-5 w-5" />}
              {action.badge}
            </Button>
          );
        })}

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback>{user.fallback || getInitials(user.name)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.name}</p>
                {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
              </div>
              {(userMenuActions.length > 0 || onLogout) && <DropdownMenuSeparator />}
              {userMenuActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <React.Fragment key={action.id}>
                    {action.separator && <DropdownMenuSeparator />}
                    <DropdownMenuItem onClick={action.onClick} className="cursor-pointer">
                      {ActionIcon && <ActionIcon className="h-4 w-4 mr-2" />}
                      {action.label}
                    </DropdownMenuItem>
                  </React.Fragment>
                );
              })}
              {onLogout && (
                <>
                  {userMenuActions.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
