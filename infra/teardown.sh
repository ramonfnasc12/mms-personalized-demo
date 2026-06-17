#!/bin/bash
set -euo pipefail

# MMS Demo - Teardown Script
# Removes all AWS resources created by deploy.sh

REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="mms-demo-v2"
ECR_REPO="mms-demo-backend"
AWS_PROFILE="${AWS_PROFILE:-ramon-mongo}"
export AWS_PROFILE
unset AWS_ACCESS_KEY_ID 2>/dev/null || true
unset AWS_SECRET_ACCESS_KEY 2>/dev/null || true

echo "═══════════════════════════════════════════"
echo "  MMS Demo - Teardown"
echo "═══════════════════════════════════════════"
echo ""

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Delete PrivateLink VPC endpoint and security group
echo "Cleaning up PrivateLink resources..."
VPC_ID=$(aws cloudformation describe-stack-resource --stack-name "$STACK_NAME" --logical-resource-id VPC \
  --region "$REGION" --query "StackResourceDetail.PhysicalResourceId" --output text 2>/dev/null || echo "")

if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  # Delete VPC endpoints for MongoDB PrivateLink in this VPC
  VPCE_IDS=$(aws ec2 describe-vpc-endpoints \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=vpc-endpoint-type,Values=Interface" \
    --region "$REGION" --query "VpcEndpoints[?contains(ServiceName,'vpce-svc')].VpcEndpointId" --output text 2>/dev/null || echo "")
  if [ -n "$VPCE_IDS" ] && [ "$VPCE_IDS" != "None" ]; then
    echo "  Deleting VPC endpoints: $VPCE_IDS"
    aws ec2 delete-vpc-endpoints --vpc-endpoint-ids $VPCE_IDS --region "$REGION" 2>/dev/null || true
  fi

  # Delete PrivateLink security group
  SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=mms-demo-privatelink-sg" "Name=vpc-id,Values=$VPC_ID" \
    --region "$REGION" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || echo "")
  if [ -n "$SG_ID" ] && [ "$SG_ID" != "None" ]; then
    echo "  Deleting security group: $SG_ID"
    sleep 10  # Wait for VPC endpoint ENIs to detach
    aws ec2 delete-security-group --group-id "$SG_ID" --region "$REGION" 2>/dev/null || true
  fi
fi
echo "✓ PrivateLink resources cleaned up"
echo ""

# Empty S3 bucket before stack deletion
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text 2>/dev/null || echo "")

if [ -n "$BUCKET_NAME" ] && [ "$BUCKET_NAME" != "None" ]; then
  echo "Emptying S3 bucket: $BUCKET_NAME"
  aws s3 rm "s3://$BUCKET_NAME" --recursive --region "$REGION"
fi

# Delete CloudFormation stack
echo "Deleting CloudFormation stack: $STACK_NAME"
aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION"
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$REGION"
echo "✓ Stack deleted"

# Delete ECR repository
echo "Deleting ECR repository: $ECR_REPO"
aws ecr delete-repository --repository-name "$ECR_REPO" --region "$REGION" --force 2>/dev/null || true
echo "✓ ECR repository deleted"

# Clean up local files
rm -f "$(dirname "$0")/.privatelink-vpce-id"
rm -f "$(dirname "$0")/.privatelink-service-name"
rm -f "$(dirname "$0")/.privatelink-connection-string"

echo ""
echo "✅ All resources removed."
echo ""
echo "Note: The Atlas Private Endpoint Service is NOT deleted."
echo "To remove it, go to Atlas → Network Access → Private Endpoint."
