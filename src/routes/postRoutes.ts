import { Router } from 'express';
import { postController } from '../controllers/postController.js';

export const postRouter = Router();

postRouter.post('/posts', postController.createPost);
postRouter.get('/posts/:id', postController.getPostById);
postRouter.post('/posts/:id/variants', postController.generateVariants);
postRouter.get('/variants/:id', postController.getVariantById);
