# Style Guide: Sonic Visual System

## Design Foundation
A comprehensive visual language where voice becomes currency and sound becomes sight.

## Color System

### Primary Sonic Palette

#### Deep Ocean Blues (Trust & Depth)
```css
--color-ocean-primary: #1a237e;    /* Deep navy - infinite acoustic space */
--color-ocean-secondary: #303f9f;  /* Rich blue - major UI elements */
--color-ocean-accent: #3f51b5;     /* Confident blue - interactions */
```

#### Resonant Purples (Premium & Sophistication)
```css
--color-resonant-primary: #4a148c;   /* Deep violet - high-frequency clarity */
--color-resonant-secondary: #7b1fa2; /* Professional purple - emphasis */
--color-resonant-accent: #9c27b0;    /* Vibrant purple - success states */
```

### Audio Spectrum Gradients

#### Frequency Ranges
```css
--gradient-low-freq: linear-gradient(90deg, #1a237e 0%, #283593 100%);   /* Deep bass tones */
--gradient-mid-freq: linear-gradient(90deg, #7b1fa2 0%, #8e24aa 100%);   /* Vocal richness */
--gradient-high-freq: linear-gradient(90deg, #3f51b5 0%, #5c6bc0 100%);  /* Crisp treble */
```

#### Waveform Gradients
```css
--gradient-waveform: linear-gradient(90deg, #1a237e 0%, #7b1fa2 50%, #3f51b5 100%);
--gradient-radial-wave: radial-gradient(circle, #4a148c 0%, #1a237e 70%);
--gradient-sonic-mesh: 
  linear-gradient(90deg, #1a237e33 1px, transparent 1px),
  linear-gradient(180deg, #7b1fa233 1px, transparent 1px);
```

### Supporting Colors

#### Neutral Acoustics
```css
--color-background: #f8faff;  /* Clean studio white with blue undertone */
--color-surface: #ffffff;     /* Pure white for content areas */
--color-border: #e3f2fd;      /* Subtle blue-grey separation */
--color-shadow: #1a237e1a;    /* 10% deep navy for shadows */
```

#### Signal Colors
```css
--color-success: #00c853;     /* Payment confirmation */
--color-warning: #ff8f00;     /* Attention states */
--color-error: #d32f2f;       /* Error states */
--color-info: #0288d1;        /* Guidance */
```

### Depth System

#### Surface Elevations
```css
--elevation-0: #ffffff;
--elevation-1: linear-gradient(145deg, #ffffff 0%, #f5f7ff 100%);
--elevation-2: linear-gradient(145deg, #ffffff 0%, #f0f2ff 100%);
--elevation-3: linear-gradient(145deg, #ffffff 0%, #ebeeff 100%);
--elevation-4: linear-gradient(145deg, #ffffff 0%, #e6e9ff 100%);
```

## Typography

### Font Stack
```css
--font-display: 'Inter Display', -apple-system, BlinkMacSystemFont, sans-serif;
--font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;
```

### Type Scale (Golden Ratio)
```css
--text-xs: 0.618rem;    /* 9.89px - Micro labels */
--text-sm: 0.75rem;     /* 12px - Captions */
--text-base: 1rem;      /* 16px - Body text */
--text-lg: 1.25rem;     /* 20px - Emphasis */
--text-xl: 1.618rem;    /* 25.89px - Subheadings */
--text-2xl: 2rem;       /* 32px - Section headers */
--text-3xl: 2.618rem;   /* 41.89px - Page titles */
--text-4xl: 3.236rem;   /* 51.78px - Hero text */
```

### Font Weights (Resonance)
```css
--font-thin: 100;       /* Whisper */
--font-light: 300;      /* Soft speech */
--font-regular: 400;    /* Normal tone */
--font-medium: 500;     /* Clear voice */
--font-semibold: 600;   /* Emphasis */
--font-bold: 700;       /* Strong statement */
--font-black: 900;      /* Maximum impact */
```

### Line Heights (Rhythm)
```css
--leading-tight: 1.25;   /* Compact waveforms */
--leading-normal: 1.5;   /* Standard rhythm */
--leading-relaxed: 1.75; /* Open breathing */
--leading-loose: 2;      /* Maximum space */
```

## Spacing System (Musical Intervals)

```css
--space-1: 0.25rem;   /* 4px - Unison */
--space-2: 0.5rem;    /* 8px - Minor second */
--space-3: 0.75rem;   /* 12px - Major second */
--space-4: 1rem;      /* 16px - Minor third */
--space-5: 1.25rem;   /* 20px - Major third */
--space-6: 1.5rem;    /* 24px - Perfect fourth */
--space-8: 2rem;      /* 32px - Perfect fifth */
--space-10: 2.5rem;   /* 40px - Minor sixth */
--space-12: 3rem;     /* 48px - Major sixth */
--space-16: 4rem;     /* 64px - Octave */
--space-20: 5rem;     /* 80px - Tenth */
--space-24: 6rem;     /* 96px - Twelfth */
```

## Component Styles

### Buttons (Interactive Waves)

```css
.btn-primary {
  background: var(--gradient-mid-freq);
  color: white;
  padding: var(--space-3) var(--space-6);
  border-radius: 24px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.btn-primary::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transform: translateY(-50%);
  transition: left 0.5s ease;
}

.btn-primary:hover::before {
  left: 100%;
}

.btn-primary:active {
  transform: scale(0.98);
}
```

### Cards (Acoustic Surfaces)

```css
.card {
  background: var(--elevation-1);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: var(--space-6);
  position: relative;
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.card::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 16px;
  background: var(--gradient-waveform);
  opacity: 0;
  z-index: -1;
  transition: opacity 0.3s ease;
}

.card:hover::after {
  opacity: 0.1;
}
```

### Input Fields (Listening Channels)

```css
.input {
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  transition: all 0.3s ease;
  position: relative;
}

.input:focus {
  border-color: var(--color-ocean-accent);
  box-shadow: 0 0 0 4px rgba(63, 81, 181, 0.1);
  outline: none;
}

.input-wave-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gradient-waveform);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s ease;
}

.input:focus + .input-wave-indicator {
  transform: scaleX(1);
}
```

### Navigation (Wave Navigation Bar)

```css
.nav {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: relative;
}

.nav::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--gradient-waveform);
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 3'%3E%3Cpath d='M0,1.5 Q300,0 600,1.5 T1200,1.5' stroke='black' fill='none'/%3E%3C/svg%3E");
  mask-size: 100% 100%;
  animation: wave-flow 3s ease-in-out infinite;
}

@keyframes wave-flow {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-50px); }
}
```

### Voice Recorder (Live Waveform)

```css
.voice-recorder {
  background: var(--gradient-radial-wave);
  border-radius: 50%;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.voice-wave {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--color-resonant-accent);
  animation: pulse-wave 1.5s ease-in-out infinite;
}

@keyframes pulse-wave {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.3); opacity: 0; }
}

.waveform-visualizer {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 60px;
}

.waveform-bar {
  width: 3px;
  background: var(--gradient-mid-freq);
  border-radius: 1.5px;
  animation: wave-dance 0.5s ease-in-out infinite alternate;
}

@keyframes wave-dance {
  from { height: 20%; }
  to { height: 100%; }
}
```

### Progress Indicators (Sonic Progress)

```css
.progress-wave {
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.progress-wave-fill {
  height: 100%;
  background: var(--gradient-waveform);
  border-radius: 2px;
  position: relative;
  transition: width 0.3s ease;
}

.progress-wave-pulse {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 20px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5));
  animation: progress-pulse 1s ease-in-out infinite;
}

@keyframes progress-pulse {
  0%, 100% { transform: translateX(0); opacity: 0; }
  50% { transform: translateX(-10px); opacity: 1; }
}
```

### Dashboard Metrics (Frequency Visualizations)

```css
.metric-card {
  background: var(--elevation-2);
  border-radius: 16px;
  padding: var(--space-6);
  position: relative;
  overflow: hidden;
}

.metric-background-wave {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
  opacity: 0.1;
  background: var(--gradient-waveform);
  mask-image: linear-gradient(to top, black, transparent);
}

.frequency-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 100px;
}

.frequency-bar {
  flex: 1;
  background: var(--gradient-mid-freq);
  border-radius: 2px 2px 0 0;
  transition: height 0.3s ease;
}
```

## Animation Patterns

### Wave Oscillation
```css
@keyframes oscillate {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-2px); }
  75% { transform: translateY(2px); }
}

.oscillating {
  animation: oscillate 2s ease-in-out infinite;
}
```

### Sound Ripple
```css
@keyframes ripple {
  0% { transform: scale(0); opacity: 1; }
  100% { transform: scale(4); opacity: 0; }
}

.ripple-effect {
  position: absolute;
  border-radius: 50%;
  background: var(--color-ocean-accent);
  animation: ripple 0.6s ease-out;
}
```

### Voice Modulation
```css
@keyframes modulate {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.1); }
}

.modulating {
  animation: modulate 1s ease-in-out infinite;
}
```

## Responsive Breakpoints

```css
--breakpoint-sm: 640px;   /* Mobile landscape */
--breakpoint-md: 768px;   /* Tablet portrait */
--breakpoint-lg: 1024px;  /* Tablet landscape */
--breakpoint-xl: 1280px;  /* Desktop */
--breakpoint-2xl: 1536px; /* Wide desktop */
```

## Shadow System (Acoustic Depth)

```css
--shadow-sm: 0 1px 2px 0 var(--color-shadow);
--shadow-md: 0 4px 6px -1px var(--color-shadow);
--shadow-lg: 0 10px 15px -3px var(--color-shadow);
--shadow-xl: 0 20px 25px -5px var(--color-shadow);
--shadow-2xl: 0 25px 50px -12px var(--color-shadow);
--shadow-inner: inset 0 2px 4px 0 var(--color-shadow);
--shadow-wave: 0 4px 20px -2px var(--gradient-waveform);
```

## Border Radius (Wave Curves)

```css
--radius-sm: 4px;    /* Subtle curve */
--radius-md: 8px;    /* Standard curve */
--radius-lg: 12px;   /* Smooth curve */
--radius-xl: 16px;   /* Wave curve */
--radius-2xl: 24px;  /* Deep curve */
--radius-full: 9999px; /* Perfect circle */
```

## Z-Index Scale (Depth Layers)

```css
--z-background: -100;  /* Ambient patterns */
--z-below: -1;        /* Hidden elements */
--z-base: 0;          /* Default layer */
--z-dropdown: 10;     /* Dropdowns */
--z-sticky: 20;       /* Sticky elements */
--z-overlay: 30;      /* Overlays */
--z-modal: 40;        /* Modals */
--z-popover: 50;      /* Popovers */
--z-tooltip: 60;      /* Tooltips */
--z-notification: 70; /* Notifications */
```

## Implementation Guidelines

1. **Always use CSS variables** for consistency
2. **Prefer gradients over solid colors** for depth
3. **Include wave patterns** in major components
4. **Animate with purpose**, not decoration
5. **Test on mobile first** - voice feedback is mobile-primary
6. **Maintain 60 FPS** for all animations
7. **Use semantic color names** that reflect audio concepts
8. **Layer elements** to create acoustic depth
9. **Respect reduced motion** preferences
10. **Document custom properties** for team clarity

## Testing Checklist

- [ ] Colors maintain WCAG AA contrast ratios
- [ ] Animations run at 60 FPS on mobile devices
- [ ] Wave patterns visible in light/dark modes
- [ ] Gradients render correctly on all browsers
- [ ] Touch targets meet 44x44px minimum
- [ ] Focus states clearly visible
- [ ] Loading states use wave animations
- [ ] Error states maintain sonic theme
- [ ] Success states celebrate with waves
- [ ] All interactions feel "conversational"