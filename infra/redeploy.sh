#!/bin/bash
set -euo pipefail

# MMS Demo - Redeploy Script
# Use after code changes to update backend, frontend, or both.
# Usage: ./redeploy.sh [backend|frontend|all]

REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="mms-demo-v2"
ECR_REPO="mms-demo-backend"
AWS_PROFILE="${AWS_PROFILE:-Solution-Architects.User-979559056307}"
export AWS_PROFILE
unset AWS_ACCESS_KEY_ID 2>/dev/null || true
unset AWS_SECRET_ACCESS_KEY 2>/dev/null || true
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO"

TARGET="${1:-all}"

redeploy_backend() {
  echo "── Backend Redeploy ──────────────────────"
  echo ""

  echo "Building Docker image (linux/amd64)..."
  docker build --platform linux/amd64 -t "$ECR_REPO" "$PROJECT_DIR/backend"
  echo "✓ Image built"

  echo "Pushing to ECR..."
  aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
  docker tag "$ECR_REPO:latest" "$ECR_URI:latest"
  docker push "$ECR_URI:latest"
  echo "✓ Image pushed"

  echo "Restarting ECS service..."
  aws ecs update-service \
    --cluster mms-demo-v2-cluster \
    --service mms-demo-v2-backend \
    --force-new-deployment \
    --region "$REGION" \
    --query 'service.serviceName' --output text >/dev/null
  echo "✓ ECS service restarting (new task will be live in ~60s)"
  echo ""
}

redeploy_frontend() {
  echo "── Frontend Redeploy ─────────────────────"
  echo ""

  CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='FrontendURL'].OutputValue" --output text | sed 's|https://||')
  API_VIA_CLOUDFRONT="https://$CLOUDFRONT_DOMAIN/api"
  BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)

  echo "Building frontend (API: $API_VIA_CLOUDFRONT)..."
  cd "$PROJECT_DIR/frontend"
  VITE_API_URL="$API_VIA_CLOUDFRONT" npm run build
  echo "✓ Frontend built"

  echo "Uploading to S3..."
  aws s3 sync dist/ "s3://$BUCKET_NAME/" --delete --region "$REGION"
  echo "✓ Files uploaded"

  echo "Invalidating CloudFront cache..."
  DISTRIBUTION_ID=$(aws cloudfront list-distributions --query \
    "DistributionList.Items[?Origins.Items[0].DomainName=='${BUCKET_NAME}.s3.${REGION}.amazonaws.com'].Id" --output text)
  if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
    aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" >/dev/null
    echo "✓ Cache invalidated (propagates in ~30s)"
  fi
  echo ""
}

echo "═══════════════════════════════════════════"
echo "  MMS Demo - Redeploy ($TARGET)"
echo "═══════════════════════════════════════════"
echo ""

case "$TARGET" in
  backend)
    redeploy_backend
    ;;
  frontend)
    redeploy_frontend
    ;;
  all)
    redeploy_backend
    redeploy_frontend
    ;;
  *)
    echo "Usage: $0 [backend|frontend|all]"
    exit 1
    ;;
esac

echo "═══════════════════════════════════════════"
echo "  ✅ Redeploy complete!"
echo "═══════════════════════════════════════════"
