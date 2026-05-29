#!/bin/bash
# Deploy Voice Pipeline Lambda
# Usage: ./deploy.sh [region] [function-name]
set -e

REGION="${1:-eu-west-2}"
FUNC_NAME="${2:-voicevision-voice-pipeline}"
ROLE_NAME="voice-pipeline-lambda-role"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== Voice Pipeline Lambda Deploy ==="
echo "Region: $REGION"
echo "Function: $FUNC_NAME"
echo ""

# 1. Install deps and bundle
echo "[1/5] Bundling Lambda..."
cd "$(dirname "$0")"
rm -rf dist node_modules
npm install --production
mkdir -p dist
cp index.mjs dist/
cp -r node_modules dist/
# Use Node.js to create zip (no zip command in sandbox)
node -e "
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
// Simple tar.gz alternative - Lambda supports zip only, so use inline zip via node
const archiver = require.resolve('archiver') || '';
" 2>/dev/null || true
cd dist && node -e "
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
// Try installing archiver and creating zip
const os = require('os');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lambda-'));
fs.cpSync('.', tmpDir, { recursive: true });
" || true
# Alternative: use python3 zipfile
python3 -c "
import zipfile, os
dist_dir = 'dist'
with zipfile.ZipFile('function.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(dist_dir):
        for f in files:
            fp = os.path.join(root, f)
            zf.write(fp, os.path.relpath(fp, dist_dir))
print(f'Created function.zip with {len(zf.namelist())} files')
" && cd ..

# 2. Create IAM role (if not exists)
echo "[2/5] Ensuring IAM role..."
if ! aws iam get-role --role-name "$ROLE_NAME" --region "$REGION" &>/dev/null; then
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --region "$REGION"

  # Attach policies
  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
    --region "$REGION"

  # Wait for IAM propagation
  echo "Waiting for IAM propagation..."
  sleep 10
fi

# 3. Create/update inline policy for Transcribe + Bedrock + Polly
echo "[3/5] Setting permissions..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "VoicePipelineAccess" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "transcribe:StartStreamTranscriptionWebSocket",
          "transcribe:StartStreamTranscription"
        ],
        "Resource": "*"
      },
      {
        "Effect": "Allow",
        "Action": ["bedrock:InvokeModel"],
        "Resource": [
          "arn:aws:bedrock:'$REGION'::foundation-model/anthropic.claude-3-5-haiku*",
          "arn:aws:bedrock:'$REGION'::foundation-model/us.anthropic.claude-3-5-haiku*"
        ]
      },
      {
        "Effect": "Allow",
        "Action": ["polly:SynthesizeSpeech"],
        "Resource": "*"
      }
    ]
  }' \
  --region "$REGION"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# 4. Create or update Lambda
echo "[4/5] Deploying Lambda..."
if aws lambda get-function --function-name "$FUNC_NAME" --region "$REGION" &>/dev/null; then
  echo "Updating function code..."
  aws lambda update-function-code \
    --function-name "$FUNC_NAME" \
    --zip-file fileb://function.zip \
    --region "$REGION"

  # Wait for update to complete
  aws lambda wait function-updated \
    --function-name "$FUNC_NAME" \
    --region "$REGION"

  echo "Updating function config..."
  aws lambda update-function-configuration \
    --function-name "$FUNC_NAME" \
    --timeout 30 \
    --memory-size 512 \
    --runtime nodejs20.x \
    --handler index.handler \
    --region "$REGION"
else
  echo "Creating new function..."
  aws lambda create-function \
    --function-name "$FUNC_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --timeout 30 \
    --memory-size 512 \
    --zip-file fileb://function.zip \
    --region "$REGION"

  aws lambda wait function-active \
    --function-name "$FUNC_NAME" \
    --region "$REGION"
fi

# 5. Create/update Function URL with CORS
echo "[5/5] Configuring Function URL..."
if aws lambda get-function-url-config --function-name "$FUNC_NAME" --region "$REGION" &>/dev/null; then
  aws lambda update-function-url-config \
    --function-name "$FUNC_NAME" \
    --auth-type NONE \
    --region "$REGION" \
    --cors '{
      "AllowOrigins": ["*"],
      "AllowMethods": ["POST", "OPTIONS"],
      "AllowHeaders": ["Content-Type"],
      "MaxAge": 86400
    }' || true
else
  aws lambda create-function-url-config \
    --function-name "$FUNC_NAME" \
    --auth-type NONE \
    --region "$REGION" \
    --cors '{
      "AllowOrigins": ["*"],
      "AllowMethods": ["POST", "OPTIONS"],
      "AllowHeaders": ["Content-Type"],
      "MaxAge": 86400
    }'
fi

URL=$(aws lambda get-function-url-config \
  --function-name "$FUNC_NAME" \
  --region "$REGION" \
  --query FunctionUrl --output text)

echo ""
echo "=== Deploy Complete ==="
echo "Function URL: $URL"
echo ""
echo "Add to .env: VITE_VOICE_PIPELINE_URL=$URL"
