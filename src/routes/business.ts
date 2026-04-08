import { Router, Request, Response } from 'express';
import Business from '../models/Business';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/businesses - 公开接口，注册时需要
router.get('/', async (_req: Request, res: Response) => {
  try {
    const businesses = await Business.find().select('-assignedUsers').sort({ name: 1 });
    res.json({ success: true, data: businesses });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/businesses - 仅admin
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限' });
    }
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: '业务名称不能为空' });
    }
    const business = await Business.create({ name, description });
    res.status(201).json({ success: true, data: business });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: '业务名称已存在' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/businesses/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限' });
    }
    const business = await Business.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!business) {
      return res.status(404).json({ success: false, message: '业务不存在' });
    }
    res.json({ success: true, data: business });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/businesses/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限' });
    }
    await Business.updateMany({}, { $pull: { assignedUsers: req.params.id } });
    const business = await Business.findByIdAndDelete(req.params.id);
    if (!business) {
      return res.status(404).json({ success: false, message: '业务不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/businesses/:id/users - 获取业务下的用户列表
router.get('/:id/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限' });
    }
    const business = await Business.findById(req.params.id).populate('assignedUsers', 'username role businesses');
    if (!business) {
      return res.status(404).json({ success: false, message: '业务不存在' });
    }
    res.json({ success: true, data: business.assignedUsers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/businesses/:id/users - 更新业务的分配用户列表
router.put('/:id/businesses', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限' });
    }
    const { businesses } = req.body; // 期望业务名称数组
    const user = await User.findByIdAndUpdate(req.params.id, { businesses }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    // 同步更新业务 assignedUsers
    // 1. 从所有业务中移除该用户
    await Business.updateMany({}, { $pull: { assignedUsers: user._id } });
    // 2. 将用户添加到新业务列表对应的业务中
    if (businesses && businesses.length) {
      await Business.updateMany(
        { name: { $in: businesses } },
        { $addToSet: { assignedUsers: user._id } }
      );
    }
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
