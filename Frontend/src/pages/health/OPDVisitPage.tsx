
import { useParams } from 'react-router-dom';
import { DashboardShell } from '@/components/DashboardShell';
import { useAuth } from '@/contexts/AuthContext';
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
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inmate, setInmate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isSaving, handleSubmit, handleCancel } = useOPDVisit(id);
  
  // Define navigation items
  const navItems = [
    { icon: <Home size={20} />, label: 'Dashboard', href: '/health' },
    { icon: <Users size={20} />, label: 'Inmates', href: '/health/inmates' },
    { icon: <FileText size={20} />, label: 'OPD Records', href: '/health/opd' },
    { icon: <ThermometerIcon size={20} />, label: 'Check-ups', href: '/health/checkups' },
  ];
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
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
      <DashboardShell
        title="Record OPD Visit"
        description="Loading..."
        user={{ name: 'Health Officer', role: 'Health Department' }}
        onLogout={handleLogout}
        navItems={navItems}
      >
        <LoadingState />
      </DashboardShell>
    );
  }
  
  if (!inmate) {
    return (
      <DashboardShell
        title="Record OPD Visit"
        description="Inmate not found"
        user={{ name: 'Health Officer', role: 'Health Department' }}
        onLogout={handleLogout}
        navItems={navItems}
      >
        <NotFoundState />
      </DashboardShell>
    );
  }
  
  return (
    <DashboardShell
      title={`Record OPD Visit: ${inmate.name}`}
      description={`Prison Number: ${inmate.prison_number}`}
      user={{ name: 'Health Officer', role: 'Health Department' }}
      onLogout={handleLogout}
      navItems={navItems}
    >
      <div className="max-w-4xl mx-auto">
        <OPDVisitForm
          inmateId={id || ''}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSaving={isSaving}
        />
      </div>
    </DashboardShell>
  );
};

export default OPDVisitPage;
