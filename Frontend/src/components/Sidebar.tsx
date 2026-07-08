import { cn } from "@/lib/utils";
import {
  Home,
  Users,
  UserPlus,
  UserCheck,
  Activity,
  Package,
  Tractor,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Stethoscope,
  Warehouse,
  Sprout,
  AlertTriangle,
  Tag,
  ArrowRightLeft,
  Gavel,
  LogOut,
  UserX,
  Lock,
  Unlock,
  FileText,
  Brain,
  Heart,
  Pill,
  ClipboardList,
  Wrench,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { messagingApi } from '@/lib/api'
import { Link, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "./ui/button";
import { getDefaultRouteForRole, normalizeRole } from "@/lib/auth";

interface SidebarProps {
  userRole: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  subItems?: { title: string; href: string }[];
}

export const Sidebar = ({ userRole }: SidebarProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(!isMobile);
  const normalizedRole = normalizeRole(userRole);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  let navItems: NavItem[] = [];

  switch (normalizedRole) {
    case "SUPER_ADMIN":
    case "ADMIN_OFFICER":
      navItems = [
        { title: "Dashboard", href: "/admin", icon: <Home size={18} /> },
        { title: "Messaging", href: "/messaging", icon: <MessageSquare size={18} /> },
        { title: "Inmates", href: "/admin/inmates", icon: <Users size={18} /> },
        {
          title: "Officers",
          href: "/admin/officers",
          icon: <UserCheck size={18} />,
          subItems: [
            { title: "Officers List", href: "/admin/officers" },
          ]
        },
        {
          title: "Admin Wizard",
          href: "/admin/wizard",
          icon: <UserPlus size={18} />,
          subItems: [
            { title: "Roles", href: "/admin/roles" },
            { title: "Departments", href: "/admin/departments" },
            { title: "Assignments", href: "/admin/assignments" },
            { title: "Data Exposure", href: "/admin/data-exposure" }
          ]
        },
        {
          title: "Audit Trail",
          href: "/admin/audit-trail",
          icon: <Activity size={18} />,
        },
        {
          title: "Settings",
          href: "/settings",
          icon: <Settings size={18} />,
        },
      ];
      break;
    case "RECEPTION_OFFICER":
      navItems = [
        { title: "Dashboard", href: "/reception", icon: <Home size={18} /> },
        { title: "Analysis", href: "/reception/analysis", icon: <Activity size={18} /> },
        { title: "Messaging", href: "/messaging", icon: <MessageSquare size={18} /> },
        {
          title: "Inmates",
          href: "/reception/inmates-management",
          icon: <Users size={18} />,
          subItems: [
            { title: "Inmate List", href: "/reception/inmates" },
            { title: "New Admission", href: "/reception/register" },
            { title: "Discharges", href: "/reception/discharges" },
          ]
        },
        {
          title: "Transfers",
          href: "/reception/transfers",
          icon: <ArrowRightLeft size={18} />,
        },
        {
          title: "Courts",
          href: "/reception/courts",
          icon: <Gavel size={18} />,
        },
        {
          title: "Escapes",
          href: "/reception/escapes",
          icon: <AlertTriangle size={18} />,
        },
        {
          title: "Lock Up",
          href: "/reception/lockup",
          icon: <Lock size={18} />,
        },
        {
          title: "Unlock",
          href: "/reception/unlock",
          icon: <Unlock size={18} />,
        },
        {
          title: "Settings",
          href: "/settings",
          icon: <Settings size={18} />,
        },
      ];
      break;
    case "HEALTH_OFFICER":
      navItems = [
        { title: "Dashboard", href: "/health", icon: <Home size={18} /> },
        { title: "Messaging", href: "/messaging", icon: <MessageSquare size={18} /> },
        {
          title: "Inmate Health",
          href: "/health/inmates",
          icon: <Activity size={18} />,
        },
        {
          title: "OPD Register",
          href: "/health/opd",
          icon: <Stethoscope size={18} />,
        },
        {
          title: "Assessments",
          href: "/health/assessments",
          icon: <FileText size={18} />,
          subItems: [
            { title: "Admission Assessments", href: "/health/assessments/admission" },
            { title: "Discharge Assessments", href: "/health/assessments/discharge" },
          ]
        },
        {
          title: "Mental Health Register",
          href: "/health/mental-health",
          icon: <Brain size={18} />,
        },
        {
          title: "Chronic Patients Register",
          href: "/health/chronic",
          icon: <Heart size={18} />,
        },
        {
          title: "Medicine Inventory",
          href: "/health/inventory",
          icon: <Pill size={18} />,
        },
        {
          title: "Stock Cards",
          href: "/health/stock-cards",
          icon: <ClipboardList size={18} />,
        },
        {
          title: "Medical Equipment & Tools",
          href: "/health/equipment",
          icon: <Wrench size={18} />,
        },
        {
          title: "Settings",
          href: "/settings",
          icon: <Settings size={18} />,
        },
      ];
      break;
    case "STORES_OFFICER":
      navItems = [
        { title: "Dashboard", href: "/stores", icon: <Home size={18} /> },
        { title: "Messaging", href: "/messaging", icon: <MessageSquare size={18} /> },
        {
          title: "Inventory",
          href: "/stores/inventory",
          icon: <Package size={18} />,
        },
        {
          title: "Issues",
          href: "/stores/issues",
          icon: <Warehouse size={18} />,
        },
        {
          title: "Settings",
          href: "/settings",
          icon: <Settings size={18} />,
        },
      ];
      break;
    case "FARMS_OFFICER":
      navItems = [
        { title: "Dashboard", href: "/farms", icon: <Home size={18} /> },
        { title: "Messaging", href: "/messaging", icon: <MessageSquare size={18} /> },
        {
          title: "Projects",
          href: "/farms/projects",
          icon: <Sprout size={18} />,
        },
        {
          title: "Livestock",
          href: "/farms/livestock",
          icon: <Tractor size={18} />,
        },
        {
          title: "Settings",
          href: "/settings",
          icon: <Settings size={18} />,
        },
      ];
      break;
    default:
      navItems = [];
  }

  const sidebarClasses = cn(
    "fixed h-full bg-[#0b4f2a] border-r border-[#063f20] text-white transition-all duration-300 z-20",
    isOpen ? "w-64" : "w-16",
  );

  const sidebarContentClasses = cn(
    "flex flex-col h-full",
    !isOpen && "items-center",
  );

  const dashboardUrl = getDefaultRouteForRole(normalizedRole);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const toggleDropdown = (href: string) => {
    setOpenDropdowns((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  // Keep dropdowns open when navigating inside their base paths or to sub-items
  useEffect(() => {
    const newOpenDropdowns: Record<string, boolean> = { ...openDropdowns };
    if (location.pathname.startsWith('/messaging')) {
      newOpenDropdowns['/messaging'] = true;
    } else {
      newOpenDropdowns['/messaging'] = false;
    }
    
    navItems.forEach(item => {
      if (item.subItems) {
        const isChildActive = item.subItems.some(subItem => 
          location.pathname === subItem.href || location.pathname.startsWith(subItem.href + '/')
        );
        
        if (location.pathname.startsWith(item.href) || isChildActive) {
          newOpenDropdowns[item.href] = true;
        } else {
          newOpenDropdowns[item.href] = false;
        }
      }
    });
    
    setOpenDropdowns(newOpenDropdowns);
  }, [location.pathname]);

  // Poll unread count periodically and update badge
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const res = await messagingApi.getUnreadCount();
      if (!mounted) return;
      if (res && typeof res.data === 'number') setUnreadCount(res.data);
    };

    load();
    const id = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <>
      <div className={sidebarClasses}>
        <div className={sidebarContentClasses}>
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#063f20]">
            {isOpen && (
              <Link to={dashboardUrl} className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white font-bold text-[#0b4f2a] ring-1 ring-[#d7a928]">
                  <Shield size={16} />
                </div>
                <span className="font-semibold text-lg text-white">
                  PrisonMS
                </span>
              </Link>
            )}
            {!isOpen && (
              <div className="w-full flex justify-center">
                <Link to={dashboardUrl} className="flex items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#0b4f2a] ring-1 ring-[#d7a928]">
                    <Shield size={16} />
                  </div>
                </Link>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="text-gray-300 hover:text-white hover:bg-[#063f20]"
            >
              {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </Button>
          </div>
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isMessaging = item.href === '/messaging';
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isDropdown = hasSubItems;
              const isDropdownOpen = openDropdowns[item.href];

              if (isDropdown) {
                return (
                  <div key={item.href}>
                    <button
                      onClick={() => toggleDropdown(item.href)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        "text-gray-300 hover:text-white hover:bg-[#063f20]",
                        location.pathname.startsWith(item.href) &&
                          "border-r-2 border-[#d7a928] bg-[#063f20] text-white",
                        !isOpen && "justify-center px-2",
                      )}
                    >
                      <span className="text-gray-300 relative">{item.icon}
                        {isMessaging && unreadCount > 0 && (
                          <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full">{unreadCount}</span>
                        )}
                      </span>
                      {isOpen && <span className="flex-1 text-left">{item.title}</span>}
                      {isOpen && <ChevronDown size={14} className={cn(isDropdownOpen ? 'transform rotate-180' : '')} />}
                      {isMessaging && unreadCount > 0 && isOpen && (
                        <span className="ml-2 text-xs text-red-600 animate-pulse">●</span>
                      )}
                    </button>

                    {isDropdownOpen && isOpen && (
                      <div className="ml-8 mt-1 space-y-1">
                        {item.subItems?.map((subItem) => (
                          <Link 
                            key={subItem.href} 
                            to={subItem.href} 
                            className={cn(
                              "block px-2 py-1 text-sm rounded transition-colors",
                              location.pathname === subItem.href 
                                ? "bg-[#063f20] font-medium text-white" 
                                : "text-gray-300 hover:bg-[#063f20] hover:text-white"
                            )}
                          >
                            {subItem.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    "text-gray-300 hover:text-white hover:bg-[#063f20]",
                    (location.pathname === item.href || (isMessaging && location.pathname.startsWith(item.href))) &&
                      "border-r-2 border-[#d7a928] bg-[#063f20] text-white",
                    !isOpen && "justify-center px-2",
                  )}
                >
                  <span className="text-gray-300 relative">
                    {item.icon}
                    {isMessaging && unreadCount > 0 && (
                      <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full">{unreadCount}</span>
                    )}
                  </span>
                  {isOpen && <span>{item.title}</span>}
                  {isMessaging && unreadCount > 0 && isOpen && (
                    <span className="ml-2 text-xs text-red-600 animate-pulse">●</span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
      {/* Content spacer - always present */}
      <div
        className={cn(
          isOpen ? "ml-64" : "ml-16",
          "transition-all duration-300",
        )}
      />
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-10 md:hidden"
          onClick={toggleSidebar}
        />
      )}
    </>
  );
};
