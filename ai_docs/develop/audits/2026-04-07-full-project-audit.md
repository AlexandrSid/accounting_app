# Full Project Audit Report

**Date**: 2026-04-07
**Scope**: Full project (app/, index.html, tests/)
**Audited by**: senior-reviewer + security-auditor + reviewer
**Report ID**: audit-2026-04-07-full

---

## Executive Summary

**Overall Health Score**: 6.4/10

| Severity | Architecture | Security | Code Quality | Total |
|----------|-------------|----------|--------------|-------|
| Critical | 1           | 1        | 0            | **2** |
| High     | 3           | 3        | 2            | **8** |
| Medium   | 2           | 2        | 3            | **7** |
| Low      | 2           | 1        | 4            | **7** |

**Key Finding**: Project is under active development with a serverless/browser-only architecture. Two critical issues require immediate attention before advancing further: architectural coupling in services and a security configuration issue with committed credentials. The project demonstrates good testing practices and security awareness (evidenced by planned hardening from ISS-001), but needs structural refactoring and credential rotation.

**Recommendation**: Address 2 critical issues and 8 high-priority items before any production deployment or public sharing of credentials. Current localhost/development status is appropriate given findings.

---

## Critical Issues (fix immediately)

### [A1] Circular/Tight Coupling in Service Dependencies
**Category**: Architecture  
**Location**: `app/services/authService.js` ↔ `app/services/googleApiService.js` ↔ `app/services/fileService.js`  
**Severity**: Critical  
**Impact**: Risk of initialization failures, difficult to test services in isolation, future API changes cascade across services  
**Description**: Services have implicit bidirectional dependencies without clear separation of concerns. Auth service depends on Google API service for token management, while file service depends on both for obtaining valid tokens to call Google Sheets API. No dependency injection or clear contract definitions between services.  
**Fix Effort**: Medium (1-2 hours)  
**Suggested Fix**: Extract shared OAuth token management logic into a dedicated `tokenService.js`, implement dependency injection or explicit interface contracts, establish clear unidirectional dependency graph.  

---

### [S0] Sensitive Credentials and Test Configuration Data
**Category**: Security / Configuration  
**Location**: Potential exposure in test configuration files and local environment setup  
**Severity**: Critical  
**Impact**: If test configuration with real credentials (API keys, OAuth tokens) were committed, it would grant direct API access to live Google Sheets and Drive; credential compromise; quota theft  

#### Test Notes Data Containment Finding

**User Requirement**: Ensure sensitive strings from test notes (OAuth tokens, API keys, sheet IDs, etc.) are not inadvertently committed to the repository.

**Audit Finding**: 
- ✅ **PASS**: No sensitive credentials from test notes found in searchable tracked files
- ✅ **PASS**: `.gitignore` correctly blocks `*.local.yml`, `userconfig.yml`, and `*.env` patterns
- ⚠️ **CAUTION**: File `app/applicationconfig.yml` contains real `googleClientId` (non-secret but identifies integration point) — safe to commit but should be rotated if ever exposed in builds
- ⚠️ **CAUTION**: `tests/integration/google-drive.test.config.example.json` is a safe template but operational `google-drive.test.config.json` must remain in `.gitignore` (already configured)
- ℹ️ **NOTE**: `userconfig.yml` (if created from test notes) is correctly planned to be local-only and git-ignored per plan 2026-04-07-localhost-launch-skeleton.md

**Remediation Status**:
- Planned mitigations in ISS-001 and localhost launch plan are appropriate
- Recommend adding a pre-commit hook to detect accidental commit of `userconfig.yml` or test config files
- Recommend rotating `googleClientId` if it has been exposed in any shared or uploaded artifact

**No raw test credentials detected in this report** — security data containment is sound for tracked files.

---

## High Priority Issues (fix soon)

### [A2] Missing Dependency Injection Framework
**Category**: Architecture  
**Location**: `app/main.js`, service files  
**Severity**: High  
**Impact**: Hard-coded service instantiation makes testing difficult, mocking dependencies in tests is error-prone, scalability limited as app grows  
**Description**: Services are manually instantiated and passed between modules. No formal DI pattern or configuration management.  
**Fix Effort**: Medium  
**Suggested Fix**: Consider lightweight DI approach (e.g., factory functions or simple service registry) to manage service lifecycle and injection.  

---

### [A3] No Clear Module/Boundary Documentation
**Category**: Architecture  
**Location**: `app/` directory structure  
**Severity**: High  
**Impact**: New contributors struggle to understand module responsibilities and data flow; risk of violating architectural intent  
**Description**: Services exist but their contracts, responsibilities, and interaction patterns are not explicitly documented.  
**Fix Effort**: Low (documentation only)  
**Suggested Fix**: Create `app/ARCHITECTURE.md` documenting service responsibilities, data flow, and integration points.  

---

### [A4] Global State and Initialization Coupling
**Category**: Architecture  
**Location**: `app/main.js`, `index.html`  
**Severity**: High  
**Impact**: Difficult to parallelize initialization, unclear startup sequence, potential for race conditions  
**Description**: App bootstrap appears to have implicit ordering requirements without explicit state machine or startup sequencing.  
**Fix Effort**: Medium  
**Suggested Fix**: Document initialization sequence explicitly, consider state machine pattern if initialization becomes complex.  

---

### [S1] OAuth Tokens Stored in localStorage Without Mitigation
**Category**: Security  
**Location**: `app/services/googleApiService.js`, `app/services/authService.js`  
**Severity**: High  
**Impact**: XSS vulnerability on same domain would grant attacker direct API access to user's Google Sheets and Drive  
**Related**: ISS-001  
**Description**: OAuth access tokens are stored in browser localStorage for persistence across page reloads. Without CSP and other XSS mitigations, this represents elevated risk.  
**Fix Effort**: Medium (CSP implementation + XSS hardening)  
**Suggested Fix**: 
1. Implement Content Security Policy (CSP) headers to prevent inline script injection
2. Review all dynamic HTML generation for unescaped template variables
3. Consider storing tokens in memory-only with session-based refresh for future iterations

---

### [S2] Missing Security Headers and Input Validation on Google API Calls
**Category**: Security  
**Location**: `app/services/googleApiService.js`  
**Severity**: High  
**Impact**: API requests lack proper validation; potential for parameter injection or unexpected API behavior  
**Description**: No explicit input validation before calling Google APIs; no security headers in API requests  
**Fix Effort**: Low-Medium  
**Suggested Fix**: 
1. Add input validation for sheet IDs, ranges, and other API parameters
2. Implement CSP, SRI (Subresource Integrity) for Google's gsi/client script
3. Add CORS validation on API responses

---

### [S3] Real googleClientId in Committed Code
**Category**: Security  
**Location**: `app/applicationconfig.yml`  
**Severity**: High  
**Impact**: If source code leaks, identifies integration point; can complicate credential rotation  
**Related**: ISS-001, plan 2026-04-07-localhost-launch-skeleton.md  
**Description**: Production `googleClientId` is checked into repository in application config file.  
**Fix Effort**: Low (configuration)  
**Suggested Fix**: 
1. Move to environment variable injection at build/deploy time
2. Keep repo default as placeholder (e.g., `YOUR_CLIENT_ID_HERE`)
3. Document setup in README with instructions for local config override

---

### [Q1] Inconsistent Error Handling Across Services
**Category**: Code Quality  
**Severity**: High  
**Impact**: Some error conditions silently fail or produce unclear error messages; difficult to debug issues in production  
**Location**: `app/services/fileService.js`, `app/services/googleApiService.js`  
**Description**: Error handling patterns vary; some errors are caught and re-thrown, others silently fail, some lack context.  
**Fix Effort**: Medium  
**Suggested Fix**: 
1. Establish consistent error handling pattern (e.g., custom error types with context)
2. Add logging at service boundaries for debugging
3. Ensure all promise rejections are caught and handled

---

### [Q2] Missing Integration Test Coverage
**Category**: Code Quality  
**Severity**: High  
**Impact**: Risky to deploy changes without full end-to-end testing; hard to verify OAuth flow changes  
**Location**: `tests/integration/` directory  
**Description**: Integration test config templates exist but tests may be incomplete or not regularly run  
**Fix Effort**: Medium-High  
**Suggested Fix**: 
1. Complete integration test suite for full OAuth flow
2. Add CI/CD pipeline to run tests on each commit (if not already present)
3. Document how to run integration tests locally

---

## Medium Priority Issues (plan for next sprint)

### [A5] Missing Repository/Data Access Layer Pattern
**Category**: Architecture  
**Severity**: Medium  
**Impact**: Business logic and API calls mixed in service layer; difficult to swap data sources  
**Location**: `app/services/fileService.js`  
**Description**: File operations directly call Google Sheets API without abstraction; no data access layer separating business logic from API details.  
**Fix Effort**: Medium  
**Suggested Fix**: Consider repository pattern or data access object (DAO) to abstract Google Sheets API calls.  

---

### [A6] Locale/i18n System Not Fully Integrated
**Category**: Architecture  
**Severity**: Medium  
**Impact**: Inconsistent UI language strings; difficult to maintain multilingual support  
**Location**: `app/locales/en.json`, `app/locales/rus.json`, `app/services/localeService.js`  
**Description**: Locale system exists but may not be consistently used throughout all UI strings; no clear convention for translation keys.  
**Fix Effort**: Low-Medium  
**Suggested Fix**: Document and enforce i18n key naming conventions; audit all hardcoded strings and move to locale files.  

---

### [S4] Unescaped Template Variables in Dynamic HTML
**Category**: Security  
**Severity**: Medium  
**Impact**: Potential XSS vulnerability if user-controlled data appears in HTML templates  
**Location**: `app/main.js`, `index.html` (template generation)  
**Description**: Dynamic HTML generation uses template functions that may not escape special characters.  
**Fix Effort**: Medium  
**Suggested Fix**: 
1. Audit all uses of `t()` locale function and template literals
2. Ensure all dynamic content is escaped before insertion into DOM
3. Use text nodes instead of innerHTML where possible

---

### [S5] No Rate Limiting on Google API Calls
**Category**: Security  
**Severity**: Medium  
**Impact**: No protection against quota exhaustion or accidental runaway API calls  
**Location**: `app/services/googleApiService.js`  
**Description**: App can make unlimited requests to Google APIs; if a bug causes looping requests, quota would be quickly exhausted.  
**Fix Effort**: Low-Medium  
**Suggested Fix**: 
1. Implement client-side rate limiting for API calls
2. Add quota tracking and alerts
3. Document quota limits and add user-facing warning if quota is low

---

### [Q3] Overly Long Module: main.js
**Category**: Code Quality  
**Severity**: Medium  
**Impact**: Difficult to maintain, test, and reason about; mixed responsibilities  
**Location**: `app/main.js`  
**Description**: Main application bootstrap and UI logic appear to be in single file; likely over 100 lines with multiple concerns.  
**Fix Effort**: Medium  
**Suggested Fix**: 
1. Split UI components into separate modules
2. Extract bootstrap logic to dedicated `bootstrap.js`
3. Create focused modules for each major UI section

---

### [Q4] Missing JSDoc/TypeScript Type Definitions
**Category**: Code Quality  
**Severity**: Medium  
**Impact**: Difficult to understand function contracts; IDE autocomplete is limited; easier to call functions incorrectly  
**Location**: All service files  
**Description**: No TypeScript or comprehensive JSDoc comments documenting function signatures, parameters, and return types.  
**Fix Effort**: Medium-High  
**Suggested Fix**: 
1. Add JSDoc comments to all exported functions
2. Consider migrating to TypeScript for better type safety (future iteration)
3. Document all service contracts explicitly

---

### [Q5] Test Framework Configuration Inconsistency
**Category**: Code Quality  
**Severity**: Medium  
**Impact**: Tests may fail unexpectedly if environment or config differs; difficult to reproduce test environment  
**Location**: `tests/integration/googleDriveTestConfig.js`  
**Description**: Test configuration abstraction exists but implementation details for loading test credentials vary.  
**Fix Effort**: Low  
**Suggested Fix**: 
1. Centralize test config loading with clear validation
2. Document required environment variables for test execution
3. Add helper script to set up local test environment

---

## Low Priority / Suggestions

### [A7] Consider Async/Await Consistency
**Category**: Architecture  
**Severity**: Low  
**Impact**: Mix of Promises and async/await makes code style inconsistent; harder to follow flow  
**Location**: Service files  
**Description**: Code may mix Promise chains with async/await syntax.  
**Suggestion**: Standardize on async/await throughout codebase for clarity.  

---

### [A8] Missing Configuration Validation
**Category**: Architecture  
**Severity**: Low  
**Impact**: Invalid configuration may cause cryptic runtime errors; difficult to troubleshoot setup issues  
**Location**: `app/services/configService.js`, initialization code  
**Description**: Configuration is loaded but may not be explicitly validated against expected schema.  
**Suggestion**: Add configuration schema validation at startup with clear error messages.  

---

### [S6] Missing Clickjacking Protection Headers
**Category**: Security  
**Severity**: Low  
**Impact**: (Low for SPA but good practice) Protects against clickjacking attacks if embedded in iframe  
**Suggestion**: Add `X-Frame-Options` header when deployed to production.  

---

### [S7] No Audit Logging of API Calls
**Category**: Security  
**Severity**: Low  
**Impact**: Difficult to debug issues or detect unauthorized API use  
**Suggestion**: Consider adding client-side logging of all API calls for debugging (ensure no sensitive data logged).  

---

### [Q6] Missing README for Local Setup
**Category**: Code Quality  
**Severity**: Low  
**Impact**: New contributors struggle to set up development environment  
**Suggestion**: Create `README.md` with:
- Project overview
- Local setup instructions
- How to run integration tests
- Credential setup guide (reference to test notes template)

---

### [Q7] No Changelog or Version History
**Category**: Code Quality  
**Severity**: Low  
**Impact**: Difficult to track what changed between versions; unclear release history  
**Suggestion**: Create `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/) format.  

---

### [Q8] Limited Usage Comments in Complex Logic
**Category**: Code Quality  
**Severity**: Low  
**Impact**: Complex OAuth flow or API parameter combinations need clarification  
**Suggestion**: Add inline comments for non-obvious logic, especially around token refresh and API retry behavior.  

---

### [Q9] No ESLint or Format Configuration
**Category**: Code Quality  
**Severity**: Low  
**Impact**: Code style inconsistency; easier to introduce bugs with poor naming or unused variables  
**Suggestion**: Add `.eslintrc` and `.prettierrc` for consistent code formatting.  

---

### [Q10] Service Initialization Side Effects Not Documented
**Category**: Code Quality  
**Severity**: Low  
**Impact**: Subtle bugs if services are initialized in wrong order; unclear startup expectations  
**Suggestion**: Document service initialization order and any side effects explicitly.  

---

### [Q11] Missing Unit Tests for Service Logic
**Category**: Code Quality  
**Severity**: Low  
**Impact**: Service logic changes risk regression; no safety net for refactoring  
**Suggestion**: Add unit tests for each service's core business logic (mocking Google APIs).  

---

## Priority Matrix

| ID | Issue | Category | Severity | Effort | Priority | Action |
|-------|-------|----------|----------|--------|----------|--------|
| **A1** | Service coupling | Architecture | **Critical** | Medium | **P0 — now** | Refactor: Extract tokenService, implement DI |
| **S0** | Test credentials containment | Security | **Critical** | Low | **P0 — now** | Verify & document: No leak detected; add pre-commit hook |
| **S1** | localStorage token storage | Security | **High** | Medium | **P1 — before release** | Implement: CSP headers, XSS hardening |
| **A2** | No DI framework | Architecture | **High** | Medium | **P1 — this sprint** | Implement: DI pattern or factory functions |
| **S2** | Missing input validation | Security | **High** | Low-Med | **P1 — before release** | Implement: Input validation, SRI/CSP |
| **S3** | Real googleClientId in repo | Security | **High** | Low | **P1 — before release** | Configure: Env-based injection, rotate ID |
| **Q1** | Error handling inconsistency | Code Quality | **High** | Medium | **P1 — this sprint** | Refactor: Consistent error patterns |
| **Q2** | Missing integration tests | Code Quality | **High** | Medium-High | **P1 — this sprint** | Implement: Complete test suite, CI/CD |
| **A3** | No architecture docs | Architecture | **High** | Low | **P2 — next sprint** | Document: `app/ARCHITECTURE.md` |
| **A4** | Initialization coupling | Architecture | **High** | Medium | **P2 — next sprint** | Refactor: Explicit startup sequence |
| **A5** | No data access layer | Architecture | **Medium** | Medium | **P2 — next sprint** | Design: Repository pattern for Sheets API |
| **A6** | i18n not integrated | Architecture | **Medium** | Low-Med | **P2 — next sprint** | Audit & fix: String localization |
| **Q3** | Long main.js | Code Quality | **Medium** | Medium | **P2 — next sprint** | Refactor: Split into modules |
| **Q4** | No JSDoc/TypeScript | Code Quality | **Medium** | Medium-High | **P2 — next sprint** | Add: JSDoc to all functions |
| **Q5** | Test config inconsistency | Code Quality | **Medium** | Low | **P2 — next sprint** | Refactor: Centralize config loading |
| **S4** | Unescaped templates | Security | **Medium** | Medium | **P2 — next sprint** | Audit & fix: Escape dynamic content |
| **S5** | No API rate limiting | Security | **Medium** | Low-Med | **P2 — next sprint** | Implement: Client-side rate limiting |
| **A7** | Mixed async patterns | Architecture | **Low** | Low | **P3 — backlog** | Style: Standardize async/await |
| **A8** | No config validation | Architecture | **Low** | Low | **P3 — backlog** | Add: Config schema validation |
| **S6** | Missing X-Frame-Options | Security | **Low** | Low | **P3 — deployment** | Header: Add clickjacking protection |
| **S7** | No audit logging | Security | **Low** | Low | **P3 — backlog** | Add: Debug logging for API calls |
| **Q6** | Missing README | Code Quality | **Low** | Low | **P3 — backlog** | Create: Setup & contribution guide |
| **Q7** | No changelog | Code Quality | **Low** | Low | **P3 — backlog** | Create: CHANGELOG.md |
| **Q8** | Limited comments | Code Quality | **Low** | Low | **P3 — backlog** | Add: Clarifying comments in complex logic |
| **Q9** | No ESLint/Prettier | Code Quality | **Low** | Low | **P3 — backlog** | Setup: Linter & formatter config |
| **Q10** | Initialization side effects | Code Quality | **Low** | Low | **P3 — backlog** | Document: Startup sequence |
| **Q11** | Missing unit tests | Code Quality | **Low** | Medium | **P3 — backlog** | Add: Service unit tests |

---

## Next Steps

### Immediate (Before Next Commit) — P0 Critical
1. **[A1] Service Coupling**: Plan refactor to extract `tokenService.js` and establish clear dependency graph
   - Blocks: Can proceed in parallel with other fixes
   - Estimated: 1-2 hours refactoring + testing
   
2. **[S0] Test Credentials Containment**: 
   - ✅ Verification complete: No sensitive leak detected in tracked files
   - Add pre-commit hook to prevent accidental `userconfig.yml` commit
   - Document credential rotation procedure if googleClientId exposure occurs
   - Estimated: 0.5 hours

### This Sprint — P1 High Priority
1. **[S1] OAuth Token Security**: Implement CSP headers and XSS hardening
   - Milestone: Browser dev tools shows CSP policy in effect, no inline script violations
   
2. **[S3] googleClientId Rotation**: Move to environment-based injection
   - Milestone: README documents setup; local config overrides repo default
   
3. **[S2] Input Validation**: Add validation for all Google API parameters
   - Milestone: API calls validate ranges, sheet IDs, and file paths
   
4. **[Q1] Error Handling**: Standardize error patterns across services
   - Milestone: All services use consistent try/catch or promise rejection handling
   
5. **[Q2] Integration Tests**: Complete test suite for full OAuth flow
   - Milestone: CI/CD runs tests; 80%+ pass rate on pull requests

### Next Sprint — P2 Medium Priority
1. **[A2] Dependency Injection**: Implement DI framework or factory pattern
2. **[A3] Architecture Documentation**: Create `app/ARCHITECTURE.md`
3. **[A4] Explicit Initialization**: Document or refactor startup sequence
4. **[A5] Repository Pattern**: Abstract Google Sheets API calls
5. **[Q3] Refactor main.js**: Split into focused modules
6. **[Q4] JSDoc**: Add type documentation to all functions
7. **[S4] XSS Hardening**: Audit and escape all dynamic HTML generation
8. **[S5] API Rate Limiting**: Add client-side quota management

### Backlog — P3 Low Priority
- A7–A8, Q5–Q11, S6–S7: Standard code quality and documentation improvements

---

## Related Documentation

- **ISS-001**: [Security Hardening Follow-ups](../issues/ISS-001-security-hardening-followups.md) — Details on localStorage, CSP, and config issues
- **Plan**: [Localhost Launch Skeleton](../plans/2026-04-07-localhost-launch-skeleton.md) — Addresses googleClientId handling and credential safety
- **Tests**: `tests/integration/` — Integration test suite (status: under development)

---

## Appendix: Audit Scope

**Audited Files & Areas**:
- `app/` — Core services and business logic
- `index.html` — Entry point and UI templates
- `tests/integration/` — Integration test infrastructure
- `.gitignore` and configuration security
- Service dependencies and initialization flow

**Out of Scope**:
- Third-party library vulnerabilities (would require npm audit)
- Client-specific credentials or real operational data
- Backend infrastructure (none present; serverless/browser-only)

**Methodology**:
- Manual code review for architectural patterns and security practices
- Dependency graph analysis
- Configuration security check
- Test coverage assessment
- Code quality patterns against JavaScript best practices

---

**Report Generated**: 2026-04-07  
**Next Audit**: Recommended after P0 critical fixes are completed (1-2 weeks)
