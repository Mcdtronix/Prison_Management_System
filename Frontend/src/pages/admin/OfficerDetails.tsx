import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Shield, MapPin, Award, GraduationCap, Users, FileText, Scale } from "lucide-react";
import { format } from "date-fns";

import { hrApi, authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function OfficerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [officer, setOfficer] = useState<any>(null);
  const [stationHistory, setStationHistory] = useState<any[]>([]);
  const [rankHistory, setRankHistory] = useState<any[]>([]);
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [chargeSheets, setChargeSheets] = useState<any[]>([]);
  const [dependants, setDependants] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  // Lookup data
  const [ranks, setRanks] = useState<any[]>([]);
  const [qualificationTypes, setQualificationTypes] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [offenceTypes, setOffenceTypes] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]); // Derived from auth or custom endpoint?

  useEffect(() => {
    if (id) {
      loadAllData();
    }
  }, [id]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [
        officerRes,
        stationRes,
        rankRes,
        qualRes,
        courseRes,
        chargeRes,
        depRes,
        docRes,
        ranksLookup,
        qualLookup,
        coursesLookup,
        offencesLookup,
      ] = await Promise.all([
        hrApi.getOfficer(id!),
        hrApi.getStationHistory(id!),
        hrApi.getRankHistory(id!),
        hrApi.getQualifications(id!),
        hrApi.getCoursesHistory(id!),
        hrApi.getChargeSheets(id!),
        hrApi.getDependants(id!),
        hrApi.getDocuments(id!),
        hrApi.getRanks(),
        hrApi.getQualificationTypes(),
        hrApi.getCourses(),
        hrApi.getOffenceTypes(),
      ]);

      if (officerRes.data) setOfficer(officerRes.data);
      if (stationRes.data) setStationHistory(stationRes.data);
      if (rankRes.data) setRankHistory(rankRes.data);
      if (qualRes.data) setQualifications(qualRes.data);
      if (courseRes.data) setCourses(courseRes.data);
      if (chargeRes.data) setChargeSheets(chargeRes.data);
      if (depRes.data) setDependants(depRes.data);
      if (docRes.data) setDocuments(docRes.data);

      if (ranksLookup.data) setRanks(ranksLookup.data);
      if (qualLookup.data) setQualificationTypes(qualLookup.data);
      if (coursesLookup.data) setAvailableCourses(coursesLookup.data);
      if (offencesLookup.data) setOffenceTypes(offencesLookup.data);
      
      // Attempt to load stations
      try {
          const authUsers = await authApi.getUsers();
          // We can't fetch plain stations right now easily without admin-actions or similar, 
          // but we can just use text inputs for station IDs if needed, or we might need a dedicated endpoint later.
          // For now, let's keep stations as simple inputs or rely on the backend setting them.
      } catch(e) {}

    } catch (error) {
      toast({ title: "Failed to load officer details", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "PPP");
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading Officer Details...</div>;
  }

  if (!officer) {
    return <div className="p-8 text-center text-red-500">Officer not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/admin/officers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {officer.first_name} {officer.surname} {officer.other_names || ""}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{officer.service_number}</Badge>
            <Badge variant={officer.current_status === "ACTIVE" ? "default" : "secondary"}>
              {officer.current_status}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto mb-4 bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="station_history">Station History</TabsTrigger>
          <TabsTrigger value="rank_history">Rank History</TabsTrigger>
          <TabsTrigger value="qualifications">Qualifications</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="dependants">Dependants</TabsTrigger>
          <TabsTrigger value="disciplinary">Disciplinary</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground">National ID</dt>
                  <dd className="mt-1 text-sm font-semibold">{officer.national_id}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground">Gender</dt>
                  <dd className="mt-1 text-sm font-semibold">{officer.gender}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground">Date of Birth</dt>
                  <dd className="mt-1 text-sm font-semibold">{formatDate(officer.date_of_birth)}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground">Date of Attestation</dt>
                  <dd className="mt-1 text-sm font-semibold">{formatDate(officer.date_of_attestation)}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground">Date of Retirement</dt>
                  <dd className="mt-1 text-sm font-semibold">{formatDate(officer.date_of_retirement)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="station_history">
          <StationHistoryTab records={stationHistory} officerId={id!} reload={loadAllData} />
        </TabsContent>

        <TabsContent value="rank_history">
          <RankHistoryTab records={rankHistory} officerId={id!} ranks={ranks} reload={loadAllData} />
        </TabsContent>

        <TabsContent value="qualifications">
          <QualificationsTab records={qualifications} officerId={id!} types={qualificationTypes} reload={loadAllData} />
        </TabsContent>

        <TabsContent value="courses">
          <CoursesTab records={courses} officerId={id!} availableCourses={availableCourses} reload={loadAllData} />
        </TabsContent>

        <TabsContent value="dependants">
          <DependantsTab records={dependants} officerId={id!} reload={loadAllData} />
        </TabsContent>

        <TabsContent value="disciplinary">
          <DisciplinaryTab records={chargeSheets} officerId={id!} offences={offenceTypes} reload={loadAllData} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab records={documents} officerId={id!} reload={loadAllData} />
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ----------------------------------------------------------------------
// SUB-COMPONENTS FOR TABS
// ----------------------------------------------------------------------

function StationHistoryTab({ records, officerId, reload }: { records: any[]; officerId: string; reload: () => void }) {
  // Station history is usually added by transferring via an endpoint. We will display it for now.
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Station History</CardTitle>
          <CardDescription>Record of postings and transfers.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Station / Unit</TableHead>
              <TableHead>Date Posted</TableHead>
              <TableHead>Date Transferred</TableHead>
              <TableHead>Posted By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No records found</TableCell></TableRow>}
            {records.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.station || "Station ID: " + r.station_id}</TableCell>
                <TableCell>{r.date_posted}</TableCell>
                <TableCell>{r.date_transferred || "Current"}</TableCell>
                <TableCell>{r.posted_by}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RankHistoryTab({ records, officerId, ranks, reload }: { records: any[]; officerId: string; ranks: any[]; reload: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ rank: "", effective_date: "", change_type: "", authority: "", remarks: "" });

  const handleSubmit = async () => {
    const res = await hrApi.addRankHistory({ officer: officerId, ...formData });
    if (res.error) {
      toast({ title: "Failed to add rank history", description: res.error, variant: "destructive" });
    } else {
      toast({ title: "Rank history added" });
      setOpen(false);
      reload();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Rank History</CardTitle><CardDescription>Promotions, demotions, and acting ranks.</CardDescription></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2"/> Add Rank</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Rank History</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Rank</Label>
                <Select value={formData.rank} onValueChange={(v) => setFormData({...formData, rank: v})}>
                  <SelectTrigger><SelectValue placeholder="Select rank" /></SelectTrigger>
                  <SelectContent>{ranks.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Effective Date</Label><Input type="date" onChange={(e) => setFormData({...formData, effective_date: e.target.value})} /></div>
              <div className="space-y-2">
                <Label>Change Type</Label>
                <Select value={formData.change_type} onValueChange={(v) => setFormData({...formData, change_type: v})}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROMOTION">Promotion</SelectItem>
                    <SelectItem value="DEMOTION">Demotion</SelectItem>
                    <SelectItem value="ACTING">Acting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Authority</Label><Input onChange={(e) => setFormData({...formData, authority: e.target.value})} /></div>
              <div className="space-y-2"><Label>Remarks</Label><Input onChange={(e) => setFormData({...formData, remarks: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={handleSubmit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Type</TableHead><TableHead>Effective Date</TableHead><TableHead>Authority</TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No records found</TableCell></TableRow>}
            {records.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-semibold">{ranks.find(rank => rank.id === r.rank)?.name || r.rank}</TableCell>
                <TableCell><Badge variant="outline">{r.change_type}</Badge></TableCell>
                <TableCell>{r.effective_date}</TableCell>
                <TableCell>{r.authority}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function QualificationsTab({ records, officerId, types, reload }: { records: any[]; officerId: string; types: any[]; reload: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ qualification_type: "", institution: "", date_awarded: "" });
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    const data = new FormData();
    data.append("officer", officerId);
    data.append("qualification_type", formData.qualification_type);
    data.append("institution", formData.institution);
    data.append("date_awarded", formData.date_awarded);
    if (file) data.append("certificate", file);

    const res = await hrApi.addQualification(data);
    if (res.error) toast({ title: "Failed", description: res.error, variant: "destructive" });
    else { toast({ title: "Success" }); setOpen(false); reload(); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Qualifications</CardTitle><CardDescription>Academic and professional qualifications.</CardDescription></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2"/> Add Qualification</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Qualification</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.qualification_type} onValueChange={(v) => setFormData({...formData, qualification_type: v})}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{types.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Institution</Label><Input onChange={(e) => setFormData({...formData, institution: e.target.value})} /></div>
              <div className="space-y-2"><Label>Date Awarded</Label><Input type="date" onChange={(e) => setFormData({...formData, date_awarded: e.target.value})} /></div>
              <div className="space-y-2"><Label>Certificate (File)</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
            </div>
            <DialogFooter><Button onClick={handleSubmit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Institution</TableHead><TableHead>Date</TableHead><TableHead>Certificate</TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No records found</TableCell></TableRow>}
            {records.map(r => (
              <TableRow key={r.id}>
                <TableCell>{types.find(t => t.id === r.qualification_type)?.name || r.qualification_type}</TableCell>
                <TableCell>{r.institution}</TableCell>
                <TableCell>{r.date_awarded}</TableCell>
                <TableCell>{r.certificate ? <a href={r.certificate} target="_blank" className="text-[#0b4f2a] underline">View File</a> : "None"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CoursesTab({ records, officerId, availableCourses, reload }: { records: any[]; officerId: string; availableCourses: any[]; reload: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ course: "", start_date: "", end_date: "", result: "" });
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    const data = new FormData();
    data.append("officer", officerId);
    Object.entries(formData).forEach(([k, v]) => data.append(k, v));
    if (file) data.append("certificate", file);

    const res = await hrApi.addCourseHistory(data);
    if (res.error) toast({ title: "Failed", description: res.error, variant: "destructive" });
    else { toast({ title: "Success" }); setOpen(false); reload(); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Courses Attended</CardTitle></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2"/> Add Course</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Course</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={formData.course} onValueChange={(v) => setFormData({...formData, course: v})}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>{availableCourses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Start Date</Label><Input type="date" onChange={(e) => setFormData({...formData, start_date: e.target.value})} /></div>
                <div className="space-y-2"><Label>End Date</Label><Input type="date" onChange={(e) => setFormData({...formData, end_date: e.target.value})} /></div>
              </div>
              <div className="space-y-2"><Label>Result</Label><Input onChange={(e) => setFormData({...formData, result: e.target.value})} /></div>
              <div className="space-y-2"><Label>Certificate (File)</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
            </div>
            <DialogFooter><Button onClick={handleSubmit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Dates</TableHead><TableHead>Result</TableHead><TableHead>Certificate</TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No records found</TableCell></TableRow>}
            {records.map(r => (
              <TableRow key={r.id}>
                <TableCell>{availableCourses.find(c => c.id === r.course)?.name || r.course}</TableCell>
                <TableCell>{r.start_date} to {r.end_date}</TableCell>
                <TableCell>{r.result}</TableCell>
                <TableCell>{r.certificate ? <a href={r.certificate} target="_blank" className="text-[#0b4f2a] underline">View</a> : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DependantsTab({ records, officerId, reload }: { records: any[]; officerId: string; reload: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ full_name: "", relationship: "", date_of_birth: "", national_id: "" });
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    const data = new FormData();
    data.append("officer", officerId);
    Object.entries(formData).forEach(([k, v]) => data.append(k, v));
    if (file) data.append("birth_certificate", file);

    const res = await hrApi.addDependant(data);
    if (res.error) toast({ title: "Failed", description: res.error, variant: "destructive" });
    else { toast({ title: "Success" }); setOpen(false); reload(); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Dependants</CardTitle></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2"/> Add Dependant</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Dependant</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Full Name</Label><Input onChange={(e) => setFormData({...formData, full_name: e.target.value})} /></div>
              <div className="space-y-2"><Label>Relationship</Label><Input onChange={(e) => setFormData({...formData, relationship: e.target.value})} /></div>
              <div className="space-y-2"><Label>National ID (Optional)</Label><Input onChange={(e) => setFormData({...formData, national_id: e.target.value})} /></div>
              <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})} /></div>
              <div className="space-y-2"><Label>Birth Certificate (File)</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
            </div>
            <DialogFooter><Button onClick={handleSubmit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Relationship</TableHead><TableHead>DOB</TableHead><TableHead>Certificate</TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No records found</TableCell></TableRow>}
            {records.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell>{r.relationship}</TableCell>
                <TableCell>{r.date_of_birth}</TableCell>
                <TableCell>{r.birth_certificate ? <a href={r.birth_certificate} target="_blank" className="text-[#0b4f2a] underline">View</a> : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DisciplinaryTab({ records, officerId, offences, reload }: { records: any[]; officerId: string; offences: any[]; reload: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ offence_type: "", charge_date: "", description: "", status: "PENDING" });
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    const data = new FormData();
    data.append("officer", officerId);
    Object.entries(formData).forEach(([k, v]) => data.append(k, v));
    if (file) data.append("document", file);

    const res = await hrApi.addChargeSheet(data);
    if (res.error) toast({ title: "Failed", description: res.error, variant: "destructive" });
    else { toast({ title: "Success" }); setOpen(false); reload(); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Disciplinary Records</CardTitle><CardDescription>Charge sheets and sentences.</CardDescription></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2"/> Add Charge Sheet</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Charge Sheet</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Offence</Label>
                <Select value={formData.offence_type} onValueChange={(v) => setFormData({...formData, offence_type: v})}>
                  <SelectTrigger><SelectValue placeholder="Select offence" /></SelectTrigger>
                  <SelectContent>{offences.map(o => <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Date of Charge</Label><Input type="date" onChange={(e) => setFormData({...formData, charge_date: e.target.value})} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="CONCLUDED">Concluded</SelectItem>
                    <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Description</Label><Textarea onChange={(e) => setFormData({...formData, description: e.target.value})} /></div>
              <div className="space-y-2"><Label>Document</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
            </div>
            <DialogFooter><Button onClick={handleSubmit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Offence</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Description</TableHead><TableHead>Doc</TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No records found</TableCell></TableRow>}
            {records.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-semibold">{offences.find(o => o.id === r.offence_type)?.name || r.offence_type}</TableCell>
                <TableCell>{r.charge_date}</TableCell>
                <TableCell><Badge>{r.status}</Badge></TableCell>
                <TableCell className="max-w-[200px] truncate">{r.description}</TableCell>
                <TableCell>{r.document ? <a href={r.document} target="_blank" className="text-[#0b4f2a] underline">View</a> : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DocumentsTab({ records, officerId, reload }: { records: any[]; officerId: string; reload: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ document_type: "" });
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    const data = new FormData();
    data.append("officer", officerId);
    data.append("document_type", formData.document_type);
    if (file) data.append("file", file);

    const res = await hrApi.addDocument(data);
    if (res.error) toast({ title: "Failed", description: res.error, variant: "destructive" });
    else { toast({ title: "Success" }); setOpen(false); reload(); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Documents</CardTitle></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2"/> Add Document</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Document Type</Label><Input placeholder="e.g. Appointment Letter" onChange={(e) => setFormData({ document_type: e.target.value })} /></div>
              <div className="space-y-2"><Label>File</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
            </div>
            <DialogFooter><Button onClick={handleSubmit}>Upload</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Uploaded At</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No documents found</TableCell></TableRow>}
            {records.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.document_type}</TableCell>
                <TableCell>{format(new Date(r.uploaded_at), "PPP")}</TableCell>
                <TableCell><a href={r.file} target="_blank" className="text-[#0b4f2a] underline">Download / View</a></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
