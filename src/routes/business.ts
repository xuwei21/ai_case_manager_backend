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

// GET /api/businesses/mine - 获取当前用户拥有的业务列表
router.get('/mine', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // 获取用户有权限的业务名称列表
    let allowedBusinessNames: string[];
    if (req.user!.role === 'admin') {
      // 管理员返回所有业务
      const allBiz = await Business.find().select('name');
      allowedBusinessNames = allBiz.map(b => b.name);
    } else {
      // 普通用户：合并 User.businesses 和 Business.assignedUsers
      const assignedBiz = await Business.find({ assignedUsers: req.user!.id }).select('name');
      const assignedNames = assignedBiz.map(b => b.name);
      allowedBusinessNames = [...new Set([...req.user!.businesses, ...assignedNames])];
    }

    // 根据业务名称查询对应的 _id 和 name
    const businesses = await Business.find({ name: { $in: allowedBusinessNames } })
      .select('_id name')
      .sort({ name: 1 });

    res.json({ success: true, data: businesses });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
