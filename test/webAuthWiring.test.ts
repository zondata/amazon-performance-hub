import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const middlewarePath = path.join(process.cwd(), 'apps/web/src/middleware.ts');
const loginPagePath = path.join(process.cwd(), 'apps/web/src/app/login/page.tsx');
const loginActionsPath = path.join(process.cwd(), 'apps/web/src/lib/auth/actions.ts');
const callbackRoutePath = path.join(
  process.cwd(),
  'apps/web/src/app/auth/callback/route.ts'
);
const layoutPath = path.join(process.cwd(), 'apps/web/src/app/layout.tsx');
const deploymentDocPath = path.join(process.cwd(), 'docs/V3_VERCEL_DEPLOYMENT.md');

describe('web auth wiring', () => {
  it('adds middleware auth protection and callback handling', () => {
    const middlewareSource = fs.readFileSync(middlewarePath, 'utf8');
    const callbackSource = fs.readFileSync(callbackRoutePath, 'utf8');

    expect(middlewareSource).toContain('updateAuthSession');
    expect(middlewareSource).toContain('/((?!_next/static|_next/image|favicon.ico');
    expect(callbackSource).toContain('exchangeCodeForSession');
  });

  it('adds a login page and protected-shell logout action', () => {
    const loginPageSource = fs.readFileSync(loginPagePath, 'utf8');
    const loginActionsSource = fs.readFileSync(loginActionsPath, 'utf8');
    const layoutSource = fs.readFileSync(layoutPath, 'utf8');

    expect(loginActionsSource).toContain('signInWithPassword');
    expect(loginPageSource).toContain('Email/password access is enabled');
    expect(layoutSource).toContain('logoutAction');
    expect(layoutSource).toContain('{user.email}');
  });

  it('documents Vercel env requirements and service-role safety', () => {
    const doc = fs.readFileSync(deploymentDocPath, 'utf8');

    expect(doc).toContain('amazon-performance-hub-v3');
    expect(doc).toContain('AUTH_ALLOWED_EMAILS=netradesolution@gmail.com');
    expect(doc).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    expect(doc).toContain('service-role bypasses RLS');
  });

  it('does not import supabaseAdmin or service-role env into client components', () => {
    const roots = [
      path.join(process.cwd(), 'apps/web/src/components'),
      path.join(process.cwd(), 'apps/web/src/app'),
    ];

    const clientFiles: string[] = [];
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const nextPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walk(nextPath);
          continue;
        }
        if (!nextPath.endsWith('.ts') && !nextPath.endsWith('.tsx')) continue;
        const source = fs.readFileSync(nextPath, 'utf8');
        if (source.startsWith("'use client';") || source.startsWith('"use client";')) {
          clientFiles.push(nextPath);
        }
      }
    };

    roots.forEach(walk);

    for (const file of clientFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source, file).not.toContain('supabaseAdmin');
      expect(source, file).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(source, file).not.toContain("from '@/lib/env'");
      expect(source, file).not.toContain('from "@/lib/env"');
    }
  });
});
