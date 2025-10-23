# Contributing to Microservices Demo

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/S2_demo.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes thoroughly
6. Commit and push to your fork
7. Create a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- kubectl (for Kubernetes testing)
- Pulumi CLI (for infrastructure changes)

### Local Development

```bash
# Install dependencies
cd services/backend && npm install
cd ../frontend && npm install

# Run tests
npm test

# Start with Docker Compose
docker-compose up
```

## Code Standards

### JavaScript/Node.js

- Use ES6+ features
- Follow existing code style
- Add tests for new features
- Use meaningful variable names
- Comment complex logic

### Docker

- Use Alpine-based images when possible
- Minimize image layers
- Don't include unnecessary files
- Use .dockerignore effectively

### Kubernetes

- Follow Kubernetes best practices
- Include resource limits
- Add health checks
- Use appropriate service types

## Testing

### Running Tests

```bash
# Backend tests
cd services/backend
npm test

# Frontend tests
cd services/frontend
npm test
```

### Writing Tests

- Write unit tests for new features
- Ensure tests are isolated
- Use descriptive test names
- Mock external dependencies

Example test:
```javascript
describe('API Endpoint', () => {
  test('should return correct response', async () => {
    const response = await request(app).get('/api/test');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
  });
});
```

## Security

### Security Scanning

Before submitting a PR:

```bash
# Run Trivy scan
trivy image backend-service:latest
trivy image frontend-service:latest

# Check for vulnerabilities
npm audit
```

### Security Best Practices

- Never commit secrets or credentials
- Use environment variables for configuration
- Keep dependencies up to date
- Follow OWASP guidelines
- Validate all inputs
- Use HTTPS in production

## Pull Request Process

1. **Update Documentation**: Update README.md if needed
2. **Add Tests**: Include tests for new features
3. **Run Tests**: Ensure all tests pass
4. **Security Scan**: Run security scanners
5. **Clean Commits**: Use clear, descriptive commit messages
6. **Small PRs**: Keep PRs focused and manageable

### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example:
```
feat: add rate limiting to API endpoints

Implement express-rate-limit middleware to prevent
DDoS attacks and abuse. Limits set to 100 requests
per 15 minutes per IP address.

Closes #123
```

## Code Review

Your PR will be reviewed for:

- Code quality and style
- Test coverage
- Security implications
- Documentation completeness
- Performance impact

## Infrastructure Changes

### Pulumi

When modifying infrastructure:

```bash
cd infrastructure
npm install
pulumi preview  # Review changes
pulumi up      # Apply changes
```

### Kubernetes Manifests

- Test changes in local cluster first
- Document any new resources
- Follow naming conventions
- Use appropriate namespaces

## CI/CD Pipeline

The pipeline runs automatically on:
- Pull requests
- Pushes to main/develop branches

Pipeline stages:
1. Build & Test
2. Security Scan (Trivy)
3. Build & Push Images (main only)
4. Infrastructure Validation

## Documentation

### What to Document

- New features
- API changes
- Configuration options
- Breaking changes
- Migration guides

### Documentation Standards

- Use clear, concise language
- Include code examples
- Add diagrams where helpful
- Keep README.md up to date

## Issue Reporting

### Bug Reports

Include:
- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details
- Logs/screenshots

### Feature Requests

Include:
- Problem you're trying to solve
- Proposed solution
- Alternative solutions considered
- Additional context

## Questions?

- Open an issue for questions
- Check existing issues first
- Be respectful and constructive

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be acknowledged in:
- GitHub contributors page
- Release notes (for significant contributions)

Thank you for contributing! 🎉
