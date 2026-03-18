'use client';

import TargetsPageShell, { type OptimizerTargetsPanelProps } from './targets/TargetsPageShell';

export type { OptimizerTargetsPanelProps };

export default function OptimizerTargetsPanel(props: OptimizerTargetsPanelProps) {
  return <TargetsPageShell {...props} />;
}
