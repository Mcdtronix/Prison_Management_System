
import { useParams, useNavigate } from 'react-router-dom';
import { PrisonLayout } from '@/components/PrisonLayout';
import { FileText, Home, LogOut, ThermometerIcon, Users } from 'lucide-react';
import { InmateBasicInfo } from './components/InmateBasicInfo';
import { HealthRecordForm, HealthFormValues } from './components/HealthRecordForm';
import { LoadingState } from './components/LoadingState';
import { NotFoundState } from './components/NotFoundState';
import { useInmateHealth } from './hooks/useInmateHealth';

const InmateHealth = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inmate, healthRecord, isLoading, isSaving, handleSubmit } = useInmateHealth(id);

  if (isLoading) {
    return (
      <PrisonLayout title="Inmate Health Record" description="Loading...">
        <LoadingState />
      </PrisonLayout>
    );
  }
  
  if (!inmate) {
    return (
      <PrisonLayout title="Inmate Health Record" description="Inmate not found">
        <NotFoundState />
      </PrisonLayout>
    );
  }
  
  const handleCancel = () => navigate('/health');
  
  const inmateName = inmate.first_name && inmate.surname 
    ? `${inmate.first_name} ${inmate.surname}` 
    : inmate.name || 'Unknown Inmate';
  
  return (
    <PrisonLayout
      title={`Health Record: ${inmateName}`}
      description={`Prison Number: ${inmate.prison_number || 'N/A'}`}
    >
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <InmateBasicInfo inmate={inmate} />
        </div>
        
        <div className="md:col-span-2">
          <HealthRecordForm 
            healthRecord={healthRecord} 
            isSaving={isSaving} 
            onSubmit={handleSubmit as (data: HealthFormValues) => void}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </PrisonLayout>
  );
};

export default InmateHealth;
