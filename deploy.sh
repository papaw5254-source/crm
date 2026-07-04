#!/bin/bash
# Serverda qo'lda deploy qilish uchun (GitHub Actions ishlamasa)
set -e

echo "=== Pulling latest code ==="
cd /root/crm
git pull

echo "=== Restarting backend ==="
pm2 restart backend

echo "=== Restarting frontend ==="
pm2 restart frontend

pm2 save
echo "=== Deploy complete ==="
pm2 list
