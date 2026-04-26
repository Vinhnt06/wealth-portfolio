# Button Animation Usage Guide

## Available Components

### 1. AnimatedButton (Basic Hover & Tap)
```tsx
import { AnimatedButton } from '@/app/components/ButtonAnimations';

<AnimatedButton className="px-6 py-3 bg-blue-500 text-white rounded-lg">
  Click Me
</AnimatedButton>
```

### 2. ColorChangeButton (Random Color on Click)
```tsx
import { ColorChangeButton } from '@/app/components/ButtonAnimations';

<ColorChangeButton className="px-6 py-3 text-white rounded-lg">
  Change Color
</ColorChangeButton>
```

### 3. RotatingButton (Rotate Animation)
```tsx
import { RotatingButton } from '@/app/components/ButtonAnimations';

<RotatingButton className="px-6 py-3 bg-green-500 text-white rounded-lg">
  Rotate Me
</RotatingButton>
```

### 4. HOC Wrapper (Add animations to any component)
```tsx
import { withHoverAnimation } from '@/app/components/ButtonAnimations';

const MyButton = ({ children }) => <button>{children}</button>;
const AnimatedMyButton = withHoverAnimation(MyButton);
```

### 5. Custom Hook (Manual control)
```tsx
import { useButtonAnimation } from '@/app/components/ButtonAnimations';
import { motion } from 'framer-motion';

function MyCustomButton() {
  const { handlers, variants } = useButtonAnimation();
  
  return (
    <motion.button
      {...handlers}
      whileHover="hover"
      whileTap="tap"
      variants={variants}
    >
      Custom Button
    </motion.button>
  );
}
```

## Animation Effects

- **Hover**: Scale up to 1.05x
- **Tap**: Scale down to 0.95x
- **Rotate**: 90° rotation over 2 seconds
- **Color Change**: Random color from predefined palette

## Next Steps

Replace existing buttons throughout the app with these animated components for consistent UX.
