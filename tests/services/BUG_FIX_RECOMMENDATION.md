# Bug Fix Recommendation: Auto-Repair 401 Retry Logic

## Bug Summary

**ID**: BUILD-65-AUTH-001
**Severity**: HIGH
**Component**: `src/services/aiPracticeService.ts`
**Discovered By**: Automated test suite
**Status**: Documented, awaiting fix

---

## Problem Description

The Auto-Repair authentication retry logic fails to trigger when:
1. A Supabase session EXISTS (user previously authenticated)
2. The Edge Function call returns 401 (token expired/rejected)

**Expected Behavior**: Should re-authenticate and retry the request
**Actual Behavior**: Throws error immediately without retry

---

## Technical Details

### Root Cause

**File**: `src/services/aiPracticeService.ts`
**Lines**: 186-209 (`invokeEdgeFunction`), 86-100 (catch block in `generateAIPracticePlan`)

The bug occurs in the error handling flow:

1. **Line 187**: `invokeEdgeFunction` extracts status code from error:
   ```typescript
   const statusCode = (error as any).context?.status;
   ```

2. **Line 200-201**: When `statusCode === 401`, it throws a new Error:
   ```typescript
   if (statusCode === 401) {
     throw new Error('Authentication failed. The session token was rejected by the server. Please contact support.');
   }
   ```

3. **Line 86-88**: The catch block tries to detect 401 errors:
   ```typescript
   catch (error: any) {
     const statusCode = error?.context?.status || (error.message?.includes('401') ? 401 : null);
   ```

**The Problem**: The thrown Error from step 2:
- Does NOT have `.context.status` (lost during transformation)
- Does NOT contain '401' in the message string
- Therefore BOTH detection methods fail in step 3

---

## Reproduction Steps

```typescript
// Mock scenario that triggers the bug
const mockSession = { access_token: 'expired-token', user: { id: 'user-123' } };
supabase.auth.getSession().returns({ session: mockSession });

const error401 = new Error('Unauthorized');
error401.context = { status: 401 };
supabase.functions.invoke().returns({ error: error401 });

await generateAIPracticePlan({ ... });
// Expected: Re-auth + retry
// Actual: Throws "Authentication failed..." immediately
```

**Test Evidence**: See test file line 111-142 (`should propagate 401 error without retry`)

---

## Recommended Fixes

### ⭐ Option 1: Include '401' in Error Message (SIMPLEST)

**File**: `src/services/aiPracticeService.ts`
**Line**: 201

**Change**:
```typescript
// BEFORE
throw new Error('Authentication failed. The session token was rejected by the server. Please contact support.');

// AFTER
throw new Error('401: Authentication failed. The session token was rejected by the server. Please contact support.');
```

**Pros**:
- ✅ One-line fix
- ✅ Triggers existing fallback detection (`error.message?.includes('401')`)
- ✅ No additional error handling needed

**Cons**:
- ⚠️ Exposes status code in user-facing message (minor)

---

### ⭐⭐ Option 2: Preserve Context Property (CLEANEST)

**File**: `src/services/aiPracticeService.ts`
**Line**: 200-201

**Change**:
```typescript
// BEFORE
if (statusCode === 401) {
  throw new Error('Authentication failed. The session token was rejected by the server. Please contact support.');
}

// AFTER
if (statusCode === 401) {
  const err: any = new Error('Authentication failed. The session token was rejected by the server. Please contact support.');
  err.context = { status: 401 };
  throw err;
}
```

**Pros**:
- ✅ Preserves error structure
- ✅ Works with primary detection method (`error.context.status`)
- ✅ No user-facing changes

**Cons**:
- Slightly more code

**Apply same pattern to 403 and 429 errors** (lines 202-206):
```typescript
else if (statusCode === 403) {
  const err: any = new Error('Access denied. Your account may not have permission to use AI features.');
  err.context = { status: 403 };
  throw err;
} else if (statusCode === 429) {
  const err: any = new Error('Rate limit exceeded. Please wait a moment before trying again.');
  err.context = { status: 429 };
  throw err;
}
```

---

### ⭐⭐⭐ Option 3: Custom Error Classes (BEST LONG-TERM)

**Create new file**: `src/services/errors.ts`

```typescript
export class AuthenticationError extends Error {
  public readonly statusCode: number;
  public readonly context: { status: number };

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
    this.context = { status: statusCode };
  }
}

export class EdgeFunctionError extends Error {
  public readonly statusCode?: number;
  public readonly context?: { status: number };

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'EdgeFunctionError';
    if (statusCode) {
      this.statusCode = statusCode;
      this.context = { status: statusCode };
    }
  }
}
```

**Update**: `src/services/aiPracticeService.ts`

```typescript
import { AuthenticationError, EdgeFunctionError } from './errors';

// Line 200-209
if (statusCode === 401) {
  throw new AuthenticationError('Authentication failed. The session token was rejected by the server. Please contact support.', 401);
} else if (statusCode === 403) {
  throw new EdgeFunctionError('Access denied. Your account may not have permission to use AI features.', 403);
} else if (statusCode === 429) {
  throw new EdgeFunctionError('Rate limit exceeded. Please wait a moment before trying again.', 429);
}

throw new EdgeFunctionError('Unable to generate AI practice plan. Please check your connection and try again.');
```

**Catch block** (line 86-100):
```typescript
catch (error: any) {
  // Check for known error types
  if (error instanceof AuthenticationError || error?.context?.status === 401 || error.message?.includes('401')) {
    if (__DEV__) {
      console.warn('   ⚠️ 401 Authentication failed, triggering re-auth...');
    }
    return await reAuthAndRetry(request, USER_ID_KEY);
  }

  throw error;
}
```

**Pros**:
- ✅ Type-safe error handling
- ✅ Better error categorization
- ✅ Easier testing
- ✅ Clear error hierarchy

**Cons**:
- More code changes
- Requires new file

---

## Impact Analysis

### Current Impact
**Affected Scenarios**:
- ✅ Works: No session initially → auto-repair succeeds
- ❌ Broken: Session exists + token expired → auto-repair fails

**User Experience**:
- First-time users: No impact (works correctly)
- Returning users with expired tokens: See error, must restart app

**Frequency Estimate**:
- Low-Medium: Only occurs when session exists but token has expired
- Supabase tokens typically valid for 1 hour
- Most users generate plans within 1-hour session

### Post-Fix Impact
**Affected Scenarios**:
- ✅ All scenarios work correctly
- ✅ Seamless token refresh for returning users
- ✅ No app restart required

---

## Test Updates Required

Once the fix is implemented, update the following tests:

**File**: `tests/services/aiPracticeService.test.ts`

### 1. Scenario 2 (line ~111-142)
**Current**: Documents bug behavior
**Update to**: Verify successful retry after 401

```typescript
it('should re-authenticate and retry when Edge Function returns 401', async () => {
  // Session exists, gets 401, should retry
  // ... (remove bug documentation)

  // ASSERT: Verify retry happened
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
  expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  expect(result).toEqual(mockAIPlan);
});
```

### 2. Scenario 3 (line ~144-249)
**Current**: Documents no-retry bug behavior
**Update to**: Verify error propagation after retry fails

```typescript
it('should propagate error when retry also returns 401 (no infinite loop)', async () => {
  // Both attempts return 401, should fail after retry

  // ASSERT: Exactly 2 calls (initial + 1 retry)
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
  expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
});
```

### 3. Edge Case (line ~656-686)
**Current**: Documents bug in error message detection
**Update to**: Verify 401 detection works

```typescript
it('should handle 401 detection from error message when context.status is missing', async () => {
  // Error has '401' in message but no context.status

  // ASSERT: Should detect and retry
  expect(supabase.auth.signInAnonymously).toHaveBeenCalled();
  expect(result).toEqual(mockAIPlan);
});
```

### 4. Integration Test (line ~738-763)
**Current**: Documents bug in full flow
**Update to**: Verify complete retry flow

```typescript
it('should complete full flow: session exists → 401 → re-auth → save ID → retry → success', async () => {
  // Full flow with retry

  // ASSERT: Verify execution order
  expect(executionOrder).toEqual([
    'getSession',
    'invoke-1',          // First attempt
    'signInAnonymously', // Re-auth triggered
    'setItemAsync',      // ID saved
    'invoke-2',          // Retry
  ]);
});
```

---

## Verification Steps

After implementing the fix:

1. ✅ Run automated tests:
   ```bash
   npm test -- tests/services/aiPracticeService.test.ts
   ```

2. ✅ Verify all 20 tests pass (4 will need updates)

3. ✅ Manual testing:
   - Clear device storage
   - Generate AI practice plan (should succeed)
   - Wait 1+ hour (token expires)
   - Generate another plan (should auto-repair and succeed)

4. ✅ Monitor production logs for:
   - Reduced "Authentication failed" errors
   - Increased "Re-auth triggered" logs (in dev mode)

---

## Timeline Recommendation

**Priority**: HIGH
**Effort**: Low (1-2 hours including testing)
**Risk**: Low (well-tested, clear fix)

**Suggested Schedule**:
- Day 1: Implement fix (Option 2 recommended)
- Day 1: Update tests
- Day 2: Code review + QA testing
- Day 3: Deploy to production

---

## References

- **Test File**: `/Users/jinlee1978/diamondscript/tests/services/aiPracticeService.test.ts`
- **Implementation**: `/Users/jinlee1978/diamondscript/src/services/aiPracticeService.ts`
- **Coverage Report**: `/Users/jinlee1978/diamondscript/tests/services/TEST_COVERAGE_REPORT.md`
- **QA Summary**: `/Users/jinlee1978/diamondscript/tests/services/QA_SUMMARY.md`

---

**Document Version**: 1.0
**Created**: 2026-02-12
**Author**: QA Automation Team
**Reviewed**: Pending
