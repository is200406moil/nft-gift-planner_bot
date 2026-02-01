# NFT Gift Planner - Telegram Mini App

A Telegram Mini App for planning and visualizing NFT gift collections. Optimized for performance in Telegram's WebView.

## Performance Optimizations

This app is optimized for Telegram Mini Apps with the following techniques:

### Bundle Optimization
- **Code Splitting**: Separate chunks for React, DnD, Lottie, and other heavy libraries
- **Lighter Lottie**: Uses `lottie_canvas` variant (267KB) instead of full bundle (533KB) - 50% smaller
- **Lazy Loading**: Modal, Lottie animations, and html2canvas are loaded only when needed
- **Tree Shaking**: Unused code is removed during production build

### Loading Performance
- **Critical CSS**: Inlined in HTML for instant visual feedback
- **Preconnect hints**: DNS prefetch for API endpoints
- **Telegram SDK**: Loaded first for instant Mini App initialization
- **Session caching**: API responses cached in sessionStorage

### Telegram Mini App Specifics
- **Instant ready()**: Called after initial render for responsive app feel
- **Theme integration**: Uses Telegram theme colors via CSS variables
- **Mobile optimizations**: Touch-friendly, no pull-to-refresh conflicts

### Caching (Vercel)
- **Immutable assets**: JS/CSS cached for 1 year with hashed filenames
- **No-cache HTML**: index.html always revalidates for fresh builds

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Analyze bundle size
npm run analyze

# Run linter
npm run lint
```

## Bundle Analysis

Run `npm run analyze` to generate a bundle analysis report at `dist/bundle-analysis.html`. Use this to identify large dependencies and optimize further.

## Current Bundle Sizes (gzipped)
- Main app: ~9KB
- React core: ~60KB
- DnD (drag-and-drop): ~16KB
- Lottie (animations): ~70KB
- Modal: ~8KB
- Pako (compression): ~15KB
- html2canvas (export): ~47KB

Total initial load (excluding lazy chunks): ~85KB gzipped

## Tech Stack

- **React 19**: Modern React with concurrent features
- **Vite 7**: Fast build tool with optimized production builds
- **@dnd-kit**: Accessible drag-and-drop
- **lottie-web**: TGS/Lottie animation playback
- **Vercel**: Serverless deployment with CDN
