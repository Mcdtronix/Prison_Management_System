
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Book, 
  CalendarDays, 
  FileText,
  Library,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { teacherApi } from "@/lib/api";

const TeacherDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [courseCount, setCourseCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const coursesResponse = await teacherApi.getCourses();
        if (!coursesResponse.error && coursesResponse.data) {
          setCourseCount(coursesResponse.data.length || 0);
        }
        
        const studentsResponse = await teacherApi.getStudents();
        if (!studentsResponse.error && studentsResponse.data) {
          setStudentCount(studentsResponse.data.length || 0);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Simulate API fetch
    setTimeout(() => {
      setCourseCount(3);
      setStudentCount(78);
      setIsLoading(false);
    }, 1000);
    
    // Uncomment to use real API
    // fetchDashboardData();
  }, []);

  const dashboardCards = [
    {
      title: "My Courses",
      value: isLoading ? "..." : courseCount,
      icon: <Book className="h-6 w-6" />,
      color: "bg-[#d7a928]/20 text-blue-700",
      link: "/teacher/courses",
    },
    {
      title: "My Students",
      value: isLoading ? "..." : studentCount,
      icon: <Users className="h-6 w-6" />,
      color: "bg-green-100 text-green-700",
      link: "/teacher/students",
    },
    {
      title: "Attendance",
      value: "Manage",
      icon: <CalendarDays className="h-6 w-6" />,
      color: "bg-[#d7a928]/20 text-purple-700",
      link: "/teacher/attendance",
    },
    {
      title: "Results",
      value: "Update",
      icon: <FileText className="h-6 w-6" />,
      color: "bg-amber-100 text-amber-700",
      link: "/teacher/results",
    },
    {
      title: "Library",
      value: "Browse",
      icon: <Library className="h-6 w-6" />,
      color: "bg-sky-100 text-sky-700",
      link: "/teacher/library",
    },
  ];

  return (
    <DashboardLayout userType="teacher">
      <h1 className="page-title">Teacher Dashboard</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardCards.map((card, index) => (
          <Card key={index} className="dashboard-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                {card.title}
                <div className={`p-2 rounded-full ${card.color}`}>
                  {card.icon}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">{card.value}</div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to={card.link}>View Details</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="p-2 bg-accent rounded-md flex justify-between">
                <div>
                  <div className="font-medium">Advanced Mathematics</div>
                  <div className="text-sm text-muted-foreground">Room: 101</div>
                </div>
                <span className="text-sm bg-[#d7a928]/20 text-blue-700 px-2 py-1 rounded">Today, 10:00 AM</span>
              </li>
              <li className="p-2 bg-accent rounded-md flex justify-between">
                <div>
                  <div className="font-medium">Computer Science</div>
                  <div className="text-sm text-muted-foreground">Room: 203</div>
                </div>
                <span className="text-sm bg-[#d7a928]/20 text-blue-700 px-2 py-1 rounded">Today, 2:00 PM</span>
              </li>
              <li className="p-2 bg-accent rounded-md flex justify-between">
                <div>
                  <div className="font-medium">Faculty Meeting</div>
                  <div className="text-sm text-muted-foreground">Room: Conference Hall</div>
                </div>
                <span className="text-sm bg-[#d7a928]/20 text-purple-700 px-2 py-1 rounded">Tomorrow, 9:00 AM</span>
              </li>
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="p-2 bg-accent rounded-md">
                <div className="font-medium">Grade Mid-term Papers</div>
                <div className="text-sm text-muted-foreground">Due in 2 days</div>
              </li>
              <li className="p-2 bg-accent rounded-md">
                <div className="font-medium">Submit Course Outline</div>
                <div className="text-sm text-muted-foreground">Due tomorrow</div>
              </li>
              <li className="p-2 bg-accent rounded-md">
                <div className="font-medium">Update Attendance Records</div>
                <div className="text-sm text-muted-foreground">Overdue by 1 day</div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
