import React, { useEffect, useState } from 'react';
import { custodyApi } from '../../lib/api';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Clock, Eye, X } from 'lucide-react';

export default function UnlockHistory() {
  const [unlocks, setUnlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await custodyApi.getUnlockHistory();
      const list = Array.isArray(data) ? data : (data?.results || data?.data || []);
      setUnlocks(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const calculateDetailedTotals = (record: any) => {
    const yardTotals: Record<string, number> = {};
    record.cell_counts.forEach((c: any) => {
      if (!yardTotals[c.yard_name_snapshot]) {
        yardTotals[c.yard_name_snapshot] = 0;
      }
      yardTotals[c.yard_name_snapshot] += c.count;
    });
    return yardTotals;
  };

  if (loading) return <PrisonLayout title="Unlock History" description="Loading..."><div className="p-8">Loading history...</div></PrisonLayout>;

  return (
    <PrisonLayout title="Unlock History" description="Review historical daily unlock records and their snapshot details.">
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
          <Clock className="w-8 h-8" /> Unlock History
        </h1>
        <p className="text-gray-500 mt-1">Review historical daily unlock records and their snapshot details.</p>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-500 text-sm">
              <th className="px-6 py-4 font-medium">Date & Time</th>
              <th className="px-6 py-4 font-medium">Total Count</th>
              <th className="px-6 py-4 font-medium">Recorded By</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {unlocks.map(record => (
              <tr key={record.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{record.date}</div>
                  <div className="text-sm text-gray-500">{record.time}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-mono font-bold text-lg text-green-600">{record.total_count}</span>
                </td>
                <td className="px-6 py-4 text-gray-700">{record.recorded_by_name || 'System'}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${record.status === 'SUBMITTED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {record.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setSelectedRecord(record)}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 justify-end w-full"
                  >
                    <Eye size={18} /> View Detail
                  </button>
                </td>
              </tr>
            ))}
            {unlocks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No unlock records found for this station.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="bg-gray-900 text-white p-6 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">Unlock Snapshot</h3>
                <p className="text-gray-400 mt-1">{selectedRecord.date} at {selectedRecord.time} • Recorded by {selectedRecord.recorded_by_name || 'System'}</p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
              <div className="grid gap-6">
                {Object.entries(calculateDetailedTotals(selectedRecord)).map(([yardName, yardTotal]: [string, any]) => (
                  <div key={yardName} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-gray-100 px-6 py-3 border-b flex justify-between items-center">
                      <h4 className="font-bold text-gray-800 uppercase tracking-wide">{yardName}</h4>
                      <div className="font-mono font-bold text-gray-700 bg-gray-200 px-3 py-1 rounded-full">Total: {yardTotal}</div>
                    </div>
                    <table className="w-full text-left">
                      <tbody>
                        {selectedRecord.cell_counts
                          .filter((c: any) => c.yard_name_snapshot === yardName)
                          .map((cell: any) => (
                            <tr key={cell.id} className="border-b last:border-0">
                              <td className="px-6 py-3 text-gray-700 font-medium">{cell.cell_name_snapshot}</td>
                              <td className="px-6 py-3 text-right">
                                <span className="font-mono font-bold text-lg">{cell.count}</span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border-t p-6 flex justify-between items-center">
              <span className="text-xl font-bold text-gray-500 uppercase tracking-widest">Grand Total</span>
              <span className="text-4xl font-mono font-bold text-green-600">{selectedRecord.total_count}</span>
            </div>
          </div>
        </div>
      )}
    </div>
    </PrisonLayout>
  );
}
