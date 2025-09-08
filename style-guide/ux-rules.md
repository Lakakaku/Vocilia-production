# UX Rules: Voice as Visual Currency

## Core Philosophy
Transform the invisible act of speaking into tangible, valuable visual experiences that communicate trust, progress, and insight.

## Fundamental Principles

### 1. The Listening State
Every interface should visually "breathe" - showing it's alive and ready to receive input.

#### Implementation Rules:
- **Idle Breathing**: Elements pulse at 60-72 BPM (resting heart rate) when awaiting input
- **Active Listening**: Visual contraction of 5-10% when user begins interaction
- **Response Expansion**: Elements expand 10-15% when providing feedback
- **Wave Propagation**: Actions create ripple effects that flow outward at 300ms intervals

### 2. Depth as Value Hierarchy

#### Z-Axis Layers:
1. **Background Layer** (-100z): Ambient wave patterns, subtle movement
2. **Context Layer** (-50z): Business information, static content
3. **Interaction Layer** (0z): Primary user interface elements
4. **Feedback Layer** (50z): Live waveforms, active responses
5. **Reward Layer** (100z): Payment confirmations, success states

#### Shadow & Elevation Rules:
- Resting: `box-shadow: 0 2px 4px rgba(26,35,126,0.1)`
- Hover: `box-shadow: 0 4px 8px rgba(26,35,126,0.15)`
- Active: `box-shadow: 0 8px 16px rgba(26,35,126,0.2)`
- Elevated: `box-shadow: 0 16px 32px rgba(26,35,126,0.25)`

### 3. Progress Through Sound Visualization

#### Waveform Progress Indicators:
- **Linear Progress**: Waveform that builds left-to-right as task completes
- **Circular Progress**: Sound wave that spirals outward from center
- **Step Progress**: Frequency bars that fill sequentially
- **Quality Score**: Amplitude visualization that grows with score value

#### Timing Standards:
- Micro-interactions: 150-300ms
- State transitions: 300-500ms
- Page transitions: 500-800ms
- Complex animations: 800-1200ms

### 4. Conversational Flow Patterns

#### Interaction Sequence:
1. **Invitation** (0ms): Element subtly pulses to invite interaction
2. **Acknowledgment** (150ms): Visual feedback confirms user input
3. **Processing** (300ms): Waveform animation shows active listening
4. **Response** (500ms): Smooth expansion with result
5. **Settlement** (800ms): Gentle return to resting state

#### Voice Interaction States:
- **Pre-Recording**: Gentle oscillation at 0.5Hz
- **Recording Active**: Live waveform visualization synced to audio input
- **Processing**: Compressed waveform pulsing at 2Hz
- **AI Responding**: Waveform expanding outward from center
- **Complete**: Waveform settles into quality score visualization

### 5. Wave-Form Architecture

#### Navigation Patterns:
- **Wave Navigation**: Nav items connected by flowing wave baseline
- **Active State**: Selected item creates peak in wave pattern
- **Hover State**: Localized wave disturbance around cursor
- **Transition**: Wave flows between sections during navigation

#### Data Visualization:
- **Feedback Metrics**: Display as frequency spectrum analyzer
- **Time Series**: Show as continuous waveform with amplitude = value
- **Categories**: Represent as different frequency bands
- **Sentiment**: Visualize as wave harmony/dissonance

### 6. Professional Restraint

#### Animation Constraints:
- **No Bouncing**: Use ease-out curves exclusively
- **No Spinning**: Rotations limited to 180° max
- **No Flashing**: Opacity changes between 0.3-1.0 only
- **No Chaos**: Maximum 3 concurrent animations per viewport

#### Easing Functions:
- Primary: `cubic-bezier(0.4, 0.0, 0.2, 1)` - Material standard
- Emphasis: `cubic-bezier(0.0, 0.0, 0.2, 1)` - Acceleration
- Settle: `cubic-bezier(0.4, 0.0, 1, 1)` - Deceleration
- Smooth: `cubic-bezier(0.4, 0.0, 0.6, 1)` - Balanced

### 7. Responsive Listening

#### Breakpoint Behaviors:
- **Mobile** (< 768px): Single wave column, vertical flow
- **Tablet** (768-1024px): Dual wave columns, mixed flow
- **Desktop** (> 1024px): Multi-wave layout, horizontal flow

#### Touch Interactions:
- **Tap**: Create ripple at touch point
- **Hold**: Increase wave amplitude progressively
- **Swipe**: Wave follows gesture path
- **Pinch**: Modulate wave frequency

### 8. Feedback as Currency

#### Value Visualization:
- **Low Quality** (0-40): Minimal wave amplitude, muted colors
- **Medium Quality** (40-70): Moderate waves, balanced colors
- **High Quality** (70-100): Full amplitude, vibrant gradients

#### Reward Animation Sequence:
1. Quality score builds as expanding waveform (1s)
2. Score transforms into currency symbol (0.5s)
3. Currency amount counts up with wave pulse (1s)
4. Success wave ripples outward (0.5s)

### 9. Error States as Dissonance

#### Error Handling:
- **Warning**: Wave distortion with amber overlay
- **Error**: Wave fragmentation with red accent
- **Recovery**: Wave reformation to stable pattern

### 10. Accessibility Through Sound

#### Visual Sound Cues:
- **Screen Reader**: Visible wave pattern when active
- **Keyboard Navigation**: Wave follows focus
- **High Contrast**: Maintain wave visibility in all modes
- **Motion Preference**: Respect prefers-reduced-motion

## Component-Specific Rules

### Voice Recorder Component
- Microphone icon pulses at speaking rhythm
- Real-time waveform matches actual audio input
- Amplitude indicates volume, frequency shows pitch
- Silent periods show as flat line with gentle oscillation

### Dashboard Analytics
- All metrics displayed as wave-based visualizations
- Hovering reveals wave details tooltip
- Clicking creates wave expansion for drill-down
- Multiple metrics show as layered wave spectrums

### Payment Flow
- Progress shown as building wave crescendo
- Success creates outward rippling celebration
- Amount displays with wave underline animation
- Confirmation includes wave signature pattern

### Authentication
- Password strength shown as wave complexity
- Login animation as wave synchronization
- Session timeout as wave decay
- Logout as wave dissipation

## Performance Guidelines

### Animation Performance:
- Use CSS transforms exclusively for wave animations
- Implement `will-change` for anticipated animations
- Limit concurrent animations to maintain 60 FPS
- Use `requestAnimationFrame` for complex wave calculations

### Loading Strategies:
- Show wave skeleton during data fetch
- Progressive wave building for long operations
- Stagger wave animations for list items
- Use intersection observer for wave triggers

## Testing Criteria

Every interaction must pass the "Listening Test":
1. Does it visually acknowledge user input?
2. Does it show clear progress through wave visualization?
3. Does it communicate value through depth and motion?
4. Does it maintain professional restraint?
5. Does it feel like a conversation, not a transaction?

## Implementation Priority

1. **Critical**: Voice recording interface with live waveform
2. **High**: Dashboard wave visualizations
3. **Medium**: Navigation wave patterns
4. **Low**: Decorative wave elements

Remember: Every pixel should serve the philosophy of transforming voice into visible value.