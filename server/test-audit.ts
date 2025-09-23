import { db, sqlite } from './db';
import { auditEvents, auditActionCodes, auditDailyDigests } from '@shared/schema';

// Simple test to verify audit tables were created and can be used
export async function testAuditSystem() {
  console.log('🔍 Testing audit system...');
  
  try {
    // Check if audit tables exist
    const tables = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'audit%' 
      ORDER BY name
    `).all();
    
    console.log('📋 Audit tables found:', tables);
    
    // Test reading from audit_action_codes
    const actionCodes = await db.select().from(auditActionCodes).limit(5);
    console.log('✅ Action codes sample:', actionCodes);
    
    // Test basic audit event insertion
    const testEvent = {
      actorType: 'system',
      actorId: 'test-system',
      sessionId: 'test-session-' + Date.now(),
      actionCode: 703, // API_CALL
      resourceType: 'system',
      resourceId: 'audit-test',
      result: 'success',
      metadata: { testRun: true, timestamp: new Date().toISOString() },
      hash: 'test-hash-' + Math.random().toString(36).substring(7)
    };
    
    const insertResult = await db.insert(auditEvents).values(testEvent).returning();
    console.log('✅ Test audit event created:', insertResult[0]?.id);
    
    // Count total audit events
    const eventCount = await db.select().from(auditEvents);
    console.log(`📊 Total audit events: ${eventCount.length}`);
    
    console.log('🎉 Audit system test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Audit system test failed:', error);
    return false;
  }
}

// Run test immediately if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAuditSystem().then(success => {
    process.exit(success ? 0 : 1);
  });
}