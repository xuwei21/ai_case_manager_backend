import { Router, Response } from 'express';
import TestCase from '../models/TestCase';
import Task from '../models/Task';
import TaskRecord from '../models/TaskRecord';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/overview
router.get('/overview', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const [totalCases, totalTasks, totalKnowledge, casesByBusiness, casesByModule] = await Promise.all([
      TestCase.countDocuments(),
      Task.countDocuments(),
      (await import('../models/Knowledge')).default.countDocuments(),
      TestCase.aggregate([
        { $group: { _id: '$business', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      TestCase.aggregate([
        { $group: { _id: { business: '$business', module: '$module' }, count: { $sum: 1 } } },
        { $sort: { '_id.business': 1, '_id.module': 1 } }
      ])
    ]);

    const recentTasks = await Task.find().sort({ updatedAt: -1 }).limit(5)
      .select('name status progress updatedAt');

    res.json({
      success: true,
      data: { 
        totalCases, totalTasks, totalKnowledge, 
        casesByBusiness, 
        casesByModule,
        recentTasks 
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/dashboard/pass-rate
router.get('/pass-rate', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    // 按业务统计最新通过率
    const tasks = await Task.find({ status: { $in: ['completed', 'failed'] } })
      .sort({ updatedAt: -1 }).limit(100);

    const businessStats: Record<string, { total: number; passed: number; latest: number; highest: number }> = {};

    for (const task of tasks) {
      const biz = task.business;
      if (!businessStats[biz]) {
        businessStats[biz] = { total: 0, passed: 0, latest: -1, highest: 0 };
      }
      const rate = task.progress.total > 0
        ? Math.round((task.progress.completed / task.progress.total) * 100)
        : 0;

      businessStats[biz].total += task.progress.total;
      businessStats[biz].passed += task.progress.completed;
      if (businessStats[biz].latest === -1) businessStats[biz].latest = rate;
      businessStats[biz].highest = Math.max(businessStats[biz].highest, rate);
    }

    const passRateData = Object.entries(businessStats).map(([business, stats]) => ({
      business,
      latestPassRate: stats.latest,
      highestPassRate: stats.highest,
      overallPassRate: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0,
    }));

    res.json({ success: true, data: passRateData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
