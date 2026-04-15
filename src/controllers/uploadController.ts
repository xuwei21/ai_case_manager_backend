import { Request, Response } from 'express';
import {
  uploadScreenshot,
  deleteScreenshot,
  deleteTaskScreenshots,
  uploadGeneralImage,
} from '../services/minio';

export const uploadScreenshotHandler = async (req: Request, res: Response) => {
  try {
    const { base64, taskId, caseId, stepIndex } = req.body;
    if (!base64 || !taskId || !caseId || stepIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: base64, taskId, caseId, stepIndex',
      });
    }
    const url = await uploadScreenshot(base64, taskId, caseId, stepIndex);
    res.json({ success: true, data: { url } });
  } catch (err: any) {
    console.error(`Upload screenshot error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

// 新增：通用图片上传（用于用例图片等场景）
export const uploadGeneralImageHandler = async (req: Request, res: Response) => {
  try {
    const { base64, prefix } = req.body;
    if (!base64) {
      return res.status(400).json({
        success: false,
        error: 'base64 required',
      });
    }
    const { url, objectName } = await uploadGeneralImage(base64, prefix || 'cases');
    res.json({ success: true, data: { url, objectName } });
  } catch (err: any) {
    console.error(`Upload general image error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const deleteScreenshotHandler = async (req: Request, res: Response) => {
  try {
    const { objectName } = req.body;
    if (!objectName) {
      return res.status(400).json({ success: false, error: 'objectName required' });
    }
    await deleteScreenshot(objectName);
    res.json({ success: true, message: 'Screenshot deleted' });
  } catch (err: any) {
    console.error(`Delete screenshot error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const deleteTaskScreenshotsHandler = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'taskId required' });
    }
    await deleteTaskScreenshots(taskId);
    res.json({ success: true, message: 'Task screenshots deleted' });
  } catch (err: any) {
    console.error(`Delete task screenshots error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};