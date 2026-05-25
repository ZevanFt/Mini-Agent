// Express API 端点模板
import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { validateRequestBody } from '@/middleware/validation';

// 类型定义
interface Resource {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateResourceRequest {
  name: string;
}

interface UpdateResourceRequest {
  name?: string;
}

// 路由
const router = Router();

// GET /api/resources - 获取所有资源
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  logger.info('Fetching all resources');
  try {
    // TODO: 实现实际逻辑
    const resources: Resource[] = [];

    logger.info('Resources fetched', { count: resources.length });
    res.status(200).json({
      success: true,
      data: resources,
      meta: {
        count: resources.length,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch resources', { error });
    next(error);
  }
});

// GET /api/resources/:id - 获取单个资源
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  logger.info('Fetching resource', { id });

  try {
    // TODO: 实现实际逻辑
    const resource: Resource | null = null;

    if (!resource) {
      logger.warn('Resource not found', { id });
      res.status(404).json({
        success: false,
        error: 'Resource not found',
      });
      return;
    }

    logger.info('Resource fetched', { id });
    res.status(200).json({
      success: true,
      data: resource,
    });
  } catch (error) {
    logger.error('Failed to fetch resource', { id, error });
    next(error);
  }
});

// POST /api/resources - 创建资源
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  logger.info('Creating resource', { request: req.body });
  try {
    // TODO: 实现实际逻辑
    const newResource: Resource = {
      id: '',
      name: req.body.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    logger.info('Resource created', { id: newResource.id });
    res.status(201).json({
      success: true,
      data: newResource,
    });
  } catch (error) {
    logger.error('Failed to create resource', { error });
    next(error);
  }
});

// PUT /api/resources/:id - 更新资源
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  logger.info('Updating resource', { id, request: req.body });
  try {
    // TODO: 实现实际逻辑
    const updatedResource: Resource | null = null;

    if (!updatedResource) {
      logger.warn('Resource not found', { id });
      res.status(404).json({
        success: false,
        error: 'Resource not found',
      });
      return;
    }

    logger.info('Resource updated', { id });
    res.status(200).json({
      success: true,
      data: updatedResource,
    });
  } catch (error) {
    logger.error('Failed to update resource', { id, error });
    next(error);
  }
});

// DELETE /api/resources/:id - 删除资源
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  logger.info('Deleting resource', { id });
  try {
    // TODO: 实现实际逻辑
    const success = true;

    if (!success) {
      logger.warn('Resource not found', { id });
      res.status(404).json({
        success: false,
        error: 'Resource not found',
      });
      return;
    }

    logger.info('Resource deleted', { id });
    res.status(200).json({
      success: true,
      data: { message: 'Resource deleted' },
    });
  } catch (error) {
    logger.error('Failed to delete resource', { id, error });
    next(error);
  }
});

export default router;
