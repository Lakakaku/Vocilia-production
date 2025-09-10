---
description: Analyze UI screens against style guide and fix design issues
allowed-tools: mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_snapshot, Read, Glob, Edit, MultiEdit
argument-hint: [screen-path or URL]
---

# UI Healing System

Analyze and fix UI screens against style guide standards with iterative improvement.

## Process Overview

**Step 1: Screenshot Analysis**
- Take screenshots of specified screens using Playwright MCP
- Capture current state of UI components and layouts

**Step 2: Style Guide Evaluation** 
- Reference `/style-guide/style-guide.md` and `/style-guide/ux-rules.md`
- Grade each screen objectively against established standards
- Provide scores on a scale of 1-10 with detailed feedback

**Step 3: Iterative Improvement**
- For any screens scoring less than 8/10, implement necessary changes
- Re-screenshot and re-evaluate until standards are met
- Continue iteration until all screens achieve 8+ scores

## Usage
Provide screen paths, component names, or URLs to analyze. The system will automatically iterate through the healing process until design standards are met. 