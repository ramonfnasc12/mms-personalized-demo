#!/bin/bash
set -euo pipefail

# MMS Demo - MongoDB Atlas PrivateLink Setup
# Creates a private endpoint between your VPC and Atlas cluster.
# Rerunnable: handles "already exists" cases gracefully.

REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="mms-demo-v2"
AWS_PROFILE="${AWS_PROFILE:-ramon-mongo}"
export AWS_PROFILE
unset AWS_ACCESS_KEY_ID 2>/dev/null || true
unset AWS_SECRET_ACCESS_KEY 2>/dev/null || true

ATLAS_PROJECT_ID="6a18682224e663d013958abf"
ATLAS_CLUSTER_NAME="Main"
ATLAS_CLIENT_ID="${MDB_MCP_API_CLIENT_ID}"
ATLAS_CLIENT_SECRET="${MDB_MCP_API_CLIENT_SECRET}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "═══════════════════════════════════════════"
echo "  MongoDB Atlas PrivateLink Setup"
echo "═══════════════════════════════════════════"
echo ""

# Step 1: Get OAuth2 token from Atlas
echo "1. Authenticating with Atlas API..."
TOKEN=$(curl -s --request POST \
  "https://cloud.mongodb.com/api/oauth/token" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  -u "${ATLAS_CLIENT_ID}:${ATLAS_CLIENT_SECRET}" \
  --data-urlencode "grant_type=client_credentials" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "   ✓ Authenticated"
echo ""

# Helper: Atlas v1 API call (v1 works for private endpoint CRUD)
atlas_v1() {
  local method="$1"
  local path="$2"
  local data="${3:-}"

  if [ -n "$data" ]; then
    curl -s -X "$method" \
      "https://cloud.mongodb.com/api/atlas/v1.0/groups/${ATLAS_PROJECT_ID}${path}" \
      --header "Authorization: Bearer ${TOKEN}" \
      --header "Content-Type: application/json" \
      --data "$data"
  else
    curl -s -X "$method" \
      "https://cloud.mongodb.com/api/atlas/v1.0/groups/${ATLAS_PROJECT_ID}${path}" \
      --header "Authorization: Bearer ${TOKEN}" \
      --header "Content-Type: application/json"
  fi
}

# Step 2: Create or get Private Endpoint Service in Atlas
echo "2. Setting up Private Endpoint Service in Atlas..."
PE_RESPONSE=$(atlas_v1 POST "/privateEndpoint/endpointService" '{
  "providerName": "AWS",
  "region": "US_EAST_1"
}')

PE_ID=$(echo "$PE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','') or '')")

if [ -z "$PE_ID" ]; then
  ERROR_CODE=$(echo "$PE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('errorCode',''))" 2>/dev/null || echo "")
  if [ "$ERROR_CODE" = "PRIVATE_ENDPOINT_SERVICE_ALREADY_EXISTS_FOR_REGION" ]; then
    echo "   Already exists, fetching..."
    PE_LIST=$(atlas_v1 GET "/privateEndpoint/AWS/endpointService")
    PE_ID=$(echo "$PE_LIST" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['id'] if isinstance(data, list) and data else '')")
  else
    echo "   ✗ Failed: $PE_RESPONSE"
    exit 1
  fi
fi
echo "   ✓ PE Service ID: $PE_ID"
echo ""

# Step 3: Wait for service name to be provisioned
echo "3. Getting endpoint service name..."
SERVICE_NAME=""
for i in $(seq 1 30); do
  PE_INFO=$(atlas_v1 GET "/privateEndpoint/AWS/endpointService/${PE_ID}")
  STATUS=$(echo "$PE_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
  SERVICE_NAME=$(echo "$PE_INFO" | python3 -c "import sys,json; v=json.load(sys.stdin).get('endpointServiceName'); print(v if v else '')")

  if [ -n "$SERVICE_NAME" ]; then
    echo "   ✓ Status: $STATUS"
    echo "   ✓ Service: $SERVICE_NAME"
    break
  fi
  echo "   Status: $STATUS (provisioning...)"
  sleep 10
done

if [ -z "$SERVICE_NAME" ]; then
  echo "   ✗ Timed out waiting for endpoint service name"
  exit 1
fi
echo ""

# Step 4: Get VPC details from CloudFormation stack
echo "4. Getting VPC details from CloudFormation..."
VPC_ID=$(aws cloudformation describe-stack-resource \
  --stack-name "$STACK_NAME" --logical-resource-id VPC \
  --region "$REGION" --query "StackResourceDetail.PhysicalResourceId" --output text)
SUBNET1_ID=$(aws cloudformation describe-stack-resource \
  --stack-name "$STACK_NAME" --logical-resource-id PublicSubnet1 \
  --region "$REGION" --query "StackResourceDetail.PhysicalResourceId" --output text)
SUBNET2_ID=$(aws cloudformation describe-stack-resource \
  --stack-name "$STACK_NAME" --logical-resource-id PublicSubnet2 \
  --region "$REGION" --query "StackResourceDetail.PhysicalResourceId" --output text)
echo "   VPC: $VPC_ID"
echo "   Subnets: $SUBNET1_ID, $SUBNET2_ID"
echo ""

# Step 5: Create Security Group for PrivateLink
echo "5. Creating Security Group..."
SG_ID=$(aws ec2 create-security-group \
  --group-name mms-demo-privatelink-sg \
  --description "MongoDB Atlas PrivateLink" \
  --vpc-id "$VPC_ID" \
  --region "$REGION" \
  --query 'GroupId' --output text 2>/dev/null || \
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=mms-demo-privatelink-sg" "Name=vpc-id,Values=$VPC_ID" \
    --region "$REGION" --query "SecurityGroups[0].GroupId" --output text)

# Allow MongoDB traffic (ports 1024-65535) from VPC CIDR
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --protocol tcp --port 1024-65535 \
  --cidr 10.0.0.0/16 \
  --region "$REGION" 2>/dev/null || true

echo "   ✓ Security Group: $SG_ID"
echo ""

# Step 6: Create AWS VPC Endpoint
echo "6. Creating VPC Endpoint..."
VPCE_ID=$(aws ec2 describe-vpc-endpoints \
  --filters "Name=service-name,Values=$SERVICE_NAME" "Name=vpc-id,Values=$VPC_ID" \
  --region "$REGION" --query "VpcEndpoints[?State!='deleted'].VpcEndpointId | [0]" --output text 2>/dev/null)

if [ -z "$VPCE_ID" ] || [ "$VPCE_ID" = "None" ]; then
  VPCE_ID=$(aws ec2 create-vpc-endpoint \
    --vpc-id "$VPC_ID" \
    --vpc-endpoint-type Interface \
    --service-name "$SERVICE_NAME" \
    --subnet-ids "$SUBNET1_ID" "$SUBNET2_ID" \
    --security-group-ids "$SG_ID" \
    --region "$REGION" \
    --query 'VpcEndpoint.VpcEndpointId' --output text)
  echo "   ✓ Created: $VPCE_ID"
else
  echo "   ✓ Already exists: $VPCE_ID"
fi
echo ""

# Step 7: Register VPC Endpoint with Atlas (must happen before AWS accepts it)
echo "7. Registering VPC Endpoint with Atlas..."
REGISTER_RESPONSE=$(atlas_v1 POST "/privateEndpoint/AWS/endpointService/${PE_ID}/endpoint" "{
  \"id\": \"${VPCE_ID}\"
}")

REG_STATUS=$(echo "$REGISTER_RESPONSE" | python3 -c "
import sys,json
d = json.load(sys.stdin)
print(d.get('connectionStatus', d.get('status', d.get('errorCode', 'unknown'))))
" 2>/dev/null || echo "unknown")
echo "   ✓ Status: $REG_STATUS"
echo ""

# Step 8: Wait for VPC Endpoint to be available (Atlas accepts it after registration)
echo "8. Waiting for VPC Endpoint to become available..."
for i in $(seq 1 60); do
  STATE=$(aws ec2 describe-vpc-endpoints --vpc-endpoint-ids "$VPCE_ID" --region "$REGION" \
    --query "VpcEndpoints[0].State" --output text)
  if [ "$STATE" = "available" ]; then
    echo "   ✓ Available"
    break
  fi
  echo "   State: $STATE"
  sleep 10
done
echo ""

# Step 9: Wait for Atlas to confirm the connection
echo "9. Waiting for Atlas to confirm connection..."
for i in $(seq 1 60); do
  EP_INFO=$(atlas_v1 GET "/privateEndpoint/AWS/endpointService/${PE_ID}/endpoint/${VPCE_ID}")
  EP_STATUS=$(echo "$EP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('connectionStatus',''))" 2>/dev/null || echo "waiting")

  if [ "$EP_STATUS" = "AVAILABLE" ]; then
    echo "   ✓ PrivateLink connection is AVAILABLE!"
    break
  fi
  echo "   Status: $EP_STATUS"
  sleep 10
done
echo ""

# Step 10: Get the private connection string
echo "10. Getting private connection string..."
sleep 5  # Brief pause for Atlas to update cluster connection strings
CLUSTER_INFO=$(atlas_v1 GET "/clusters/${ATLAS_CLUSTER_NAME}")

PRIVATE_SRV=$(echo "$CLUSTER_INFO" | python3 -c "
import sys, json, os
vpce_id = '${VPCE_ID}'
data = json.load(sys.stdin)
cs = data.get('connectionStrings', {})
for pe in cs.get('privateEndpoint', []):
    for ep in pe.get('endpoints', []):
        if ep.get('endpointId') == vpce_id:
            print(pe.get('srvConnectionString', ''))
            sys.exit(0)
# Fallback: use first available
private = cs.get('privateEndpoint', [])
if private:
    print(private[-1].get('srvConnectionString', ''))
else:
    print('')
")

if [ -z "$PRIVATE_SRV" ]; then
  STANDARD_SRV=$(echo "$CLUSTER_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('connectionStrings',{}).get('standardSrv',''))")
  echo "   ⚠ Private endpoint string not yet available."
  echo "   Standard SRV: $STANDARD_SRV"
  echo "   The private string usually appears within 1-2 minutes."
  echo "   Check Atlas UI: Database → Connect → Private Endpoint"
  PRIVATE_SRV="$STANDARD_SRV"
else
  echo "   ✓ $PRIVATE_SRV"
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ PrivateLink Setup Complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "  VPC Endpoint:  $VPCE_ID"
echo "  Atlas PE ID:   $PE_ID"
echo "  Service:       $SERVICE_NAME"
echo ""
echo "  Private Connection String:"
echo "  $PRIVATE_SRV"
echo ""
echo "  Next Steps:"
echo "  1. Update MONGODB_URI in backend/.env:"
echo "     ${PRIVATE_SRV}/mms_demo?retryWrites=true&w=majority"
echo "  2. Redeploy: ./infra/redeploy.sh backend"
echo "═══════════════════════════════════════════"

# Save values for other scripts
echo "$VPCE_ID" > "$SCRIPT_DIR/.privatelink-vpce-id"
echo "$SERVICE_NAME" > "$SCRIPT_DIR/.privatelink-service-name"
echo "$PRIVATE_SRV" > "$SCRIPT_DIR/.privatelink-connection-string"
