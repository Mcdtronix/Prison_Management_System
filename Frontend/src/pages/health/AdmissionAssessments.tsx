import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { receptionApi } from '@/lib/api';
import { PrisonLayout } from '@/components/PrisonLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Stethoscope, FileText, RefreshCw, Home, Users, ThermometerIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Inmate {
  id: string;
  prison_number: string;
  name: string;
  age: number;
  admission_date: string;
  offense: string;
  status: string;
}

const AdmissionAssessments = () => {
  const [inmates, setInmates] = useState<Inmate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingAssessments();
  }, []);

  const fetchPendingAssessments = async () => {
    setIsLoading(true);
    try {
      const response = await receptionApi.getInmateList('', { admission_status: 'PENDING_HEALTH_ASSESSMENT' });
      if (response.data) {
        setInmates(response.data as Inmate[]);
      }
    } catch (error) {
      console.error('Error fetching pending assessments:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch pending assessments',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePerformAssessment = (id: string) => {
    navigate(`/health/inmate/${id}`);
  };

  const filteredInmates = inmates.filter(inmate => {
    const query = searchQuery.toLowerCase();
    return (
      inmate.name.toLowerCase().includes(query) ||
      inmate.prison_number.toLowerCase().includes(query) ||
      inmate.offense.toLowerCase().includes(query)
    );
  });

  return (
    <PrisonLayout
      title="Admission Assessments"
      description="Inmates awaiting initial health assessment from reception before admin approval"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-xl">Pending Assessments</CardTitle>
            <CardDescription>
              List of newly admitted inmates that require a mandatory health assessment.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Input
              placeholder="Search by name, prison #, or offense..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            <Button variant="outline" size="icon" onClick={fetchPendingAssessments} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center p-8 text-gray-500">Loading pending assessments...</div>
          ) : (
            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prison #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Admission Date</TableHead>
                    <TableHead>Offense Summary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInmates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                        {searchQuery ? "No matching inmates found" : "No pending admission assessments"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInmates.map((inmate) => (
                      <TableRow key={inmate.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{inmate.prison_number}</TableCell>
                        <TableCell>{inmate.name}</TableCell>
                        <TableCell>{inmate.age}</TableCell>
                        <TableCell>{new Date(inmate.admission_date).toLocaleDateString()}</TableCell>
                        <TableCell className="max-w-xs truncate" title={inmate.offense}>
                          {inmate.offense || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="default" 
                            size="sm"
                            className="bg-[#0b4f2a] hover:bg-[#0b4f2a]/90 text-[#d7a928]"
                            onClick={() => handlePerformAssessment(inmate.id)}
                          >
                            <Stethoscope className="mr-2 h-4 w-4" />
                            Assess
                          </Button>
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
    </PrisonLayout>
  );
};

export default AdmissionAssessments;
