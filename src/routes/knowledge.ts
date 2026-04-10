import { Router, Response } from 'express';
import Knowledge from '../models/Knowledge';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/knowledges
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, pageSize = 20, business, name } = req.query;
    const filter: any = {};
    if (business) filter.business = business;
    if (name) filter.name = { $regex: name, $options: 'i' };

    const skip = (Number(page) - 1) * Number(pageSize);
    const [data, total] = await Promise.all([
      Knowledge.find(filter).select('-steps').sort({ updatedAt: -1 }).skip(skip).limit(Number(pageSize)),
      Knowledge.countDocuments(filter),
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

// GET /api/knowledges/all - 简要列表，用于导入选择
router.get('/all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { business } = req.query;
    const filter: any = {};
    if (business) filter.business = business;
    const data = await Knowledge.find(filter).select('name business description').sort({ name: 1 });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/knowledges/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const knowledge = await Knowledge.findById(req.params.id);
    if (!knowledge) return res.status(404).json({ success: false, message: '知识库不存在' });
    res.json({ success: true, data: knowledge });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/knowledges
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, business, description, steps } = req.body;
    if (!name || !business) {
      return res.status(400).json({ success: false, message: '名称和业务不能为空' });
    }

    const knowledge = await Knowledge.create({
      name, business, description: description || '', steps: steps || [],
      creator: req.user!.id, creatorName: req.user!.username,
    });

    // 修改：只返回 success 和 message，不返回 data
    res.status(201).json({ success: true, message: '创建成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/knowledges/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const knowledge = await Knowledge.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!knowledge) return res.status(404).json({ success: false, message: '知识库不存在' });
    res.json({ success: true, data: knowledge });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/knowledges/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const knowledge = await Knowledge.findByIdAndDelete(req.params.id);
    if (!knowledge) return res.status(404).json({ success: false, message: '知识库不存在' });
    res.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
