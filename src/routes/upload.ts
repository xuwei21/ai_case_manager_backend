import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  uploadScreenshotHandler,
  uploadGeneralImageHandler,   // 新增
  deleteScreenshotHandler,
  deleteTaskScreenshotsHandler,
} from '../controllers/uploadController';

const router = Router();

// 任务执行截图上传（场景3）
router.post('/screenshot', authMiddleware, uploadScreenshotHandler);

// 通用图片上传（场景1&2：用例图片、客户端/前端上传）
router.post('/image', authMiddleware, uploadGeneralImageHandler);

// 删除单张图片（适用所有场景）
router.post('/delete', authMiddleware, deleteScreenshotHandler);

// 删除任务下所有截图
router.post('/delete-task-screenshots', authMiddleware, deleteTaskScreenshotsHandler);

export default router;