
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { healthApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { OPDVisitFormValues } from '../components/OPDVisitForm';

export const useOPDVisit = (inmateId: string | undefined) => {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (data: OPDVisitFormValues) => {
    if (!inmateId) return;
    
    setIsSaving(true);
    try {
      const response = await healthApi.registerOPDVisit(inmateId, data);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      toast({
        title: 'Success',
        description: 'OPD visit recorded successfully',
      });
      
      navigate(`/health/inmate/${inmateId}`);
      
    } catch (error) {
      console.error('Error saving OPD visit:', error);
      toast({
        title: 'Error',
        description: 'Failed to save OPD visit record',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/health/inmate/${inmateId}`);
  };

  return {
    isSaving,
    handleSubmit,
    handleCancel
  };
};
