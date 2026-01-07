-- =====================================================
-- MUT Secure Vault - Database Schema
-- CTF Game for Cybersecurity Education
-- =====================================================

-- Drop existing tables (for reset)
DROP TABLE IF EXISTS flag_submissions;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS access_rules;
DROP TABLE IF EXISTS player_attributes;
DROP TABLE IF EXISTS player_roles;
DROP TABLE IF EXISTS access_control_matrix;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS auth_challenges;
DROP TABLE IF EXISTS crypto_artifacts;
DROP TABLE IF EXISTS game_sessions;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS university_data;

-- =====================================================
-- Core Tables
-- =====================================================

-- Player accounts
CREATE TABLE players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Game sessions
CREATE TABLE game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    session_token VARCHAR(500),
    challenge_1_complete INTEGER DEFAULT 0,
    challenge_2_complete INTEGER DEFAULT 0,
    challenge_3_complete INTEGER DEFAULT 0,
    flag_1 VARCHAR(64),
    flag_2 VARCHAR(64),
    final_flag VARCHAR(64),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- =====================================================
-- Challenge 1: Cryptography
-- =====================================================

CREATE TABLE crypto_artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    dh_prime TEXT,
    dh_generator TEXT,
    dh_server_public TEXT,
    dh_server_private TEXT,
    dh_client_public TEXT,
    dh_shared_secret TEXT,
    aes_iv VARCHAR(64),
    aes_encrypted_data TEXT,
    rsa_public_key TEXT,
    rsa_private_key TEXT,
    rsa_signature TEXT,
    secret_message TEXT,
    artifact_downloaded INTEGER DEFAULT 0,
    exchange_complete INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id)
);

-- =====================================================
-- Challenge 2: Authentication
-- =====================================================

CREATE TABLE auth_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    password_hash VARCHAR(255),
    pin_hash VARCHAR(255),
    otp_secret VARCHAR(64),
    password_verified INTEGER DEFAULT 0,
    pin_verified INTEGER DEFAULT 0,
    otp_verified INTEGER DEFAULT 0,
    mfa_complete INTEGER DEFAULT 0,
    pin_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id)
);

-- =====================================================
-- Challenge 3: Authorization
-- =====================================================

-- Roles (RBAC)
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    security_level INTEGER NOT NULL,
    description TEXT
);

-- Permissions
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

-- Role-Permission mapping
CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

-- Resources/Files
CREATE TABLE resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    path VARCHAR(255) UNIQUE NOT NULL,
    content TEXT,
    security_classification INTEGER NOT NULL,
    department VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Access Control Matrix
CREATE TABLE access_control_matrix (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    resource_id INTEGER NOT NULL,
    can_read INTEGER DEFAULT 0,
    can_write INTEGER DEFAULT 0,
    can_execute INTEGER DEFAULT 0,
    can_delete INTEGER DEFAULT 0,
    UNIQUE(role_id, resource_id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (resource_id) REFERENCES resources(id)
);

-- Player roles assignment
CREATE TABLE player_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Player attributes (ABAC)
CREATE TABLE player_attributes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    attribute_name VARCHAR(50) NOT NULL,
    attribute_value VARCHAR(100) NOT NULL,
    UNIQUE(session_id, attribute_name),
    FOREIGN KEY (session_id) REFERENCES game_sessions(id)
);

-- Rule-based access rules
CREATE TABLE access_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name VARCHAR(100) NOT NULL,
    condition_expression TEXT NOT NULL,
    action VARCHAR(20) NOT NULL,
    priority INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1
);

-- =====================================================
-- Audit & Logging
-- =====================================================

CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    player_id INTEGER,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id),
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Flag submissions
CREATE TABLE flag_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    challenge_number INTEGER NOT NULL,
    submitted_flag VARCHAR(100) NOT NULL,
    is_correct INTEGER NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id)
);

-- =====================================================
-- Reference Data
-- =====================================================

CREATE TABLE university_data (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    hint_for VARCHAR(50)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX idx_sessions_player ON game_sessions(player_id);
CREATE INDEX idx_crypto_session ON crypto_artifacts(session_id);
CREATE INDEX idx_auth_session ON auth_challenges(session_id);
CREATE INDEX idx_player_roles_session ON player_roles(session_id);
CREATE INDEX idx_player_attrs_session ON player_attributes(session_id);
CREATE INDEX idx_audit_session ON audit_log(session_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_flag_submissions_session ON flag_submissions(session_id);
