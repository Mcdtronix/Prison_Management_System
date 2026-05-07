
import { Link } from "react-router-dom";

export const AppFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-accent py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4">Academia</h3>
            <p className="text-sm text-foreground/70">
              Modern school management system designed to transform educational administration.
            </p>
          </div>
          
          <div>
            <h3 className="font-bold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
              <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">Contact Us</Link></li>
              <li><Link to="/login" className="hover:text-primary transition-colors">Login</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold text-lg mb-4">Portal Access</h3>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li><Link to="/student" className="hover:text-primary transition-colors">Student Portal</Link></li>
              <li><Link to="/teacher" className="hover:text-primary transition-colors">Teacher Portal</Link></li>
              <li><Link to="/admin" className="hover:text-primary transition-colors">Admin Portal</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold text-lg mb-4">Contact</h3>
            <address className="not-italic text-sm text-foreground/70 space-y-2">
              <p>123 Education Street</p>
              <p>Academic City, AC 12345</p>
              <p>Phone: (123) 456-7890</p>
              <p>Email: info@academia.edu</p>
            </address>
          </div>
        </div>
        
        <div className="border-t border-border/30 mt-8 pt-6 text-center text-sm text-foreground/70">
          <p>&copy; {currentYear} Academia. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
