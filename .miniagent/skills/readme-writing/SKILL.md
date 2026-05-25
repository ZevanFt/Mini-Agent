---
name: readme-writing
description: Use when the user wants to write, update, or improve a README file for a project. Provides structured README template with sections for description, installation, usage, API, contributing, and license. Triggers on README creation, documentation writing, or project setup requests.
allowed-tools: file_read, file_write, glob, grep, bash
disallowedTools:
  - web_search
triggers:
  - 写 README
  - README
  - 写文档
  - 项目文档
  - 写说明文档
  - create README
  - improve README
  - project documentation
---

# README Writing Skill

Structured README template following best practices.

## README Structure

```markdown
# Project Name

> Brief tagline describing the project (one sentence)

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## What is this?

Brief description (2-3 sentences) of what the project does and why it exists.
Include the problem it solves and key features.

## Features

- Feature 1 with brief benefit
- Feature 2 with brief benefit
- Feature 3 with brief benefit

## Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

\`\`\`bash
npm install project-name
\`\`\`

### Usage

\`\`\`typescript
import { main } from 'project-name';

await main();
\`\`\`

## Project Structure

\`\`\`
project/
├── src/           # Source code
├── tests/         # Test files
├── docs/          # Documentation
└── package.json
\`\`\`

## API Reference

### `functionName(params: Type): ReturnType`

Description of what the function does.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `params` | `Type` | Yes | Description |

**Returns:** `ReturnType` - Description

**Example:**

\`\`\`typescript
const result = functionName({ key: 'value' });
\`\`\`

## Development

\`\`\`bash
# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Build
npm run build
\`\`\`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.