import { PrisonLayout } from "@/components/PrisonLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Home, LogOut, Plus, FileText, Users } from "lucide-react";
import OffenceRegistrationForm from "./components/InmateForm/OffenceRegistrationForm";

const OffenceRegistration = () => {
  return (
    <PrisonLayout
      title="Offence Registration"
      description="Register offences and related information for existing inmates"
    >
      <div className="max-w-5xl mx-auto">
        <OffenceRegistrationForm />
      </div>
    </PrisonLayout>
  );
};

export default OffenceRegistration;
