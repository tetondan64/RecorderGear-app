# Library Screen Wireframe

## Layout
```
┌─────────────────────────────────────┐
│           Library Tab               │
├─────────────────────────────────────┤
│                                     │
│    Recent Recordings                │
│                                     │
├─────────────────────────────────────┤
│ Team Meeting - Q4 Planning    30:47 │
│ [meeting] [planning] [team]        ►│
├─────────────────────────────────────┤
│ Interview with Sarah Johnson  35:56 │
│ [interview] [hr]               ►    │
├─────────────────────────────────────┤
│ Product Demo Rehearsal        15:45 │
│ [demo] [product] [rehearsal]        ►│
├─────────────────────────────────────┤
│ Client Call - Feedback Session 20:34│
│ [client] [feedback]                 ►│
├─────────────────────────────────────┤
│ Daily Standup - Engineering   09:27 │
│ [standup] [engineering] [daily]     ►│
├─────────────────────────────────────┤
│                 ⋮                   │
└─────────────────────────────────────┘
```

## Empty State
```
┌─────────────────────────────────────┐
│           Library Tab               │
├─────────────────────────────────────┤
│                                     │
│                                     │
│                📚                   │
│                                     │
│         No Recordings Yet           │
│                                     │
│    Your recorded audio files will   │
│     appear here once you start      │
│            recording.               │
│                                     │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

## Component Specs

### ListItem
- **Layout**: Title + Duration on top row
- **Tags**: Up to 3 badges below title
- **Duration**: Formatted as MM:SS
- **Chevron**: Right arrow indicating navigation
- **Accessibility**: Comprehensive label with all info

### Header
- **Title**: "Recent Recordings"
- **Style**: Semi-bold, larger text
- **Position**: Above list, with padding

### Tags (Badges)
- **Limit**: Maximum 3 tags per item
- **Style**: Rounded rectangles with subtle background
- **Colors**: Uses theme surface color
- **Overflow**: Additional tags are hidden

## Data Structure
```json
{
  "id": "rec-001",
  "title": "Team Meeting - Q4 Planning",
  "durationSec": 1847,
  "tags": ["meeting", "planning", "team"],
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Interactions
1. **Tap Item**: Navigate to recording detail (future)
2. **Visual Feedback**: Item highlights on press
3. **Scrolling**: Vertical scroll through recordings
4. **Empty State**: Shows when no recordings exist

## Accessibility
- **ListItem Labels**: Include title, duration, and tags
- **Scroll**: Supports assistive technology
- **Touch Targets**: Adequate size for interaction
- **Screen Reader**: Announces content clearly

## Visual Design
- **Cards**: Each item in rounded container
- **Shadows**: Subtle elevation for depth
- **Spacing**: Consistent padding and margins
- **Typography**: Clear hierarchy with title emphasis
- **Colors**: Theme-aware backgrounds and text

## Mock Data (P0)
- 10 sample recordings with varied:
  - Titles (meetings, interviews, demos)
  - Durations (9 minutes to 57 minutes)
  - Tags (1-3 per item, various categories)
  - Realistic timestamps

## Future Enhancements (Post-P0)
- Search and filtering
- Sort options (date, duration, name)
- Batch actions (delete, share)
- Recording previews
- Folder organization
- Sync status indicators