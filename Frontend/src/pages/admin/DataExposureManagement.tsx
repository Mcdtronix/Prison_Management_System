import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { rbacApi } from '@/lib/api';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DataExposureManagement = () => {
  const [policies, setPolicies] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [polRes, recRes] = await Promise.all([
      rbacApi.getDataExposurePolicies(),
      rbacApi.getDataExposureRecords()
    ]);
    if (polRes.data) setPolicies(Array.isArray(polRes.data) ? polRes.data : (polRes.data as any).results || []);
    if (recRes.data) setRecords(Array.isArray(recRes.data) ? recRes.data : (recRes.data as any).results || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeletePolicy = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this policy?")) return;
    try {
      await rbacApi.deleteDataExposurePolicy(id);
      toast({ title: "Policy deleted" });
      fetchData();
    } catch (err) {
      toast({ title: "Error deleting policy", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Data Exposure Policies</CardTitle>
            <CardDescription>Rules defining data sharing between stations</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p>Loading...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Source → Target</th>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map(p => (
                    <tr key={p.id} className="border-b">
                      <td className="px-4 py-3 font-medium">{p.code}</td>
                      <td className="px-4 py-3">{p.source_org_name || p.source_org_unit} → {p.target_org_name || p.target_org_unit}</td>
                      <td className="px-4 py-3">{p.module}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${p.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeletePolicy(p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {policies.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No policies found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exposed Records</CardTitle>
          <CardDescription>Individual records exposed under active policies</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p>Loading...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Policy Code</th>
                    <th className="px-4 py-3">Resource Type</th>
                    <th className="px-4 py-3">Resource ID</th>
                    <th className="px-4 py-3">Target Org</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="border-b">
                      <td className="px-4 py-3">{r.policy_code || r.policy}</td>
                      <td className="px-4 py-3">{r.resource_type}</td>
                      <td className="px-4 py-3 font-medium">{r.resource_id}</td>
                      <td className="px-4 py-3">{r.target_org_name || r.target_org_unit}</td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No exposed records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataExposureManagement;
