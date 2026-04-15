import ImageRef from '../models/ImageRef';

/**
 * 从步骤数组中提取所有图片 URL（递归提取 images / precondition.images / fixSteps[].images）
 * 适用于 TestCase.automation_steps 和 Knowledge.steps
 */
export function extractImageUrls(steps: any[]): string[] {
  if (!Array.isArray(steps)) return [];
  const urls: string[] = [];

  for (const step of steps) {
    // step.images
    if (Array.isArray(step.images)) {
      for (const img of step.images) {
        if (img.url) urls.push(img.url);
      }
    }
    // step.precondition.images
    if (step.precondition && Array.isArray(step.precondition.images)) {
      for (const img of step.precondition.images) {
        if (img.url) urls.push(img.url);
      }
    }
    // step.fixSteps[].images
    if (Array.isArray(step.fixSteps)) {
      for (const fs of step.fixSteps) {
        if (Array.isArray(fs.images)) {
          for (const img of fs.images) {
            if (img.url) urls.push(img.url);
          }
        }
      }
    }
  }

  return urls;
}

/**
 * 批量减少图片引用计数
 * @param urls - 需要减引用的图片 URL 列表
 */
export async function batchDecrementRefCount(urls: string[]): Promise<void> {
  if (!urls.length) return;
  const uniqueUrls = [...new Set(urls)];

  for (const url of uniqueUrls) {
    try {
      const ref = await ImageRef.findOneAndUpdate(
        { url },
        { $inc: { refCount: -1 } },
        { new: true }
      );
      if (ref) {
        console.log(`[ImageRef] refCount-- for ${url}, now=${ref.refCount}`);
      }
    } catch (err: any) {
      console.error(`[ImageRef] Failed to decrement refCount for ${url}: ${err.message}`);
    }
  }
}

/**
 * 对比新旧步骤，对被移除的图片做 refCount--
 * @param oldSteps - 旧步骤数组（从数据库读出的）
 * @param newSteps - 新步骤数组（客户端提交的）
 */
export async function diffAndDecrementImages(oldSteps: any[], newSteps: any[]): Promise<void> {
  const oldUrls = new Set(extractImageUrls(oldSteps));
  const newUrls = new Set(extractImageUrls(newSteps));

  const removedUrls = [...oldUrls].filter(url => !newUrls.has(url));
  if (removedUrls.length > 0) {
    console.log(`[ImageRef] Detected ${removedUrls.length} removed images, decrementing...`);
    await batchDecrementRefCount(removedUrls);
  }
}
