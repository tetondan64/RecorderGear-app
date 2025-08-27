# Record Screen Wireframe

## Layout
```
┌─────────────────────────────────────┐
│           Record Tab                │
├─────────────────────────────────────┤
│                                     │
│                                     │
│           Ready to Record           │
│                                     │
│    Tap the button below to start    │
│            recording                │
│                                     │
│                                     │
│              ┌─────┐                │
│              │     │                │
│              │  🎤  │                │
│              │     │                │
│              └─────┘                │
│        (Large Circular Button)      │
│                                     │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

## Recording State
```
┌─────────────────────────────────────┐
│           Record Tab                │
├─────────────────────────────────────┤
│                                     │
│                                     │
│            Recording...             │
│                                     │
│     Tap the button to stop         │
│            recording                │
│                                     │
│                                     │
│              ┌─────┐                │
│              │     │                │
│              │  ⏹️  │                │
│              │     │                │
│              └─────┘                │
│         (Red Stop Button)           │
│                                     │
│            ● REC 00:02              │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

## Component Specs

### WaveButton
- **Size**: 120px diameter
- **States**: 
  - Default: Blue circle with microphone icon
  - Recording: Red circle with stop icon
- **Animation**: Scale down slightly on press
- **Haptics**: Medium impact on press in, Heavy impact on press
- **Accessibility**: 
  - Role: button
  - Label: "Record button"
  - Hint: Changes based on state

### Visual Feedback
- **Title Changes**: "Ready to Record" → "Recording..."
- **Subtitle Changes**: Instructions update based on state
- **Recording Indicator**: Shows "● REC MM:SS" when recording
- **Color Scheme**: Uses theme colors (primary blue, error red)

## Interactions
1. **Press WaveButton**: Toggle recording state
2. **Visual State**: Button color and icon change
3. **Haptic Feedback**: Provides tactile response
4. **Auto Reset**: Returns to default state after 2 seconds (P0 demo)

## Accessibility
- Screen reader announces state changes
- Button has clear labels and hints
- High contrast colors for visibility
- Proper touch target size (120px)

## Future Enhancements (Post-P0)
- Real audio recording functionality
- Waveform visualization
- Recording controls (pause, cancel)
- Audio level indicators
- Recording quality settings