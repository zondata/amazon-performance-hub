import 'server-only';

import { env } from '@/lib/env';

export const isAdsOptimizerEnabled = () => env.enableAdsOptimizer;
