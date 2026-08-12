import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PrisonLayout } from "@/components/PrisonLayout";
import { useAuth } from "@/contexts/AuthContext";
import { receptionApi, adminApi } from "@/lib/api";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Toaster, toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InmateDue {
  id: string;
  prison_number: string;
  name: string;
  current_class: string;
  required_class: string;
  admission_date: string;
  offense: string;
}

interface InmatePending {
  id: string;
  prison_number: string;
  name: string;
  current_class: string;
  proposed_class: string;
  required_class: string;
  date_proposed: string;
}

interface InmateCategory {
  id: string;
  prison_number: string;
  name: string;
  admission_date: string;
  offense: string;
}

export default function Reclassification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [dueInmates, setDueInmates] = useState<InmateDue[]>([]);
  const [pendingInmates, setPendingInmates] = useState<InmatePending[]>([]);
  const [categories, setCategories] = useState<Record<string, InmateCategory[]>>({});
  
  // Dialog State
  const [proposeOpen, setProposeOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [selectedInmate, setSelectedInmate] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<string>("C");
  const [processing, setProcessing] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_OFFICER";

  const fetchData = async () => {
    setLoading(true);
    try {
      const promises = [
        receptionApi.getDueReclassifications(),
        receptionApi.getReclassificationCategories()
      ];
      if (isAdmin) {
        promises.push(receptionApi.getPendingReclassifications());
      }
      
      const results = await Promise.all(promises);
      
      const dueRes = results[0];
      const catRes = results[1];
      const pendRes = isAdmin ? results[2] : { data: [] };

      if (dueRes.error) throw new Error(dueRes.error);
      if (catRes.error) throw new Error(catRes.error);
      if (pendRes.error) throw new Error(pendRes.error);
      
      setDueInmates(dueRes.data || []);
      setCategories(catRes.data || {});
      setPendingInmates(pendRes.data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load reclassification data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getClassBadgeColor = (cls: string) => {
    switch(cls) {
      case 'A': return 'bg-emerald-500';
      case 'B': return 'bg-blue-500';
      case 'C': return 'bg-amber-500';
      case 'D': return 'bg-red-500';
      case 'COND': return 'bg-purple-600';
      case 'PUSOD': return 'bg-pink-600';
      default: return 'bg-gray-500';
    }
  };

  const openProposeDialog = (inmate: InmateDue) => {
    setSelectedInmate(inmate);
    setSelectedClass(inmate.required_class); // Default to engine's suggestion
    setProposeOpen(true);
  };

  const openApproveDialog = (inmate: InmatePending) => {
    setSelectedInmate(inmate);
    setSelectedClass(inmate.proposed_class); // Default to what was proposed
    setApproveOpen(true);
  };

  const handleProposeSubmit = async () => {
    if (!selectedInmate) return;
    setProcessing(true);
    try {
      const res = await receptionApi.proposeReclassification(selectedInmate.id, selectedClass);
      if (res.error) throw new Error(res.error);
      toast.success("Classification proposed successfully");
      setProposeOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to propose classification");
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveSubmit = async () => {
    if (!selectedInmate) return;
    setProcessing(true);
    try {
      const res = await adminApi.approveReclassification(selectedInmate.id, selectedClass);
      if (res.error) throw new Error(res.error);
      toast.success("Classification approved successfully");
      setApproveOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to approve classification");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeny = async (id: string) => {
    if (!window.confirm("Are you sure you want to deny this reclassification proposal?")) return;
    setProcessing(true);
    try {
      const res = await receptionApi.rejectReclassification(id);
      if (res.error) throw new Error(res.error);
      toast.success("Proposal denied successfully");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to deny proposal");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PrisonLayout user={user}>
      <div className="container mx-auto p-6 max-w-6xl">
        <Toaster position="top-right" richColors />
        
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inmate Reclassification</h1>
            <p className="text-muted-foreground mt-1">
              Manage inmate security classifications based on sentence length and court outcomes.
            </p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading || processing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${(loading || processing) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="due" className="space-y-6">
          <TabsList>
            <TabsTrigger value="due" className="relative">
              Due for Reclassification
              {dueInmates.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {dueInmates.length}
                </span>
              )}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="pending" className="relative">
                Pending Approvals
                {pendingInmates.length > 0 && (
                  <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {pendingInmates.length}
                  </span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="categories">Current Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="due">
            <Card className="border-t-4 border-t-amber-500">
              <CardHeader>
                <CardTitle>Inmates Due for Reclassification</CardTitle>
                <CardDescription>
                  These inmates have a current classification that no longer matches the strict system rules.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : dueInmates.length === 0 ? (
                  <Alert className="bg-emerald-50 text-emerald-900 border-emerald-200">
                    <AlertCircle className="h-4 w-4 text-emerald-600" />
                    <AlertTitle>All clear</AlertTitle>
                    <AlertDescription>
                      No inmates are currently pending a classification proposal.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Prison No.</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Primary Offence</TableHead>
                          <TableHead>Current Class</TableHead>
                          <TableHead>System Recommends</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dueInmates.map((inmate) => (
                          <TableRow key={inmate.id}>
                            <TableCell className="font-medium">{inmate.prison_number}</TableCell>
                            <TableCell>{inmate.name}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={inmate.offense}>
                              {inmate.offense}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${getClassBadgeColor(inmate.current_class)} text-white border-transparent`}>
                                {inmate.current_class}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${getClassBadgeColor(inmate.required_class)} text-white`}>
                                Class {inmate.required_class}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => navigate(`/inmates/${inmate.id}`)}
                              >
                                View
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={() => openProposeDialog(inmate)}
                              >
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
          </TabsContent>

          {isAdmin && (
            <TabsContent value="pending">
              <Card className="border-t-4 border-t-amber-500">
                <CardHeader>
                  <CardTitle>Pending Approvals</CardTitle>
                  <CardDescription>
                    Review and approve reclassification proposals submitted by Reception.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : pendingInmates.length === 0 ? (
                    <Alert className="bg-emerald-50 text-emerald-900 border-emerald-200">
                      <AlertCircle className="h-4 w-4 text-emerald-600" />
                      <AlertTitle>All clear</AlertTitle>
                      <AlertDescription>
                        No pending proposals to review.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Prison No.</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Current Class</TableHead>
                            <TableHead>Proposed Class</TableHead>
                            <TableHead>System Recommends</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingInmates.map((inmate) => (
                            <TableRow key={inmate.id}>
                              <TableCell className="font-medium">{inmate.prison_number}</TableCell>
                              <TableCell>{inmate.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`${getClassBadgeColor(inmate.current_class)} text-white border-transparent`}>
                                  {inmate.current_class}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={`${getClassBadgeColor(inmate.proposed_class)} text-white animate-pulse`}>
                                  Class {inmate.proposed_class}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  Class {inmate.required_class}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right space-x-2">
                                <Button size="sm" variant="outline" onClick={() => navigate(`/inmates/${inmate.id}`)}>
                                  View
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeny(inmate.id)} disabled={processing}>
                                  Deny
                                </Button>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openApproveDialog(inmate)} disabled={processing}>
                                  Approve
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
            </TabsContent>
          )}

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Inmate Categories</CardTitle>
                <CardDescription>
                  View all active inmates organized by their current classification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                   <div className="flex justify-center p-8">
                     <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                   </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {['A', 'B', 'C', 'D', 'COND', 'PUSOD'].map((cls) => (
                      <div key={cls} className="border rounded-lg overflow-hidden">
                        <div className={`p-3 ${getClassBadgeColor(cls)} text-white font-semibold flex justify-between items-center`}>
                          <span>Class {cls}</span>
                          <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none">
                            {categories[cls]?.length || 0} Inmates
                          </Badge>
                        </div>
                        <div className="p-0 bg-gray-50/50">
                          {categories[cls]?.length > 0 ? (
                            <div className="max-h-[300px] overflow-y-auto">
                              <Table>
                                <TableHeader className="bg-gray-100 sticky top-0">
                                  <TableRow>
                                    <TableHead className="h-8 text-xs">Prison No.</TableHead>
                                    <TableHead className="h-8 text-xs">Name</TableHead>
                                    <TableHead className="h-8 text-xs text-right">Action</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {categories[cls].map((inmate) => (
                                    <TableRow key={inmate.id}>
                                      <TableCell className="py-2 text-sm">{inmate.prison_number}</TableCell>
                                      <TableCell className="py-2 text-sm">{inmate.name}</TableCell>
                                      <TableCell className="py-2 text-right">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-7 text-xs"
                                          onClick={() => navigate(`/inmates/${inmate.id}`)}
                                        >
                                          View
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              No inmates in this class
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* PROPOSE DIALOG */}
      <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose Reclassification</DialogTitle>
            <DialogDescription>
              Submit a new classification proposal for this inmate. The system recommendation is shown below.
            </DialogDescription>
          </DialogHeader>
          {selectedInmate && (
            <div className="py-4 space-y-4">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md border">
                <span className="text-sm font-medium text-gray-500">Current Class</span>
                <Badge variant="outline" className={`${getClassBadgeColor(selectedInmate.current_class)} text-white`}>
                  {selectedInmate.current_class}
                </Badge>
              </div>
              <div className="flex justify-between items-center bg-blue-50 p-3 rounded-md border border-blue-100">
                <span className="text-sm font-medium text-blue-700">System Recommended</span>
                <Badge className={`${getClassBadgeColor(selectedInmate.required_class)} text-white`}>
                  Class {selectedInmate.required_class}
                </Badge>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Proposed Classification</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Class A (Less than 18 months)</SelectItem>
                    <SelectItem value="B">Class B (18 to 36 months)</SelectItem>
                    <SelectItem value="C">Class C (3 years to 7 years)</SelectItem>
                    <SelectItem value="D">Class D (7+ years or Unconvicted)</SelectItem>
                    <SelectItem value="COND">Condemned</SelectItem>
                    <SelectItem value="PUSOD">PUSOD</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  You may override the system recommendation if necessary.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProposeOpen(false)} disabled={processing}>Cancel</Button>
            <Button onClick={handleProposeSubmit} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APPROVE DIALOG */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Reclassification</DialogTitle>
            <DialogDescription>
              Review the proposed classification and confirm the final class for this inmate.
            </DialogDescription>
          </DialogHeader>
          {selectedInmate && (
            <div className="py-4 space-y-4">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md border">
                <span className="text-sm font-medium text-gray-500">Current Class</span>
                <Badge variant="outline" className={`${getClassBadgeColor(selectedInmate.current_class)} text-white`}>
                  {selectedInmate.current_class}
                </Badge>
              </div>
              <div className="flex justify-between items-center bg-amber-50 p-3 rounded-md border border-amber-200">
                <span className="text-sm font-medium text-amber-700">Proposed by Reception</span>
                <Badge className={`${getClassBadgeColor(selectedInmate.proposed_class)} text-white animate-pulse`}>
                  Class {selectedInmate.proposed_class}
                </Badge>
              </div>
              <div className="flex justify-between items-center bg-blue-50 p-3 rounded-md border border-blue-100">
                <span className="text-sm font-medium text-blue-700">System Recommended</span>
                <Badge variant="outline" className="border-blue-300 text-blue-700">
                  Class {selectedInmate.required_class}
                </Badge>
              </div>
              <div className="space-y-2 pt-2 border-t mt-4">
                <label className="text-sm font-medium">Final Approved Classification</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="border-emerald-300 focus:ring-emerald-500">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Class A (Less than 18 months)</SelectItem>
                    <SelectItem value="B">Class B (18 to 36 months)</SelectItem>
                    <SelectItem value="C">Class C (3 years to 7 years)</SelectItem>
                    <SelectItem value="D">Class D (7+ years or Unconvicted)</SelectItem>
                    <SelectItem value="COND">Condemned</SelectItem>
                    <SelectItem value="PUSOD">PUSOD</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  You can change the proposed class before approving.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={processing}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApproveSubmit} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve Classification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PrisonLayout>
  );
}
