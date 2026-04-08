import { Router, Response } from 'express';
import TestCase from '../models/TestCase';
import Business from '../models/Business';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 辅助函数：检查用户是否有某业务的权限
async function checkBusinessPermission(user: AuthRequest['user'], businessName: string): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'admin') return true;
  // 方式一：用户businesses数组包含
  if (user.businesses?.includes(businessName)) return true;
  // 方式二：业务assignedUsers包含用户ID
  const business = await Business.findOne({ name: businessName });
  if (business && business.assignedUsers.some(id => id.toString() === user.id)) return true;
  return false;
}

// 辅助函数：获取用户有权限的所有业务名称
async function getBusinessesForUser(userId: string, userBusinesses: string[]): Promise<string[]> {
  // 从 Business 表中查找 assignedUsers 包含该用户的业务名
  const assignedBiz = await Business.find({ assignedUsers: userId }).select('name');
  const assignedNames = assignedBiz.map(b => b.name);
  const all = [...new Set([...assignedNames, ...userBusinesses])];
  return all;
}

// GET /api/testcases - 分页查询（仅返回有权限的业务）
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, pageSize = 20, business, testCase, platform, creator } = req.query;
    const filter: any = {};

    if (testCase) filter.testCase = { $regex: testCase, $options: 'i' };
    if (platform) filter.platforms = platform;
    if (creator) filter.creatorName = { $regex: creator, $options: 'i' };

    // 获取用户有权限的业务列表（admin 时返回 null 表示无限制）
    let allowedBusinesses: string[] | null = null;
    if (req.user!.role !== 'admin') {
      allowedBusinesses = await getBusinessesForUser(req.user!.id, req.user!.businesses);
      if (allowedBusinesses.length === 0) {
        // 用户没有任何业务权限，直接返回空数据
        return res.json({
          success: true,
          data: [],
          pagination: { page: Number(page), pageSize: Number(pageSize), total: 0, totalPages: 0 }
        });
      }
    }

    // 处理业务筛选与权限的交集
    if (business) {
      // 前端指定了业务筛选
      if (allowedBusinesses !== null && !allowedBusinesses.includes(business as string)) {
        // 筛选的业务不在用户权限内，返回空
        return res.json({
          success: true,
          data: [],
          pagination: { page: Number(page), pageSize: Number(pageSize), total: 0, totalPages: 0 }
        });
      }
      filter.business = business;
    } else if (allowedBusinesses !== null) {
      // 未指定业务筛选，但用户有权限限制，则限制在权限业务内
      filter.business = { $in: allowedBusinesses };
    }
    // admin 且未指定 business 时，filter 中无 business 条件，返回所有

    const skip = (Number(page) - 1) * Number(pageSize);
    const pipeline: any[] = [
      { $match: filter },
      {
        $addFields: {
          stepCount: {
            $reduce: {
              input: "$automation_steps",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  1,
                  {
                    $cond: [
                      { $eq: ["$$this.inputType", "if"] },
                      { $size: { $ifNull: ["$$this.fixSteps", []] } },
                      0
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: Number(pageSize) },
      { $project: { automation_steps: 0 } }
    ];

    const [data, total] = await Promise.all([
      TestCase.aggregate(pipeline),
      TestCase.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/testcases/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const testCase = await TestCase.findById(req.params.id);
    if (!testCase) {
      return res.status(404).json({ success: false, message: '用例不存在' });
    }
    // 权限校验
    if (!await checkBusinessPermission(req.user, testCase.business)) {
      return res.status(403).json({ success: false, message: '您没有权限查看该用例' });
    }
    res.json({ success: true, data: testCase });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/testcases
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { platforms, business, module, testCase: caseName, relatedCase, remark, automation_steps } = req.body;
    if (!business || !caseName) {
      return res.status(400).json({ success: false, message: '业务和用例名称不能为空' });
    }
    // 权限校验：是否有权限在该业务下创建
    if (!await checkBusinessPermission(req.user, business)) {
      return res.status(403).json({ success: false, message: '您没有该业务的创建权限' });
    }

    const testCase = await TestCase.create({
      platforms: platforms || [],
      business,
      module: module || '',
      testCase: caseName,
      creator: req.user!.id,
      creatorName: req.user!.username,
      relatedCase: relatedCase || '',
      remark: remark || '',
      automation_steps: automation_steps || [],
    });

    res.status(201).json({ success: true, data: testCase });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/testcases/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await TestCase.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '用例不存在' });
    }
    // 权限校验
    if (!await checkBusinessPermission(req.user, existing.business)) {
      return res.status(403).json({ success: false, message: '您没有权限修改该用例' });
    }
    // 如果更新请求中包含了 business 字段，也需要校验新业务权限
    if (req.body.business && req.body.business !== existing.business) {
      if (!await checkBusinessPermission(req.user, req.body.business)) {
        return res.status(403).json({ success: false, message: '您没有新业务的修改权限' });
      }
    }

    const testCase = await TestCase.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: testCase });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/testcases/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await TestCase.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '用例不存在' });
    }
    if (!await checkBusinessPermission(req.user, existing.business)) {
      return res.status(403).json({ success: false, message: '您没有权限删除该用例' });
    }
    await TestCase.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;