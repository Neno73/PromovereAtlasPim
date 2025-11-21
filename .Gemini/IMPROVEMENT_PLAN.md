# Improvement Plan: PromovereAtlasPim Backend

Based on the comprehensive PR review, this plan outlines the steps to improve code quality, security, and performance.

## 1. Testing Strategy (Priority 1) ✅ COMPLETED
**Goal:** Add basic test coverage for critical components.
**Current State:** Jest installed, 13 tests passing.

### Actions:
- [x] **Install Jest**: Set up `jest` and `ts-jest` for TypeScript testing.
- [x] **Unit Tests for Transformers**:
    - Test `product-transformer.ts` (Promidata -> Local) - 7 tests
    - Test `product-to-json.ts` (Local -> Gemini) - 6 tests
- [ ] **Unit Tests for Queue Workers**:
    - Mock `Job` object and test `process` methods for `gemini-sync-worker` and `supplier-sync-worker`.
- [ ] **Integration Tests (Optional/Later)**: Test full flow with mocked external services.

## 2. Documentation (Priority 2) ✅ COMPLETED
**Goal:** Document new API endpoints.
**Current State:** Swagger/OpenAPI documentation configured.

### Actions:
- [x] **Install Documentation Plugin**: Add `@strapi/plugin-documentation`.
- [x] **Annotate Gemini Routes**: Add comments/overrides to generate Swagger docs for:
    - `POST /api/gemini-sync/init`
    - `POST /api/gemini-sync/trigger-all`

## 3. Resilience & Security (Priority 2/3) ✅ COMPLETED
**Goal:** Improve error handling and secure file operations.

### Actions:
- [x] **Circuit Breaker**: Implement `axios-retry` or a custom wrapper for Gemini and Promidata API calls to handle transient failures with exponential backoff.
- [x] **Secure File Handling**:
    - Update `gemini-service.ts` to use `fs.writeFileSync` with `mode: 0o600` (read/write only for owner).
    - Ensure temporary files are cleaned up in a `finally` block even if uploads fail.
- [x] **Error Sanitization**: Create a utility function to format errors for API responses, hiding stack traces and internal paths in production.

## 4. Performance & Monitoring (Priority 2/3)
**Goal:** Optimize resource usage and visibility.

### Actions:
- [ ] **In-Memory Streaming**: Refactor `gemini-service.ts` to stream data directly to Gemini File API if supported, or strictly manage temp file lifecycle.
- [ ] **Queue Monitoring**:
    - Add a scheduled job or middleware to log queue depth and processing times.
    - Alerting is complex without external tools, but we can log "High Load" warnings if queue length > threshold.

## 5. Execution Order
1.  **Setup Testing**: Install Jest and write transformer tests (Low risk, high value).
2.  **Secure Files**: Fix the temp file permission issue (Security).
3.  **Circuit Breaker**: Add retry logic (Resilience).
4.  **Documentation**: Install plugin and document APIs.
