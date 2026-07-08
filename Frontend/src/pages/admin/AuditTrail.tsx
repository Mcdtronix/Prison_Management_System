import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface AuditLog {
  id: number;
  user: {
    username: string;
    first_name: string;
    last_name: string;
  };
  role: string;
  station: string;
  action: string;
  module: string;
  object_type: string | null;
  object_id: string | null;
  ip_address: string;
  user_agent: string;
  request_method: string;
  request_path: string;
  remarks: string | null;
  timestamp: string;
}

export default function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await authApi.getAuditLogs();
      if (res.data) {
        // Handle both paginated (res.data.results) and non-paginated (res.data) responses
        const logsData = Array.isArray(res.data) ? res.data : (res.data.results || []);
        setLogs(logsData as AuditLog[]);
      } else {
        toast({
          title: "Error fetching logs",
          description: "Could not retrieve audit trail data.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error fetching logs",
        description: "A network error occurred while fetching audit trail data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    window.location.href = "http://localhost:8000/api/auth/logs/export/";
  };

  const filteredLogs = logs.filter((log) => {
    const s = search.toLowerCase();
    const username = log.user?.username || "";
    return (
      username.toLowerCase().includes(s) ||
      log.action.toLowerCase().includes(s) ||
      log.module.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">System Audit Trail</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive log of all user activities and system mutations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user or action..."
              className="pl-8 bg-white border-gray-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={handleExport} className="bg-[#0b4f2a] hover:bg-[#063f20] text-white">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
          <CardTitle className="text-lg">Activity Logs</CardTitle>
          <CardDescription>
            Showing recent accountability records across all modules.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b4f2a] mx-auto mb-4"></div>
              Loading audit logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No logs found</h3>
              <p className="text-sm text-muted-foreground">
                There are no audit records matching your search criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold text-gray-900">Timestamp</TableHead>
                    <TableHead className="font-semibold text-gray-900">User / Role</TableHead>
                    <TableHead className="font-semibold text-gray-900">Module</TableHead>
                    <TableHead className="font-semibold text-gray-900">Action</TableHead>
                    <TableHead className="font-semibold text-gray-900">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell className="text-sm whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {format(new Date(log.timestamp), "MMM dd, yyyy")}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {format(new Date(log.timestamp), "HH:mm:ss")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-[#0b4f2a]">
                          {log.user ? log.user.username : "System"}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px] bg-gray-50">
                            {log.role}
                          </Badge>
                          {log.station && <span className="text-gray-400">@ {log.station}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-[#0b4f2a] text-white hover:bg-[#063f20]">
                          {log.module}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-gray-900">
                          {log.action}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                          {log.request_method} {log.request_path}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600 max-w-[250px] truncate" title={log.remarks || "No additional remarks"}>
                          {log.remarks || "-"}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5" title={log.ip_address}>
                          IP: {log.ip_address}
                        </div>
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
  );
}
