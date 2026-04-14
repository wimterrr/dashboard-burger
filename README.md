# Burger AI Dashboard

Static dashboard that turns the current idea/project state into a forced-choice board:

- `build now 3`
- `park 3`
- `kill review 3`

The board ships as plain HTML plus a machine-readable verdict receipt so the scoring contract stays inspectable.

## Local usage

```bash
npm run build
```

Preview the generated board locally:

```bash
npm run preview
```

## Output

- `dist/index.html`: rendered dashboard board
- `dist/verdict-receipt.json`: scoring contract, audit data, and chosen rows
