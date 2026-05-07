
import React from 'react';
import { Link } from 'react-router-dom';
import { Gavel, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  user: {
    name: string;
    role: string;
  };
  onLogout: () => void;
  navItems: NavItem[];
}

export function DashboardShell({
  children,
  title,
  description,
  user,
  onLogout,
  navItems,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-2 md:gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="pr-0">
                <div className="px-7">
                  <Link to="/" className="flex items-center gap-2">
                    <Gavel className="h-6 w-6 text-[#9b87f5]" />
                    <span className="font-bold">Prison Management</span>
                  </Link>
                </div>
                <Separator className="my-4" />
                <nav className="grid gap-2 px-2">
                  {navItems.map((item, index) => (
                    <Link
                      key={index}
                      to={item.href}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            <Link to="/" className="hidden items-center gap-2 md:flex">
              <Gavel className="h-6 w-6 text-[#9b87f5]" />
              <span className="font-bold">Prison Management</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-sm md:block">
              <div className="font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.role}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={onLogout}>
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Logout</span>
            </Button>
          </div>
        </div>
      </header>
      <div className="container flex-1 items-start md:grid md:grid-cols-[220px_1fr] md:gap-6 lg:grid-cols-[240px_1fr] lg:gap-10 py-6">
        <aside className="fixed top-16 hidden h-[calc(100vh-4rem)] w-full shrink-0 overflow-y-auto border-r md:sticky md:block">
          <nav className="grid gap-2 px-2 py-4">
            {navItems.map((item, index) => (
              <Link
                key={index}
                to={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex w-full flex-col overflow-hidden">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
