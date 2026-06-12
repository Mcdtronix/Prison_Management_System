from django import forms
from .models import OrgUnit, Department, Role, OrgUnitDepartment
from HumanResources.models import Officer
from django.contrib.auth.models import User


class CreateOrgUnitForm(forms.Form):
    name = forms.CharField(max_length=150)
    code = forms.CharField(max_length=50)
    code_short = forms.CharField(max_length=20)
    unit_type = forms.ChoiceField(choices=OrgUnit.UNIT_TYPES)
    location = forms.CharField(max_length=200, required=False)
    description = forms.CharField(widget=forms.Textarea, required=False)


class CreateAdminUserForm(forms.Form):
    officer = forms.ModelChoiceField(queryset=Officer.objects.filter(current_status='ACTIVE'))
    role = forms.ModelChoiceField(queryset=Role.objects.filter(is_active=True))
    password = forms.CharField(widget=forms.PasswordInput)
    email = forms.EmailField(required=False)
    make_primary = forms.BooleanField(required=False, initial=True)


class CreateDepartmentAccountForm(forms.Form):
    department = forms.ModelChoiceField(queryset=Department.objects.filter(active=True))
    create_user = forms.BooleanField(required=False, initial=True)
    officer = forms.ModelChoiceField(queryset=Officer.objects.filter(current_status='ACTIVE'), required=False)
    role = forms.ModelChoiceField(queryset=Role.objects.filter(is_active=True), required=False)
