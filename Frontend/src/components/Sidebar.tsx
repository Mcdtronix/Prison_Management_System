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
  Landmark,
  Database,
} from "lucide-react";
import { useEffect, useState } from "react";
import { messagingApi } from '@/lib/api'
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import { getDefaultRouteForRole, normalizeRole } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  userRole: string;
  /** Phone-width drawer state (below md). Controlled by the layout's menu button. */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  subItems?: { title: string; href: string }[];
}

export const Sidebar = ({ userRole, mobileOpen = false, onMobileOpenChange }: SidebarProps) => {
  const location = useLocation();
  // Desktop expand/collapse. Phones use the drawer below instead.
  const [isOpen, setIsOpen] = useState(true);
  const normalizedRole = normalizeRole(userRole);
  const closeMobile = () => onMobileOpenChange?.(false);

  // Close the phone drawer whenever the route changes.
  useEffect(() => {
    closeMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  let navItems: NavItem[] = [];

  switch (normalizedRole) {
    case "HQ_SYS_ADMIN":
    case "SUPER_ADMIN":
      navItems = [
        { title: "Overview", href: "/hq", icon: <Home size={18} /> },
        { title: "Provinces & Stations", href: "/hq/organisation", icon: <Landmark size={18} /> },
        { title: "User Accounts", href: "/hq/users", icon: <Users size={18} /> },
        { title: "Officers", href: "/hq/officers", icon: <UserCheck size={18} /> },
        {
          title: "Roles & Departments",
          href: "/hq/roles",
          icon: <Shield size={18} />,
          subItems: [
            { title: "Roles", href: "/hq/roles" },
            { title: "Departments", href: "/hq/departments" },
          ],
        },
        { title: "Activity & Sign-ins", href: "/hq/activity", icon: <Activity size={18} /> },
        { title: "Storage", href: "/hq/storage", icon: <Database size={18} /> },
        { title: "Messaging", href: "/messaging", icon: <MessageSquare size={18} /> },
        { title: "Settings", href: "/settings", icon: <Settings size={18} /> },
      ];
      break;
    case "PROV_SYS_ADMIN":
    case "STN_SYS_ADMIN":
      // Same console as HQ, limited to their province or station; roles and departments stay with HQ.
      navItems = [
        { title: "Overview", href: "/hq", icon: <Home size={18} /> },
        {
          title: normalizedRole === "STN_SYS_ADMIN" ? "My Station" : "Province & Stations",
          href: "/hq/organisation",
          icon: <Landmark size={18} />,
        },
        { title: "User Accounts", href: "/hq/users", icon: <Users size={18} /> },
        { title: "Officers", href: "/hq/officers", icon: <UserCheck size={18} /> },
        { title: "Activity & Sign-ins", href: "/hq/activity", icon: <Activity size={18} /> },
        { title: "Storage", href: "/hq/storage", icon: <Database size={18} /> },
        { title: "Messaging", href: "/messaging", icon: <MessageSquare size={18} /> },
        { title: "Settings", href: "/settings", icon: <Settings size={18} /> },
      ];
      break;
    case "ADMIN_OFFICER":
      navItems = [
        { title: "Dashboard", href: "/admin", icon: <Home size={18} /> },
        { title: "Messaging", href: "/messaging", icon: <MessageSquare size={18} /> },
        {
          title: "Inmates",
          href: "/admin/inmates",
          icon: <Users size={18} />,
          subItems: [
            { title: "Overview", href: "/admin/inmates" },
            { title: "Reclassification", href: "/reception/reclassification" },
            { title: "Discharges", href: "/admin/inmates/discharges" },
          ]
        },
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
          title: "Report Builder",
          href: "/admin/reports",
          icon: <FileText size={18} />,
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
            { title: "Reclassification", href: "/reception/reclassification" },
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
          title: "Discharges",
          href: "/reception/discharges",
          icon: <LogOut size={18} />,
        },
        {
          title: "Escapes",
          href: "/reception/escapes",
          icon: <AlertTriangle size={18} />,
        },
        {
          title: "Custody",
          href: "/reception/custody",
          icon: <Lock size={18} />,
          subItems: [
            { title: "Station Config", href: "/reception/station-config" },
            { title: "Lockup", href: "/reception/lockup" },
            { title: "Unlock", href: "/reception/unlock" },
            { title: "Lockup History", href: "/reception/lockup-history" },
            { title: "Unlock History", href: "/reception/unlock-history" },
          ],
        },
        {
          title: "Report Builder",
          href: "/reception/reports",
          icon: <FileText size={18} />,
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
          title: "Report Builder",
          href: "/health/reports",
          icon: <FileText size={18} />,
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
          title: "Report Builder",
          href: "/stores/reports",
          icon: <FileText size={18} />,
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
          title: "Report Builder",
          href: "/farms/reports",
          icon: <FileText size={18} />,
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

  const dashboardUrl = getDefaultRouteForRole(normalizedRole);
  const { user } = useAuth();
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

  // Panel contents, shared by the desktop sidebar and the phone drawer.
  // `isOpen` here shadows the desktop state: the drawer always renders expanded.
  const renderPanel = (isOpen: boolean, inDrawer: boolean) => (
        <div className={cn("flex flex-col h-full", !isOpen && "items-center")}>
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#063f20]">
            {isOpen && (
              <Link to={dashboardUrl} onClick={inDrawer ? closeMobile : undefined} className="flex items-center gap-2">
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
                <Link to={dashboardUrl} onClick={inDrawer ? closeMobile : undefined} className="flex items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#0b4f2a] ring-1 ring-[#d7a928]">
                    <Shield size={16} />
                  </div>
                </Link>
              </div>
            )}
            {!inDrawer && <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="text-gray-300 hover:text-white hover:bg-[#063f20]"
            >
              {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </Button>}
          </div>
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {navItems.map((item, index) => {
              const itemKey = item.href || item.title || `nav-${index}`;
              const isMessaging = item.href === '/messaging';
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isDropdown = hasSubItems;
              const isDropdownOpen = openDropdowns[itemKey];

              if (isDropdown) {
                return (
                  <div key={itemKey}>
                    <button
                      onClick={() => toggleDropdown(itemKey)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        "text-gray-300 hover:text-white hover:bg-[#063f20]",
                        item.href && location.pathname.startsWith(item.href) &&
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
                        {item.subItems?.map((subItem, subIndex) => (
                          <Link 
                            key={subItem.href || subItem.title || `sub-${subIndex}`} 
                            to={subItem.href}
                            onClick={inDrawer ? closeMobile : undefined}
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
                  key={itemKey}
                  to={item.href}
                  onClick={inDrawer ? closeMobile : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    "text-gray-300 hover:text-white hover:bg-[#063f20]",
                    (location.pathname === item.href ||
                      (isMessaging && location.pathname.startsWith(item.href)) ||
                      // sub-pages (e.g. /hq/users/12) keep their section highlighted
                      (item.href.split('/').length > 2 && location.pathname.startsWith(item.href + '/'))) &&
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
          
          {/* User Mailbox Address at the bottom */}
          <div className="p-4 border-t border-[#063f20] bg-[#0b4f2a] shrink-0">
            <div className={cn("flex items-center gap-3", !isOpen && "justify-center")}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d7a928] text-[#0b4f2a] font-bold">
                {user?.mailboxAddress ? user.mailboxAddress[0].toUpperCase() : <UserCheck size={16} />}
              </div>
              {isOpen && (
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs text-gray-300 font-medium truncate">Mailbox</span>
                  <span className="text-sm text-white font-semibold truncate" title={user?.mailboxAddress || 'None'}>
                    {user?.mailboxAddress || 'Not Assigned'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
  );

  return (
    <>
      {/* Desktop sidebar (md and up) */}
      <div className={cn(sidebarClasses, "hidden md:block")}>
        {renderPanel(isOpen, false)}
      </div>
      {/* Content spacer for the fixed desktop sidebar */}
      <div
        className={cn(
          "hidden md:block",
          isOpen ? "ml-64" : "ml-16",
          "transition-all duration-300",
        )}
      />
      {/* Phone drawer (below md) */}
      <Sheet open={mobileOpen} onOpenChange={(open) => onMobileOpenChange?.(open)}>
        <SheetContent
          side="left"
          className="md:hidden w-64 max-w-[85vw] p-0 gap-0 bg-[#0b4f2a] border-r border-[#063f20] text-white [&>button]:text-white [&>button]:data-[state=open]:bg-transparent"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {renderPanel(true, true)}
        </SheetContent>
      </Sheet>
    </>
  );
};
