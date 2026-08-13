import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { FileUp, CheckCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { receptionApi } from '@/lib/api';

interface DischargeApproval {
  id: number;
  inmate_name: string;
  prison_number: string;
  status: string;
  proposed_date: string;
  reception_reason: string;
  reception_receipt: string | null;
  active_edr: string | null;
}

const DischargeApprovals = () => {
  const [approvals, setApprovals] = useState<DischargeApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedAction, setSelectedAction] = useState<{ type: 'approve' | 'reject', approval: DischargeApproval } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const response = await receptionApi.getPendingDischargeApprovals();
      if (response.error) {
        throw new Error(response.error);
      }
      setApprovals(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending approvals');
      toast({
        title: "Error",
        description: "Failed to load pending discharge approvals.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleAction = async () => {
    if (!selectedAction) return;
    
    try {
      setActionLoading(true);
      if (selectedAction.type === 'approve') {
        await receptionApi.approvePendingDischarge(selectedAction.approval.id, remarks);
        toast({ title: "Success", description: "Discharge approved successfully." });
      } else {
        if (!remarks.trim()) {
          toast({ title: "Error", description: "Remarks are required for rejection.", variant: "destructive" });
          setActionLoading(false);
          return;
        }
        await receptionApi.rejectPendingDischarge(selectedAction.approval.id, remarks);
        toast({ title: "Success", description: "Discharge rejected." });
      }
      
      setSelectedAction(null);
      setRemarks('');
      fetchApprovals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${selectedAction.type} discharge`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4 mt-6">
      <Card className="shadow-sm border-0 ring-1 ring-gray-100 bg-white">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileUp className="w-5 h-5 text-[#0b4f2a]" />
            Pending Discharge Approvals
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b4f2a]"></div>
            </div>
          ) : error ? (
            <p className="text-red-500 bg-red-50 p-4 rounded-md">{error}</p>
          ) : approvals.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
              <CheckCircle className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
              <p className="text-muted-foreground mt-1">There are no pending discharge approvals at the moment.</p>
            </div>
          ) : (
            <div className="rounded-md border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50/80">
                  <TableRow>
                    <TableHead>Prison No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Proposed Date</TableHead>
                    <TableHead>EDR</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((approval) => (
                    <TableRow key={approval.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-semibold">{approval.prison_number}</TableCell>
                      <TableCell>{approval.inmate_name}</TableCell>
                      <TableCell>{new Date(approval.proposed_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium text-green-700">
                        {approval.active_edr ? new Date(approval.active_edr).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={approval.reception_reason}>
                        {approval.reception_reason}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          size="sm" 
                          className="bg-[#0b4f2a] hover:bg-[#0b4f2a]/90 text-white"
                          onClick={() => setSelectedAction({ type: 'approve', approval })}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setSelectedAction({ type: 'reject', approval })}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
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

      <Dialog open={!!selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAction?.type === 'approve' ? 'Approve Discharge' : 'Reject Discharge'}
            </DialogTitle>
            <DialogDescription>
              {selectedAction?.type === 'approve' 
                ? `You are about to approve the discharge for ${selectedAction?.approval?.inmate_name} (${selectedAction?.approval?.prison_number}). This action will officially release the inmate.`
                : `You are rejecting the discharge proposal for ${selectedAction?.approval?.inmate_name} (${selectedAction?.approval?.prison_number}).`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Remarks (Optional for approval, required for rejection)</label>
              <Textarea 
                placeholder="Enter any notes or remarks regarding this decision..." 
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAction(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button 
              className={selectedAction?.type === 'reject' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-[#0b4f2a] hover:bg-[#0b4f2a]/90 text-white"}
              onClick={handleAction} 
              disabled={actionLoading || (selectedAction?.type === 'reject' && !remarks.trim())}
            >
              {actionLoading ? "Processing..." : selectedAction?.type === 'approve' ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DischargeApprovals;
