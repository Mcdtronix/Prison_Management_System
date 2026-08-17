import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface FilterRule {
  field: string;
  operator: string;
  value: string;
}

export interface FilterGroup {
  operator: 'AND' | 'OR';
  conditions: (FilterRule | FilterGroup)[];
}

interface QueryBuilderProps {
  group: FilterGroup;
  onChange: (group: FilterGroup) => void;
  fieldsSchema: any;
}

export function QueryBuilder({ group, onChange, fieldsSchema }: QueryBuilderProps) {
  const handleOperatorChange = (op: 'AND' | 'OR') => {
    onChange({ ...group, operator: op });
  };

  const addRule = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, { field: '', operator: 'equals', value: '' }]
    });
  };

  const addGroup = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, { operator: 'AND', conditions: [{ field: '', operator: 'equals', value: '' }] }]
    });
  };

  const updateCondition = (index: number, newCond: FilterRule | FilterGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = newCond;
    onChange({ ...group, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    const newConditions = [...group.conditions];
    newConditions.splice(index, 1);
    onChange({ ...group, conditions: newConditions });
  };

  // Group fields by their group label
  const groupedFields = fieldsSchema.reduce((acc: any, field: any) => {
    if (!acc[field.group]) {
      acc[field.group] = [];
    }
    acc[field.group].push(field);
    return acc;
  }, {});

  return (
    <div className="border border-gray-300 rounded-md p-4 bg-gray-50 mb-2">
      <div className="flex gap-2 items-center mb-4">
        <select
          value={group.operator}
          onChange={(e) => handleOperatorChange(e.target.value as 'AND' | 'OR')}
          className="h-8 rounded-md border border-gray-300 px-2 text-sm font-bold bg-white"
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
        <Button variant="outline" size="sm" onClick={addRule} className="h-8">
          <Plus className="mr-1 h-3 w-3" /> Add Rule
        </Button>
        <Button variant="outline" size="sm" onClick={addGroup} className="h-8">
          <Plus className="mr-1 h-3 w-3" /> Add Group
        </Button>
      </div>
      
      <div className="space-y-3 pl-4 border-l-2 border-gray-200">
        {group.conditions.map((cond, i) => {
          if ('operator' in cond && 'conditions' in cond) {
            return (
              <div key={i} className="flex gap-2 items-start relative ml-6">
                <Button variant="ghost" size="sm" onClick={() => removeCondition(i)} className="absolute -left-12 top-2 text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <QueryBuilder group={cond as FilterGroup} onChange={(g) => updateCondition(i, g)} fieldsSchema={fieldsSchema} />
                </div>
              </div>
            );
          } else {
            const rule = cond as FilterRule;
            const fieldInfo = fieldsSchema.find((f: any) => f.key === rule.field);
            const availableOperators = fieldInfo ? fieldInfo.operators : ['equals', 'contains'];
            
            return (
              <div key={i} className="flex gap-2 items-center relative pl-6">
                <Button variant="ghost" size="sm" onClick={() => removeCondition(i)} className="absolute -left-4 text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
                
                <select
                  value={rule.field}
                  onChange={(e) => updateCondition(i, { ...rule, field: e.target.value, operator: fieldsSchema.find((f:any)=>f.key===e.target.value)?.operators[0] || 'equals', value: '' })}
                  className="flex h-10 w-1/3 items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b4f2a]"
                >
                  <option value="">Select Field...</option>
                  {Object.entries(groupedFields).map(([groupName, fields]: any) => (
                    <optgroup key={groupName} label={groupName}>
                      {fields.map((f: any) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={(e) => updateCondition(i, { ...rule, operator: e.target.value })}
                  className="flex h-10 w-1/4 items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b4f2a]"
                >
                  {availableOperators.map((op: string) => (
                    <option key={op} value={op}>{op.replace(/_/g, ' ').toUpperCase()}</option>
                  ))}
                </select>

                {fieldInfo?.type === 'choice' && fieldInfo.choices ? (
                  <select
                    value={rule.value}
                    onChange={(e) => updateCondition(i, { ...rule, value: e.target.value })}
                    className="flex h-10 w-1/3 items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b4f2a]"
                  >
                    <option value="">Select Value...</option>
                    {fieldInfo.choices.map((c: any) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                ) : fieldInfo?.type === 'date' && !['today','yesterday','this_week','this_month','this_year'].includes(rule.operator) ? (
                   rule.operator === 'between' ? (
                     <Input
                        value={rule.value}
                        onChange={(e) => updateCondition(i, { ...rule, value: e.target.value })}
                        placeholder="YYYY-MM-DD, YYYY-MM-DD"
                        className="w-1/3"
                      />
                   ) : (
                      <Input
                        type="date"
                        value={rule.value}
                        onChange={(e) => updateCondition(i, { ...rule, value: e.target.value })}
                        className="w-1/3"
                      />
                   )
                ) : ['is_empty', 'is_not_empty', 'is_true', 'is_false', 'today', 'yesterday', 'this_week', 'this_month', 'this_year'].includes(rule.operator) ? (
                  <div className="w-1/3"></div>
                ) : (
                  <Input
                    value={rule.value}
                    onChange={(e) => updateCondition(i, { ...rule, value: e.target.value })}
                    placeholder="Value..."
                    className="w-1/3 border-gray-300 focus-visible:ring-[#0b4f2a]"
                  />
                )}
              </div>
            );
          }
        })}
        {group.conditions.length === 0 && (
          <div className="text-sm text-gray-500 italic py-2">No conditions. All records will be included.</div>
        )}
      </div>
    </div>
  );
}
