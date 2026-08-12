# Prison Management System (PMS)
## Core Module Documentation: Organizational Messaging System

**Document Version:** 1.0  
**Module Status:** Production-Ready  
**Architecture Theme:** Secure, Closed-Loop, Role-Based  

---

### 1. Executive Summary
The PMS Organizational Messaging System is a secure, internal communications backbone designed specifically for high-security environments. Unlike traditional email systems (which map to individual people) or instant messengers, this system maps communication strictly to **Organizational Roles and Departments**. It guarantees that sensitive communications (e.g., inmate transfer requests, medical clearances) remain securely within the PMS environment and are tied to authoritative departments rather than transient staff members.

---

### 2. The Core Addressing Mechanism

The fundamental innovation of the messaging module is its **Domain-Based Mailbox Addressing Scheme**. 

Every entity in the system is assigned an address formatted as:
`[DEPARTMENT]@[STATION_CODE].pms.local`

**Examples:**
- `RECEPTION@chv-stn.pms.local` (Reception Department at Chikurubi Maximum Prison)
- `HEALTH@nat-hq.pms.local` (Health Directorate at National Headquarters)

**Why this approach?**
1. **Instant Recognition:** A receiver immediately knows the authoritative origin of a message.
2. **Staff Turnover Immunity:** If Officer A is off-duty and Officer B logs into the Reception role, Officer B immediately inherits the Reception mailbox and can continue critical operational threads.
3. **Closed-Loop Security:** The `.pms.local` domain is isolated. The system is physically incapable of receiving spoofed emails from the public internet (like Gmail), completely neutralizing external phishing threats.

---

### 3. Database Architecture (Django Models)

The backend is powered by a highly optimized, normalized relational schema:

#### `Mailbox` Model
- Represents the sender/receiver.
- Tied directly to an `OrgUnitDepartment` (e.g., the intersection of "Chikurubi Prison" and "Reception Department").
- Automatically provisioned during the system's Phase 1 Setup Phase.

#### `Thread` Model
- The central container for a conversation.
- Contains the `subject`, `created_at`, and a critical `last_message_at` timestamp used for high-performance sorting.

#### `Message` Model
- The individual payload. Contains the `body` and a Foreign Key to the sender's `Mailbox` and the parent `Thread`.

#### `ThreadParticipant` Model (The "Unread" Engine)
- A Many-To-Many through table linking a `Mailbox` to a `Thread`.
- **The Magic:** Contains a `last_read_at` timestamp. The system calculates unread status efficiently by checking if the `Thread.last_message_at` is greater than the participant's `last_read_at`.

---

### 4. Backend Request Flow (Django REST Framework)

1. **Authentication & Middleware:** When an officer logs in, `AuthContext` retrieves their station and role. The backend detects this and seamlessly maps their session to the correct `mailbox_address`.
2. **Inbox Querying:** The `ThreadViewSet` filters all threads where the current user's mailbox is a `ThreadParticipant`. It annotates an `is_unread` boolean directly in the SQL query for maximum performance.
3. **Group Messaging:** When a user sends a message to multiple comma-separated addresses, the backend's `create` method automatically looks up all target mailboxes, creates `ThreadParticipant` records for each, and immediately blasts the message into everyone's Inbox.

---

### 5. Frontend Architecture (React / TypeScript)

The frontend was meticulously engineered to mimic a sleek, modern Webmail client, providing zero learning curve for officers.

* **MailLayout & Sidebar:** A minimalist, persistent sidebar with `Folders` and `Others` sections. It features an automatic polling mechanism that queries the `/unread-count/` endpoint every 10 seconds, injecting a subtle, real-time unread badge next to the Inbox icon.
* **Inbox / Outbox Views:** Displays a clean list of threads. It intelligently extracts the first 50 characters of the latest message to provide a helpful preview underneath the bold Subject line. Unread threads are highlighted with distinct typography and a blue indicator dot.
* **The Thread View (Conversation UI):** 
  - Recently completely overhauled to abandon informal "chat bubbles" in favor of a highly professional, full-width single-column email feed.
  - Features structured message headers (Avatar, Sender Name, Recipient List, and precise Timestamps).
  - Contains an integrated, fixed "Reply Card" at the bottom with a sleek dark "Send" button and rich-text formatting placeholders, providing a premium user experience.

---

### 6. Security & Data Integrity Highlights

> [!IMPORTANT]
> **Ghost Message Prevention**
> During development, a complex filtering bug caused threads to disappear from the Inbox if the user replied to them, resulting in "ghost" unread badges. This was permanently resolved by ensuring the `Inbox` query correctly evaluates `ThreadParticipants` rather than simply checking if the user wasn't the sender of the last message.

> [!TIP]
> **No External Routing**
> There is intentionally no SMTP (Simple Mail Transfer Protocol) server attached to this module. It relies strictly on internal Django ORM routing, meaning data never leaves the encrypted PMS database.
