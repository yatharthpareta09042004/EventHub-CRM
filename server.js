const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8085;

app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(__dirname));

// ============================================================================
// API ENDPOINTS
// ============================================================================

// 1. USERS & ROLES
app.get('/api/users', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.full_name as name, r.name as role, 
              SUBSTRING(u.full_name FROM '^[A-Za-z]') || SUBSTRING(u.full_name FROM ' [A-Za-z]') as avatar
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.deleted_at IS NULL 
       ORDER BY u.id`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// 2. LEADS PIPELINE
app.get('/api/leads', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT l.id, l.full_name as "fullName", l.email, l.mobile_number as "mobileNumber", 
              COALESCE(l.alternate_number, '') as "alternateNumber", COALESCE(l.company_name, '') as "companyName", 
              l.event_type as "eventType", to_char(l.event_date, 'YYYY-MM-DD') as "eventDate", 
              l.number_of_guests as "numberOfGuests", COALESCE(l.preferred_venue, '') as "preferredVenue", 
              l.budget, l.city, l.state, s.name as source, u.full_name as "assignedExecutive", 
              l.priority, l.status as stage, COALESCE(l.notes, '') as notes, l.created_at as "createdAt"
       FROM leads l
       LEFT JOIN lead_sources s ON l.source_id = s.id
       LEFT JOIN users u ON l.assigned_executive_id = u.id
       WHERE l.deleted_at IS NULL
       ORDER BY l.created_at DESC`
    );

    // Format fields correctly
    const formatted = result.rows.map(row => ({
      ...row,
      budget: parseFloat(row.budget) || 0,
      numberOfGuests: parseInt(row.numberOfGuests) || 0
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// Create Lead
app.post('/api/leads', async (req, res, next) => {
  try {
    const body = req.body;

    // Required fields validation
    if (!body.fullName || !body.email || !body.mobileNumber || !body.eventType || !body.eventDate || !body.budget) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Resolve source_id
    let sourceId = 1;
    const sourceRes = await db.query('SELECT id FROM lead_sources WHERE name = $1', [body.source]);
    if (sourceRes.rows.length > 0) sourceId = sourceRes.rows[0].id;

    // Resolve assigned_executive_id
    let execId = null;
    const execRes = await db.query('SELECT id FROM users WHERE full_name = $1', [body.assignedExecutive]);
    if (execRes.rows.length > 0) execId = execRes.rows[0].id;

    // Split name for contact table
    const names = body.fullName.split(' ');
    const firstName = names[0];
    const lastName = names.slice(1).join(' ') || '';

    // Create a contact
    const contactRes = await db.query(
      'INSERT INTO contacts (first_name, last_name, email, phone, city, state) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [firstName, lastName, body.email, body.mobileNumber, body.city || '', body.state || 'WA']
    );
    const contactId = contactRes.rows[0].id;

    // Insert lead
    const result = await db.query(
      `INSERT INTO leads (
        full_name, email, mobile_number, alternate_number, company_name, 
        event_type, event_date, number_of_guests, preferred_venue, budget, city, state, 
        source_id, assigned_executive_id, priority, status, notes, contact_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
      [
        body.fullName, body.email, body.mobileNumber, body.alternateNumber || '', body.companyName || 'Private Client',
        body.eventType, body.eventDate, parseInt(body.numberOfGuests) || 0, body.preferredVenue || '', 
        parseFloat(body.budget) || 0, body.city || '', body.state || 'WA',
        sourceId, execId, body.priority || 'Medium', body.stage || 'New Lead', body.notes || '', contactId
      ]
    );

    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// Update Lead
app.put('/api/leads/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    // Check if lead exists
    const leadCheck = await db.query('SELECT id, contact_id FROM leads WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Resolve source_id
    let sourceId = 1;
    if (body.source) {
      const sourceRes = await db.query('SELECT id FROM lead_sources WHERE name = $1', [body.source]);
      if (sourceRes.rows.length > 0) sourceId = sourceRes.rows[0].id;
    }

    // Resolve assigned_executive_id
    let execId = null;
    if (body.assignedExecutive) {
      const execRes = await db.query('SELECT id FROM users WHERE full_name = $1', [body.assignedExecutive]);
      if (execRes.rows.length > 0) execId = execRes.rows[0].id;
    }

    // Update lead
    await db.query(
      `UPDATE leads 
       SET full_name = $1, email = $2, mobile_number = $3, alternate_number = $4, company_name = $5,
           event_type = $6, event_date = $7, number_of_guests = $8, preferred_venue = $9, budget = $10,
           city = $11, state = $12, source_id = $13, assigned_executive_id = $14, priority = $15, 
           status = $16, notes = $17
       WHERE id = $18`,
      [
        body.fullName, body.email, body.mobileNumber, body.alternateNumber || '', body.companyName || 'Private Client',
        body.eventType, body.eventDate, parseInt(body.numberOfGuests) || 0, body.preferredVenue || '',
        parseFloat(body.budget) || 0, body.city || '', body.state || 'WA',
        sourceId, execId, body.priority || 'Medium', body.stage || 'New Lead', body.notes || '',
        id
      ]
    );

    // Sync corresponding Contact details
    const contactId = leadCheck.rows[0].contact_id;
    if (contactId) {
      const names = body.fullName.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || '';
      await db.query(
        'UPDATE contacts SET first_name = $1, last_name = $2, email = $3, phone = $4, city = $5, state = $6 WHERE id = $7',
        [firstName, lastName, body.email, body.mobileNumber, body.city || '', body.state || 'WA', contactId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Soft Delete Lead
app.delete('/api/leads/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await db.query('UPDATE leads SET deleted_at = NOW() WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 3. LEAD ACTIVITIES
app.get('/api/activities', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.lead_id as "leadId", a.activity_type as type, a.description, 
              COALESCE(u.full_name, l.full_name) as actor, a.activity_date as date
       FROM lead_activities a
       JOIN leads l ON a.lead_id = l.id
       LEFT JOIN users u ON a.performed_by_id = u.id
       ORDER BY a.activity_date ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/activities', async (req, res, next) => {
  try {
    const body = req.body;
    if (!body.leadId || !body.type || !body.description || !body.actor) {
      return res.status(400).json({ error: 'Missing required activity fields' });
    }

    // Resolve performed_by_id (if actor is user, get id. Otherwise null represents Client)
    const userRes = await db.query('SELECT id FROM users WHERE full_name = $1', [body.actor]);
    const performedById = userRes.rows.length > 0 ? userRes.rows[0].id : null;

    const result = await db.query(
      'INSERT INTO lead_activities (lead_id, activity_type, description, performed_by_id, activity_date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [body.leadId, body.type, body.description, performedById, body.date || new Date()]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// 4. TASKS KANBAN
app.get('/api/tasks', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT t.id, t.lead_id as "leadId", t.title, COALESCE(t.description, '') as desc, 
              t.priority, t.status, u.full_name as owner
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to_id = u.id
       WHERE t.deleted_at IS NULL
       ORDER BY t.id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/tasks', async (req, res, next) => {
  try {
    const body = req.body;
    let ownerId = null;
    if (body.owner) {
      const userRes = await db.query('SELECT id FROM users WHERE full_name = $1', [body.owner]);
      if (userRes.rows.length > 0) ownerId = userRes.rows[0].id;
    }

    const result = await db.query(
      'INSERT INTO tasks (lead_id, title, description, priority, status, assigned_to_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [body.leadId, body.title, body.desc, body.priority || 'Medium', body.status || 'To Do', ownerId]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

app.put('/api/tasks/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    let ownerId = null;
    if (body.owner) {
      const userRes = await db.query('SELECT id FROM users WHERE full_name = $1', [body.owner]);
      if (userRes.rows.length > 0) ownerId = userRes.rows[0].id;
    }

    await db.query(
      `UPDATE tasks 
       SET title = COALESCE($1, title), description = COALESCE($2, description), 
           priority = COALESCE($3, priority), status = COALESCE($4, status), 
           assigned_to_id = COALESCE($5, assigned_to_id)
       WHERE id = $6`,
      [body.title, body.desc, body.priority, body.status, ownerId, id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 5. FOLLOWUPS
app.get('/api/followups', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT f.id, f.lead_id as "leadId", f.title, f.follow_up_type as type, 
              f.scheduled_at as date, f.status, u.full_name as owner
       FROM followups f
       LEFT JOIN users u ON f.assigned_to_id = u.id
       ORDER BY f.scheduled_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/followups', async (req, res, next) => {
  try {
    const body = req.body;
    let ownerId = null;
    if (body.owner) {
      const userRes = await db.query('SELECT id FROM users WHERE full_name = $1', [body.owner]);
      if (userRes.rows.length > 0) ownerId = userRes.rows[0].id;
    }

    const result = await db.query(
      'INSERT INTO followups (lead_id, title, follow_up_type, scheduled_at, status, assigned_to_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [body.leadId, body.title, body.type, body.date, body.status || 'Pending', ownerId]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

app.put('/api/followups/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    let ownerId = null;
    if (body.owner) {
      const userRes = await db.query('SELECT id FROM users WHERE full_name = $1', [body.owner]);
      if (userRes.rows.length > 0) ownerId = userRes.rows[0].id;
    }

    await db.query(
      `UPDATE followups 
       SET title = COALESCE($1, title), follow_up_type = COALESCE($2, follow_up_type), 
           scheduled_at = COALESCE($3, scheduled_at), status = COALESCE($4, status), 
           assigned_to_id = COALESCE($5, assigned_to_id)
       WHERE id = $6`,
      [body.title, body.type, body.date, body.status, ownerId, id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 6. QUOTATIONS
app.get('/api/quotations', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT q.id, q.lead_id as "leadId", q.quotation_number as number, 
              q.total_amount as "totalAmount", q.discount_amount as discount, 
              q.tax_amount as tax, q.net_amount as "netAmount", q.status, 
              to_char(q.valid_until, 'YYYY-MM-DD') as "validUntil", q.items
       FROM quotations q
       WHERE q.deleted_at IS NULL
       ORDER BY q.id ASC`
    );
    const formatted = result.rows.map(row => ({
      ...row,
      totalAmount: parseFloat(row.totalAmount) || 0,
      discount: parseFloat(row.discount) || 0,
      tax: parseFloat(row.tax) || 0,
      netAmount: parseFloat(row.netAmount) || 0,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items
    }));
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

app.post('/api/quotations', async (req, res, next) => {
  try {
    const body = req.body;
    if (!body.leadId || !body.number || !body.totalAmount || !body.netAmount || !body.items) {
      return res.status(400).json({ error: 'Missing required quotation fields' });
    }

    // Default to Super Admin (id 1) for mockup simplicity, or try current role switcher mapping
    const result = await db.query(
      `INSERT INTO quotations (
        lead_id, quotation_number, total_amount, discount_amount, tax_amount, net_amount, status, valid_until, items, created_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        body.leadId, body.number, parseFloat(body.totalAmount), parseFloat(body.discount) || 0, 
        parseFloat(body.tax) || 0, parseFloat(body.netAmount), body.status || 'Sent', body.validUntil || null,
        JSON.stringify(body.items), 1
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// 7. SYSTEM NOTIFICATIONS
app.get('/api/notifications', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, title, message, notification_type as type, is_read as read, created_at as date 
       FROM notifications 
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/notifications', async (req, res, next) => {
  try {
    const body = req.body;
    const result = await db.query(
      `INSERT INTO notifications (user_id, title, message, notification_type, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
      [1, body.title, body.message, body.type, body.read || false]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// Mark notification as read
app.post('/api/notifications/read/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await db.query('UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Clear all notifications
app.delete('/api/notifications', async (req, res, next) => {
  try {
    await db.query('DELETE FROM notifications');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 8. AUDIT LOGS
app.get('/api/auditlogs', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, action, table_name as "tableName", record_id as "recordId", 
              old_values as "oldValues", new_values as "newValues", 
              ip_address as "ipAddress", created_at as "createdAt"
       FROM audit_logs
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/auditlogs', async (req, res, next) => {
  try {
    const body = req.body;
    const result = await db.query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
      [
        body.userId || 1, body.action, body.tableName, body.recordId, 
        JSON.stringify(body.oldValues || {}), JSON.stringify(body.newValues || {}), 
        body.ipAddress || '127.0.0.1'
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ============================================================================
// START SERVER WITH SEED CHECK
// ============================================================================
app.listen(PORT, async () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  try {
    await db.seedDatabase();
  } catch (seedError) {
    console.error('Database seeding failed:', seedError);
  }
});
