import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { inmateApi } from '@/lib/api';
import { PrisonLayout } from '@/components/PrisonLayout';
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
import { FileText, Search, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function InmateHealthList() {
  const [inmates, setInmates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchInmates = async () => {
      setIsLoading(true);
      try {
        const response = await inmateApi.searchInmates(searchQuery);
        if (response.data && response.data.results) {
          setInmates(response.data.results);
        } else if (Array.isArray(response.data)) {
          setInmates(response.data);
        }
      } catch (error) {
        console.error('Error fetching inmates:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch inmate list.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchInmates();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, toast]);

  return (
    <PrisonLayout title="Inmate Health Register" description="Global registry of inmate medical records">
      <Card>
        <CardHeader>
          <CardTitle>Inmate Health Directory</CardTitle>
          <CardDescription>Select an inmate to view or update their health assessments and OPD records.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-6">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or prison number..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prison Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Admission Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
                  </TableRow>
                ) : inmates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No inmates found.
                    </TableCell>
                  </TableRow>
                ) : (
                  inmates.map((inmate) => (
                    <TableRow key={inmate.id}>
                      <TableCell className="font-medium">{inmate.prison_number}</TableCell>
                      <TableCell>
                        {inmate.first_name} {inmate.surname}
                      </TableCell>
                      <TableCell>
                        {new Date(inmate.admission_date || inmate.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                          {inmate.admission_status?.replace(/_/g, ' ') || 'ACTIVE'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#9b87f5]"
                          onClick={() => navigate(`/health/inmate/${inmate.id}`)}
                        >
                          <Activity className="h-4 w-4 mr-2" />
                          Health Record
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PrisonLayout>
  );
}
