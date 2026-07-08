
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, FileText, RefreshCw, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Inmate {
  id: string;
  prison_number: string;
  name: string;
  age: number;
  admission_date: string;
  offense: string;
  sentence: string;
  classification: 'A' | 'B' | 'C' | 'D' | 'PUSOD' | 'CONDEM';
  status: 'active' | 'pending' | 'discharged' | 'transferred';
  admission_status?: string;
}

const InmateOverview = () => {
  const [inmates, setInmates] = useState<Inmate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchInmates();
  }, []);

  const fetchInmates = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.getAllInmates();
      if (response.data) {
        setInmates(response.data as Inmate[]);
      }
    } catch (error) {
      console.error('Error fetching inmates:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch inmates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewInmate = (id: string) => {
    navigate(`/inmates/${id}`);
  };

  const handleApproveInmate = async (id: string) => {
    try {
      await adminApi.approveInmate(id);
      setInmates(inmates.map(inmate => 
        inmate.id === id ? { ...inmate, status: 'active' } : inmate
      ));
      toast({
        title: 'Success',
        description: 'Inmate approved successfully',
      });
    } catch (error) {
      console.error('Error approving inmate:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve inmate',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'discharged':
        return <Badge className="bg-[#0b4f2a]">Discharged</Badge>;
      case 'transferred':
        return <Badge className="bg-[#0b4f2a]">Transferred</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredInmates = inmates.filter(inmate => {
    // Filter by search query
    const matchesSearch = 
      inmate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inmate.prison_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inmate.offense.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by status
    const matchesStatus = filterStatus === 'all' || inmate.status === filterStatus;
    
    // Filter by classification
    const matchesClassification = filterClassification === 'all' || inmate.classification === filterClassification;
    
    return matchesSearch && matchesStatus && matchesClassification;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Inmate Management</CardTitle>
        <Button onClick={() => navigate('/reception/register')}>
          Register New Inmate
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search inmates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="discharged">Discharged</SelectItem>
              <SelectItem value="transferred">Transferred</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterClassification} onValueChange={setFilterClassification}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              <SelectItem value="A">Class A</SelectItem>
              <SelectItem value="B">Class B</SelectItem>
              <SelectItem value="C">Class C</SelectItem>
              <SelectItem value="D">Class D</SelectItem>
              <SelectItem value="PUSOD">PUSOD</SelectItem>
              <SelectItem value="CONDEM">CONDEM</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchInmates}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center p-4">Loading inmates...</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prison #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Admission Date</TableHead>
                  <TableHead>Offense</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInmates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      No inmates found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInmates.map((inmate) => (
                    <TableRow key={inmate.id}>
                      <TableCell 
                        className="font-medium text-[#0b4f2a] hover:underline cursor-pointer"
                        onClick={() => handleViewInmate(inmate.id)}
                      >
                        {inmate.prison_number}
                      </TableCell>
                      <TableCell>{inmate.name}</TableCell>
                      <TableCell>{new Date(inmate.admission_date).toLocaleDateString()}</TableCell>
                      <TableCell>{inmate.offense}</TableCell>
                      <TableCell>
                        <Badge className="bg-[#d7a928]">Class {inmate.classification}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(inmate.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {inmate.status === 'pending' && inmate.admission_status === 'PENDING_HEALTH_ASSESSMENT' && (
                            <Button 
                              variant="secondary" 
                              size="sm"
                              disabled
                              title="Health Assessment required before admin approval"
                              className="opacity-70"
                            >
                              Awaiting Health Check
                            </Button>
                          )}
                          {inmate.status === 'pending' && inmate.admission_status !== 'PENDING_HEALTH_ASSESSMENT' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleApproveInmate(inmate.id)}
                            >
                              Approve
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleViewInmate(inmate.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => navigate(`/inmates/${inmate.id}/record`)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => navigate(`/inmates/${inmate.id}/transfer`)}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InmateOverview;
