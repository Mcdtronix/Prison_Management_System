
import { useParams } from 'react-router-dom';
import { PrisonLayout } from '@/components/PrisonLayout';
import { useNavigate } from 'react-router-dom';
import { FileText, Home, LogOut, ThermometerIcon, Users } from 'lucide-react';
import { OPDVisitForm } from './components/OPDVisitForm';
import { useOPDVisit } from './hooks/useOPDVisit';
import { LoadingState } from './components/LoadingState';
import { NotFoundState } from './components/NotFoundState';
import { inmateApi } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const OPDVisitPage = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [inmate, setInmate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isSaving, handleSubmit, handleCancel } = useOPDVisit(id);
  
  useEffect(() => {
    const fetchInmateData = async () => {
      if (!id) return;
      
      setIsLoading(true);
      try {
        const inmateResponse = await inmateApi.getInmateDetails(id);
        if (inmateResponse.data) {
          setInmate(inmateResponse.data);
        }
      } catch (error) {
        console.error('Error fetching inmate data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch inmate information',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInmateData();
  }, [id, toast]);
  
  if (isLoading) {
    return (
      <PrisonLayout title="Record OPD Visit" description="Loading...">
        <LoadingState />
      </PrisonLayout>
    );
  }
  
  if (!inmate) {
    return (
      <PrisonLayout title="Record OPD Visit" description="Inmate not found">
        <NotFoundState />
      </PrisonLayout>
    );
  }
  
  return (
    <PrisonLayout
      title={`Record OPD Visit: ${inmate.name}`}
      description={`Prison Number: ${inmate.prison_number}`}
    >
      <div className="max-w-4xl mx-auto">
        <OPDVisitForm
          inmateId={id || ''}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSaving={isSaving}
        />
      </div>
    </PrisonLayout>
  );
};

export default OPDVisitPage;
