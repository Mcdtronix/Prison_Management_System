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
  active_odr: string | null;
  date_of_admission: string | null;
  offences_list: Array<{ description: string; status: string; sentence: string; date_of_sentence: string | null }>;
}

const DischargeApprovals = () => {
  const [approvals, setApprovals] = useState<DischargeApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedApproval, setSelectedApproval] = useState<DischargeApproval | null>(null);
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

  const handleAction = async (type: 'approve' | 'reject') => {
    if (!selectedApproval) return;
    
    try {
      setActionLoading(true);
      if (type === 'approve') {
        await receptionApi.approvePendingDischarge(selectedApproval.id, remarks);
        toast({ title: "Success", description: "Discharge approved successfully." });
      } else {
        if (!remarks.trim()) {
          toast({ title: "Error", description: "Remarks are required for rejection.", variant: "destructive" });
          setActionLoading(false);
          return;
        }
        await receptionApi.rejectPendingDischarge(selectedApproval.id, remarks);
        toast({ title: "Success", description: "Discharge rejected." });
      }
      
      setSelectedApproval(null);
      setRemarks('');
      fetchApprovals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${type} discharge`,
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
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          className="bg-[#0b4f2a] hover:bg-[#0b4f2a]/90 text-white"
                          onClick={() => setSelectedApproval(approval)}
                        >
                          <FileUp className="w-4 h-4 mr-1" /> Review
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

      <Dialog open={!!selectedApproval} onOpenChange={(open) => !open && setSelectedApproval(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Discharge Proposal</DialogTitle>
            <DialogDescription>
              Review the inmate's details carefully before approving or rejecting this discharge.
            </DialogDescription>
          </DialogHeader>
          
          {selectedApproval && (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-md border">
                <div>
                  <span className="text-gray-500 block text-xs uppercase font-semibold">Name</span>
                  <span className="font-medium">{selectedApproval.inmate_name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase font-semibold">Prison Number</span>
                  <span className="font-medium">{selectedApproval.prison_number}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase font-semibold">Admission Date</span>
                  <span className="font-medium">
                    {selectedApproval.date_of_admission ? new Date(selectedApproval.date_of_admission).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase font-semibold">Proposed Reason</span>
                  <span className="font-medium text-[#0b4f2a]">{selectedApproval.reception_reason}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase font-semibold">EDR</span>
                  <span className="font-medium text-green-700">
                    {selectedApproval.active_edr ? new Date(selectedApproval.active_edr).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase font-semibold">ODR</span>
                  <span className="font-medium">
                    {selectedApproval.active_odr ? new Date(selectedApproval.active_odr).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Offences & Sentences</h4>
                {selectedApproval.offences_list && selectedApproval.offences_list.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-50 text-xs">
                        <TableRow>
                          <TableHead>Offence</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Sentence</TableHead>
                          <TableHead>Date of Sentence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-sm">
                        {selectedApproval.offences_list.map((offence, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium max-w-[200px] truncate" title={offence.description}>
                              {offence.description}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                offence.status === 'CONVICTED' ? 'bg-red-100 text-red-800' :
                                offence.status === 'UNCONVICTED' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {offence.status}
                              </span>
                            </TableCell>
                            <TableCell>{offence.sentence}</TableCell>
                            <TableCell>
                              {offence.date_of_sentence ? new Date(offence.date_of_sentence).toLocaleDateString() : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No offences recorded.</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Admin Remarks (Optional for approval, required for rejection)</label>
                <Textarea 
                  placeholder="Enter any notes or remarks regarding this decision..." 
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setSelectedApproval(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleAction('reject')} 
                disabled={actionLoading || !remarks.trim()}
              >
                <XCircle className="w-4 h-4 mr-1" /> Reject
              </Button>
              <Button 
                className="bg-[#0b4f2a] hover:bg-[#0b4f2a]/90 text-white"
                onClick={() => handleAction('approve')} 
                disabled={actionLoading}
              >
                <CheckCircle className="w-4 h-4 mr-1" /> Approve
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DischargeApprovals;
