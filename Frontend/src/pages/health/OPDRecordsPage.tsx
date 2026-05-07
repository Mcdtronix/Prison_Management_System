
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardShell } from '@/components/DashboardShell';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Home, LogOut, Plus, ThermometerIcon, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { healthApi, inmateApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from './components/LoadingState';
import { NotFoundState } from './components/NotFoundState';

const OPDRecordsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inmate, setInmate] = useState<any>(null);
  const [opdRecords, setOpdRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Define navigation items
  const navItems = [
    { icon: <Home size={20} />, label: 'Dashboard', href: '/health' },
    { icon: <Users size={20} />, label: 'Inmates', href: '/health/inmates' },
    { icon: <FileText size={20} />, label: 'OPD Records', href: '/health/opd' },
    { icon: <ThermometerIcon size={20} />, label: 'Check-ups', href: '/health/checkups' },
  ];
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      setIsLoading(true);
      try {
        // Fetch inmate basic info
        const inmateResponse = await inmateApi.getInmateDetails(id);
        if (inmateResponse.data) {
          setInmate(inmateResponse.data);
        }
        
        // Fetch OPD records
        const opdResponse = await healthApi.getOPDRecords(id);
        if (opdResponse.data) {
          setOpdRecords(opdResponse.data);
        }
      } catch (error) {
        console.error('Error fetching OPD records:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch OPD records',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [id, toast]);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'treated':
        return <Badge className="bg-green-500">Treated</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'follow-up':
        return <Badge className="bg-blue-500">Follow-Up</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  const handleNewOPDVisit = () => {
    navigate(`/health/inmate/${id}/opd/new`);
  };
  
  if (isLoading) {
    return (
      <DashboardShell
        title="OPD Records"
        description="Loading..."
        user={{ name: 'Health Officer', role: 'Health Department' }}
        onLogout={handleLogout}
        navItems={navItems}
      >
        <LoadingState />
      </DashboardShell>
    );
  }
  
  if (!inmate) {
    return (
      <DashboardShell
        title="OPD Records"
        description="Inmate not found"
        user={{ name: 'Health Officer', role: 'Health Department' }}
        onLogout={handleLogout}
        navItems={navItems}
      >
        <NotFoundState />
      </DashboardShell>
    );
  }
  
  return (
    <DashboardShell
      title={`OPD Records: ${inmate.name}`}
      description={`Prison Number: ${inmate.prison_number}`}
      user={{ name: 'Health Officer', role: 'Health Department' }}
      onLogout={handleLogout}
      navItems={navItems}
    >
      <div className="flex justify-between items-center mb-4">
        <Button onClick={() => navigate(`/health/inmate/${id}`)}>
          Back to Health Record
        </Button>
        <Button onClick={handleNewOPDVisit}>
          <Plus className="mr-2 h-4 w-4" /> New OPD Visit
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>OPD Visit History</CardTitle>
        </CardHeader>
        <CardContent>
          {opdRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Complaint</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opdRecords.map((record, index) => (
                  <TableRow key={index}>
                    <TableCell>{new Date(record.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{record.complaint}</TableCell>
                    <TableCell>{record.diagnosis}</TableCell>
                    <TableCell>{record.treatment}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No OPD records found for this inmate.</p>
              <Button onClick={handleNewOPDVisit} className="mt-4">
                Create First OPD Record
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
};

export default OPDRecordsPage;
