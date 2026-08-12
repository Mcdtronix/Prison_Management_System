# Prison Management System: Operational User Manual

**Version:** 1.0  
**Target Audience:** System Administrators, Officers, and Operational Staff  
**Purpose:** A comprehensive, professional guide on utilizing the Prison Management System (PMS), covering system setup, user management, workflows, and operational protocols.

---

## 1. System Setup and Pilot Program Activation

The deployment of the Prison Management System follows a strict, top-down initialization sequence to maintain the integrity of the 3-tier organizational hierarchy.

### 1.1 The Order of Events (Pilot Program Flow)
1. **System Initialization:** The database begins in an `UNINITIALIZED` state.
2. **National HQ Creation:** The setup wizard establishes the National Headquarters (OrgUnit) and creates the first **National HQ System Admin** (Super Admin).
3. **Provincial Setup:** The National Admin logs in and creates the initial Provincial Command Centers for the pilot regions.
4. **Provincial Admin Provisioning:** The National Admin registers the Provincial Admins for the newly created provinces.
5. **Station Setup:** Provincial Admins log into their respective dashboards and create the physical Prison Stations under their jurisdiction.
6. **Station Admin Provisioning:** Provincial Admins register Station Admins to run the newly created stations.
7. **Officer Onboarding:** Station Admins register departmental staff (Reception, Health, Stores, etc.) to begin daily operations.

### 1.2 The National HQ System Admin
**Role:** `SUPER_ADMIN` / `ADMIN_OFFICER` at National HQ.  
**Responsibilities:**
* **System-wide Governance:** Defines data exposure policies across the entire nation.
* **Provincial Management:** Exclusively responsible for creating `PROVINCIAL_HQ` organizational units and provisioning Provincial Admins.
* **Global Configuration:** Manages system-wide departments, standardizes classification codes, and oversees system audits.
* **Reporting:** Accesses aggregated, system-wide analytics (e.g., national population statistics, overall health metrics). *Note: The National Admin cannot natively view individual inmate records unless explicitly exposed via a Data Exposure Policy.*

---

## 2. Organization and User Management

### 2.1 How to Add a Department
Departments (e.g., Reception, Health, HR) are globally standardized to ensure consistent reporting. 
1. The **National Admin** navigates to `System Configuration > Departments`.
2. Clicks **Add New Department**.
3. Enters the Department Code (e.g., `EDUCATION`), Name (e.g., `Rehabilitation & Education`), and Description.
4. Saves the department, making it available to be activated at any Provincial HQ or Station.

### 2.2 How to Add a Station
Stations are created by the **Provincial Admin** for their specific province.
1. The **Provincial Admin** navigates to `Organization > Stations`.
2. Clicks **Add Station**.
3. Enters the Station Code (e.g., `HRE_CNTRL`), Name (e.g., `Harare Central Prison`), physical location, and selects the parent Province.
4. Clicks **Create**. The station is now active and ready for a Station Admin.

### 2.3 How to Add a Station Admin
1. The **Provincial Admin** navigates to `User Management > Add User`.
2. Enters the Admin's details (Name, Service Number, Email).
3. Selects the `OrgUnit` (the newly created Station).
4. Selects the `Department` (Administration).
5. Selects the `Role` (`ADMIN_OFFICER`).
6. The system automatically generates a temporary password and sends it to the user's email.
**Station Admin Responsibilities:** Overseeing all station operations, onboarding station officers, managing daily operational audits, and requesting data exposures (e.g., escalating an incident to the province).

### 2.4 How to Add an Officer (System User)
Adding an officer follows the same flow as adding an Admin, but is typically performed by the **Station Admin** or an **HR Officer**.
1. Navigate to `User Management > Register Officer`.
2. Enter the Officer's demographic and employment details.
3. Assign them to a specific `Department` (e.g., Health).
4. Assign them a specific `Role` (e.g., `HEALTH_OFFICER`).
5. Complete registration. The officer can now log in and access modules relevant *only* to their department and station.

---

## 3. Operational Roles and Responsibilities

The system enforces strict Role-Based Access Control (RBAC). A user's experience is dictated by their role:

* **Reception Officer:** Station-based. Responsible for inmate admissions, capturing biometrics, recording valuables, and maintaining legal case/offence data.
* **Health Officer:** Station-based. Responsible for the medical wellbeing of inmates. Conducts admission health assessments, logs daily clinical visits, and manages medicinal inventory.
* **HR Officer:** Provincial or Station-based. Manages staff profiles, tracks officer postings/transfers between stations, and manages disciplinary records for staff.
* **Stores Officer:** Station-based. Manages physical inventory, handles stock receipts, allocates equipment to officers, and logs inmate feeding sessions.
* **Farms Officer:** Station-based. Manages agricultural production, logs crop yields, and tracks livestock on prison farms.

---

## 4. Inmate Management Workflows

### 4.1 How to Add an Inmate (Basic Registration)
**Responsible Account:** `RECEPTION_OFFICER`
1. Navigate to `Reception > Inmate Registration`.
2. **Basic Details:** Enter Prison Number, Full Name, DOB, Gender, and capture Biometrics.
3. **Next of Kin:** Enter the emergency contact details, relationship, and physical address.
4. **Classification:** Assign an initial security classification based on preliminary data.
5. **Valuables:** Log any personal belongings (cash, jewelry, phones) surrendered at admission.
6. **Submit:** Generates the core Inmate Profile and an unapproved admission record.

### 4.2 How to Add an Offence (Scenarios)
Immediately following basic registration, the Reception Officer must attach legal charges.
**Scenario A: Remand / Unconvicted**
1. Select the Inmate and click **Add Offence**.
2. Enter the Offence description, Court location, and arresting authority.
3. Since the inmate is unconvicted, the system prompts for a **Next Court Date**.
4. Save the offence. The inmate is classified as 'Remand'.

**Scenario B: Convicted**
1. Select the Inmate and click **Add Offence**.
2. Enter the Offence and Court details.
3. Mark as **Convicted**.
4. The system dynamically alters the form to request: **Sentence Length**, **Sentence Start Date**, **Expected Remission**, and **Restitution Details** (if applicable).
5. If multiple offences exist, repeat the loop. The system will automatically calculate the aggregate **Expected Release Date** based on concurrent or consecutive sentence flags.

### 4.3 How to Perform a Health Assessment
**Responsible Account:** `HEALTH_OFFICER`
1. The Health Officer views the "Pending Admissions" queue on their dashboard.
2. Selects the newly registered inmate to initiate the **Admission Health Screening**.
3. The officer records vital signs (BP, Weight, Temp), logs any chronic illnesses, allergies, and notes physical injuries present upon arrival.
4. Saves the assessment. This generates a permanent `Patient` record linked to the Inmate.

### 4.4 Inmate Admission Approval
**Responsible Account:** `ADMIN_OFFICER` (Station Admin) or Senior Receptionist.
1. The Admin reviews the unified **Admission Dossier**, which aggregates:
   * Basic Registration Data
   * Offence & Legal Data
   * Initial Health Assessment
2. If all data is accurate and compliant, the Admin clicks **Approve Admission**.
3. The inmate's state transitions from `PENDING` to `ACTIVE`. They are officially part of the station's active population.

### 4.5 Inmate Reclassification Workflow
Over time, an inmate's behavior or legal status may change, necessitating a reclassification (e.g., moving from High Risk to Medium Risk).
1. A **Security Officer** or **Reception Officer** navigates to the Inmate's profile and clicks **Propose Reclassification**.
2. Enters the new proposed class and attaches a mandatory justification (e.g., "Good behavior over 24 months").
3. The request is routed to the **Station Admin**.
4. The Admin reviews the justification, checks disciplinary records, and clicks **Approve Reclassification**. The system logs the change in the audit trail.

### 4.6 Discharge of an Inmate
When an inmate reaches their Release Date, or is granted bail/pardon:
1. **Reception Officer** initiates the **Discharge Workflow**.
2. **Health Sign-off:** The Health Officer performs a final medical check and clears the patient.
3. **Valuables Return:** The Stores/Reception officer returns the logged valuables, capturing a digital signature/thumbprint from the inmate.
4. **Final Approval:** The Station Admin reviews the discharge dossier and approves.
5. The inmate's state changes to `DISCHARGED`. The record is archived but remains accessible for historical reporting and audit purposes.
