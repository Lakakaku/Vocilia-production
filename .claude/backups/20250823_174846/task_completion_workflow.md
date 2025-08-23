# AI Feedback Platform - Task Completion Workflow

## Definition of Done
Before marking any task as complete, ensure ALL criteria are met:

✅ **Feature works on iPhone Safari** (primary target platform)  
✅ **Unit tests written and passing** (80%+ coverage minimum)  
✅ **Integration tests for critical paths**  
✅ **Code review approved** by team member  
✅ **Documentation updated** (README, API docs)  
✅ **Security review completed** for sensitive features  
✅ **Performance targets met** (voice <2s, API <500ms)  
✅ **Error handling and logging implemented**  
✅ **Fraud detection considerations addressed**

## Step-by-Step Task Completion Process

### 1. Development Phase
```bash
# Start development
git checkout -b feature/task-description

# During development, run frequently:
npm run typecheck    # Catch type errors early
npm run lint        # Fix linting issues
```

### 2. Pre-Completion Checks
```bash
# Required before marking task complete:
npm run format      # Auto-fix code formatting
npm run typecheck   # Ensure no TypeScript errors  
npm run lint        # Fix all linting issues
npm run test        # All tests must pass
```

### 3. iOS Safari Validation (Critical)
```bash
# MANDATORY for any UI/voice-related changes:
npm run test:ios           # Run iOS compatibility tests
npm run test:ios:headed    # Visual debugging if issues
npm run test:ios:report    # Review results

# Manual testing on actual iOS device recommended
```

### 4. Performance Validation
- **Voice Response**: Must be <2 seconds from stop talking to AI response
- **API Endpoints**: Must respond <500ms for non-AI endpoints  
- **Page Load**: Must load <3 seconds on mobile
- **WebSocket**: Stable connection, handle mobile network switching

### 5. Security & Privacy Checks
- **No voice data storage**: Only transcripts, delete audio immediately
- **GDPR compliance**: Minimal PII, anonymous customer hashing
- **Input sanitization**: All user inputs properly sanitized
- **Rate limiting**: Prevent abuse (5 QR scans/min, 15 feedbacks/hour)

### 6. Documentation Requirements
Update relevant documentation:
- **API changes**: Update OpenAPI/Swagger specs
- **Component changes**: Update component documentation
- **New features**: Update CLAUDE.md and README.md
- **Breaking changes**: Update migration guides

### 7. Commit Standards
```bash
# Use conventional commit format:
git commit -m "feat(voice): add iOS Safari audio recording fallback"
git commit -m "fix(payment): resolve Stripe webhook validation"
git commit -m "docs(api): update POS integration documentation"
git commit -m "test(fraud): add device fingerprinting test cases"

# Types: feat, fix, docs, style, refactor, test, chore, hotfix
# Scopes: voice, ai, payment, pos, admin, fraud, ui
```

### 8. Code Review Process
- **Create PR** with thorough description and test results
- **Include screenshots/videos** for UI changes
- **Document testing approach** for complex features
- **Address all feedback** before merging

### 9. Post-Merge Actions
```bash
# Deploy to staging
npm run build
# Run staging tests
# Monitor performance metrics
# Check error logs
```

## Critical Checkpoints

### Before Any Voice/Audio Changes
- Test on actual iOS Safari device
- Verify WebSocket stability on mobile networks
- Check audio quality and latency
- Test microphone permissions flow

### Before Any Payment Changes  
- Test with Stripe test cards
- Verify webhook handling
- Check fraud detection triggers
- Validate commission calculations

### Before Any AI Changes
- Test scoring consistency across samples
- Verify context injection works
- Check prompt versioning
- Validate performance targets

### Before Any Database Changes
- Run migrations on staging
- Verify data integrity
- Test rollback procedures
- Update backup procedures

## Emergency Procedures

### Critical Bug Response
```bash
git checkout -b hotfix/critical-issue-description
# Fix issue
npm run test        # Verify fix
npm run test:ios    # iOS compatibility
git commit -m "hotfix(scope): resolve critical issue"
# Fast-track review and deploy
```

### Performance Degradation
- Check voice latency metrics first
- Verify database query performance
- Monitor WebSocket connection stability
- Scale resources if needed

This workflow ensures consistent quality and prevents regressions in the critical customer journey.