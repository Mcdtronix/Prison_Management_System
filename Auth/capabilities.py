"""Built-in roles, departments and capabilities.

The built-in ("system") roles and departments below are created by a data
migration and protected: they cannot be deleted or renamed. Admins can add
their own roles and departments alongside them.

After a role exists, the `auth_role_capability` table is the source of truth
for what it can do; the lists here are only the starting defaults.

Capability names are `<area>.<action>`. `*` means everything (legacy
SUPER_ADMIN only, and only when held at National HQ).
"""

# ---------------------------------------------------------------- departments

# code: name. IT holds every system administrator.
BUILTIN_DEPARTMENTS = {
    'IT': 'Information Technology',
    'ADMINISTRATION': 'Administration',
    'RECEPTION': 'Reception',
    'HEALTH': 'Health',
    'STORES': 'Stores',
    'SECURITY': 'Security',
    'REHABILITATION': 'Rehabilitation',
    'FARMS': 'Farms',
}

# Older department codes merged into the built-in ones by the migration.
DEPARTMENT_ALIASES = {
    'REC': 'RECEPTION',
    'ADMIN': 'ADMINISTRATION',
    'HQ_SYS_ADMIN': 'IT',
    'PROV_SYS_ADMIN': 'IT',
    'SYS_ADMIN': 'IT',
    'STN_SYS_ADMIN': 'IT',
}

# ---------------------------------------------------------------- capabilities

# Everything a system administrator does: accounts, structure, audit.
# Scope (own unit and below) and the grant rule decide *where* it applies,
# so one list serves all three tiers.
SYSTEM_ADMIN_CAPABILITIES = [
    'users.view', 'users.create', 'users.change', 'users.manage',
    'assignments.manage',
    'admin.create_phq', 'admin.assign_phq_admin', 'admin.manage_phq_departments',
    'admin.create_station', 'admin.assign_station_admin', 'admin.manage_station_departments',
    'admin.assign_roles', 'admin.assign_officer', 'admin.view_created_logs', 'admin.view_password_changes',
    'policies.create', 'policies.view', 'policies.approve', 'policies.revoke',
]

# Only HQ: edits the system-wide lists of roles and departments.
HQ_ONLY_CAPABILITIES = ['roles.manage', 'system.setup']

# ---------------------------------------------------------------- roles

# code: (name, department code, is admin role, assignable at)
BUILTIN_ROLES = {
    'HQ_SYS_ADMIN': ('HQ System Admin', 'IT', True, 'NATIONAL_HQ'),
    'PROV_SYS_ADMIN': ('Provincial System Admin', 'IT', True, 'PROVINCIAL_HQ'),
    'STN_SYS_ADMIN': ('Station System Admin', 'IT', True, 'STATION'),
    'ADMIN_OFFICER': ('Administration Officer', 'ADMINISTRATION', False, None),
    'RECEPTION_OFFICER': ('Reception Officer', 'RECEPTION', False, None),
    'HEALTH_OFFICER': ('Health Officer', 'HEALTH', False, None),
    'STORES_OFFICER': ('Stores Officer', 'STORES', False, None),
    'FARMS_OFFICER': ('Farms Officer', 'FARMS', False, None),
    'SECURITY_OFFICER': ('Security Officer', 'SECURITY', False, None),
    'REHABILITATION_OFFICER': ('Rehabilitation Officer', 'REHABILITATION', False, None),
    'AUDITOR': ('Auditor (read-only)', None, False, None),
}

DEFAULT_ROLE_CAPABILITIES = {
    # Legacy all-powerful role, kept for existing accounts. Not built in.
    'SUPER_ADMIN': ['*'],

    # System administrators (IT): accounts, structure and audit only. No
    # inmate, health or other operational data (plan §2.4).
    'HQ_SYS_ADMIN': SYSTEM_ADMIN_CAPABILITIES + HQ_ONLY_CAPABILITIES,
    'PROV_SYS_ADMIN': list(SYSTEM_ADMIN_CAPABILITIES),
    'STN_SYS_ADMIN': list(SYSTEM_ADMIN_CAPABILITIES),

    # Administration department: runs the station (approvals, cases) and can
    # see every operational module. Account management belongs to IT.
    'ADMIN_OFFICER': [
        'cases.create', 'cases.view', 'cases.change', 'cases.delete', 'cases.manage_exposure',
        'reception.access', 'reception.view', 'reception.approve',
        'health.access', 'stores.access', 'farms.access', 'security.access', 'rehabilitation.access',
        'users.view',
    ],

    'RECEPTION_OFFICER': ['reception.access', 'reception.create', 'reception.view', 'cases.create', 'cases.view'],
    'HEALTH_OFFICER': ['health.access', 'health.create', 'health.view', 'health.change', 'cases.view'],
    'STORES_OFFICER': ['stores.access', 'stores.view', 'stores.create', 'stores.change', 'cases.view'],
    'FARMS_OFFICER': ['farms.access', 'farms.view', 'farms.create', 'farms.change'],
    'SECURITY_OFFICER': ['security.access', 'security.view', 'security.create', 'security.change', 'cases.view'],
    'REHABILITATION_OFFICER': ['rehabilitation.access', 'rehabilitation.view', 'rehabilitation.create',
                               'rehabilitation.change'],
    'HR_OFFICER': ['hr.view', 'hr.create', 'hr.change', 'hr.delete'],

    # Read-only compliance review within the auditor's own scope.
    'AUDITOR': [
        'reception.view', 'health.view', 'stores.view', 'farms.view', 'security.view',
        'rehabilitation.view', 'cases.view', 'users.view', 'policies.view',
        'admin.view_created_logs', 'reports.export',
    ],
}

# Most active holders of a system-admin role allowed at one org unit.
SYSTEM_ADMIN_LIMITS = {
    'PROV_SYS_ADMIN': 2,  # per province
    'STN_SYS_ADMIN': 2,   # per station
}

# The system-admin role created at each unit type from the console.
SYSTEM_ADMIN_ROLE_FOR_UNIT = {
    'PROVINCIAL_HQ': 'PROV_SYS_ADMIN',
    'STATION': 'STN_SYS_ADMIN',
}

# Roles that administer accounts; their tier is the level they are held at.
# SUPER_ADMIN is the legacy equivalent of HQ System Admin.
ADMIN_ROLE_CODES = {code for code, spec in BUILTIN_ROLES.items() if spec[2]} | {'SUPER_ADMIN'}

# Where a role may be assigned. Roles not listed may be assigned anywhere.
ROLE_ASSIGNABLE_AT = {code: spec[3] for code, spec in BUILTIN_ROLES.items() if spec[3]}
ROLE_ASSIGNABLE_AT['SUPER_ADMIN'] = 'NATIONAL_HQ'
