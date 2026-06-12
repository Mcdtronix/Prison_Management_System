# Phase 1 Data Backfill Strategy Documentation
# ============================================
#
# Overview:
# This document outlines the data migration strategy for Phase 1, transitioning from
# single-level (Station) to three-level (National → Provincial → Station) organizational
# hierarchy while backfilling new ownership fields across all domain models.
#
# Key Principles:
# 1. Non-destructive: All existing data is preserved
# 2. Idempotent: Safe to run multiple times; operations are get_or_create where possible
# 3. Auditable: All changes logged with timestamps and user context
# 4. Reversible: Can be reversed if needed (though not automated)
#
# ============================================================
# EXECUTION SEQUENCE
# ============================================================
#
# Phase 1: Setup Organizational Hierarchy
# ----------------------------------------
# Run: python manage.py setup_org_hierarchy --create-hierarchy
#
# Output:
# - Creates 1 National HQ OrgUnit
# - Creates 10 Provincial OrgUnits (one per province in Zimbabwe)
# - Creates Station OrgUnits for all existing Station records
# - Creates 8 Master Department records (RECEPTION, HEALTH, STORES, FARMS, HR, SECURITY, FINANCE, ADMIN)
# - Creates OrgUnitDepartment mappings at National HQ level
# - Initializes SystemConfig with NATIONAL_HQ reference
#
# Organizational Structure:
#   National Headquarters (NAT_HQ_001)
#   ├── Harare Province (HARARE_PROV)
#   │   ├── Chikurubi Station (CHIKURUBI_STN)
#   │   ├── Kamata Station (KAMATA_STN)
#   │   └── ... (other stations)
#   ├── Bulawayo Province (BULAWAYO_PROV)
#   │   └── ... (stations)
#   └── ... (other provinces)
#
# Phase 2: Backfill Ownership Data
# ---------------------------------
# Run: python manage.py setup_org_hierarchy --backfill-data
#
# Operations:
# 1. Inmate: owner_org_unit ← default_station_org_unit
# 2. Patient: owner_org_unit ← default_station_org_unit
# 3. AdmissionHealthAssessment: owner_org_unit ← default_station_org_unit
# 4. StockReceipt: receiving_org_unit ← default_station_org_unit
# 5. FeedingSession: providing_org_unit & consuming_org_unit ← default_station_org_unit
# 6. FarmProject: owner_org_unit ← default_station_org_unit
# 7. OfficerStationHistory: posting_org_unit ← default_station_org_unit
#
# Post-Backfill State:
# - All historical records point to a default station-level org unit
# - No data loss; all records remain accessible
# - Ownership is now explicit and queryable
# - Supports data isolation via org_unit filtering
#
# Phase 3: Create Initial User Assignments
# ------------------------------------------
# Run: python manage.py setup_org_hierarchy --create-assignments
#
# Operations:
# - For each active Django User without an assignment:
#   - Create UserAssignment record
#   - Bind to default ADMIN_OFFICER role
#   - Bind to default station org_unit
#   - Bind to RECEPTION department
#   - Mark as primary (one per user)
#
# Result:
# - Existing users now have multi-tenant presence
# - Can later create additional UserAssignments for multi-role scenarios
#
# ============================================================
# RUNNING FULL SETUP (Recommended)
# ============================================================
#
# Command: python manage.py setup_org_hierarchy --full-setup
# or simply: python manage.py setup_org_hierarchy
#
# Executes all three phases in sequence with proper error handling.
#
# ============================================================
# VERIFICATION & VALIDATION
# ============================================================
#
# After setup completes, verify:
#
# 1. National HQ exists:
#    SELECT * FROM auth_org_unit WHERE unit_type='NATIONAL_HQ';
#    Expected: 1 row
#
# 2. Provinces exist:
#    SELECT COUNT(*) FROM auth_org_unit WHERE unit_type='PROVINCIAL_HQ' AND parent_id IS NOT NULL;
#    Expected: 10 rows
#
# 3. Stations linked:
#    SELECT COUNT(*) FROM auth_org_unit WHERE unit_type='STATION' AND parent_id IS NOT NULL;
#    Expected: >0 rows (matching number of existing stations)
#
# 4. Ownership fields populated:
#    SELECT COUNT(*) FROM inmate WHERE owner_org_unit_id IS NOT NULL;
#    Expected: COUNT(inmate) (all records should have owner_org_unit)
#
# 5. Departments created:
#    SELECT COUNT(*) FROM auth_department WHERE active=true;
#    Expected: 8 rows
#
# 6. User assignments created (if --create-assignments ran):
#    SELECT COUNT(*) FROM auth_user_assignment WHERE is_primary=true AND is_active=true;
#    Expected: COUNT(User records without existing assignments)
#
# ============================================================
# TROUBLESHOOTING
# ============================================================
#
# Issue: "CommandError: No organization units found"
# Solution: Run with --create-hierarchy first
#
# Issue: Some fields still NULL after backfill
# Reason: Default org unit not found; check OrgUnit table
# Solution: Verify organizational hierarchy was created correctly
#
# Issue: User assignments failed to create
# Reason: Role or Department records missing
# Solution: Run init_rbac command first (python manage.py init_rbac)
#
# Issue: Duplicate key violations
# Reason: Running script multiple times; operations use get_or_create
# Solution: No action needed; duplicates are skipped safely
#
# ============================================================
# ROLLBACK / RESET (DESTRUCTIVE)
# ============================================================
#
# ⚠ WARNING: This operation cannot be undone!
#
# Command: python manage.py setup_org_hierarchy --reset
#
# This will DELETE:
# - All OrgUnit records
# - All Department records
# - All OrgUnitDepartment mappings
# - All UserAssignment records
# - SystemConfig records
#
# Domain model backfilled fields will remain NULL until backfill runs again.
#
# ============================================================
# CUSTOM MAPPING: Station → Province
# ============================================================
#
# Default behavior links all stations to Harare Province.
# To customize, edit setup_org_hierarchy.py Step 3:
#
# STATION_PROVINCE_MAPPING = {
#     'CHIKURUBI': 'HARARE_PROV',
#     'KAMATA': 'HARARE_PROV',
#     'HWANGE': 'MATABELELAND_NORTH_PROV',
#     'BULAWAYO': 'BULAWAYO_PROV',
#     # ... add all mappings
# }
#
# Then modify the loop to:
#    target_province_code = STATION_PROVINCE_MAPPING.get(station.code, 'HARARE_PROV')
#    target_province = OrgUnit.objects.get(code=f'{target_province_code}')
#    station_unit.parent = target_province
#
# ============================================================
# AUDIT TRAIL
# ============================================================
#
# All operations log to Django logging under 'Auth.management.commands.setup_org_hierarchy'
# Monitor with:
#    tail -f logs/django.log | grep setup_org_hierarchy
#
# Each operation records:
# - Number of records created/updated
# - Timestamps via auto_now_add/auto_now fields
# - Created/updated_by references where applicable
#
# ============================================================
# NEXT STEPS (Phase 1 Tasks 6-10)
# ============================================================
#
# After Task 5 (data backfill) completes:
#
# Task 6: Implement middleware (OrgContext, AccessScope, Audit)
#    - Middleware extracts user's org_unit from UserAssignment
#    - Patches request.org_unit for downstream use
#    - Middleware computes data exposure scope based on OrgUnit hierarchy
#
# Task 7: Update ViewSets with org-unit filtering
#    - QuerySets now filtered via org_unit ownership
#    - Prevents global data access
#    - Enforces multi-tenancy isolation
#
# Task 8: Create setup wizard API endpoints
#    - Interactive org hierarchy setup (skip if auto-setup ran)
#    - Department activation/deactivation per org-unit
#    - User management endpoints
#
# Task 9: Update permission classes for multi-tenancy
#    - Permission checks now include org_unit context
#    - Role-based + org-unit-based access control combined
#
# Task 10: Testing & UAT
#    - Integration tests for multi-tenant data isolation
#    - UAT with full organizational hierarchy
#    - Verify data only visible within org-unit scope
#
"""

from django.core.management import execute_from_command_line
from django.conf import settings
import os
import sys


def run_setup():
    """Standalone execution of organizational hierarchy setup"""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
    
    # Execute the management command
    execute_from_command_line(['manage.py', 'setup_org_hierarchy', '--full-setup'])


if __name__ == '__main__':
    run_setup()
