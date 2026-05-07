import { PrisonLayout } from "@/components/PrisonLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Home, LogOut, Plus, UserPlus, Users } from "lucide-react";
import BasicInmateForm from "./components/InmateForm/BasicInmateForm";

const InmateRegistration = () => {
  return (
    <PrisonLayout
      title="New Inmate Basic Registration"
      description="Enter inmate basic details for initial registration"
    >
      <div className="max-w-5xl mx-auto">
        <BasicInmateForm />
      </div>
    </PrisonLayout>
  );
};

export default InmateRegistration;
