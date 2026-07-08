
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Home, LogOut, Search, Thermometer, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { healthApi, inmateApi } from '@/lib/api';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface RecentPatient {
  id: string;
  prison_number: string;
  name: string;
  date: string;
  complaint: string;
  status: 'treated' | 'pending' | 'follow-up';
}

interface HealthStats {
  total_records: number;
  daily_visits: number;
  pending_checkups: number;
  critical_cases: number;
}

const HealthDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [healthStats, setHealthStats] = useState<HealthStats>({
    total_records: 0,
    daily_visits: 0,
    pending_checkups: 0,
    critical_cases: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // In a real app, you would fetch actual data from your API
      // This is just placeholder data for demonstration
      
      const statsResponse = await healthApi.getHealthStatistics();
      if (statsResponse.data) {
        setHealthStats(statsResponse.data as HealthStats);
      }
      
      // Mock data for recent patients
      setRecentPatients([
        {
          id: '1',
          prison_number: 'PN12345',
          name: 'John Smith',
          date: '2025-05-14',
          complaint: 'Fever and headache',
          status: 'treated'
        },
        {
          id: '2',
          prison_number: 'PN23456',
          name: 'Robert Johnson',
          date: '2025-05-14',
          complaint: 'Sprained ankle',
          status: 'follow-up'
        },
        {
          id: '3',
          prison_number: 'PN34567',
          name: 'Michael Williams',
          date: '2025-05-13',
          complaint: 'Chest pain',
          status: 'pending'
        },
        {
          id: '4',
          prison_number: 'PN45678',
          name: 'David Brown',
          date: '2025-05-13',
          complaint: 'Skin rash',
          status: 'treated'
        },
      ]);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch health dashboard data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      const response = await inmateApi.searchInmates(searchQuery);
      
      if (response.data) {
        setSearchResults(response.data);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching inmates:', error);
      toast({
        title: 'Error',
        description: 'Failed to search inmates',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'treated':
        return <Badge className="bg-green-500">Treated</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'follow-up':
        return <Badge className="bg-[#0b4f2a]">Follow-Up</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <PrisonLayout
      title="Health Department Dashboard"
      description="Manage inmate health records and medical services"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Records</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthStats.total_records}</div>
            <p className="text-xs text-muted-foreground">
              Total inmate health records
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily OPD Visits</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthStats.daily_visits}</div>
            <p className="text-xs text-muted-foreground">
              Patients seen today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Check-ups</CardTitle>
            <div className="h-4 w-4 rounded-full bg-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthStats.pending_checkups}</div>
            <p className="text-xs text-muted-foreground">
              Scheduled for today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Cases</CardTitle>
            <div className="h-4 w-4 rounded-full bg-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthStats.critical_cases}</div>
            <p className="text-xs text-muted-foreground">
              Requiring special attention
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent OPD Patients</CardTitle>
            <CardDescription>
              Recent out-patient department visits
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-4">Loading patient data...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prison #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Complaint</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPatients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">
                          No recent patients
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell 
                          className="font-medium text-[#0b4f2a] hover:underline cursor-pointer"
                          onClick={() => navigate(`/inmates/${patient.id}`)}
                        >
                          {patient.prison_number}
                        </TableCell>
                          <TableCell>{patient.name}</TableCell>
                          <TableCell>{patient.complaint}</TableCell>
                          <TableCell>{getStatusBadge(patient.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate('/health/opd')}
            >
              View All OPD Records
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inmate Search</CardTitle>
            <CardDescription>
              Search for inmates to view or create health records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <Input
                placeholder="Search by name or prison number"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                <Search className="h-4 w-4 mr-2" />
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>
            
            {searchResults.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prison #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((inmate) => (
                      <TableRow key={inmate.id}>
                        <TableCell 
                          className="font-medium text-[#0b4f2a] hover:underline cursor-pointer"
                          onClick={() => navigate(`/inmates/${inmate.id}`)}
                        >
                          {inmate.prison_number}
                        </TableCell>
                        <TableCell>{inmate.name}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/health/inmate/${inmate.id}`)}
                          >
                            Health Record
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {searchQuery && !isSearching && searchResults.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No inmates found matching your search.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PrisonLayout>
  );
};

export default HealthDashboard;
