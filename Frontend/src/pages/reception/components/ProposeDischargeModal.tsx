import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { receptionApi } from '@/lib/api';
import { format } from 'date-fns';

interface ProposeDischargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  session: any | null;
}

const ProposeDischargeModal: React.FC<ProposeDischargeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  session
}) => {
  const [reason, setReason] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceipt(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("A reason for discharge must be stated.");
      return;
    }
    if (!session) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      // Use inmate ID from session. The API expects inmate_id
      // session from getUpcomingDischarges actually returns ReleaseHistory id, 
      // but wait, we need inmate_id. Let's make sure session has inmate_id or we fetch it.
      // Wait, UpcomingDischargeSerializer returns ReleaseHistory fields, we might need to add inmate_id to it if it doesn't have it.
      formData.append('inmate_id', session.inmate_id.toString());
      formData.append('reception_reason', reason);
      if (receipt) {
        formData.append('reception_receipt', receipt);
      }

      const response = await receptionApi.proposeDischarge(formData);
      
      if (response.error) {
        throw new Error(response.error);
      }

      toast({
        title: "Discharge Proposed",
        description: "The discharge has been successfully proposed to Admin.",
      });
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to propose discharge");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Propose Discharge</DialogTitle>
            <DialogDescription>
              Verify the release dates and propose discharge to Admin.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
              <div>
                <Label className="text-xs text-gray-500">Inmate</Label>
                <div className="font-medium text-sm">{session.inmate_name} ({session.prison_number})</div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">EDR (Earliest Date of Release)</Label>
                <div className="font-medium text-sm text-green-700">
                  {session.active_edr ? format(new Date(session.active_edr + 'T12:00:00'), 'PP') : 'N/A'}
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">ODR (Official Date of Release)</Label>
                <div className="font-medium text-sm text-gray-600">
                  {session.active_odr ? format(new Date(session.active_odr + 'T12:00:00'), 'PP') : 'N/A'}
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Current Status</Label>
                <div className="font-medium text-sm">
                  {session.approval_status}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Reason for Discharge <span className="text-red-500">*</span></Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="State the reason for proposing this discharge..."
                rows={3}
                className={error ? 'border-red-500' : ''}
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="receipt">Upload Receipt / File (Optional)</Label>
              <Input
                id="receipt"
                type="file"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#0b4f2a] hover:bg-[#063f20]">
              {isSubmitting ? 'Submitting...' : 'Propose Discharge'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProposeDischargeModal;
