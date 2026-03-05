# GitHub Copilot Instructions

## Model Preference

**Use Claude Sonnet 4.5** for all coding tasks in this repository.

When starting a task with GitHub Copilot coding agent, select "Claude Sonnet 4.5" from the model picker instead of "Claude Sonnet 4.6" or "Auto".

### Reason

Claude Sonnet 4.6 has caused issues with previous agent tasks. Claude Sonnet 4.5 is the preferred and stable model for this project.

## Project Context

This is a TypeScript/React game project called "Vibing Arkanoid" - a modern take on the classic Arkanoid/Breakout game with:

- TypeScript for type safety
- React for UI components
- Vite for build tooling
- Canvas-based rendering engine
- Advanced physics with continuous collision detection (CCD)
- Mobile touch controls
- Boss battles and power-up systems

## Coding Style Preferences

- Use TypeScript strict mode
- Prefer functional components and hooks in React
- Use explicit types rather than type inference where it improves clarity
- Follow existing naming conventions in the codebase
- Maintain consistent code formatting with the existing style
