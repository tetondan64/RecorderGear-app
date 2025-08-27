# Settings Screen Wireframe

## Layout
```
┌─────────────────────────────────────┐
│           Settings Tab              │
├─────────────────────────────────────┤
│                                     │
│    APPEARANCE                       │
│                                     │
├─────────────────────────────────────┤
│ Dark Mode                        ○  │
│ Enable dark theme for better        │
│ visibility in low light             │
├─────────────────────────────────────┤
│                                     │
│    DEVELOPER                        │
│                                     │
├─────────────────────────────────────┤
│ Enable Mocks                     ●  │
│ Use mock data for testing and       │
│ development                         │
├─────────────────────────────────────┤
│                                     │
│    ABOUT                            │
│                                     │
├─────────────────────────────────────┤
│ Version                      1.0.0  │
├─────────────────────────────────────┤
│ Build                     Phase P0  │
├─────────────────────────────────────┤
│                                     │
└─────────────────────────────────────┘
```

## Component Specs

### Section Headers
- **Style**: Uppercase, small font, secondary color
- **Spacing**: Extra margin above, small margin below
- **Examples**: "APPEARANCE", "DEVELOPER", "ABOUT"

### Setting Rows (Toggle)
- **Layout**: Title + subtitle on left, switch on right
- **Title**: Primary text, medium weight
- **Subtitle**: Secondary text, smaller font
- **Switch**: Native iOS/Android toggle
- **Background**: Card style with borders

### Info Rows
- **Layout**: Label on left, value on right
- **Style**: Same card design as settings
- **Content**: Read-only information
- **Examples**: Version, Build number

### Switch Component
- **Active Color**: Theme primary color
- **Track Color**: Theme border color (inactive)
- **Thumb Color**: White/theme surface
- **Animation**: Smooth toggle transition

## Settings Categories

### Appearance
- **Dark Mode**: Toggle between light/dark themes
- **Default**: Follows system preference
- **Persistence**: Setting saved locally
- **Effect**: Immediate UI update

### Developer
- **Enable Mocks**: Toggle mock data usage
- **Purpose**: Testing and development
- **Default**: True in P0
- **Future**: Hidden in production builds

### About
- **Version**: App version from package.json
- **Build**: Phase identifier (P0, F1, etc.)
- **Future**: Build number, commit hash

## Interactions
1. **Toggle Switches**: Change setting values
2. **Visual Feedback**: Immediate UI updates
3. **Persistence**: Settings saved automatically
4. **Scrolling**: Vertical scroll for content

## Theme Integration
- **Colors**: Adaptive to light/dark mode
- **Cards**: Proper elevation and shadows
- **Text**: High contrast for readability
- **Switches**: Theme-appropriate colors

## Accessibility
- **Switch Labels**: Clear descriptions
- **Role Definitions**: Proper element roles
- **Screen Reader**: Full content announcement
- **Focus**: Keyboard navigation support

## State Management
```typescript
type AppSettings = {
  enableMocks: boolean;
  themeMode: 'light' | 'dark' | 'system';
}
```

## Visual Design Patterns
- **Card Layout**: Consistent with ListItem
- **Spacing**: Same as other screens
- **Typography**: Theme-defined fonts
- **Borders**: Subtle dividers between sections
- **Shadows**: Light elevation effects

## Future Settings (Post-P0)

### Recording
- **Quality**: Audio bitrate selection
- **Format**: File format preferences
- **Storage**: Local vs cloud options
- **Auto-Stop**: Silence detection settings

### Privacy
- **Permissions**: Microphone access
- **Data Sharing**: Analytics opt-out
- **Encryption**: Local file protection
- **Cloud Sync**: Account preferences

### Notifications
- **Recording Alerts**: Start/stop notifications
- **Transcription**: Completion alerts
- **Storage**: Low space warnings
- **Updates**: Feature announcements

### Advanced
- **Debug Mode**: Detailed logging
- **Export Data**: Backup functionality
- **Reset**: Clear all data option
- **Beta Features**: Experimental toggles

## Data Persistence
- **Local Storage**: Settings saved to device
- **Sync**: Future cloud synchronization
- **Migration**: Setting format changes
- **Defaults**: Fallback values

## Platform Considerations
- **iOS**: Native switch styling
- **Android**: Material Design switches
- **Haptics**: Feedback on toggle (iOS)
- **Animations**: Platform-appropriate timing

## Testing Considerations
- **Toggle Functionality**: All switches work
- **Theme Changes**: Immediate visual updates
- **Persistence**: Settings survive app restart
- **Accessibility**: Screen reader compatibility

## Error Handling
- **Invalid Values**: Fallback to defaults
- **Storage Errors**: Graceful degradation
- **Theme Failures**: System default
- **Network Issues**: Local-only settings