const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function query(text, params) {
  return pool.query(text, params);
}

async function seedDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if roles are already populated
    const rolesCheck = await client.query('SELECT count(*) FROM roles');
    if (parseInt(rolesCheck.rows[0].count) > 0) {
      console.log('Database already seeded. Skipping seed process.');
      await client.query('COMMIT');
      return;
    }

    console.log('Database empty. Seeding initial CRM data...');

    // Seed Roles
    const roles = [
      { id: 1, name: 'Super Admin', description: 'Full system access' },
      { id: 2, name: 'Sales Manager', description: 'Manager pipeline' },
      { id: 3, name: 'Sales Executive', description: 'Executive access' }
    ];
    for (const r of roles) {
      await client.query('INSERT INTO roles (id, name, description) VALUES ($1, $2, $3)', [r.id, r.name, r.description]);
    }

    // Seed Permissions
    const permissions = [
      { id: 1, name: 'all_access', description: 'Manage everything' }
    ];
    for (const p of permissions) {
      await client.query('INSERT INTO permissions (id, name, description) VALUES ($1, $2, $3)', [p.id, p.name, p.description]);
      await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [1, p.id]);
    }

    // Seed Users
    const users = [
      { id: 1, role_id: 1, username: 'alexander', email: 'alexander@eventhub.com', password_hash: 'mock_hash', full_name: 'Alexander Wright', phone_number: '+1 (555) 011-2233' },
      { id: 2, role_id: 2, username: 'nisha', email: 'nisha@eventhub.com', password_hash: 'mock_hash', full_name: 'Nisha Patel', phone_number: '+1 (555) 012-3344' },
      { id: 3, role_id: 3, username: 'aarav', email: 'aarav@eventhub.com', password_hash: 'mock_hash', full_name: 'Aarav Mehta', phone_number: '+1 (555) 013-4455' }
    ];
    for (const u of users) {
      await client.query('INSERT INTO users (id, role_id, username, email, password_hash, full_name, phone_number) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
        u.id, u.role_id, u.username, u.email, u.password_hash, u.full_name, u.phone_number
      ]);
    }

    // Seed Lead Sources
    const sources = [
      { id: 1, name: 'Website Form' },
      { id: 2, name: 'WhatsApp' },
      { id: 3, name: 'Phone Call' },
      { id: 4, name: 'Walk-in' },
      { id: 5, name: 'Referral' },
      { id: 6, name: 'Social Media' },
      { id: 7, name: 'Paid Ads' },
      { id: 8, name: 'Marketplace' }
    ];
    for (const s of sources) {
      await client.query('INSERT INTO lead_sources (id, name) VALUES ($1, $2)', [s.id, s.name]);
    }

    // Seed Contacts & Accounts for Leads
    const sampleLeads = [
      {
        id: 101,
        fullName: "Yatharth Pareta",
        email: "yatharth.pareta@bloomweddings.com",
        mobileNumber: "+1 (555) 014-9988",
        alternateNumber: "+1 (555) 014-9989",
        companyName: "Private Client",
        eventType: "Wedding",
        eventDate: "2026-08-15",
        numberOfGuests: 180,
        preferredVenue: "Grand Hill Gardens",
        budget: 65000,
        city: "Seattle",
        state: "WA",
        sourceId: 1, // Website Form
        assignedExecutiveId: 3, // Aarav Mehta
        priority: "High",
        stage: "Qualified",
        notes: "Dreaming of an outdoor glasshouse wedding. Needs high-end floral styling and complete catering plan.",
        createdAt: "2026-06-01T10:00:00.000Z"
      },
      {
        id: 102,
        fullName: "Rohan Malhotra",
        email: "r.malhotra@nexustech.io",
        mobileNumber: "+1 (555) 017-2233",
        alternateNumber: "",
        companyName: "Nexus Technology Solutions",
        eventType: "Product Launch",
        eventDate: "2026-07-20",
        numberOfGuests: 350,
        preferredVenue: "Metropolitan Exhibition Center",
        budget: 120000,
        city: "San Francisco",
        state: "CA",
        sourceId: 7, // Paid Ads
        assignedExecutiveId: 2, // Nisha Patel
        priority: "High",
        stage: "Proposal Sent",
        notes: "Annual major launch event. High tech requirements: LED walls, premium acoustics, futuristic branding elements.",
        createdAt: "2026-06-05T14:30:00.000Z"
      },
      {
        id: 103,
        fullName: "Ananya Sharma",
        email: "ananya@themyscira-charity.org",
        mobileNumber: "+1 (555) 019-5566",
        alternateNumber: "",
        companyName: "Themyscira Foundations",
        eventType: "Corporate Gala",
        eventDate: "2026-09-10",
        numberOfGuests: 220,
        preferredVenue: "Palace Center Ballroom",
        budget: 45000,
        city: "Seattle",
        state: "WA",
        sourceId: 5, // Referral
        assignedExecutiveId: 1, // Alexander Wright
        priority: "Medium",
        stage: "Negotiation",
        notes: "Charity gala to raise funds. Needs auction stages, table settings, and string quartet music bookings.",
        createdAt: "2026-06-08T09:15:00.000Z"
      },
      {
        id: 104,
        fullName: "Kabir Singhania",
        email: "kabir.s@bludhaven-builders.com",
        mobileNumber: "+1 (555) 012-7788",
        alternateNumber: "",
        companyName: "Bludhaven Construction Ltd",
        eventType: "Birthday Party",
        eventDate: "2026-11-05",
        numberOfGuests: 80,
        preferredVenue: "Waterfront Lounge & Terrace",
        budget: 18000,
        city: "Boston",
        state: "MA",
        sourceId: 2, // WhatsApp (corresponds to id 2 in sources list)
        assignedExecutiveId: 3, // Aarav Mehta
        priority: "Low",
        stage: "New Lead",
        notes: "50th Anniversary bash. Casual but elegant. Open bar, tapas-style service, and DJ setup requested.",
        createdAt: "2026-06-12T16:45:00.000Z"
      },
      {
        id: 105,
        fullName: "Priyanka Patel",
        email: "priyanka.p@coalhill.edu",
        mobileNumber: "+1 (555) 015-3344",
        alternateNumber: "",
        companyName: "Coal Hill Academy",
        eventType: "Exhibition",
        eventDate: "2026-06-25",
        numberOfGuests: 150,
        preferredVenue: "North Wing Gallery",
        budget: 9500,
        city: "Seattle",
        state: "WA",
        sourceId: 4, // Walk-in
        assignedExecutiveId: 3, // Aarav Mehta
        priority: "Low",
        stage: "Lost",
        notes: "Art exhibition. Client budget was too tight for full-scale gallery lighting and coordination services.",
        createdAt: "2026-05-20T11:20:00.000Z"
      },
      {
        id: 106,
        fullName: "Devendra Kulkarni",
        email: "devendra@wayneenterprises.com",
        mobileNumber: "+1 (555) 019-9999",
        alternateNumber: "",
        companyName: "Wayne Enterprises",
        eventType: "Corporate Gala",
        eventDate: "2026-12-18",
        numberOfGuests: 500,
        preferredVenue: "Wayne Manor Grand Hall",
        budget: 350000,
        city: "Gotham",
        state: "NY",
        sourceId: 5, // Referral
        assignedExecutiveId: 1, // Alexander Wright
        priority: "High",
        stage: "Won",
        notes: "Annual charity gala. Budget is open-ended. Booking absolute best acts, caterers, and lighting in the city.",
        createdAt: "2026-05-15T08:00:00.000Z"
      }
    ];

    for (const lead of sampleLeads) {
      // Split full name for contact table
      const names = lead.fullName.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || '';

      // Create contact first
      const contactRes = await client.query(
        'INSERT INTO contacts (first_name, last_name, email, phone, city, state) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [firstName, lastName, lead.email, lead.mobileNumber, lead.city, lead.state]
      );
      const contactId = contactRes.rows[0].id;

      // Insert Lead
      await client.query(
        `INSERT INTO leads (
          id, contact_id, full_name, email, mobile_number, alternate_number, company_name, 
          event_type, event_date, number_of_guests, preferred_venue, budget, city, state, 
          source_id, assigned_executive_id, priority, status, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          lead.id, contactId, lead.fullName, lead.email, lead.mobileNumber, lead.alternateNumber, lead.companyName,
          lead.eventType, lead.eventDate, lead.numberOfGuests, lead.preferredVenue, lead.budget, lead.city, lead.state,
          lead.sourceId, lead.assignedExecutiveId, lead.priority, lead.stage, lead.notes, lead.createdAt
        ]
      );
    }

    // Seed Activities
    const sampleActivities = [
      { id: 1, leadId: 101, type: "Call", description: "Discussed catering options. Yatharth prefers Italian menu. Will send quotation.", actorId: 3, date: "2026-06-02T11:00:00.000Z" },
      { id: 2, leadId: 101, type: "Email", description: "Sent visual deck of Grand Hill Gardens setups.", actorId: 3, date: "2026-06-03T15:20:00.000Z" },
      { id: 3, leadId: 102, type: "WhatsApp", description: "Rohan requested urgent quote for LED screens upgrade.", actorId: 2, date: "2026-06-06T10:12:00.000Z" },
      { id: 4, leadId: 102, type: "Call", description: "Clarified staging requirements and acoustics systems details.", actorId: 2, date: "2026-06-07T14:40:00.000Z" },
      { id: 5, leadId: 103, type: "Meeting", description: "F2F meeting at Palace Ballroom. Reviewed timeline milestones.", actorId: 1, date: "2026-06-09T16:00:00.000Z" },
      { id: 6, leadId: 104, type: "Note", description: "Client mentioned they are sensitive to seafood menu items.", actorId: 3, date: "2026-06-13T10:00:00.000Z" },
      { id: 7, leadId: 106, type: "Status Change", description: "Stage advanced to Won after contracts signed.", actorId: 1, date: "2026-06-10T11:00:00.000Z" }
    ];

    for (const act of sampleActivities) {
      await client.query(
        'INSERT INTO lead_activities (id, lead_id, activity_type, description, performed_by_id, activity_date) VALUES ($1, $2, $3, $4, $5, $6)',
        [act.id, act.leadId, act.type, act.description, act.actorId, act.date]
      );
    }

    // Seed Tasks
    const sampleTasks = [
      { id: 1, leadId: 101, title: "Draft custom wedding catering estimate", desc: "Include premium cocktail selection and dessert bar.", priority: "High", status: "In Progress", ownerId: 3 },
      { id: 2, leadId: 102, title: "Book LED wall provider reservation", desc: "Coordinate staging layouts with Metropolitan Expo team.", priority: "High", status: "To Do", ownerId: 2 },
      { id: 3, leadId: 103, title: "Review gala floorplans drafts", desc: "Verify exits capacity and stage sightline layouts.", priority: "Medium", status: "Completed", ownerId: 1 }
    ];
    for (const task of sampleTasks) {
      await client.query(
        'INSERT INTO tasks (id, lead_id, title, description, priority, status, assigned_to_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [task.id, task.leadId, task.title, task.desc, task.priority, task.status, task.ownerId]
      );
    }

    // Seed Followups
    const sampleFollowups = [
      { id: 1, leadId: 101, title: "Follow-up on floral mockups review", type: "WhatsApp", date: "2026-06-18T10:00:00.000Z", status: "Pending", ownerId: 3 },
      { id: 2, leadId: 102, title: "Send revised product launch contract", type: "Email", date: "2026-06-17T15:00:00.000Z", status: "Pending", ownerId: 2 },
      { id: 3, leadId: 103, title: "Call Ananya regarding deposit timeline", type: "Call", date: "2026-06-17T11:30:00.000Z", status: "Pending", ownerId: 1 }
    ];
    for (const f of sampleFollowups) {
      await client.query(
        'INSERT INTO followups (id, lead_id, title, follow_up_type, scheduled_at, status, assigned_to_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [f.id, f.leadId, f.title, f.type, f.date, f.status, f.ownerId]
      );
    }

    // Seed Quotations
    const sampleQuotations = [
      {
        id: 1,
        leadId: 102,
        number: "QT-2026-0001",
        totalAmount: 120000,
        discountAmount: 5000,
        taxAmount: 20700,
        netAmount: 135700,
        status: "Sent",
        validUntil: "2026-07-15",
        items: [{ desc: "Metropolitan Hall Rental & Rigging", qty: 1, rate: 45000 }, { desc: "LED Wall Stage Setup & Acoustics Systems", qty: 1, rate: 70000 }],
        createdBy: 2
      },
      {
        id: 2,
        leadId: 106,
        number: "QT-2026-0002",
        totalAmount: 350000,
        discountAmount: 0,
        taxAmount: 63000,
        netAmount: 413000,
        status: "Approved",
        validUntil: "2026-08-30",
        items: [{ desc: "Full Wayne Manor Catering & Decor", qty: 1, rate: 250000 }, { desc: "Live Orchestral Booking & Performers", qty: 1, rate: 100000 }],
        createdBy: 1
      }
    ];

    for (const q of sampleQuotations) {
      await client.query(
        'INSERT INTO quotations (id, lead_id, quotation_number, total_amount, discount_amount, tax_amount, net_amount, status, valid_until, items, created_by_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [q.id, q.leadId, q.number, q.totalAmount, q.discountAmount, q.taxAmount, q.netAmount, q.status, q.validUntil, JSON.stringify(q.items), q.createdBy]
      );
    }

    // Seed Notifications
    const sampleNotifications = [
      { id: 1, userId: 2, title: "New Lead Assigned", message: "High priority lead Rohan Malhotra has been assigned to Nisha Patel.", type: "NEW_LEAD", read: false, date: "2026-06-17T09:00:00.000Z" },
      { id: 2, userId: 1, title: "Follow-up Overdue", message: "Call Ananya regarding deposit timeline is due in 30 minutes.", type: "FOLLOWUP_DUE", read: false, date: "2026-06-17T10:00:00.000Z" }
    ];

    for (const n of sampleNotifications) {
      await client.query(
        'INSERT INTO notifications (id, user_id, title, message, notification_type, is_read, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [n.id, n.userId, n.title, n.message, n.type, n.read, n.date]
      );
    }

    // Sync serial sequences
    const sequences = [
      'roles_id_seq', 'permissions_id_seq', 'users_id_seq', 'lead_sources_id_seq', 
      'contacts_id_seq', 'leads_id_seq', 'lead_activities_id_seq', 
      'tasks_id_seq', 'followups_id_seq', 'quotations_id_seq', 'notifications_id_seq'
    ];
    for (const seq of sequences) {
      const table = seq.replace('_id_seq', '');
      await client.query(`SELECT setval('${seq}', COALESCE((SELECT MAX(id)+1 FROM ${table}), 1), false)`);
    }

    await client.query('COMMIT');
    console.log('Database seeded successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', e);
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  pool,
  seedDatabase
};
