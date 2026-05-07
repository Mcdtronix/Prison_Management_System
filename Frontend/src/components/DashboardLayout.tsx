
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Link } from "react-router-dom";
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
import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardLayoutProps {
  children: ReactNode;
  userType: "student" | "teacher" | "admin";
}

export const DashboardLayout = ({
  children,
  userType,
}: DashboardLayoutProps) => {
  const isMobile = useIsMobile();
  const name = userType === "student" 
    ? "John Doe" 
    : userType === "teacher" 
    ? "Dr. Smith" 
    : "Admin User";
  
  const role = userType === "student"
    ? "Student" 
    : userType === "teacher"
    ? "Professor"
    : "Administrator";
  
  const baseUrl = `/${userType}`;

  return (
    <div className="flex min-h-screen">
      <Sidebar userType={userType} />
      
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b flex items-center justify-between px-4 bg-background">
          <div className="md:hidden">
            {/* Mobile header content */}
            <Link to={baseUrl} className="font-medium">
              {userType.charAt(0).toUpperCase() + userType.slice(1)} Dashboard
            </Link>
          </div>
          
          <div className="md:flex items-center gap-4 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg" alt={name} />
                    <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {role}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={`${baseUrl}/profile`} className="w-full cursor-pointer flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/logout" className="w-full cursor-pointer flex items-center">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-accent/30">
          {children}
        </main>
      </div>
    </div>
  );
};
