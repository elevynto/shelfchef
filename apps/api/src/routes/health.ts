import { Router } from 'express';
import type { HealthResponse } from '@shelfchef/shared';

const router = Router();

router.get('/', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    version: process.env['npm_package_version'] ?? '0.0.0',
  };
  res.json(body);
});

export default router;
