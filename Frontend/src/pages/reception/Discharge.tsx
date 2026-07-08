import React, { useState, useEffect, useMemo } from 'react';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { receptionApi } from '@/lib/api';
import { format, isSameDay } from 'date-fns';
import { Download, Calendar as CalendarIcon, UserMinus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Calendar } from '@/components/ui/calendar';

interface DischargeSession {
  id: number;
  inmate_name: string;
  prison_number: string;
  offence_description: string;
  approval_status: string;
  active_edr: string;
  active_odr: string;
}

const Discharge = () => {
  const [sessions, setSessions] = useState<DischargeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await receptionApi.getUpcomingDischarges();
      if (response.error) {
        throw new Error(response.error);
      }
      setSessions(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      toast({
        title: "Error",
        description: "Failed to load upcoming discharges.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Extract all unique dates that have discharges scheduled (using active_edr)
  const bookedDates = useMemo(() => {
    const dates: Date[] = [];
    sessions.forEach(session => {
      if (session.active_edr) {
        const dateObj = new Date(session.active_edr + 'T12:00:00'); 
        dates.push(dateObj);
      }
    });
    return dates;
  }, [sessions]);

  // Filter sessions by the selected date
  const filteredSessions = useMemo(() => {
    if (!selectedDate) return [];
    return sessions.filter(session => {
      if (!session.active_edr) return false;
      const sessionDate = new Date(session.active_edr + 'T12:00:00');
      return isSameDay(sessionDate, selectedDate);
    });
  }, [sessions, selectedDate]);

  return (
    <PrisonLayout
      title="Discharge Management"
      description="View upcoming inmate discharges and track Earliest Dates of Release (EDR)."
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Calendar Section */}
        <div className="md:col-span-4 flex flex-col gap-4">
          <Card className="flex-1 shadow-sm border-t-4 border-t-[#0b4f2a]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-[#0b4f2a]">
                <CalendarIcon className="w-5 h-5" />
                Calendar View
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                captionLayout="dropdown-buttons"
                fromYear={2000}
                toYear={2050}
                className="rounded-md border shadow-sm p-4 bg-white"
                modifiers={{ booked: bookedDates }}
                modifiersClassNames={{
                  booked: "bg-red-100 text-red-900 font-bold border-2 border-red-300"
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* List Section */}
        <div className="md:col-span-8 flex flex-col gap-4">
          <Card className="flex-1 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50/80 border-b">
              <CardTitle className="text-lg">
                Discharges on {selectedDate ? format(selectedDate, 'PPP') : 'Select a date'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b4f2a]"></div>
                </div>
              ) : error ? (
                <p className="text-red-500 bg-red-50 p-4 rounded-md">{error}</p>
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                  <UserMinus className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <h3 className="text-lg font-medium text-gray-900">No Discharges Scheduled</h3>
                  <p className="text-muted-foreground mt-1">There are no inmates scheduled for discharge on this date.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-100">
                      <TableRow>
                        <TableHead>Prison No.</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Offences</TableHead>
                        <TableHead>Approval Status</TableHead>
                        <TableHead>EDR</TableHead>
                        <TableHead>ODR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map((session) => (
                        <TableRow key={session.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="font-semibold">{session.prison_number}</TableCell>
                          <TableCell>{session.inmate_name}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={session.offence_description}>
                            {session.offence_description}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${session.approval_status === 'APPROVED' ? 'bg-green-100 text-green-800' : session.approval_status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {session.approval_status}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-green-700">
                            {session.active_edr ? format(new Date(session.active_edr + 'T12:00:00'), 'PP') : 'N/A'}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {session.active_odr ? format(new Date(session.active_odr + 'T12:00:00'), 'PP') : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PrisonLayout>
  );
};

export default Discharge;
