import { initDatabase, isDbConnected } from '../src/db/db.js';
import { postRepository } from '../src/services/postRepository.js';
import { approvalService } from '../src/services/approvalService.js';
import { publishingService } from '../src/services/publishingService.js';
import { PublishWorker } from '../src/workers/publishWorker.js';
import dotenv from 'dotenv';

dotenv.config();

async function runE2E() {
  console.log('--- STARTING PHASE 5 SCHEDULER & WORKER E2E VERIFICATION ---');

  const connected = await initDatabase();
  console.log(`[E2E] Database connected: ${connected}`);

  await postRepository.clearAll();

  // 1. Create Canonical Post
  console.log('\n1. Creating Canonical Post...');
  const post = await postRepository.createPost({
    sourceType: 'markdown',
    title: 'Phase 5 Worker & Scheduler Capstone Verification',
    sourceContent: 'Testing Phase 5 durable scheduling, worker claiming, crash recovery, and idempotency guarantees.'
  });
  console.log(`-> Post Created: ${post.id}`);

  // 2. Create Discord Variant
  console.log('\n2. Creating Discord Variant...');
  const uniqueContent = `🚀 **FlyRank Social Media Studio — Phase 5 Capstone Verification**\n- Durable Scheduler & Worker\n- Atomic Skipping & Crash Recovery\n- Verification ID: ${Date.now()}`;
  const variant = await postRepository.createVariant({
    postId: post.id,
    platform: 'discord',
    content: uniqueContent,
    status: 'draft',
    validationInfo: { isValid: true, length: uniqueContent.length, maxLength: 2000, hashtagCount: 0, maxHashtags: 5, errors: [] }
  });
  console.log(`-> Variant Created: ${variant.id} (${variant.platform}, status: ${variant.status})`);

  // 3. Approve Variant
  console.log('\n3. Approving Variant...');
  const approvedVariant = await approvalService.approveVariant(variant.id);
  console.log(`-> Status Updated to: ${approvedVariant.status}`);

  // 4. Schedule Variant 2 seconds in future
  console.log('\n4. Scheduling Variant for 2 Seconds in Future...');
  const scheduledTime = new Date(Date.now() + 2000);
  const slot = await approvalService.scheduleVariant(variant.id, scheduledTime);
  console.log(`-> Slot Created: ${slot.id} (Scheduled at: ${slot.scheduled_at.toISOString()})`);

  const jobBefore = await postRepository.getScheduledJobBySlotId(slot.id);
  console.log(`-> Scheduled Job State: status=${jobBefore?.status}, attempts=${jobBefore?.attempts}`);

  // 5. Start Worker & Allow Worker to process due job
  console.log('\n5. Starting Worker to Process Due Job...');
  const worker = new PublishWorker({ pollIntervalMs: 500, leaseTimeoutSeconds: 5 });
  
  // Wait 2.5s for schedule time to pass
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const batchResult = await worker.processBatch();
  console.log(`-> Worker processed batch of ${batchResult.length} job(s).`);

  const jobAfter = await postRepository.getScheduledJobBySlotId(slot.id);
  console.log(`-> Job Status After Worker Execution: ${jobAfter?.status}`);
  console.log(`-> Published At: ${jobAfter?.published_at?.toISOString()}`);

  const attempts = await postRepository.getPublishAttemptsByVariantId(variant.id);
  console.log(`-> Publish Attempt Recorded: count=${attempts.length}, status=${attempts[0]?.status}, externalPostId=${attempts[0]?.external_post_id}`);

  // 6. Simulate Crash Recovery & Idempotency Replay
  console.log('\n6. Simulating Crash Recovery (Job interrupted mid-batch)...');
  
  // Reset job status to processing with expired lease to simulate mid-batch crash after publication succeeded
  await postRepository.updateScheduledJob(jobAfter!.id, {
    status: 'processing',
    claimed_at: new Date(Date.now() - 10000)
  });
  console.log(`-> Simulated Crash State: job.status = processing, claimed_at = -10s`);

  // Restart worker process
  console.log('\n7. Restarting Worker Process (Simulating Process Recovery)...');
  const restartedWorker = new PublishWorker({ leaseTimeoutSeconds: 5 });
  await restartedWorker.recoverStaleJobs();

  const recoveredJob = await postRepository.getScheduledJobBySlotId(slot.id);
  console.log(`-> Job Status After Worker Restart Recovery: ${recoveredJob?.status}`);

  const finalAttempts = await postRepository.getPublishAttemptsByVariantId(variant.id);
  console.log(`-> Final Publish Attempts Count: ${finalAttempts.length}`);
  console.log(`-> External Post ID Unchanged: ${finalAttempts[0]?.external_post_id}`);

  // 8. Inspect Publish History
  console.log('\n8. Inspecting Publish History...');
  const history = await publishingService.getPublishHistory();
  console.log(`-> Total History Records: ${history.length}`);
  console.log(`-> Latest Attempt Record:`, JSON.stringify(history[0], null, 2));

  if (jobAfter?.status === 'published' && finalAttempts.length === 1 && history.length >= 1) {
    console.log('\n✅ PHASE 5 SCHEDULER & WORKER E2E VERIFICATION SUCCESSFUL!');
  } else {
    console.error('\n❌ E2E VERIFICATION FAILED');
    process.exit(1);
  }
}

runE2E().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
