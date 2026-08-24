# FieldFlow visual style guide

This guide keeps Scheduling, Analytics, Chatbot, and Operations recognizable as one FieldFlow product while allowing each area to solve a different job.

## Product principles

1. **Fast to understand:** a contractor should find the main number or next action within ten seconds.
2. **Account context stays visible:** show the current company near the page title or primary navigation.
3. **One primary action:** use the dark-blue primary button for the most important action in a section.
4. **Calm, operational design:** prefer clear labels, generous spacing, and restrained color over decoration.
5. **Accessible by default:** keyboard focus, readable contrast, form labels, and text alternatives are required.

## Shared foundation

The canonical shared stylesheet is [`shared-data/styles.css`](../shared-data/styles.css). Product styles may import it and override layout details, but should reuse its `--ff-*` design tokens.

### Core colors

The FieldFlow palette is adapted from the supplied warm-earth and earthy-tone references. The reference set contains many swatches; this smaller system assigns a clear product purpose to the most useful colors and keeps dark colors available for accessible text and controls.

| Purpose | Token | Value |
| --- | --- | --- |
| Deep navy · primary actions | `--ff-color-brand-700` | `#132841` |
| Deep teal · links and hover | `--ff-color-brand-600` | `#29544F` |
| Rust · highlights and eyebrows | `--ff-color-accent-600` | `#8A4D36` |
| Forest · positive status | `--ff-color-forest-700` | `#424B37` |
| Olive · secondary category | `--ff-color-olive-600` | `#726C44` |
| Ochre · warning emphasis | `--ff-color-ochre-500` | `#AF8A49` |
| Sage · chart/supporting color | `--ff-color-sage-400` | `#A7B79E` |
| Terracotta · chart/supporting color | `--ff-color-terracotta-500` | `#B37350` |
| Muted rose · chart/supporting color | `--ff-color-rose-500` | `#A3767D` |
| Taupe · quiet surfaces | `--ff-color-taupe-400` | `#C0AB9F` |
| Main text | `--ff-color-text` | `#132841` |
| Page background | `--ff-color-page` | `#F4F1ED` |
| Card background | `--ff-color-surface` | `#FFFCF8` |
| Error | `--ff-color-danger` | `#713E43` |

Use deep navy for primary actions, rust sparingly for emphasis, and forest for positive status. Ochre, sage, terracotta, olive, rose, and taupe support charts and categories. Do not use color alone to communicate job status or errors; pair it with a label, icon, or explanatory text.

## Typography

- Use Inter when available, followed by the system sans-serif stack.
- Page titles use a responsive size and tight spacing.
- Eyebrows are short, uppercase context labels such as “FieldFlow · Analytics.”
- Body copy should remain plain and task-focused.

## Spacing and shape

- Use the shared 4–48 px spacing tokens instead of introducing arbitrary gaps.
- Use 8 px radius for controls, 12 px for rows and notices, and 16 px for cards.
- Keep card shadows subtle; borders should define most surfaces.

## Components

### Navigation

Contractor pages should expose links to Scheduling, Analytics, and Support Chat while preserving the signed-in account. Operations remains a separate staff-only area.

### Buttons

- Primary: deep navy, for saving or moving to the main next step.
- Secondary: warm white with a navy border, for navigation or cancellation.
- Destructive: red and always labeled with the action, such as “Delete job.”

### Forms

- Every input requires a visible label.
- Required fields should be clear before submission.
- Validation messages should appear beside the form and use `role="alert"` when appropriate.

### Cards and metrics

- Cards group one idea or task.
- A summary metric needs a short label, the value, and optional comparison text.
- Avoid placing unrelated charts or actions in the same card.

### Status and feedback

- Empty states explain what is missing and suggest a next action.
- Error states explain what happened without exposing technical details.
- Demo notices clarify that mock edits last only for the current browser tab.

## Analytics charts

- Every chart needs a title, labeled axes, and a text alternative.
- Tooltips should repeat the date/category and exact value.
- Use the line chart for changes over time and the donut chart only for the new-versus-repeat client split.

## Accessibility checklist

- All interactive elements work with a keyboard.
- Focus is visibly indicated.
- Text contrast meets WCAG AA.
- Motion respects `prefers-reduced-motion`.
- Icon-only controls have accessible names.
- Layout remains usable at 320 px width and at 200% zoom.

## Adding a new screen

1. Import the shared stylesheet.
2. Reuse the shared tokens and component classes.
3. Show the product area and current account near the title.
4. Provide loading, empty, error, and success states.
5. Test keyboard navigation and a narrow viewport before merging.
