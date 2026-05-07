
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn, Menu, X } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const AppHeader = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="w-full border-b bg-background sticky top-0 z-30">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-primary rounded-md w-8 h-8 flex items-center justify-center text-primary-foreground font-bold">
            A
          </div>
          <span className="font-bold text-xl hidden sm:inline-block">Academia</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className={cn("text-foreground/80 hover:text-foreground transition-colors", 
            location.pathname === "/" && "text-foreground font-medium")}>
            Home
          </Link>
          <Link to="/about" className="text-foreground/80 hover:text-foreground transition-colors">
            About
          </Link>
          <Link to="/contact" className="text-foreground/80 hover:text-foreground transition-colors">
            Contact
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Register</Link>
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden" 
          onClick={toggleMobileMenu}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMobile && mobileMenuOpen && (
        <div className="fixed inset-0 top-16 bg-background z-20 animate-fade-in">
          <nav className="flex flex-col p-4">
            <Link 
              to="/" 
              className="py-3 px-4 hover:bg-accent rounded-md"
              onClick={closeMobileMenu}
            >
              Home
            </Link>
            <Link 
              to="/about" 
              className="py-3 px-4 hover:bg-accent rounded-md"
              onClick={closeMobileMenu}
            >
              About
            </Link>
            <Link 
              to="/contact" 
              className="py-3 px-4 hover:bg-accent rounded-md"
              onClick={closeMobileMenu}
            >
              Contact
            </Link>
            <hr className="my-4" />
            <div className="flex flex-col gap-2 px-4">
              <Button variant="outline" asChild onClick={closeMobileMenu}>
                <Link to="/login" className="w-full justify-center">
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Link>
              </Button>
              <Button asChild onClick={closeMobileMenu}>
                <Link to="/register" className="w-full justify-center">Register</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
