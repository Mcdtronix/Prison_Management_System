import React, { useState, useEffect, useMemo } from 'react';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { receptionApi } from '@/lib/api';
import { format, isSameDay, parseISO } from 'date-fns';
import { Plus, Download, Calendar as CalendarIcon } from 'lucide-react';
import ScheduleCourtSessionModal from './components/ScheduleCourtSessionModal';
import { useToast } from '@/components/ui/use-toast';
import { Calendar } from '@/components/ui/calendar';

interface CourtSession {
  id: number;
  inmate_name: string;
  prison_number: string;
  offence_description: string;
  offence_status: string;
  restitution_status: string;
  next_court_date: string;
  warrant_document: string | null;
  remarks: string | null;
}

const Courts = () => {
  const [sessions, setSessions] = useState<CourtSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await receptionApi.getUpcomingCourtSessions();
      if (response.error) {
        throw new Error(response.error);
      }
      setSessions(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      toast({
        title: "Error",
        description: "Failed to load upcoming court sessions.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSessionScheduled = () => {
    fetchSessions();
  };

  // Extract all unique dates that have court sessions
  const bookedDates = useMemo(() => {
    const dates: Date[] = [];
    sessions.forEach(session => {
      if (session.next_court_date) {
        // Parse date carefully to avoid timezone shift
        const dateObj = new Date(session.next_court_date + 'T12:00:00'); 
        dates.push(dateObj);
      }
    });
    return dates;
  }, [sessions]);

  // Filter sessions by the selected date
  const filteredSessions = useMemo(() => {
    if (!selectedDate) return [];
    return sessions.filter(session => {
      if (!session.next_court_date) return false;
      const sessionDate = new Date(session.next_court_date + 'T12:00:00');
      return isSameDay(sessionDate, selectedDate);
    });
  }, [sessions, selectedDate]);

  return (
    <PrisonLayout
      title="Courts Management"
      description="View upcoming court sessions and schedule new ones."
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
                className="rounded-md border shadow-sm p-4 bg-white"
                modifiers={{ booked: bookedDates }}
                modifiersClassNames={{
                  booked: "bg-amber-100 text-amber-900 font-bold border-2 border-amber-300"
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
                Sessions on {selectedDate ? format(selectedDate, 'PPP') : 'Select a date'}
              </CardTitle>
              <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#d7a928] hover:bg-[#c59820] text-black">
                <Plus className="w-4 h-4" /> Schedule Session
              </Button>
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
                  <CalendarIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <h3 className="text-lg font-medium text-gray-900">No Court Sessions</h3>
                  <p className="text-muted-foreground mt-1">There are no inmates scheduled for court on this date.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4 border-[#d7a928] text-[#0b4f2a]"
                    onClick={() => setIsModalOpen(true)}
                  >
                    Schedule a session now
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-100">
                      <TableRow>
                        <TableHead>Prison No.</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Offence</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Warrant</TableHead>
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
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {session.offence_status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {session.warrant_document ? (
                              <a 
                                href={session.warrant_document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium text-white bg-[#0b4f2a] hover:bg-[#0b4f2a]/90 transition-colors shadow-sm"
                              >
                                <Download className="w-3.5 h-3.5" /> View
                              </a>
                            ) : (
                              <span className="text-gray-400 text-sm italic">None</span>
                            )}
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

      <ScheduleCourtSessionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleSessionScheduled}
      />
    </PrisonLayout>
  );
};

export default Courts;
