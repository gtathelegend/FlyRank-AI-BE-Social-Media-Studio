import { initDatabase } from '../src/db/db.js';
import { postRepository } from '../src/services/postRepository.js';
import { variantGeneratorService } from '../src/services/variantGenerator.js';
import { approvalService } from '../src/services/approvalService.js';
import { publishingService } from '../src/services/publishingService.js';

async function runE2EVerification() {
  console.log('--- STARTING E2E VERIFICATION ---');

  // Step 1: Init Database
  await initDatabase();

  // Step 2: Ingest Post
  console.log('\n1. Creating Canonical Post...');
  const post = await postRepository.createPost({
    sourceType: 'markdown',
    title: 'FlyRank Discord E2E Test',
    sourceContent: 'This is an end-to-end test of the FlyRank Social Media Studio publishing pipeline.'
  });
  console.log('-> Post Created:', post.id);

  // Step 3: Generate Variants
  console.log('\n2. Generating Platform Variants...');
  const variants = await variantGeneratorService.generateVariantsForPost(post);
  console.log(`-> ${variants.length} Variants Generated:`, variants.map(v => `${v.platform}: ${v.id} (${v.status})`));

  const discordVariant = variants.find(v => v.platform === 'discord');
  if (!discordVariant) throw new Error('Discord variant missing');

  // Step 4: Approve Discord Variant
  console.log('\n3. Approving Discord Variant...');
  const approvedVariant = await approvalService.approveVariant(discordVariant.id);
  console.log('-> Variant Status Updated to:', approvedVariant.status);

  // Step 5: Schedule Slot
  console.log('\n4. Creating Scheduling Slot...');
  const slot = await approvalService.scheduleVariant(approvedVariant.id, new Date(Date.now() + 3600000));
  console.log('-> Slot Created:', slot.id);

  // Step 6: Publish to Real Discord Webhook
  console.log('\n5. Publishing to Real Discord Webhook...');
  const pubRes1 = await publishingService.publishVariant(approvedVariant.id, slot.id);
  console.log('-> First Publish Result:', {
    attemptId: pubRes1.attempt.id,
    status: pubRes1.attempt.status,
    isReplay: pubRes1.isReplay,
    externalPostId: pubRes1.attempt.external_post_id,
    variantStatus: pubRes1.variant.status
  });

  // Step 7: Repeat Publish Request (Idempotency Replay Verification)
  console.log('\n6. Repeating Identical Publish Request (Idempotency Check)...');
  const pubRes2 = await publishingService.publishVariant(approvedVariant.id, slot.id);
  console.log('-> Second Publish Result:', {
    attemptId: pubRes2.attempt.id,
    status: pubRes2.attempt.status,
    isReplay: pubRes2.isReplay,
    externalPostId: pubRes2.attempt.external_post_id
  });

  if (pubRes2.isReplay && pubRes1.attempt.id === pubRes2.attempt.id) {
    console.log('\n✅ IDEMPOTENCY VERIFIED SUCCESSFULLY! Replay returned existing attempt without duplicate webhook call.');
  } else {
    console.error('\n❌ Idempotency failed!');
  }

  process.exit(0);
}

runE2EVerification().catch((err) => {
  console.error('E2E Verification Error:', err);
  process.exit(1);
});
