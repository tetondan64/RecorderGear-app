# RecorderGear Mobile App

A modern React Native audio recording application built with Expo and TypeScript.

## 📱 Current Phase: C4 - Multi-Device Sync & Conflict Handling

### ✅ Completed Phases (9 Total)
1. **P0** - Context & Repo Bootstrap ✅
2. **F1** - Core Recording ✅
3. **F2** - Audio Player & Navigation ✅
4. **F3** - Local Management & Search ✅
5. **C2** - Cloud Storage Upload ✅
6. **C2R** - Cloud Restore ✅
7. **DB1** - PostgreSQL Database ✅
8. **C3** - Authentication (JWT) ✅
9. **C4** - Multi-Device Sync & Conflict Handling ✅ *(Current)*

### ✨ Features (All Phases)
- 🎯 **4-Tab Navigation**: Record, Library, Chat, Settings
- 🎙️ **Audio Recording**: Real recording with permissions and storage
- 🎵 **Audio Playback**: Full-featured player with seek controls
- 📚 **Library Management**: Folders, tags, and search functionality
- ☁️ **Cloud Storage**: Upload and restore recordings
- 🔐 **Authentication**: JWT-based secure access
- 🔄 **Multi-Device Sync**: Incremental sync with conflict resolution
- 🎨 **Theme System**: Light/dark mode with comprehensive design tokens
- ⚡ **Testing Suite**: Comprehensive component and unit tests
- ♿ **Accessibility**: Full screen reader support and proper touch targets

## 🛠 Tech Stack

- **React Native** with **Expo SDK 52+**
- **TypeScript** (strict mode)
- **Expo Router** for navigation
- **Jest + React Native Testing Library** for testing
- **ESLint + Prettier** for code quality
- **GitHub Actions** for CI/CD

## 🚀 Quick Start

### Prerequisites
- **Node.js 20.x** or later
- **npm** package manager
- **Expo Go app** on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

### Installation & Development

```bash
# Navigate to mobile app directory
cd apps/mobile

# Install dependencies
npm ci

# Start development server
npm start

# Run tests
npm test

# Run linting
npm run lint

# Run type checking
npm run typecheck
```

### Running in Expo Go

1. Run `npm start` in the `apps/mobile` directory
2. Open **Expo Go** on your phone
3. Scan the QR code displayed in your terminal
4. The app will load with 4 tabs ready to explore!

## 📱 App Structure

```
RecorderGear/
├── apps/mobile/
│   ├── app/                      # Expo Router screens
│   │   ├── (tabs)/              # Tab-based navigation
│   │   │   ├── record.tsx       # Recording interface (P0: visual only)
│   │   │   ├── library.tsx      # Recording library (P0: mock data)
│   │   │   ├── chat.tsx         # AI chat (P0: coming soon)
│   │   │   └── settings.tsx     # App settings
│   │   └── _layout.tsx          # Root layout with theme
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/             # Generic UI elements
│   │   │   └── record/         # Recording-specific components
│   │   ├── lib/                # Core utilities
│   │   │   ├── theme/          # Design system & tokens
│   │   │   ├── store/          # State management
│   │   │   └── utils/          # Helper functions
│   │   ├── mock/               # Mock data for development
│   │   └── features/           # Feature documentation
│   └── __tests__/              # Test suites
```

## 🎨 Design System

### Theme Tokens
- **Colors**: Light/dark adaptive palette
- **Typography**: Consistent font scales and weights  
- **Spacing**: 8-point grid system
- **Shadows**: Elevation system for depth
- **Border Radius**: Consistent corner rounding

### Components
- **Button**: Multiple variants with loading states
- **Badge**: Pill-shaped labels for tags
- **ListItem**: Structured content with metadata
- **EmptyState**: Friendly placeholder screens
- **WaveButton**: Animated recording control

## 🧪 Testing

### Test Coverage
- ✅ **Component Tests**: All UI components with user interactions
- ✅ **Unit Tests**: Utilities and theme tokens
- ✅ **Integration Tests**: Tab navigation and state management
- ✅ **Accessibility Tests**: Screen reader and keyboard navigation

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Run specific test file
npm test tabs.spec.tsx

# Run in watch mode
npm test -- --watch
```

## 📋 Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo development server |
| `npm test` | Run test suite |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript compiler |

## 🔄 CI/CD Pipeline

GitHub Actions workflow automatically runs on pull requests:
1. **Install Dependencies** (`npm ci`)
2. **Lint Code** (`npm run lint`)  
3. **Type Check** (`npm run typecheck`)
4. **Run Tests** (`npm test`)
5. **Verify Build** (Expo config validation)

## ♿ Accessibility

- All interactive elements have proper `accessibilityRole` and `accessibilityLabel`
- High contrast colors meeting WCAG AA standards
- Proper touch target sizes (minimum 44px)
- Screen reader friendly content descriptions
- Keyboard navigation support

## 📖 Documentation

- **[Wireframes](apps/mobile/src/features/wireframes/)**: Visual specifications for each screen
- **[Phase P0 Spec](docs/phase-p0.yaml)**: Complete technical specification
- **Component Docs**: Inline JSDoc comments in source code

## 🔮 Roadmap

### Next Phases

#### BG1 - Background Sync (Next)
- True background sync using EAS Dev Client
- Automatic sync on network change
- Sync while app is backgrounded
- Battery-optimized sync strategies

#### T1 - Transcription Integration
- Speech-to-text transcription
- Speaker diarization
- Real-time transcription display
- Export transcripts

#### AI1 - AI Features
- AI-powered chat interface
- Content summarization
- Smart search with semantic matching
- Auto-tagging suggestions

#### E1 - Enhanced Editor
- Trim and split recordings
- Noise reduction
- Speed adjustment
- Multi-track editing

## 🐛 Troubleshooting

### Common Issues

**App won't load in Expo Go:**
- Ensure you're on the same WiFi network
- Try clearing Expo Go cache
- Restart the development server

**Tests failing:**
- Run `npm ci` to ensure clean dependencies
- Check Node.js version (requires 20.x)

**TypeScript errors:**
- Run `npm run typecheck` to see detailed errors
- Ensure all imports use correct paths

### Getting Help

1. Check existing [GitHub Issues](../../issues)
2. Review the [Phase P0 specification](docs/phase-p0.yaml)
3. Consult component wireframes in `src/features/wireframes/`

## 📄 License

This project is proprietary. All rights reserved.

---

**🎯 Current Status**: Phase C4 Complete - Multi-device sync with conflict resolution implemented!

**Completed**: P0 → F1 → F2 → F3 → C2 → C2R → DB1 → C3 → C4 ✅

**Next Phase**: BG1 - Background sync functionality