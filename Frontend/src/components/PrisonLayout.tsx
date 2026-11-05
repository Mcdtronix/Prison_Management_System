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

  const getUserDisplayName = () => {
    // In a real app, this would come from user profile
    return user?.username || "User";
  };

  const getUserRoleDisplay = () => {
    if (!user?.role) return "User";
    return user.roleName || getRoleDisplayName(user.role);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
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
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium text-white">
                      {getUserDisplayName()}
                    </span>
                    <span className="text-xs text-gray-300">
                      {getUserRoleDisplay()}
                    </span>
                  </div>
                  <User className="h-4 w-4 text-gray-300" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{getUserDisplayName()}</span>
                    <span className="text-xs text-gray-500 mb-1">{getUserRoleDisplay()}</span>
                    {user?.mailboxAddress && (
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1 py-0.5 rounded w-max mt-1">
                        {user.mailboxAddress}
                      </span>
                    )}
                  </div>
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
