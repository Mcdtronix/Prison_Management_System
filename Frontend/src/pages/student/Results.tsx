
import { DashboardLayout } from "@/components/DashboardLayout";
import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, Download, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { studentApi } from "@/lib/api";

interface Course {
  id: string;
  code: string;
  title: string;
  credits: number;
  grade?: string;
  marks?: number;
  status: "completed" | "ongoing" | "upcoming";
}

interface Semester {
  id: string;
  name: string;
  year: string;
  gpa: number;
  courses: Course[];
}

const Results = () => {
  const [loading, setLoading] = useState(true);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>("");

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await studentApi.getResults();
        
        if (response.error) {
          toast({
            title: "Error",
            description: response.error,
            variant: "destructive",
          });
          return;
        }
        
        if (response.data) {
          setSemesters(response.data);
          if (response.data.length > 0) {
            setSelectedSemester(response.data[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch results:", error);
        toast({
          title: "Error",
          description: "Failed to fetch results. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    // Mock data for demonstration
    setTimeout(() => {
      const mockSemesters: Semester[] = [
        {
          id: "fall2024",
          name: "Fall Semester",
          year: "2024",
          gpa: 3.75,
          courses: [
            {
              id: "cs101",
              code: "CS101",
              title: "Introduction to Computer Science",
              credits: 3,
              grade: "A",
              marks: 92,
              status: "completed"
            },
            {
              id: "math201",
              code: "MATH201",
              title: "Calculus II",
              credits: 4,
              grade: "A-",
              marks: 88,
              status: "completed"
            },
            {
              id: "eng105",
              code: "ENG105",
              title: "Academic Writing",
              credits: 3,
              grade: "B+",
              marks: 85,
              status: "completed"
            }
          ]
        },
        {
          id: "spring2024",
          name: "Spring Semester",
          year: "2024",
          gpa: 3.5,
          courses: [
            {
              id: "cs201",
              code: "CS201",
              title: "Data Structures",
              credits: 3,
              grade: "B+",
              marks: 87,
              status: "completed"
            },
            {
              id: "phys101",
              code: "PHYS101",
              title: "Physics I",
              credits: 4,
              grade: "A-",
              marks: 89,
              status: "completed"
            },
            {
              id: "hist105",
              code: "HIST105",
              title: "World History",
              credits: 3,
              grade: "B",
              marks: 83,
              status: "completed"
            }
          ]
        },
        {
          id: "current",
          name: "Current Semester",
          year: "2025",
          gpa: 0,
          courses: [
            {
              id: "cs301",
              code: "CS301",
              title: "Database Systems",
              credits: 3,
              status: "ongoing"
            },
            {
              id: "cs305",
              code: "CS305",
              title: "Software Engineering",
              credits: 4,
              status: "ongoing"
            },
            {
              id: "math301",
              code: "MATH301",
              title: "Discrete Mathematics",
              credits: 3,
              status: "ongoing"
            }
          ]
        }
      ];
      
      setSemesters(mockSemesters);
      setSelectedSemester(mockSemesters[0].id);
      setLoading(false);
    }, 1000);
    
    // Uncomment to use real API
    // fetchResults();
  }, []);

  const handleDownloadResults = () => {
    // In a real app, this would download a PDF
    toast({
      title: "Download Started",
      description: "Your results are being downloaded...",
    });
  };

  const currentSemester = semesters.find(sem => sem.id === selectedSemester);
  
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
      case 'A-':
        return 'text-green-600';
      case 'B+':
      case 'B':
      case 'B-':
        return 'text-[#0b4f2a]';
      case 'C+':
      case 'C':
        return 'text-amber-600';
      case 'C-':
      case 'D':
        return 'text-orange-600';
      case 'F':
        return 'text-red-600';
      default:
        return '';
    }
  };

  return (
    <DashboardLayout userType="student">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title mb-0">Academic Results</h1>
        <Button variant="outline" onClick={handleDownloadResults}>
          <Download className="mr-2 h-4 w-4" /> Download Results
        </Button>
      </div>
      
      {loading ? (
        <div className="text-center py-12">Loading results...</div>
      ) : semesters.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-medium">No Results Available</p>
            <p className="text-muted-foreground">Your academic results will appear here when available.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Semester Results</CardTitle>
                  <CardDescription>View your academic performance by semester</CardDescription>
                </div>
                <div className="w-full sm:w-[180px]">
                  <Select
                    value={selectedSemester}
                    onValueChange={setSelectedSemester}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {semesters.map((semester) => (
                        <SelectItem key={semester.id} value={semester.id}>
                          {semester.name} {semester.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            {currentSemester && (
              <>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Course Code</th>
                          <th className="text-left py-3 px-2">Course Title</th>
                          <th className="text-left py-3 px-2">Credits</th>
                          <th className="text-left py-3 px-2">Status</th>
                          <th className="text-left py-3 px-2">Marks</th>
                          <th className="text-left py-3 px-2">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentSemester.courses.map((course) => (
                          <tr key={course.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 px-2 font-medium">{course.code}</td>
                            <td className="py-3 px-2">{course.title}</td>
                            <td className="py-3 px-2">{course.credits}</td>
                            <td className="py-3 px-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                course.status === 'completed' 
                                  ? 'bg-green-100 text-green-700' 
                                  : course.status === 'ongoing'
                                  ? 'bg-[#d7a928]/20 text-blue-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              {course.marks !== undefined ? course.marks : '-'}
                            </td>
                            <td className={`py-3 px-2 font-medium ${course.grade ? getGradeColor(course.grade) : ''}`}>
                              {course.grade || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                {currentSemester.status !== "ongoing" && (
                  <CardFooter className="border-t bg-muted/30 flex justify-end">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Semester GPA</div>
                      <div className="text-2xl font-bold">{currentSemester.gpa.toFixed(2)}</div>
                    </div>
                  </CardFooter>
                )}
              </>
            )}
          </Card>
          
          {/* Cumulative Result Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Cumulative Result Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <div className="text-sm text-muted-foreground">Cumulative GPA</div>
                <div className="text-3xl font-bold">3.65</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <div className="text-sm text-muted-foreground">Total Credits Earned</div>
                <div className="text-3xl font-bold">35</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <div className="text-sm text-muted-foreground">Courses Completed</div>
                <div className="text-3xl font-bold">12</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Results;
