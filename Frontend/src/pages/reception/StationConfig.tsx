import React, { useEffect, useState } from 'react';
import { custodyApi } from '../../lib/api';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Plus, Edit2, Trash2, Save, X, Settings } from 'lucide-react';

export default function StationConfig() {
  const [yards, setYards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [editingYard, setEditingYard] = useState<any>(null);
  const [editingCell, setEditingCell] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await custodyApi.getYards();
      setYards(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load yards');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveYard = async () => {
    try {
      if (editingYard.id) {
        await custodyApi.updateYard(editingYard.id, editingYard);
      } else {
        await custodyApi.createYard(editingYard);
      }
      setEditingYard(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save yard');
    }
  };

  const handleSaveCell = async () => {
    try {
      if (editingCell.id) {
        await custodyApi.updateCell(editingCell.id, editingCell);
      } else {
        await custodyApi.createCell(editingCell);
      }
      setEditingCell(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save cell');
    }
  };

  const handleDeactivateYard = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this yard?')) return;
    try {
      await custodyApi.updateYard(id, { is_active: false });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate yard');
    }
  };

  const handleDeactivateCell = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this cell?')) return;
    try {
      await custodyApi.updateCell(id, { is_active: false });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate cell');
    }
  };

  if (loading) return <PrisonLayout title="Station Configuration" description="Loading..."><div className="p-8">Loading configuration...</div></PrisonLayout>;

  return (
    <PrisonLayout title="Station Configuration" description="Configure physical yards and cells for this station.">
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6" /> Station Custody Configuration
          </h1>
          <p className="text-gray-500 mt-1">Configure physical yards and cells for this station.</p>
        </div>
        <button
          onClick={() => setEditingYard({ name: '', description: '', display_order: yards.length + 1 })}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus size={18} /> Add Yard
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>}

      <div className="grid gap-6">
        {yards.filter(y => y.is_active).map(yard => (
          <div key={yard.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{yard.name}</h2>
                <p className="text-sm text-gray-500">{yard.description || 'No description'}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingYard(yard)}
                  className="text-gray-600 hover:text-blue-600"
                  title="Edit Yard"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDeactivateYard(yard.id)}
                  className="text-gray-600 hover:text-red-600"
                  title="Deactivate Yard"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-700">Cells ({yard.cells.filter((c:any) => c.is_active).length})</h3>
                <button
                  onClick={() => setEditingCell({ yard: yard.id, name: '', capacity: 0, display_order: yard.cells.length + 1 })}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus size={16} /> Add Cell
                </button>
              </div>

              {yard.cells.filter((c:any) => c.is_active).length === 0 ? (
                <p className="text-sm text-gray-500 italic">No active cells in this yard.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {yard.cells.filter((c:any) => c.is_active).sort((a:any, b:any) => a.display_order - b.display_order).map((cell: any) => (
                    <div key={cell.id} className="border rounded-lg p-4 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <p className="font-medium text-gray-800">{cell.name}</p>
                        {cell.capacity ? <p className="text-xs text-gray-500">Capacity: {cell.capacity}</p> : null}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingCell(cell)} className="text-gray-400 hover:text-blue-600">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeactivateCell(cell.id)} className="text-gray-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {yards.filter(y => y.is_active).length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500">No yards configured yet.</p>
          </div>
        )}
      </div>

      {/* Edit Yard Modal */}
      {editingYard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingYard.id ? 'Edit' : 'Add'} Yard</h3>
              <button onClick={() => setEditingYard(null)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Yard Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={editingYard.name || ''}
                  onChange={e => setEditingYard({ ...editingYard, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={editingYard.description || ''}
                  onChange={e => setEditingYard({ ...editingYard, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Display Order</label>
                <input
                  type="number"
                  className="w-full border rounded-lg p-2"
                  value={editingYard.display_order || 0}
                  onChange={e => setEditingYard({ ...editingYard, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <button
                onClick={handleSaveYard}
                className="w-full bg-blue-600 text-white py-2 rounded-lg flex justify-center items-center gap-2 hover:bg-blue-700"
              >
                <Save size={18} /> Save Yard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Cell Modal */}
      {editingCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingCell.id ? 'Edit' : 'Add'} Cell</h3>
              <button onClick={() => setEditingCell(null)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cell Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={editingCell.name || ''}
                  onChange={e => setEditingCell({ ...editingCell, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Capacity (Optional)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg p-2"
                  value={editingCell.capacity || ''}
                  onChange={e => setEditingCell({ ...editingCell, capacity: parseInt(e.target.value) || null })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Display Order</label>
                <input
                  type="number"
                  className="w-full border rounded-lg p-2"
                  value={editingCell.display_order || 0}
                  onChange={e => setEditingCell({ ...editingCell, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <button
                onClick={handleSaveCell}
                className="w-full bg-blue-600 text-white py-2 rounded-lg flex justify-center items-center gap-2 hover:bg-blue-700"
              >
                <Save size={18} /> Save Cell
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PrisonLayout>
  );
}
