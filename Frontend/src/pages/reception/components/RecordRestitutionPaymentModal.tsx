import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { receptionApi } from '@/lib/api';

interface RecordRestitutionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restitutionId: string | null;
  balanceLeft: number;
}

const RecordRestitutionPaymentModal: React.FC<RecordRestitutionPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  restitutionId,
  balanceLeft
}) => {
  const [amount, setAmount] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceipt(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restitutionId) return;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive"
      });
      return;
    }

    if (!receiptNumber.trim()) {
      toast({
        title: "Receipt Number Required",
        description: "Please enter the official receipt number.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('receipt_number', receiptNumber);
      if (receipt) {
        formData.append('receipt', receipt);
      }

      const response = await receptionApi.recordRestitutionPayment(restitutionId, formData);
      
      if (response.error) {
        throw new Error(response.error);
      }

      toast({
        title: "Payment Recorded",
        description: response.data?.message || "Restitution payment successfully recorded.",
      });
      
      // Reset form
      setAmount('');
      setReceiptNumber('');
      setReceipt(null);
      
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to record payment",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!restitutionId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record Restitution Payment</DialogTitle>
            <DialogDescription>
              Update the payment status and upload the supporting receipt.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="bg-gray-50 p-3 rounded-md border border-gray-100 mb-2 text-sm">
              <span className="text-gray-500 font-medium mr-2">Balance Due:</span>
              <span className="font-bold text-gray-900">${balanceLeft.toFixed(2)}</span>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount Paid <span className="text-red-500">*</span></Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50.00"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="receiptNumber">Receipt Number <span className="text-red-500">*</span></Label>
              <Input
                id="receiptNumber"
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="e.g. REC-10293"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="receipt">Upload Receipt Document</Label>
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
              {isSubmitting ? 'Saving...' : 'Save Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RecordRestitutionPaymentModal;
