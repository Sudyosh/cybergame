-- =====================================================
-- MUT Secure Vault - Seed Data
-- CTF Game Initial Data
-- =====================================================

-- =====================================================
-- University Reference Data (SUT)
-- =====================================================

INSERT OR REPLACE INTO university_data (key, value, hint_for) VALUES
('university_name_en', 'Suranaree University of Technology', 'general'),
('university_name_th', 'มหาวิทยาลัยเทคโนโลยีสุรนารี', 'general'),
('year_established', '1990', 'dh_prime_hint'),
('campus_location_en', 'Nakhon Ratchasima', 'location_auth'),
('campus_location_th', 'นครราชสีมา', 'location_auth'),
('postal_code', '30000', 'pin_auth'),
('province_code', 'TH-30', 'location_auth'),
('coordinates_lat', '14.8820', 'geolocation'),
('coordinates_lon', '102.0204', 'geolocation'),
('country_en', 'Thailand', 'location_auth'),
('country_th', 'ประเทศไทย', 'location_auth');

-- =====================================================
-- Roles (RBAC)
-- =====================================================

INSERT OR REPLACE INTO roles (id, name, security_level, description) VALUES
(1, 'Student', 1, 'Basic access to public resources only'),
(2, 'Researcher', 2, 'Access to confidential research data'),
(3, 'Admin', 3, 'Access to secret administrative files'),
(4, 'Director', 4, 'Top secret clearance - full access');

-- =====================================================
-- Permissions
-- =====================================================

INSERT OR REPLACE INTO permissions (id, name, description) VALUES
(1, 'read', 'View resource content'),
(2, 'write', 'Modify resource content'),
(3, 'execute', 'Execute scripts or programs'),
(4, 'delete', 'Remove resources'),
(5, 'delegate', 'Delegate access to others');

-- =====================================================
-- Role-Permission Mapping
-- =====================================================

-- Student permissions
INSERT OR REPLACE INTO role_permissions (role_id, permission_id) VALUES
(1, 1);  -- read only

-- Researcher permissions
INSERT OR REPLACE INTO role_permissions (role_id, permission_id) VALUES
(2, 1),  -- read
(2, 2),  -- write
(2, 5);  -- delegate

-- Admin permissions
INSERT OR REPLACE INTO role_permissions (role_id, permission_id) VALUES
(3, 1),  -- read
(3, 2),  -- write
(3, 3),  -- execute
(3, 5);  -- delegate

-- Director permissions (all)
INSERT OR REPLACE INTO role_permissions (role_id, permission_id) VALUES
(4, 1),  -- read
(4, 2),  -- write
(4, 3),  -- execute
(4, 4),  -- delete
(4, 5);  -- delegate

-- =====================================================
-- Resources (Files)
-- =====================================================

-- Public resources (Level 1)
INSERT OR REPLACE INTO resources (id, name, path, content, security_classification, department) VALUES
(1, 'welcome.txt', '/vault/public/welcome.txt',
'WELCOME TO MUT SECURE VAULT
============================

You have entered the classified research protection system.
As a Student, you have limited access.

To gain higher clearance, you must prove yourself worthy.

Hint: The delegation system allows Researchers to share access...
But perhaps it shares more than intended?

Current Security Level: PUBLIC

- MUT Secure Vault System', 1, 'general'),

(2, 'university_history.txt', '/vault/public/university_history.txt',
'SURANAREE UNIVERSITY OF TECHNOLOGY
===================================

Established: 1990
Location: Nakhon Ratchasima, Thailand
Postal Code: 30000

The university was founded to advance science and technology
in the northeastern region of Thailand.

Coordinates: 14.8820°N, 102.0204°E

Remember these numbers... they may be useful later.', 1, 'general'),

(3, 'system_info.txt', '/vault/public/system_info.txt',
'SYSTEM INFORMATION
==================

Access Control Model: Multi-Level Security (Bell-LaPadula)
- No Read Up: Cannot read higher classification
- No Write Down: Cannot write to lower classification

Roles:
- Student (Level 1 - Public)
- Researcher (Level 2 - Confidential)
- Admin (Level 3 - Secret)
- Director (Level 4 - Top Secret)

Maintenance Window: 02:00 - 03:00
During maintenance, certain restrictions may be relaxed...

Note: The X-System-Time header is used for testing purposes.', 1, 'IT');

-- Confidential resources (Level 2)
INSERT OR REPLACE INTO resources (id, name, path, content, security_classification, department) VALUES
(4, 'project_alpha.txt', '/vault/research/project_alpha.txt',
'PROJECT ALPHA - CONFIDENTIAL
=============================

Research Status: In Progress
Lead Researcher: Dr. Suranaree

This project explores advanced cryptographic techniques
for protecting sensitive university data.

Key findings:
- AES-256 provides strong symmetric encryption
- RSA-2048 is suitable for digital signatures
- Diffie-Hellman enables secure key exchange

Note: Researchers with clearance_training=complete
can access admin-level resources for collaboration.', 2, 'research'),

(5, 'findings.txt', '/vault/research/findings.txt',
'RESEARCH FINDINGS - CONFIDENTIAL
=================================

Our analysis shows that attribute-based access control
can be powerful but dangerous if misconfigured.

WARNING: The attribute update endpoint at:
POST /api/c3/attributes

Does not properly validate the caller role.
Any authenticated user can modify their own attributes.

This should be fixed in the next release.

Recommended fix: Add role verification before attribute modification.', 2, 'research');

-- Secret resources (Level 3)
INSERT OR REPLACE INTO resources (id, name, path, content, security_classification, department) VALUES
(6, 'user_audit.txt', '/vault/admin/user_audit.txt',
'USER AUDIT LOG - SECRET
========================

Recent suspicious activities:
- Multiple failed PIN attempts from various IPs
- Unusual attribute modification requests
- Access attempts during maintenance window

Security Notice:
The declassification endpoint at POST /api/c3/declassify
accepts a "requester_role" parameter in the request body.

BUG: This parameter is trusted without verification!
A user could claim to be a Director without actually being one.

Priority: HIGH - Fix immediately!', 3, 'security'),

(7, 'system_config.txt', '/vault/admin/system_config.txt',
'SYSTEM CONFIGURATION - SECRET
==============================

Maintenance Mode Settings:
- Window: 02:00 - 03:00 (server time)
- During maintenance, Top Secret files are accessible
- Time check uses X-System-Time header if present

VULNERABILITY NOTICE:
The X-System-Time header is trusted without validation.
An attacker could set this header to "02:30" to bypass
time-based access restrictions.

This is a known issue for testing purposes.

Production systems should NEVER trust client-provided time.', 3, 'IT');

-- Top Secret resources (Level 4)
INSERT OR REPLACE INTO resources (id, name, path, content, security_classification, department) VALUES
(8, 'FINAL_FLAG.txt', '/vault/classified/FINAL_FLAG.txt',
'TOP SECRET - DIRECTOR EYES ONLY
================================

Congratulations, Agent.

You have successfully navigated through:
1. The Encrypted Legacy (Cryptography)
2. The Guardian Gauntlet (Authentication)
3. The Hierarchy of Secrets (Authorization)

You have proven your mastery of:
- Diffie-Hellman Key Exchange
- AES-256 Symmetric Encryption
- RSA-2048 Digital Signatures
- SHA-256 Hashing
- Multi-Factor Authentication
- Access Control Exploitation

The FINAL FLAG will be generated upon accessing this file
through proper authentication at:

POST /api/c3/submit-flag

Include your session token to receive your unique flag.

Welcome to the inner circle of MUT Secure Vault.

- The Founders, 1990', 4, 'classified');

-- =====================================================
-- Access Control Matrix
-- =====================================================

-- Student access (Role 1)
INSERT OR REPLACE INTO access_control_matrix (role_id, resource_id, can_read, can_write, can_execute, can_delete) VALUES
(1, 1, 1, 0, 0, 0),  -- welcome.txt
(1, 2, 1, 0, 0, 0),  -- university_history.txt
(1, 3, 1, 0, 0, 0);  -- system_info.txt

-- Researcher access (Role 2)
INSERT OR REPLACE INTO access_control_matrix (role_id, resource_id, can_read, can_write, can_execute, can_delete) VALUES
(2, 1, 1, 0, 0, 0),  -- welcome.txt
(2, 2, 1, 0, 0, 0),  -- university_history.txt
(2, 3, 1, 0, 0, 0),  -- system_info.txt
(2, 4, 1, 1, 0, 0),  -- project_alpha.txt
(2, 5, 1, 1, 0, 0);  -- findings.txt

-- Admin access (Role 3)
INSERT OR REPLACE INTO access_control_matrix (role_id, resource_id, can_read, can_write, can_execute, can_delete) VALUES
(3, 1, 1, 1, 0, 0),  -- welcome.txt
(3, 2, 1, 1, 0, 0),  -- university_history.txt
(3, 3, 1, 1, 1, 0),  -- system_info.txt
(3, 4, 1, 1, 0, 0),  -- project_alpha.txt
(3, 5, 1, 1, 0, 0),  -- findings.txt
(3, 6, 1, 1, 0, 0),  -- user_audit.txt
(3, 7, 1, 1, 1, 0);  -- system_config.txt

-- Director access (Role 4) - Full access to everything
INSERT OR REPLACE INTO access_control_matrix (role_id, resource_id, can_read, can_write, can_execute, can_delete) VALUES
(4, 1, 1, 1, 1, 1),
(4, 2, 1, 1, 1, 1),
(4, 3, 1, 1, 1, 1),
(4, 4, 1, 1, 1, 1),
(4, 5, 1, 1, 1, 1),
(4, 6, 1, 1, 1, 1),
(4, 7, 1, 1, 1, 1),
(4, 8, 1, 1, 1, 1);  -- FINAL_FLAG.txt

-- =====================================================
-- Access Rules (Rule-Based)
-- =====================================================

INSERT OR REPLACE INTO access_rules (id, rule_name, condition_expression, action, priority, active) VALUES
(1, 'maintenance_window', '{"time_range": {"start": "02:00", "end": "03:00"}}', 'ALLOW_TOP_SECRET', 100, 1),
(2, 'clearance_training', '{"attribute": "clearance_training", "value": "complete"}', 'ELEVATE_TO_ADMIN', 50, 1),
(3, 'weekday_only', '{"day_type": "weekday"}', 'ALLOW', 10, 1),
(4, 'delegation_request', '{"action": "delegate", "from_role": "Researcher"}', 'ALLOW_DELEGATION', 60, 1);
