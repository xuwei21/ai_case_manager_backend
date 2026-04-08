import { Router, Response } from 'express';
import User from '../models/User';
import Business from '../models/Business';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/users - 获取所有用户（admin）
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限' });
    }
    const users = await User.find().select('-password').sort({ username: 1 });
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/users/:id/businesses - 更新用户业务权限
router.put('/:id/businesses', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // 仅管理员可操作
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限' });
    }

    const { businesses } = req.body; // 期望 businesses 为字符串数组，如 ["登录", "支付"]
    if (!Array.isArray(businesses)) {
      return res.status(400).json({ success: false, message: 'businesses 必须为数组' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 1. 更新用户的 businesses 字段
    user.businesses = businesses;
    await user.save();

    // 2. 同步更新业务 assignedUsers：
    //    - 从所有业务中移除该用户
    await Business.updateMany({}, { $pull: { assignedUsers: user._id } });
    //    - 将该用户添加到新业务列表对应的业务中
    if (businesses.length > 0) {
      await Business.updateMany(
        { name: { $in: businesses } },
        { $addToSet: { assignedUsers: user._id } }
      );
    }

    // 返回更新后的用户（不返回密码）
    const updatedUser = await User.findById(user._id).select('-password');
    res.json({ success: true, data: updatedUser });
  } catch (error: any) {
    console.error('更新用户业务权限失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/users/:id/role - 更新用户角色
router.put('/:id/role', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限' });
    }
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ success: false, message: '无效角色' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限' });
    }
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ success: false, message: '不能删除自己' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
