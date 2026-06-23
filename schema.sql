-- EventHub CRM - PostgreSQL Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--ROLES & PERMISSIONS
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 2. USERS
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- 3. CONTACTS & ACCOUNTS
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    industry VARCHAR(100) DEFAULT 'Event Management',
    domain VARCHAR(100),
    billing_address TEXT,
    shipping_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_accounts_deleted_at ON accounts(deleted_at) WHERE deleted_at IS NULL;

CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    title VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    social_links JSONB DEFAULT '{}'::jsonb, -- Store links to LinkedIn, Facebook, Instagram, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_contacts_account_id ON contacts(account_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_deleted_at ON contacts(deleted_at) WHERE deleted_at IS NULL;

-- 4. LEAD SOURCE
CREATE TABLE lead_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'Website Form', 'WhatsApp', 'Phone Call', 'Walk-in', 'Referral', 'Social Media', 'Paid Ads', 'Marketplace'
    utm_source VARCHAR(50),
    utm_medium VARCHAR(50),
    utm_campaign VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. LEADS
CREATE TYPE lead_priority_enum AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE lead_stage_enum AS ENUM ('New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost');

CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    
    -- Lead Details (copied/referenced for ease of use or for standalone leads)
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    alternate_number VARCHAR(20),
    company_name VARCHAR(150),
    
    -- Event Specific Fields
    event_type VARCHAR(100) NOT NULL, 
    event_date DATE,
    number_of_guests INTEGER,
    preferred_venue VARCHAR(255),
    budget NUMERIC(15, 2) DEFAULT 0.00,
    city VARCHAR(100),
    state VARCHAR(100),
    
    -- CRM Metadata
    source_id INTEGER NOT NULL REFERENCES lead_sources(id),
    assigned_executive_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    priority lead_priority_enum DEFAULT 'Medium',
    status lead_stage_enum DEFAULT 'New Lead',
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb, 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_leads_contact_id ON leads(contact_id);
CREATE INDEX idx_leads_source_id ON leads(source_id);
CREATE INDEX idx_leads_assigned_executive_id ON leads(assigned_executive_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_event_date ON leads(event_date);
CREATE INDEX idx_leads_deleted_at ON leads(deleted_at) WHERE deleted_at IS NULL;

-- 6. LEAD SCORING SYSTEM
CREATE TYPE lead_score_category_enum AS ENUM ('Cold', 'Warm', 'Hot');

CREATE TABLE lead_scores (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER UNIQUE NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    budget_score INTEGER DEFAULT 0,          -- Calculated score on event budget
    proximity_score INTEGER DEFAULT 0,       -- Date proximity score (closer date = higher priority/score)
    engagement_score INTEGER DEFAULT 0,      -- Based on responses, messages, website visits
    followups_score INTEGER DEFAULT 0,       -- Active and completed followups ratio
    response_time_score INTEGER DEFAULT 0,   -- Time to respond to initial enquiry
    event_type_value_score INTEGER DEFAULT 0,-- High margin event types score
    total_score INTEGER DEFAULT 0,           -- Combined score
    lead_category lead_score_category_enum DEFAULT 'Cold', -- Cold, Warm, Hot
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lead_scores_lead_id ON lead_scores(lead_id);
CREATE INDEX idx_lead_scores_total_score ON lead_scores(total_score);

-- 7. LEAD ACTIVITIES & NOTES
CREATE TABLE lead_activities (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- e.g., 'Call', 'Email', 'WhatsApp', 'Meeting', 'Note', 'Task', 'Status Change'
    description TEXT NOT NULL,
    performed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    activity_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX idx_lead_activities_date ON lead_activities(activity_date);

CREATE TABLE lead_notes (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    note_content TEXT NOT NULL,
    created_by_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX idx_lead_notes_deleted_at ON lead_notes(deleted_at) WHERE deleted_at IS NULL;


-- 8. FOLLOW-UPS & MEETINGS
CREATE TYPE followup_status_enum AS ENUM ('Pending', 'Completed', 'Missed', 'Rescheduled');
CREATE TYPE followup_type_enum AS ENUM ('Call', 'WhatsApp', 'Email', 'Meeting');

CREATE TABLE followups (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status followup_status_enum DEFAULT 'Pending',
    follow_up_type followup_type_enum DEFAULT 'Call',
    notes TEXT,
    recurrence_rule VARCHAR(100), -- For recurring tasks/reminders (e.g., FREQ=DAILY;INTERVAL=1)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_followups_lead_id ON followups(lead_id);
CREATE INDEX idx_followups_assigned_to ON followups(assigned_to_id);
CREATE INDEX idx_followups_status ON followups(status);
CREATE INDEX idx_followups_scheduled_at ON followups(scheduled_at);

CREATE TYPE meeting_status_enum AS ENUM ('Scheduled', 'Cancelled', 'Completed');

CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(255), -- Online URL or physical venue
    host_id INTEGER NOT NULL REFERENCES users(id),
    status meeting_status_enum DEFAULT 'Scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meetings_lead_id ON meetings(lead_id);
CREATE INDEX idx_meetings_start_time ON meetings(start_time);


-- 9. TASKS & COMMENTS
CREATE TYPE task_priority_enum AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE task_status_enum AS ENUM ('To Do', 'In Progress', 'Completed');

CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    priority task_priority_enum DEFAULT 'Medium',
    status task_status_enum DEFAULT 'To Do',
    assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NULL;

CREATE TABLE task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_by_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);

-- 10. QUOTATIONS
CREATE TYPE quotation_status_enum AS ENUM ('Draft', 'Sent', 'Approved', 'Rejected', 'Expired');

CREATE TABLE quotations (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    quotation_number VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'QT-2026-0001'
    version INTEGER DEFAULT 1,
    total_amount NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) DEFAULT 0.00,
    net_amount NUMERIC(15, 2) DEFAULT 0.00,
    tax_amount NUMERIC(15, 2) DEFAULT 0.00,
    items JSONB NOT NULL DEFAULT '[]'::jsonb, 
    status quotation_status_enum DEFAULT 'Draft',
    created_by_id INTEGER NOT NULL REFERENCES users(id),
    approved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    valid_until DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_quotations_lead_id ON quotations(lead_id);
CREATE INDEX idx_quotations_number ON quotations(quotation_number);
CREATE INDEX idx_quotations_deleted_at ON quotations(deleted_at) WHERE deleted_at IS NULL;


-- 11. NOTIFICATIONS
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- e.g., 'NEW_LEAD', 'FOLLOWUP_DUE', 'MEETING_REMINDER', 'LEAD_WON', 'QUOTATION_SENT'
    is_read BOOLEAN DEFAULT FALSE,
    reference_id INTEGER, -- e.g., lead_id or followup_id
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = FALSE;

-- 12. AUDIT LOGS

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'CREATE_LEAD', 'UPDATE_LEAD_STAGE', 'GENERATE_QUOTATION'
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);



CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';


CREATE TRIGGER update_roles_modtime BEFORE UPDATE ON roles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_permissions_modtime BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_accounts_modtime BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_contacts_modtime BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_lead_sources_modtime BEFORE UPDATE ON lead_sources FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_leads_modtime BEFORE UPDATE ON leads FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_lead_notes_modtime BEFORE UPDATE ON lead_notes FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_followups_modtime BEFORE UPDATE ON followups FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_meetings_modtime BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_tasks_modtime BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_quotations_modtime BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
