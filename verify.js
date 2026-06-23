

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
require('dotenv').config();

console.log('====================================================');
console.log('Starting EventHub CRM comprehensive sanity checks...');
console.log('====================================================\n');

// 1. Verify existence of core files
const files = ['index.html', 'style.css', 'app.js', 'schema.sql', 'server.js', 'db.js', 'package.json'];
let allExist = true;

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`[PASS] File exists: ${file}`);
    } else {
        console.error(`[FAIL] File missing: ${file}`);
        allExist = false;
    }
});

if (!allExist) {
    console.error('\nCore files check failed. Exiting.');
    process.exit(1);
}


const jsFiles = ['app.js', 'server.js', 'db.js'];
jsFiles.forEach(file => {
    try {
        execSync(`node -c "${path.join(__dirname, file)}"`);
        console.log(`[PASS] ${file} syntax is valid.`);
    } catch (err) {
        console.error(`[FAIL] ${file} contains syntax errors:`);
        console.error(err.message);
        process.exit(1);
    }
});


const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
if (htmlContent.includes('style.css') && htmlContent.includes('app.js')) {
    console.log('[PASS] index.html correctly references style.css and app.js.');
} else {
    console.warn('[WARNING] index.html might be missing style.css or app.js script tags.');
}


async function runIntegrationTests() {
    console.log('\n--- Running Backend & DB Integration Tests ---');

    
    const serverProcess = spawn('node', ['server.js'], {
        cwd: __dirname,
        env: { ...process.env, PORT: '8085' }
    });

    serverProcess.stdout.on('data', (data) => {
        const text = data.toString();
        if (text.includes('Server is running') || text.includes('Database seeded')) {
            
            console.log(`[SERVER] ${text.trim()}`);
        }
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`[SERVER ERROR] ${data.toString().trim()}`);
    });

    
    await new Promise(resolve => setTimeout(resolve, 3000));

    let testsFailed = false;

    try {
        
        console.log('Testing GET /api/users...');
        const usersRes = await fetch('http://localhost:8085/api/users');
        if (usersRes.status !== 200) throw new Error(`GET /api/users returned status ${usersRes.status}`);
        const users = await usersRes.json();
        if (!Array.isArray(users) || users.length === 0) throw new Error('GET /api/users did not return expected array');
        console.log(`[PASS] GET /api/users returned ${users.length} users successfully.`);

        
        console.log('Testing GET /api/leads...');
        const leadsRes = await fetch('http://localhost:8085/api/leads');
        if (leadsRes.status !== 200) throw new Error(`GET /api/leads returned status ${leadsRes.status}`);
        const leads = await leadsRes.json();
        if (!Array.isArray(leads) || leads.length === 0) throw new Error('GET /api/leads did not return expected array');
        console.log(`[PASS] GET /api/leads returned ${leads.length} leads successfully.`);

        
        console.log('Testing POST /api/leads...');
        const testLeadPayload = {
            fullName: "Integration Test Lead",
            email: "integration.test@example.com",
            mobileNumber: "+1 (555) 999-8888",
            alternateNumber: "",
            companyName: "Test Company LLC",
            eventType: "Corporate Gala",
            eventDate: "2026-10-10",
            numberOfGuests: 120,
            preferredVenue: "Test Grand Ballroom",
            budget: 45000,
            city: "Seattle",
            state: "WA",
            source: "Website Form",
            assignedExecutive: "Alexander Wright",
            priority: "Medium",
            stage: "New Lead",
            notes: "Test notes content"
        };
        const createRes = await fetch('http://localhost:8085/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testLeadPayload)
        });
        if (createRes.status !== 201) throw new Error(`POST /api/leads returned status ${createRes.status}`);
        const createData = await createRes.json();
        const testLeadId = createData.id;
        if (!testLeadId) throw new Error('POST /api/leads response did not contain created lead ID');
        console.log(`[PASS] Lead created successfully with ID: ${testLeadId}`);

        
        console.log(`Testing PUT /api/leads/${testLeadId}...`);
        const updatedLeadPayload = {
            ...testLeadPayload,
            stage: "Qualified",
            budget: 50000
        };
        const updateRes = await fetch(`http://localhost:8085/api/leads/${testLeadId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedLeadPayload)
        });
        if (updateRes.status !== 200) throw new Error(`PUT /api/leads/${testLeadId} returned status ${updateRes.status}`);
        console.log(`[PASS] Lead updated successfully.`);

       
        const checkRes = await fetch('http://localhost:8085/api/leads');
        const checkLeads = await checkRes.json();
        const found = checkLeads.find(l => l.id === testLeadId);
        if (!found) throw new Error('Created lead was not found in leads list');
        if (found.stage !== 'Qualified' || parseFloat(found.budget) !== 50000) {
            throw new Error(`Lead details in DB not matching update. Expected stage 'Qualified' and budget 50000, got stage '${found.stage}' and budget ${found.budget}`);
        }
        console.log(`[PASS] Database state verified: stage correctly set to 'Qualified' and budget to $50000.`);

        
        console.log(`Testing DELETE /api/leads/${testLeadId}...`);
        const deleteRes = await fetch(`http://localhost:8085/api/leads/${testLeadId}`, {
            method: 'DELETE'
        });
        if (deleteRes.status !== 200) throw new Error(`DELETE /api/leads/${testLeadId} returned status ${deleteRes.status}`);
        console.log(`[PASS] Lead deleted successfully.`);

        
        const checkAfterDeleteRes = await fetch('http://localhost:8085/api/leads');
        const checkAfterDeleteLeads = await checkAfterDeleteRes.json();
        const deletedFound = checkAfterDeleteLeads.find(l => l.id === testLeadId);
        if (deletedFound) throw new Error('Deleted lead still returned in active leads list');
        console.log('[PASS] Soft delete verified: lead is no longer in active pipeline.');

    } catch (err) {
        console.error('[FAIL] Integration tests failed:');
        console.error(err.message || err);
        testsFailed = true;
    } finally {

        console.log('Stopping test server...');
        serverProcess.kill();
    }

    if (testsFailed) {
        process.exit(1);
    } else {
        console.log('\n=============================================================');
        console.log('All sanity and integration checks complete! EventHub CRM is robust.');
        console.log('=============================================================');
        process.exit(0);
    }
}

runIntegrationTests();
