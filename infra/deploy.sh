#!/bin/bash
set -euo pipefail

# MMS Demo - AWS Deployment Script
# Prerequisites: aws cli configured, docker running

REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="mms-demo-v2"
ECR_REPO="mms-demo-backend"
AWS_PROFILE="${AWS_PROFILE:-ramon-mongo}"
export AWS_PROFILE
unset AWS_ACCESS_KEY_ID 2>/dev/null || true
unset AWS_SECRET_ACCESS_KEY 2>/dev/null || true
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "═══════════════════════════════════════════"
echo "  MMS Demo - AWS Deployment"
echo "═══════════════════════════════════════════"
echo ""
echo "Region: $REGION"
echo ""

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account: $ACCOUNT_ID"
echo ""

# Step 1: Create ECR repository (if not exists)
echo "1. Setting up ECR repository..."
aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$REGION" 2>/dev/null || \
  aws ecr create-repository --repository-name "$ECR_REPO" --region "$REGION" --query 'repository.repositoryUri' --output text
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO"
echo "   ✓ ECR: $ECR_URI"
echo ""

# Step 2: Build and push Docker image
echo "2. Building backend Docker image (linux/amd64)..."
docker build --platform linux/amd64 -t "$ECR_REPO" "$PROJECT_DIR/backend"
echo "   ✓ Image built"

echo "   Pushing to ECR..."
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
docker tag "$ECR_REPO:latest" "$ECR_URI:latest"
docker push "$ECR_URI:latest"
echo "   ✓ Image pushed"
echo ""

# Step 3: Deploy CloudFormation stack
echo "3. Deploying CloudFormation stack..."

# Load env vars from backend/.env into local variables
MONGODB_URI=$(grep '^MONGODB_URI=' "$PROJECT_DIR/backend/.env" | cut -d= -f2-)
MONGODB_DATABASE=$(grep '^MONGODB_DATABASE=' "$PROJECT_DIR/backend/.env" | cut -d= -f2-)
BEDROCK_ACCESS_KEY=$(grep '^AWS_ACCESS_KEY_ID=' "$PROJECT_DIR/backend/.env" | cut -d= -f2-)
BEDROCK_SECRET_KEY=$(grep '^AWS_SECRET_ACCESS_KEY=' "$PROJECT_DIR/backend/.env" | cut -d= -f2-)
BEDROCK_REGION=$(grep '^AWS_REGION=' "$PROJECT_DIR/backend/.env" | cut -d= -f2-)
BEDROCK_TEXT_MODEL=$(grep '^BEDROCK_TEXT_MODEL=' "$PROJECT_DIR/backend/.env" | cut -d= -f2-)

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$SCRIPT_DIR/cloudformation.yaml" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --parameter-overrides \
    "MongoDBUri=$MONGODB_URI" \
    "MongoDBDatabase=$MONGODB_DATABASE" \
    "AwsAccessKeyIdParam=$BEDROCK_ACCESS_KEY" \
    "AwsSecretAccessKeyParam=$BEDROCK_SECRET_KEY" \
    "BedrockRegion=$BEDROCK_REGION" \
    "BedrockTextModel=$BEDROCK_TEXT_MODEL" \
    "BackendImage=$ECR_URI:latest"

echo "   ✓ Stack deployed"
echo ""

# Step 4: Get outputs
echo "4. Retrieving endpoints..."
BACKEND_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='BackendURL'].OutputValue" --output text)
FRONTEND_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendURL'].OutputValue" --output text)
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)

echo "   Backend:  $BACKEND_URL"
echo "   Frontend: $FRONTEND_URL"
echo ""

# Step 5: Build and deploy frontend
# Frontend uses same CloudFront origin (/api) for HTTPS
API_VIA_CLOUDFRONT="https://$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendURL'].OutputValue" --output text | sed 's|https://||')/api"
echo "5. Building frontend with API URL: $API_VIA_CLOUDFRONT"
cd "$PROJECT_DIR/frontend"
VITE_API_URL="$API_VIA_CLOUDFRONT" npm run build
echo "   ✓ Frontend built"

echo "   Uploading to S3..."
aws s3 sync dist/ "s3://$BUCKET_NAME/" --delete --region "$REGION"
echo "   ✓ Frontend deployed"
echo ""

# Step 6: Invalidate CloudFront cache
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query \
  "DistributionList.Items[?Origins.Items[0].DomainName=='${BUCKET_NAME}.s3.${REGION}.amazonaws.com'].Id" --output text)
if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
  aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" >/dev/null
  echo "   ✓ CloudFront cache invalidated"
fi

# Step 7: Setup PrivateLink and start backend
echo ""
echo "7. Setting up PrivateLink..."
"$SCRIPT_DIR/setup-privatelink.sh"
echo ""

echo "8. Scaling ECS service to 1..."
aws ecs update-service \
  --cluster mms-demo-v2-cluster \
  --service mms-demo-v2-backend \
  --desired-count 1 \
  --force-new-deployment \
  --region "$REGION" \
  --query 'service.serviceName' --output text >/dev/null
echo "   ✓ Backend starting (will be live in ~60s)"

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Deployment Complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "  Backend API: $BACKEND_URL"
echo "  Frontend:    $FRONTEND_URL"
echo ""
echo "  Note: CloudFront may take a few minutes"
echo "  to fully propagate."
echo "═══════════════════════════════════════════"
