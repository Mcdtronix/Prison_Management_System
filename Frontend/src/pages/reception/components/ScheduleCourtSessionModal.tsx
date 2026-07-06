import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { receptionApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ScheduleCourtSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ScheduleCourtSessionModal: React.FC<ScheduleCourtSessionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [inmates, setInmates] = useState<any[]>([]);
  const [selectedInmateId, setSelectedInmateId] = useState<string>('');
  const [offences, setOffences] = useState<any[]>([]);
  const [selectedOffenceId, setSelectedOffenceId] = useState<string>('');
  const [nextCourtDate, setNextCourtDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      // Fetch inmates when modal opens
      fetchInmates();
    } else {
      // Reset state when closed
      setSelectedInmateId('');
      setOffences([]);
      setSelectedOffenceId('');
      setNextCourtDate('');
      setRemarks('');
      setDocumentFile(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  const fetchInmates = async () => {
    try {
      const response = await receptionApi.getInmateList();
      if (!response.error) {
        setInmates(response.data || []);
      }
    } catch (error) {
      console.error("Error fetching inmates:", error);
    }
  };

  const handleInmateSelect = async (inmateId: string) => {
    setSelectedInmateId(inmateId);
    setSelectedOffenceId('');
    setOffences([]);
    
    if (!inmateId) return;

    try {
      setLoading(true);
      const response = await receptionApi.getInmate(inmateId);
      if (!response.error && response.data) {
        setOffences(response.data.offences || []);
      }
    } catch (error) {
      console.error("Error fetching inmate details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setDocumentFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffenceId || !nextCourtDate || !documentFile) {
      toast({
        title: "Validation Error",
        description: "Please select an offence, provide a next court date, and upload the court warrant/request document.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const formData = new FormData();
      formData.append('offence_id', selectedOffenceId);
      formData.append('next_court_date', nextCourtDate);
      if (remarks) formData.append('remarks', remarks);
      if (documentFile) formData.append('warrant_document', documentFile);

      const response = await receptionApi.scheduleCourtSession(formData);
      
      if (response.error) {
        throw new Error(response.error);
      }

      toast({
        title: "Success",
        description: "Court session scheduled successfully.",
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to schedule court session.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter inmates locally if they use the search box
  const filteredInmates = inmates.filter(inmate => 
    inmate.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    inmate.prison_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Court Session</DialogTitle>
          <DialogDescription>
            Select an inmate and schedule a new court appearance. You can optionally upload a court warrant or request document.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Inmate</Label>
            <Input 
              placeholder="Search inmate by name or prison number..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
            />
            <Select value={selectedInmateId} onValueChange={handleInmateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select an inmate..." />
              </SelectTrigger>
              <SelectContent>
                {filteredInmates.map((inmate) => (
                  <SelectItem key={inmate.id} value={inmate.id.toString()}>
                    {inmate.prison_number} - {inmate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Select Offence</Label>
            <Select 
              value={selectedOffenceId} 
              onValueChange={setSelectedOffenceId}
              disabled={!selectedInmateId || offences.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an offence..." />
              </SelectTrigger>
              <SelectContent>
                {offences.map((offence) => (
                  <SelectItem key={offence.id} value={offence.id.toString()}>
                    {offence.offence_description} ({offence.conviction_status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Court Date</Label>
            <Input 
              type="date" 
              value={nextCourtDate} 
              onChange={(e) => setNextCourtDate(e.target.value)} 
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Remarks (Optional)</Label>
            <Input 
              placeholder="Any additional notes..." 
              value={remarks} 
              onChange={(e) => setRemarks(e.target.value)} 
            />
          </div>

          <div className="space-y-2">
            <Label>Court Warrant / Request Document <span className="text-red-500">*</span></Label>
            <Input 
              type="file" 
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              required
            />
            <p className="text-xs text-muted-foreground">Uploading the official document received from the court is mandatory.</p>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Scheduling..." : "Schedule Session"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleCourtSessionModal;
