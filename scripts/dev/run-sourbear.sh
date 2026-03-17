#!/usr/bin/env bash
set -e

cp ~/code/amazon-performance-hub/apps/web/.env.sourbear.local ~/code/amazon-performance-hub/apps/web/.env.local
cd ~/code/amazon-performance-hub
npm run web:dev
