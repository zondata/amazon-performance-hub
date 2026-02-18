import path from 'node:path';

export const safeJoin = (root: string, relativePath: string) => {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(resolvedRoot, relativePath);
  if (resolvedTarget === resolvedRoot) return resolvedTarget;
  if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Path traversal detected');
  }
  return resolvedTarget;
};
