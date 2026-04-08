import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Business from '../models/Business';
import config from '../config';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, businesses } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '账号和密码不能为空' });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ success: false, message: '账号已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      businesses: businesses || [],
    });

    // 新增：将用户添加到对应业务的 assignedUsers
    if (businesses && businesses.length > 0) {
      await Business.updateMany(
        { name: { $in: businesses } },
        { $addToSet: { assignedUsers: user._id } }
      );
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, businesses: user.businesses },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    res.status(201).json({
      success: true,
      data: {
        user: { _id: user._id, username: user.username, businesses: user.businesses, role: user.role },
        token,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '账号和密码不能为空' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, message: '账号或密码错误' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '账号或密码错误' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, businesses: user.businesses },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    res.json({
      success: true,
      data: {
        user: { _id: user._id, username: user.username, businesses: user.businesses, role: user.role },
        token,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
