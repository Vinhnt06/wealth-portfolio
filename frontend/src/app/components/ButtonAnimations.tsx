'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { useState, type ComponentType, type ReactNode } from 'react';

// Button animation variants
export const buttonVariants = {
    hover: {
        scale: 1.05,
        transition: { duration: 0.2, ease: 'easeOut' as const },
    },
    tap: {
        scale: 0.95,
        transition: { duration: 0.1 },
    },
    rotate: {
        rotate: 90,
        transition: { duration: 2 },
    },
};

// Random color generator
const randomColor = () => {
    const colors = [
        '#0099FF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
        '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
};

// Animated Button with Hover Effect
interface AnimatedButtonProps extends HTMLMotionProps<'button'> {
    children: ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost';
    withRotate?: boolean;
    withColorChange?: boolean;
}

export function AnimatedButton({
    children,
    variant = 'primary',
    withRotate = false,
    withColorChange = false,
    className = '',
    onClick,
    ...props
}: AnimatedButtonProps) {
    const [bgColor, setBgColor] = useState<string | undefined>(undefined);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (withColorChange) {
            setBgColor(randomColor());
        }
        onClick?.(e);
    };

    return (
        <motion.button
            className={className}
            animate={withRotate ? { rotate: 360, backgroundColor: bgColor } : { backgroundColor: bgColor }}
            whileHover="hover"
            whileTap="tap"
            variants={buttonVariants}
            transition={withRotate ? { rotate: { duration: 2, ease: 'easeInOut' } } : undefined}
            onClick={handleClick}
            {...props}
        >
            {children}
        </motion.button>
    );
}

// Button with Random Color on Click
export function ColorChangeButton({
    children,
    className = '',
    ...props
}: AnimatedButtonProps) {
    const [bgColor, setBgColor] = useState('#0099FF');

    return (
        <motion.button
            className={className}
            animate={{ backgroundColor: bgColor }}
            whileHover="hover"
            whileTap="tap"
            variants={buttonVariants}
            onClick={(e) => {
                setBgColor(randomColor());
                props.onClick?.(e);
            }}
            {...props}
        >
            {children}
        </motion.button>
    );
}

// Button with Rotate Animation
export function RotatingButton({
    children,
    className = '',
    ...props
}: AnimatedButtonProps) {
    return (
        <motion.button
            className={className}
            animate="rotate"
            whileHover="hover"
            whileTap="tap"
            variants={buttonVariants}
            {...props}
        >
            {children}
        </motion.button>
    );
}

// HOC to add animations to any component
export function withHoverAnimation<P extends object>(
    Component: ComponentType<P>
): ComponentType<P> {
    return function AnimatedComponent(props: P) {
        return (
            <motion.div
                whileHover="hover"
                whileTap="tap"
                variants={buttonVariants}
            >
                <Component {...props} />
            </motion.div>
        );
    };
}

// Custom hook for button animations
export function useButtonAnimation() {
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);

    return {
        isHovered,
        isPressed,
        handlers: {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
            onMouseDown: () => setIsPressed(true),
            onMouseUp: () => setIsPressed(false),
        },
        variants: buttonVariants,
    };
}
