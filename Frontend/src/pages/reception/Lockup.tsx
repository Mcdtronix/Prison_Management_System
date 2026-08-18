import React, { useEffect, useState } from 'react';
import { custodyApi } from '../../lib/api';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Lock, Save, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Lockup() {
  const [yards, setYards] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmMode, setConfirmMode] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await custodyApi.getLockupConfig();
      setYards(data.yards || []);
      
      const initialCounts: Record<string, number> = {};
      (data.yards || []).forEach((y: any) => {
        y.cells.forEach((c: any) => {
          initialCounts[`${y.id}-${c.id}`] = 0;
        });
      });
      setCounts(initialCounts);
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleCountChange = (yardId: number, cellId: number, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    setCounts(prev => ({ ...prev, [`${yardId}-${cellId}`]: num }));
  };

  const calculateYardTotal = (yardId: number) => {
    return Object.entries(counts)
      .filter(([key]) => key.startsWith(`${yardId}-`))
      .reduce((sum, [, count]) => sum + count, 0);
  };

  const calculateStationTotal = () => {
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
  };

  const handleSubmit = async () => {
    if (!confirmMode) {
      setConfirmMode(true);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
        counts: Object.entries(counts).map(([key, count]) => {
          const [yard_id, cell_id] = key.split('-');
          return { yard_id: parseInt(yard_id), cell_id: parseInt(cell_id), count };
        })
      };

      await custodyApi.submitLockup(payload);
      alert('Lockup submitted successfully');
      navigate('/reception/lockup-history');
    } catch (err: any) {
      alert(err.message || 'Failed to submit lockup');
      setConfirmMode(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PrisonLayout title="Daily Lockup" description="Loading..."><div className="p-8">Loading configuration...</div></PrisonLayout>;

  const totalLockup = calculateStationTotal();

  if (yards.length === 0) {
    return (
      <PrisonLayout title="Daily Lockup" description="Record the physical count of inmates currently locked up.">
      <div className="p-8 max-w-4xl mx-auto text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">No Station Configuration</h2>
        <p className="text-gray-500 mt-2">Your station has no active yards or cells configured. Please contact the administrator.</p>
      </div>
      </PrisonLayout>
    );
  }

  return (
    <PrisonLayout title="Daily Lockup" description="Record the physical count of inmates currently locked up.">
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center bg-gray-900 text-white p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Lock className="w-8 h-8" /> Daily Lockup
          </h1>
          <p className="text-gray-300 mt-1">Record the physical count of inmates currently locked up.</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Total Count</p>
          <p className="text-4xl font-mono font-bold text-blue-400">{totalLockup}</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>}

      <div className="grid gap-8">
        {yards.map(yard => {
          const yardTotal = calculateYardTotal(yard.id);
          return (
            <div key={yard.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">{yard.name}</h2>
                <div className="bg-blue-100 text-blue-800 px-4 py-1 rounded-full font-mono font-bold text-lg">
                  Total: {yardTotal}
                </div>
              </div>

              <div className="p-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-500 text-sm">
                      <th className="px-6 py-3 font-medium">Cell / Unit</th>
                      <th className="px-6 py-3 font-medium w-48">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yard.cells.sort((a:any, b:any) => a.display_order - b.display_order).map((cell: any) => (
                      <tr key={cell.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-700">{cell.name}</td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min="0"
                            className="w-full border-2 border-gray-300 rounded-lg p-2 text-xl font-mono text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                            value={counts[`${yard.id}-${cell.id}`] === 0 ? '' : counts[`${yard.id}-${cell.id}`]}
                            onChange={e => handleCountChange(yard.id, cell.id, e.target.value)}
                            placeholder="0"
                            disabled={confirmMode}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {confirmMode && (
        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl shadow-sm">
          <h3 className="text-xl font-bold text-yellow-800 mb-4 flex items-center gap-2">
            <AlertTriangle /> Lockup Summary Confirmation
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {yards.map(yard => (
              <div key={yard.id} className="flex justify-between border-b pb-2">
                <span className="font-medium text-gray-700">{yard.name}</span>
                <span className="font-mono font-bold">{calculateYardTotal(yard.id)}</span>
              </div>
            ))}
            <div className="col-span-2 flex justify-between border-t-2 border-gray-800 pt-4 mt-2">
              <span className="text-xl font-bold text-gray-900">GRAND TOTAL</span>
              <span className="text-2xl font-mono font-bold text-blue-600">{totalLockup}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 justify-end pb-12">
        {confirmMode && (
          <button
            onClick={() => setConfirmMode(false)}
            className="px-6 py-3 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50"
            disabled={saving}
          >
            Cancel / Edit
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className={`px-8 py-3 rounded-xl font-bold text-white flex items-center gap-2 ${confirmMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          <Save size={20} />
          {saving ? 'Saving...' : confirmMode ? 'Confirm Lockup' : 'Review & Submit'}
        </button>
      </div>
    </div>
    </PrisonLayout>
  );
}
