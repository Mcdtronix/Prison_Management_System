
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, UserPlus, UserMinus, Home, LogOut, 
  Search, Plus, FileText, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi, authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { PrisonLayout } from '@/components/PrisonLayout';
import OfficerManagement from './OfficerManagement';
import InmateOverview from './InmateOverview';
import { useToast } from '@/hooks/use-toast';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
  PieChart, Pie, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';

const populationData = [
  { name: 'Jan', value: 1200, capacity: 1500 },
  { name: 'Feb', value: 1250, capacity: 1500 },
  { name: 'Mar', value: 1300, capacity: 1500 },
  { name: 'Apr', value: 1280, capacity: 1500 },
  { name: 'May', value: 1400, capacity: 1500 },
  { name: 'Jun', value: 1450, capacity: 1500 },
];

const incidentData = [
  { name: 'Assault', count: 12 },
  { name: 'Contraband', count: 45 },
  { name: 'Medical', count: 32 },
  { name: 'Rule Viol.', count: 85 },
];

const securityData = [
  { name: 'Maximum', value: 400, color: '#0b4f2a' },
  { name: 'Medium', value: 750, color: '#2e8b57' },
  { name: 'Minimum', value: 300, color: '#d7a928' },
];

const officerData = [
  { name: 'Day Shift', value: 65, fill: '#0b4f2a' },
  { name: 'Night Shift', value: 45, fill: '#d7a928' },
];

const AdminDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalInmates: 0,
    totalOfficers: 0,
    pendingAdmissions: 0,
    recentDischarges: 0
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // In a real app, you would fetch actual data from your API
        // This is just a placeholder for demonstration
        const [inmatesRes, logsRes] = await Promise.all([
          adminApi.getAllInmates(),
          authApi.getAuditLogs()
        ]);
        
        if (inmatesRes.data) {
          // Simulate some stats based on the response
          setStats({
            totalInmates: inmatesRes.data.length || 0,
            totalOfficers: 25, // Placeholder
            pendingAdmissions: 3, // Placeholder
            recentDischarges: 2 // Placeholder
          });
        }
        
        if (logsRes.data) {
          const logs = (logsRes.data as any).results || logsRes.data;
          if (Array.isArray(logs)) {
            setRecentActivities(logs.slice(0, 5));
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch dashboard data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [toast]);


  return (
    <PrisonLayout
      title="Admin Dashboard"
      description="Manage prison operations, officers, and inmates"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inmates</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : stats.totalInmates}</div>
            <p className="text-xs text-muted-foreground">
              Currently housed inmates
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prison Officers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : stats.totalOfficers}</div>
            <p className="text-xs text-muted-foreground">
              Active staff members
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Admissions</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : stats.pendingAdmissions}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Discharges</CardTitle>
            <UserMinus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : stats.recentDischarges}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-x-2">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Admission
            </Button>
            <Button variant="outline" size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              New Officer
            </Button>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8"
            />
          </div>
        </div>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="inmates">Inmate Management</TabsTrigger>
            <TabsTrigger value="officers">Officer Management</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
              
              {/* Left Column - Main Charts (Spans 2 cols on XL) */}
              <div className="xl:col-span-2 space-y-6">
                
                {/* Population Trend Area Chart */}
                <Card className="shadow-sm border-0 ring-1 ring-gray-100 bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-gray-800 uppercase tracking-wider">Population Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={populationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0b4f2a" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#0b4f2a" stopOpacity={0.1}/>
                            </linearGradient>
                            <linearGradient id="colorCap" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#d7a928" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#d7a928" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }} />
                          <RechartsTooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600 }}
                            itemStyle={{ color: '#1f2937' }}
                          />
                          <Area type="monotone" dataKey="capacity" stroke="#d7a928" fillOpacity={1} fill="url(#colorCap)" strokeWidth={2} name="Capacity" />
                          <Area type="monotone" dataKey="value" stroke="#0b4f2a" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} name="Inmates" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* KPI Metrics Row (Custom Circle Widgets) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { title: 'Total Capacity', value: '1,500', desc: 'Max beds', color: 'text-[#0b4f2a]', bg: 'bg-[#0b4f2a]/10', border: 'border-[#0b4f2a]' },
                    { title: 'Current Pop.', value: '1,450', desc: '96.6% full', color: 'text-[#d7a928]', bg: 'bg-[#d7a928]/10', border: 'border-[#d7a928]' },
                    { title: 'Officers', value: '110', desc: 'On active duty', color: 'text-[#2e8b57]', bg: 'bg-[#2e8b57]/10', border: 'border-[#2e8b57]' },
                  ].map((kpi, i) => (
                    <Card key={i} className="shadow-sm border-0 ring-1 ring-gray-100 flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl">
                       <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 border-[6px] ${kpi.bg} ${kpi.border} shadow-inner`}>
                         <span className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</span>
                       </div>
                       <h3 className="text-[15px] font-bold text-gray-800">{kpi.title}</h3>
                       <p className="text-sm font-medium text-gray-500 mt-1">{kpi.desc}</p>
                    </Card>
                  ))}
                </div>

                {/* Horizontal Bars for Security Classes */}
                <Card className="shadow-sm border-0 ring-1 ring-gray-100 bg-white">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-bold text-gray-800 uppercase tracking-wider">Security Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-6 mt-2">
                       {securityData.map((sec, i) => (
                         <div key={i} className="flex items-center">
                           <div className="w-24 text-[15px] font-bold text-gray-700">{sec.name}</div>
                           <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                             <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(sec.value / 1450) * 100}%`, backgroundColor: sec.color }} />
                           </div>
                           <div className="w-16 text-right text-[15px] font-black text-gray-900">{sec.value}</div>
                         </div>
                       ))}
                     </div>
                  </CardContent>
                </Card>

              </div>

              {/* Right Column - Secondary Charts */}
              <div className="space-y-6">
                
                {/* Radial Chart - Officer Shifts */}
                <Card className="shadow-sm border-0 ring-1 ring-gray-100 bg-white">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-sm font-bold text-gray-800 uppercase tracking-wider">Officer Shifts</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center p-0">
                    <div className="h-[250px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart cx="50%" cy="50%" innerRadius="40%" outerRadius="100%" barSize={20} data={officerData}>
                          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                          <RadialBar background clockWise dataKey="value" cornerRadius={10} />
                          <Legend iconSize={12} layout="vertical" verticalAlign="bottom" align="center" wrapperStyle={{ fontWeight: 600, color: '#374151' }} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Incident Bar Chart */}
                <Card className="shadow-sm border-0 ring-1 ring-gray-100 bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-gray-800 uppercase tracking-wider">Incidents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[220px] w-full mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={incidentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} />
                          <RechartsTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600 }} />
                          <Bar dataKey="count" fill="#d7a928" radius={[6, 6, 0, 0]} barSize={24} name="Reports" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Demographics Circular Mini-Gauges */}
                <Card className="shadow-sm border-0 ring-1 ring-gray-100 bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-gray-800 uppercase tracking-wider">Age Demo</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-6">
                     <div className="flex justify-between items-end mt-4 px-2">
                        <div className="text-center">
                          <div className="w-16 h-16 rounded-full border-[6px] border-[#0b4f2a] flex items-center justify-center text-lg font-black text-gray-800 mx-auto shadow-sm bg-[#0b4f2a]/5">45%</div>
                          <div className="text-xs font-bold text-gray-500 mt-3 uppercase">18-35</div>
                        </div>
                        <div className="text-center">
                          <div className="w-16 h-16 rounded-full border-[6px] border-[#2e8b57] flex items-center justify-center text-lg font-black text-gray-800 mx-auto shadow-sm bg-[#2e8b57]/5">35%</div>
                          <div className="text-xs font-bold text-gray-500 mt-3 uppercase">36-50</div>
                        </div>
                        <div className="text-center">
                          <div className="w-16 h-16 rounded-full border-[6px] border-[#d7a928] flex items-center justify-center text-lg font-black text-gray-800 mx-auto shadow-sm bg-[#d7a928]/5">20%</div>
                          <div className="text-xs font-bold text-gray-500 mt-3 uppercase">51+</div>
                        </div>
                     </div>
                  </CardContent>
                </Card>

              </div>
            </div>
          </TabsContent>
          <TabsContent value="inmates">
            <InmateOverview />
          </TabsContent>
          <TabsContent value="officers">
            <OfficerManagement />
          </TabsContent>
        </Tabs>
      </div>
    </PrisonLayout>
  );
};

export default AdminDashboard;
