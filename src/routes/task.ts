import { Router, Response } from 'express';
import Task from '../models/Task';
import TaskRecord from '../models/TaskRecord';
import TestCase from '../models/TestCase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/tasks
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, pageSize = 20, business, status, name } = req.query;
    const filter: any = {};
    if (business) filter.business = business;
    if (status) filter.status = status;
    if (name) filter.name = { $regex: name, $options: 'i' };

    const skip = (Number(page) - 1) * Number(pageSize);
    const [data, total] = await Promise.all([
      Task.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(Number(pageSize)),
      Task.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data,
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findById(req.params.id).populate('testCases', 'testCase business platforms');
    if (!task) return res.status(404).json({ success: false, message: '任务不存在' });
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/tasks
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, business, platform, testCases } = req.body;  // 增加 platform
    if (!name || !business || !platform || !testCases?.length) {
      return res.status(400).json({ success: false, message: '名称、业务、运行端和用例不能为空' });
    }
    const task = await Task.create({
      name, business, platform, testCases,
      progress: { total: testCases.length, completed: 0, failed: 0, current: 0 },
      creator: req.user!.id, creatorName: req.user!.username,
    });
    res.status(201).json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/tasks/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: '任务不存在' });
    if (task.status === 'running') return res.status(400).json({ success: false, message: '运行中的任务不能修改' });

    const updated = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: '任务不存在' });
    if (task.status === 'running') return res.status(400).json({ success: false, message: '运行中的任务不能删除' });

    await Task.findByIdAndDelete(req.params.id);
    await TaskRecord.deleteMany({ taskId: req.params.id });
    res.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

async function simulateExecution(taskId: string) {
  const records = await TaskRecord.find({ taskId }).sort({ createdAt: 1 });
  const task = await Task.findById(taskId);
  if (!task) return;

  // 获取每个用例的步骤数量（用于生成步骤记录）
  const testCaseStepsMap = new Map();
  for (const record of records) {
    const testCase = await TestCase.findById(record.testCaseId).select('automation_steps');
    const stepCount = testCase?.automation_steps?.length || 1;
    testCaseStepsMap.set(record._id.toString(), stepCount);
  }

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const stepCount = testCaseStepsMap.get(record._id.toString()) || 1;

    // 初始化 steps 数组
    const steps = [];
    for (let stepIdx = 0; stepIdx < stepCount; stepIdx++) {
      steps.push({
        stepIndex: stepIdx,
        status: 'pending',
        screenshot: '',
      });
    }
    record.steps = steps;
    await record.save();

    // 模拟每个步骤的执行
    for (let stepIdx = 0; stepIdx < stepCount; stepIdx++) {
      // 更新当前步骤为 running
      record.steps[stepIdx].status = 'running';
      await record.save();

      // 模拟执行耗时 1~2 秒
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

      // 随机决定步骤是否通过（整体用例通过率80%，但步骤可能有失败）
      const stepPassed = Math.random() > 0.1; // 步骤90%通过率
      record.steps[stepIdx].status = stepPassed ? 'passed' : 'failed';
      if (!stepPassed) {
        // 可以添加模拟截图
        record.steps[stepIdx].screenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      }
      await record.save();
    }

    // 整体用例状态判断
    const allPassed = record.steps.every(s => s.status === 'passed');
    record.status = allPassed ? 'passed' : 'failed';
    record.startTime = new Date(Date.now() - stepCount * 1500);
    record.endTime = new Date();
    if (!allPassed) record.errorMessage = '部分步骤执行失败';
    await record.save();

    // 更新任务进度
    const currentTask = await Task.findById(taskId);
    if (!currentTask || currentTask.status === 'cancelled') break;
    await Task.findByIdAndUpdate(taskId, {
      'progress.current': i + 1,
      'progress.completed': allPassed ? (currentTask.progress.completed + 1) : currentTask.progress.completed,
      'progress.failed': !allPassed ? (currentTask.progress.failed + 1) : currentTask.progress.failed,
    });
  }

  const finalTask = await Task.findById(taskId);
  if (finalTask && finalTask.status === 'running') {
    finalTask.status = finalTask.progress.failed > 0 ? 'failed' : 'completed';
    await finalTask.save();
  }
}

router.post('/:id/cancel', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: '任务不存在' });
    if (task.status !== 'running') return res.status(400).json({ success: false, message: '任务未在运行中' });

    task.status = 'cancelled';
    await task.save();
    res.json({ success: true, message: '任务已取消' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/tasks/:id/progress
router.get('/:id/progress', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findById(req.params.id).select('status progress');
    if (!task) return res.status(404).json({ success: false, message: '任务不存在' });
    res.json({ success: true, data: { status: task.status, progress: task.progress } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/tasks/:id/records
router.get('/:id/records', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const records = await TaskRecord.find({ taskId: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, data: records });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
