import React, { useState, useEffect } from 'react';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { receptionApi } from '@/lib/api';
import { 
  Users, UserPlus, Calendar, Activity, Loader2, AlertCircle
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  LineChart, Line, ResponsiveContainer 
} from 'recharts';

const COLORS = ['#0b4f2a', '#d7a928', '#2563eb', '#dc2626', '#16a34a', '#8b5cf6', '#f97316'];

const Analysis = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await receptionApi.getReceptionAnalytics();
        if (response.error) {
          throw new Error(response.error);
        }
        setData(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <PrisonLayout title="Reception Analysis" description="Loading metrics...">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-[#0b4f2a]" />
          <p className="text-lg">Compiling analytics dashboard...</p>
        </div>
      </PrisonLayout>
    );
  }

  if (error || !data) {
    return (
      <PrisonLayout title="Reception Analysis" description="Error">
        <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center shadow-sm">
          <AlertCircle className="w-6 h-6 mr-3 text-red-500" />
          <div>
            <h3 className="font-semibold text-lg">Failed to load analytics</h3>
            <p>{error}</p>
          </div>
        </div>
      </PrisonLayout>
    );
  }

  const { kpis, status_distribution, classification_distribution, gender_distribution, offences_distribution, sentences_distribution, admission_trends } = data;

  return (
    <PrisonLayout 
      title="Reception Analytics Dashboard" 
      description="Real-time insights into prison population, admissions, and legal proceedings."
    >
      <div className="space-y-6">
        
        {/* KPIs Row */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm border-l-4 border-l-[#0b4f2a]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-600">Total In Custody</CardTitle>
              <Users className="w-4 h-4 text-[#0b4f2a]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{kpis.total_in_custody}</div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-l-4 border-l-[#2563eb]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-600">Admissions (Last 30 Days)</CardTitle>
              <UserPlus className="w-4 h-4 text-[#2563eb]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{kpis.admissions_this_month}</div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-l-4 border-l-[#d7a928]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-600">Upcoming Courts (7 Days)</CardTitle>
              <Calendar className="w-4 h-4 text-[#d7a928]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{kpis.upcoming_courts}</div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-[#dc2626]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Actions</CardTitle>
              <Activity className="w-4 h-4 text-[#dc2626]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{kpis.pending_admissions}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1: Status & Demographics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Status Distribution */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Population by Status</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={status_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {status_distribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gender Demographics */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Gender Demographics</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gender_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {gender_distribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Classification Bar Chart */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Security Classifications</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classification_distribution} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#0b4f2a" radius={[0, 4, 4, 0]}>
                    {classification_distribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2: Sentences & Offences */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Sentence Periods */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Sentence Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sentences_distribution} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#d7a928" radius={[4, 4, 0, 0]}>
                    {sentences_distribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Offences Breakdown */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Top 10 Offences</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={offences_distribution} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} style={{ fontSize: '11px' }} />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Full Width Row: Admission Trends */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Admission Trends (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={admission_trends} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="admissions" 
                  stroke="#2563eb" 
                  strokeWidth={3}
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </PrisonLayout>
  );
};

export default Analysis;
