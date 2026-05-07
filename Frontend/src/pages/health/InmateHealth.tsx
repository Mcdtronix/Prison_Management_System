
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardShell } from '@/components/DashboardShell';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Home, LogOut, ThermometerIcon, Users } from 'lucide-react';
import { InmateBasicInfo } from './components/InmateBasicInfo';
import { HealthRecordForm, HealthFormValues } from './components/HealthRecordForm';
import { LoadingState } from './components/LoadingState';
import { NotFoundState } from './components/NotFoundState';
import { useInmateHealth } from './hooks/useInmateHealth';

const InmateHealth = () => {
  const { id } = useParams<{ id: string }>();
  const { logout } = useAuth();
  const navigate = useNavigate();
  
  const { inmate, healthRecord, isLoading, isSaving, handleSubmit } = useInmateHealth(id);
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  // Define navigation items
  const navItems = [
    { icon: <Home size={20} />, label: 'Dashboard', href: '/health' },
    { icon: <Users size={20} />, label: 'Inmates', href: '/health/inmates' },
    { icon: <FileText size={20} />, label: 'OPD Records', href: '/health/opd' },
    { icon: <ThermometerIcon size={20} />, label: 'Check-ups', href: '/health/checkups' },
  ];
  
  if (isLoading) {
    return (
      <DashboardShell
        title="Inmate Health Record"
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
        title="Inmate Health Record"
        description="Inmate not found"
        user={{ name: 'Health Officer', role: 'Health Department' }}
        onLogout={handleLogout}
        navItems={navItems}
      >
        <NotFoundState />
      </DashboardShell>
    );
  }
  
  const handleCancel = () => navigate('/health');
  
  return (
    <DashboardShell
      title={`Health Record: ${inmate.name}`}
      description={`Prison Number: ${inmate.prison_number}`}
      user={{ name: 'Health Officer', role: 'Health Department' }}
      onLogout={handleLogout}
      navItems={navItems}
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
    </DashboardShell>
  );
};

export default InmateHealth;
