"""
RBAC (Role-Based Access Control) Models
========================================
Production-grade authentication and authorization system for Prison Management System.

Features:
- Role-based access control
- Station-level data isolation
- User profile management
- Audit-ready design
"""

from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone


# ==================================================
# ROLE MODEL
# ==================================================
class Role(models.Model):
    """
    System roles defining user permissions.
    Each role grants access to specific modules and actions.
    """
    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "auth_role"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"


# ==================================================
# STATION MODEL (Security Boundary)
# ==================================================
class Station(models.Model):
    """
    Prison stations/locations.
    Acts as a security boundary for data isolation.
    Users can only access data from their assigned station.
    """
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True, db_index=True)
    location = models.CharField(max_length=200, blank=True, null=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "auth_station"
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} - {self.name}"


# ==================================================
# USER PROFILE (RBAC Anchor)
# ==================================================
class UserProfile(models.Model):
    """
    Extends Django User with role and station assignment.
    This is the core of RBAC - every user has exactly one role and one station.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="userprofile"
    )
    officer = models.OneToOneField(
        "HumanResources.Officer",
        on_delete=models.PROTECT,
        related_name="system_account",
        blank=True,
        null=True,
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="user_profiles"
    )
    station = models.ForeignKey(
        Station,
        on_delete=models.PROTECT,
        related_name="user_profiles"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_profile"
        indexes = [
            models.Index(fields=["role", "station"]),
            models.Index(fields=["is_active"]),
        ]

    def clean(self):
        if not self.user.is_active and self.is_active:
            raise ValidationError("User profile cannot be active if user is inactive")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        identifier = self.officer.service_number if self.officer else self.user.username
        return f"{identifier} - {self.role.code} @ {self.station.code}"


# ==================================================
# AUDIT LOG MODEL
# ==================================================
class AuditLog(models.Model):
    """
    Comprehensive audit trail for all sensitive actions.
    Required for legal compliance and security monitoring.
    """
    MODULE_CHOICES = [
        ("AUTH", "Authentication"),
        ("INMATES", "Inmates"),
        ("HEALTH", "Health"),
        ("STORES", "Stores"),
        ("FARMS", "Farms"),
        ("HR", "Human Resources"),
        ("RBAC", "Role Management"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="audit_logs"
    )
    role = models.CharField(max_length=50)
    station = models.ForeignKey(
        Station,
        on_delete=models.PROTECT,
        related_name="audit_logs"
    )

    action = models.CharField(max_length=200)
    module = models.CharField(max_length=50, choices=MODULE_CHOICES)
    object_id = models.CharField(max_length=50, blank=True, null=True)
    object_type = models.CharField(max_length=100, blank=True, null=True)

    # Request metadata
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True, null=True)
    request_method = models.CharField(max_length=10, blank=True, null=True)
    request_path = models.CharField(max_length=500, blank=True, null=True)

    # Additional context
    remarks = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_log"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user", "-timestamp"]),
            models.Index(fields=["module", "-timestamp"]),
            models.Index(fields=["station", "-timestamp"]),
            models.Index(fields=["role", "-timestamp"]),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.action} - {self.timestamp}"
