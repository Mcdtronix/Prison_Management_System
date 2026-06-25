import { useState, useEffect } from 'react';
import { healthApi } from '@/lib/api';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { format } from 'date-fns';

export default function OPDRegister() {
  const [visits, setVisits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchVisits = async () => {
      setIsLoading(true);
      try {
        const response = await healthApi.getAllOPDVisits();
        if (response.data && response.data.results) {
          setVisits(response.data.results);
        } else if (Array.isArray(response.data)) {
          setVisits(response.data);
        }
      } catch (error) {
        console.error('Error fetching OPD visits:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch OPD Register.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisits();
  }, [toast]);

  return (
    <PrisonLayout title="Out-Patient Department (OPD) Register" description="Global registry of all station OPD visits">
      <Card>
        <CardHeader>
          <CardTitle>OPD Visit History</CardTitle>
          <CardDescription>Comprehensive log of all medical consultations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Complaint</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Follow Up</TableHead>
                  <TableHead>Attending Officer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">Loading OPD records...</TableCell>
                  </TableRow>
                ) : visits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No OPD visits recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  visits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell className="font-medium">
                        {visit.visit_date ? format(new Date(visit.visit_date), 'MMM d, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{visit.patient_name || 'Unknown Patient'}</span>
                          <span className="text-xs text-muted-foreground">{visit.patient_identifier}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={visit.problem}>
                        {visit.problem}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={visit.diagnosis}>
                        {visit.diagnosis}
                      </TableCell>
                      <TableCell>
                        {visit.follow_up_required ? (
                          <Badge variant="destructive">Required</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {visit.attended_by}
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
