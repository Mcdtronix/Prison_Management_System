import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Button } from "./ui/button";
import { LogOut, Menu, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleDisplayName } from "@/lib/auth";

interface PrisonLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export const PrisonLayout = ({
  children,
  title,
  description,
}: PrisonLayoutProps) => {
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const getUserDisplayName = () => user?.fullName || user?.username || "User";

  const getUserRoleDisplay = () => {
    if (!user?.role) return "User";
    return user.roleName || getRoleDisplayName(user.role);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-background">
      <Sidebar
        userRole={user?.role || ""}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-10 h-16 border-b border-[#063f20] bg-[#0b4f2a] flex items-center justify-between gap-2 px-3 md:px-6 shadow-sm">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden shrink-0 text-white hover:bg-[#063f20] hover:text-white"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            {title && (
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-semibold text-white truncate">{title}</h1>
                {description && (
                  <p className="text-sm text-gray-200 truncate max-w-md">{description}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 md:px-3 text-white hover:bg-[#063f20] hover:text-white">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={getUserDisplayName()} />
                    <AvatarFallback className="bg-[#d7a928] text-[#0b4f2a]">
                      {getUserDisplayName().charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex min-w-0 max-w-[240px] flex-col items-start leading-tight">
                    <span className="max-w-full truncate text-sm font-medium text-white">
                      {getUserDisplayName()}
                    </span>
                    <span
                      className="max-w-full truncate text-xs text-gray-300"
                      title={user?.email || undefined}
                    >
                      {user?.email || getUserRoleDisplay()}
                    </span>
                  </div>
                  <User className="h-4 w-4 text-gray-300" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-[#0b4f2a] text-white">
                        {getUserDisplayName().charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold text-gray-900">{getUserDisplayName()}</span>
                      <span className="text-xs text-gray-500">{getUserRoleDisplay()}</span>
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1.5 border-t pt-3 text-xs">
                    {user?.email && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Email</dt>
                        <dd className="truncate text-gray-900" title={user.email}>
                          {user.email}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Service no.</dt>
                      <dd className="font-mono text-gray-900">{user?.username}</dd>
                    </div>
                    {user?.mailboxAddress && (
                      <div className="flex justify-between gap-3">
                        <dt className="shrink-0 text-gray-500">Mailbox</dt>
                        <dd className="truncate font-mono text-gray-700" title={user.mailboxAddress}>
                          {user.mailboxAddress}
                        </dd>
                      </div>
                    )}
                  </dl>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-3 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
