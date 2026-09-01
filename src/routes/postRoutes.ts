import { Router } from 'express';
import { postController } from '../controllers/postController.js';
import { approvalController } from '../controllers/approvalController.js';
import { publishingController } from '../controllers/publishingController.js';

export const postRouter = Router();

// Post ingestion & variant generation
postRouter.post('/posts', postController.createPost);
postRouter.get('/posts/:id', postController.getPostById);
postRouter.post('/posts/:id/variants', postController.generateVariants);
postRouter.get('/variants/:id', postController.getVariantById);

// Phase 3: Approval, Rejection, Editing, Scheduling & Audit History
postRouter.post('/variants/:id/approve', approvalController.approveVariant);
postRouter.post('/variants/:id/reject', approvalController.rejectVariant);
postRouter.put('/variants/:id', approvalController.editVariant);
postRouter.post('/variants/:id/schedule', approvalController.scheduleVariant);
postRouter.get('/variants/:id/history', approvalController.getVariantHistory);

// Phase 4 & 5: Publishing, Idempotency Ledger & History
postRouter.post('/variants/:id/publish', publishingController.publishVariant);
postRouter.get('/variants/:id/attempts', publishingController.getVariantPublishAttempts);
postRouter.get('/publish-attempts/:id', publishingController.getPublishAttemptById);
postRouter.get('/publish-history', publishingController.getPublishHistory);
postRouter.get('/publish-attempts', publishingController.getPublishHistory);
