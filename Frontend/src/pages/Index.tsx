
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";
import { 
  BookOpen, 
  GraduationCap, 
  Library, 
  School, 
  Users
} from "lucide-react";

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/10 to-background py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Welcome to Academia</h1>
            <p className="text-xl md:text-2xl text-foreground/70 mb-8 max-w-3xl mx-auto">
              A comprehensive school management system for students, teachers, and administrators
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" asChild>
                <Link to="/register">Get Started</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/login">Login</Link>
              </Button>
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="dashboard-card flex flex-col items-center text-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <GraduationCap size={32} className="text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Student Portal</h3>
                <p className="text-foreground/70">
                  Access courses, check results, view timetables, and manage fee payments all in one place.
                </p>
              </div>
              
              <div className="dashboard-card flex flex-col items-center text-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <School size={32} className="text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Teacher Portal</h3>
                <p className="text-foreground/70">
                  Manage courses, record attendance, submit grades, and communicate with students easily.
                </p>
              </div>
              
              <div className="dashboard-card flex flex-col items-center text-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Users size={32} className="text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Admin Portal</h3>
                <p className="text-foreground/70">
                  Complete school management with student records, fee tracking, and administrative tools.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* More Features */}
        <section className="py-16 bg-accent/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">More Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex gap-4 items-start">
                <div className="bg-primary/10 p-3 rounded-full shrink-0">
                  <Library size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Digital Library</h3>
                  <p className="text-foreground/70">
                    Access a vast collection of digital books, journals, and research papers to enhance your learning experience.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="bg-primary/10 p-3 rounded-full shrink-0">
                  <BookOpen size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Result Management</h3>
                  <p className="text-foreground/70">
                    View and download semester results, track academic progress, and identify areas for improvement.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="bg-primary/10 p-3 rounded-full shrink-0">
                  <School size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Course Management</h3>
                  <p className="text-foreground/70">
                    Register for courses, access course materials, submit assignments, and interact with instructors.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="bg-primary/10 p-3 rounded-full shrink-0">
                  <Users size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Fee Management</h3>
                  <p className="text-foreground/70">
                    View fee structure, pay fees online, and download receipts for all transactions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-16 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Join thousands of students and educators already using our platform to enhance their educational experience.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/register">Create an Account</Link>
              </Button>
              <Button variant="outline" size="lg" className="border-primary-foreground hover:bg-primary-foreground hover:text-primary" asChild>
                <Link to="/login">Login</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      
      <AppFooter />
    </div>
  );
};

export default Index;
