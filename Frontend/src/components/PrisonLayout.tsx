import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Button } from "./ui/button";
import { LogOut, User } from "lucide-react";
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

  const getUserDisplayName = () => {
    // In a real app, this would come from user profile
    return user?.username || "User";
  };

  const getUserRoleDisplay = () => {
    if (!user?.role) return "User";
    return user.role.replace("_", " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userRole={user?.role || ""} />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-4">
            {title && (
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
                {description && (
                  <p className="text-sm text-gray-600">{description}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={getUserDisplayName()} />
                    <AvatarFallback className="bg-[#d7a928]/25 text-[#0b4f2a]">
                      {getUserDisplayName().charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium text-gray-900">
                      {getUserDisplayName()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getUserRoleDisplay()}
                    </span>
                  </div>
                  <User className="h-4 w-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{getUserDisplayName()}</span>
                    <span className="text-xs text-gray-500">{getUserRoleDisplay()}</span>
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
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
