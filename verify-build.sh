#!/bin/bash

echo "🔍 Vercel Build Verification Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# 1. Check API endpoint count
echo -n "1. Checking API endpoint count... "
API_COUNT=$(find api -name "*.ts" -not -path "api/_lib/*" | grep -v tsconfig | wc -l | tr -d ' ')
if [ "$API_COUNT" -le 12 ]; then
    echo -e "${GREEN}✓ $API_COUNT endpoints (under 12 limit)${NC}"
else
    echo -e "${RED}✗ $API_COUNT endpoints (exceeds 12 limit)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 2. Check for Python files in API directory
echo -n "2. Checking for Python files in API... "
PYTHON_FILES=$(find api -name "*.py" | wc -l | tr -d ' ')
if [ "$PYTHON_FILES" -eq 0 ]; then
    echo -e "${GREEN}✓ No Python files${NC}"
else
    echo -e "${YELLOW}⚠ Found $PYTHON_FILES Python files (may cause issues)${NC}"
    find api -name "*.py" | head -5
fi

# 3. Check TypeScript compilation
echo -n "3. Checking API TypeScript compilation... "
if npx tsc --noEmit -p api/tsconfig.json 2>/dev/null; then
    echo -e "${GREEN}✓ No TypeScript errors${NC}"
else
    echo -e "${RED}✗ TypeScript compilation errors${NC}"
    npx tsc --noEmit -p api/tsconfig.json
    ERRORS=$((ERRORS + 1))
fi

# 4. Check frontend build
echo -n "4. Checking frontend build... "
if cd frontend && npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend builds successfully${NC}"
    cd ..
else
    echo -e "${RED}✗ Frontend build failed${NC}"
    ERRORS=$((ERRORS + 1))
    cd ..
fi

# 5. Check for consistent API patterns
echo -n "5. Checking API export patterns... "
OLD_PATTERN=$(grep -l "export default.*handler" api/*.ts 2>/dev/null | wc -l | tr -d ' ')
NEW_PATTERN=$(grep -l "export async function \(GET\|POST\|PUT\|DELETE\)" api/*.ts 2>/dev/null | wc -l | tr -d ' ')
if [ "$OLD_PATTERN" -gt 0 ] && [ "$NEW_PATTERN" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Mixed patterns found (old: $OLD_PATTERN, new: $NEW_PATTERN)${NC}"
    echo "   Old pattern in:"
    grep -l "export default.*handler" api/*.ts 2>/dev/null | head -3 | sed 's/^/     - /'
    echo "   New pattern in:"
    grep -l "export async function \(GET\|POST\|PUT\|DELETE\)" api/*.ts 2>/dev/null | head -3 | sed 's/^/     - /'
else
    echo -e "${GREEN}✓ Consistent API patterns${NC}"
fi

# 6. Check vercel.json validity
echo -n "6. Checking vercel.json... "
if [ -f "vercel.json" ]; then
    if jq . vercel.json > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Valid JSON${NC}"
    else
        echo -e "${RED}✗ Invalid JSON${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ vercel.json not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 7. Check for required environment variables
echo -n "7. Checking for .env references... "
ENV_REFS=$(grep -h "process\.env\." api/*.ts frontend/src/**/*.ts 2>/dev/null | grep -o "process\.env\.[A-Z_]*" | sort | uniq | wc -l | tr -d ' ')
echo -e "${YELLOW}ℹ Found $ENV_REFS environment variable references${NC}"

echo ""
echo "=================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Safe to deploy.${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s). Fix before deploying.${NC}"
    exit 1
fi