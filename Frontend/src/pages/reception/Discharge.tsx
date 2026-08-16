import React, { useState, useEffect, useMemo } from 'react';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { receptionApi } from '@/lib/api';
import { format, isSameDay } from 'date-fns';
import { Download, Calendar as CalendarIcon, UserMinus, FileUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Calendar } from '@/components/ui/calendar';
import ProposeDischargeModal from './components/ProposeDischargeModal';

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
  const [selectedSession, setSelectedSession] = useState<DischargeSession | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
          <Card className="flex-1 shadow-sm border-t-4 border-t-red-600">
            <CardHeader className="bg-gradient-to-r from-red-50 to-white pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2 text-red-900">
                <CalendarIcon className="w-5 h-5 text-red-600" />
                Discharge Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-6 pb-6 bg-white">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border shadow-sm p-4 bg-white"
                modifiers={{ booked: bookedDates }}
                modifiersClassNames={{
                  booked: "bg-red-100 text-red-900 font-bold border-2 border-red-300 rounded-full"
                }}
              />
              <div className="w-full mt-6 space-y-3 px-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-600">
                    <div className="w-3 h-3 rounded-full bg-red-100 border-2 border-red-300"></div>
                    Scheduled Discharges
                  </span>
                  <span className="font-semibold text-gray-900">{bookedDates.length} Days</span>
                </div>
              </div>
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
                <div className="text-center py-16 bg-gray-50/50 rounded-lg border border-dashed flex flex-col items-center">
                  <div className="bg-white p-4 rounded-full shadow-sm border mb-4">
                    <UserMinus className="h-8 w-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">No Discharges Scheduled</h3>
                  <p className="text-muted-foreground mt-1 max-w-sm">
                    There are no inmates scheduled for release on {selectedDate ? format(selectedDate, 'MMMM do, yyyy') : 'this date'}.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50/80">
                      <TableRow>
                        <TableHead>Prison No.</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Offences</TableHead>
                        <TableHead>Approval Status</TableHead>
                        <TableHead>EDR</TableHead>
                        <TableHead>ODR</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
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
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[#0b4f2a] border-[#0b4f2a] hover:bg-[#0b4f2a] hover:text-white"
                              onClick={() => {
                                setSelectedSession(session);
                                setIsModalOpen(true);
                              }}
                            >
                              <FileUp className="w-4 h-4 mr-1" />
                              Propose
                            </Button>
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

      <ProposeDischargeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchSessions}
        session={selectedSession}
      />
    </PrisonLayout>
  );
};

export default Discharge;
