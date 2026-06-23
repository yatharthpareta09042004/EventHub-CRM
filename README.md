-------Welcome to the backend repository for the EventHub 360 CRM & Lead Management Module------- 

This module serves as the commercial front door of the entire platform, routing intake channels, prioritizing efforts via automated lead scoring, enforcing territory-aware assignment routines, and executing transactional handoffs to the downstream booking engines.  
Built using NestJS, TypeScript, and Zod validation , this service implements enterprise-grade, multi-tenant architectural patterns designed to scale.
CORE DATABASE SCHEMA ARCHITEC:
The schema encapsulates structured, multi-tenant data tracking mapped out as follows:  
1.crm_contact: Manages core customer identities, supporting communication thread tracking and historical tombstones for merged profiles.  
2.crm_lead: The central entity driving event constraints (event_type, event_date, budget), sales stage pipelines, and direct booking references.  
3.crm_lead_stage_history: Tracks chronological velocity tracking along forward movements and tracks regressions separately.  
4.crm_lead_score_snapshot: Preserves analytical historical data for tracking score trajectory graphs. 
5.crm_lead_activity & crm_task: Powers continuous engagement tracking via logging and scheduling future communication items.


---Tech Stack & Configurations---

Framework: NestJS (Node.js)   
Language: TypeScript
Validation Layer: Zod Schemas (Enforced Server-Side)  
Batch Utility Engine: BullMQ (Handles asynchronous nightly scoring runs)   
Database Integration: PostgreSQL (with JSONB support for schema meta adapters)

