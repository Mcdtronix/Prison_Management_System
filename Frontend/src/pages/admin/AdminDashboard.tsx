
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, UserPlus, UserMinus, Home, LogOut, 
  Search, Plus, FileText, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { PrisonLayout } from '@/components/PrisonLayout';
import OfficerManagement from './OfficerManagement';
import InmateOverview from './InmateOverview';
import { useToast } from '@/hooks/use-toast';

const AdminDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalInmates: 0,
    totalOfficers: 0,
    pendingAdmissions: 0,
    recentDischarges: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // In a real app, you would fetch actual data from your API
        // This is just a placeholder for demonstration
        const response = await adminApi.getAllInmates();
        
        if (response.data) {
          // Simulate some stats based on the response
          setStats({
            totalInmates: response.data.length || 0,
            totalOfficers: 25, // Placeholder
            pendingAdmissions: 3, // Placeholder
            recentDischarges: 2 // Placeholder
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch dashboard data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [toast]);


  return (
    <PrisonLayout
      title="Admin Dashboard"
      description="Manage prison operations, officers, and inmates"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inmates</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : stats.totalInmates}</div>
            <p className="text-xs text-muted-foreground">
              Currently housed inmates
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prison Officers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : stats.totalOfficers}</div>
            <p className="text-xs text-muted-foreground">
              Active staff members
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Admissions</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : stats.pendingAdmissions}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Discharges</CardTitle>
            <UserMinus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : stats.recentDischarges}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-x-2">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Admission
            </Button>
            <Button variant="outline" size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              New Officer
            </Button>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8"
            />
          </div>
        </div>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="inmates">Inmate Management</TabsTrigger>
            <TabsTrigger value="officers">Officer Management</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  The latest actions in the prison management system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p>Loading recent activities...</p>
                ) : (
                  <ul className="space-y-2">
                    <li className="flex items-center justify-between border-b pb-2">
                      <span>New inmate admitted: John Doe (ID: 43521)</span>
                      <span className="text-xs text-muted-foreground">2 hours ago</span>
                    </li>
                    <li className="flex items-center justify-between border-b pb-2">
                      <span>Inmate transferred: Richard Smith (ID: 32155)</span>
                      <span className="text-xs text-muted-foreground">5 hours ago</span>
                    </li>
                    <li className="flex items-center justify-between border-b pb-2">
                      <span>New officer registered: Officer Williams</span>
                      <span className="text-xs text-muted-foreground">Yesterday</span>
                    </li>
                    <li className="flex items-center justify-between border-b pb-2">
                      <span>Inmate discharged: Michael Brown (ID: 29876)</span>
                      <span className="text-xs text-muted-foreground">Yesterday</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Health check scheduled for Block C</span>
                      <span className="text-xs text-muted-foreground">2 days ago</span>
                    </li>
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="inmates">
            <InmateOverview />
          </TabsContent>
          <TabsContent value="officers">
            <OfficerManagement />
          </TabsContent>
        </Tabs>
      </div>
    </PrisonLayout>
  );
};

export default AdminDashboard;
