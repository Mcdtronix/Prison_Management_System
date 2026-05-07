
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Book, 
  Calendar, 
  FileText, 
  GraduationCap, 
  Library, 
  User 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { studentApi } from "@/lib/api";

const StudentDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [courseCount, setCourseCount] = useState(0);
  const [feeStatus, setFeeStatus] = useState("Pending");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const coursesResponse = await studentApi.getCourses();
        if (!coursesResponse.error && coursesResponse.data) {
          setCourseCount(coursesResponse.data.length || 0);
        }
        
        const feesResponse = await studentApi.getFeeStatus();
        if (!feesResponse.error && feesResponse.data) {
          setFeeStatus(feesResponse.data.status || "Pending");
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Simulate API fetch
    setTimeout(() => {
      setCourseCount(5);
      setFeeStatus("Paid");
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
      color: "bg-blue-100 text-blue-700",
      link: "/student/courses",
    },
    {
      title: "Timetable",
      value: "View",
      icon: <Calendar className="h-6 w-6" />,
      color: "bg-purple-100 text-purple-700",
      link: "/student/timetable",
    },
    {
      title: "Results",
      value: "Check",
      icon: <FileText className="h-6 w-6" />,
      color: "bg-green-100 text-green-700",
      link: "/student/results",
    },
    {
      title: "Library",
      value: "Browse",
      icon: <Library className="h-6 w-6" />,
      color: "bg-amber-100 text-amber-700",
      link: "/student/library",
    },
    {
      title: "Fee Status",
      value: isLoading ? "..." : feeStatus,
      icon: <GraduationCap className="h-6 w-6" />,
      color: "bg-red-100 text-red-700",
      link: "/student/fees",
    },
    {
      title: "My Profile",
      value: "View",
      icon: <User className="h-6 w-6" />,
      color: "bg-sky-100 text-sky-700",
      link: "/student/profile",
    },
  ];

  return (
    <DashboardLayout userType="student">
      <h1 className="page-title">Student Dashboard</h1>
      
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
            <CardTitle>Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="p-2 bg-accent rounded-md flex justify-between">
                <span>Mathematics Assignment</span>
                <span className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded">Due: Tomorrow</span>
              </li>
              <li className="p-2 bg-accent rounded-md flex justify-between">
                <span>Computer Science Project</span>
                <span className="text-sm bg-amber-100 text-amber-700 px-2 py-1 rounded">Due: 3 days</span>
              </li>
              <li className="p-2 bg-accent rounded-md flex justify-between">
                <span>History Essay</span>
                <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded">Due: 1 week</span>
              </li>
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="p-2 bg-accent rounded-md">
                <div className="font-medium">Mid-term Examination Schedule</div>
                <div className="text-sm text-muted-foreground">Posted 2 days ago</div>
              </li>
              <li className="p-2 bg-accent rounded-md">
                <div className="font-medium">Library Hours Extended</div>
                <div className="text-sm text-muted-foreground">Posted 4 days ago</div>
              </li>
              <li className="p-2 bg-accent rounded-md">
                <div className="font-medium">Campus Sports Day</div>
                <div className="text-sm text-muted-foreground">Posted 1 week ago</div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
