import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, ViewStyle } from "react-native";

export function useReducedMotion() {
  // Start without motion while the device preference is loading.
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => active && setReduced(value))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/** Figma 265:28993: the first basket arrival, independent of later quantity updates. */
export function CartDockArrival({
  visible,
  children,
  style,
}: {
  visible: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const appeared = useRef(false);
  const arrival = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible || appeared.current) {
      arrival.setValue(1);
      return;
    }
    appeared.current = true;
    if (reduced) return;
    arrival.setValue(0);
    const animation = Animated.timing(arrival, {
      toValue: 1,
      duration: 180,
      easing: Easing.bezier(0, 0, 0.58, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
      arrival.setValue(1);
    };
  }, [visible, reduced]);
  if (!visible) return null;
  return (
    <Animated.View
      style={[
        style,
        !reduced && {
          opacity: arrival.interpolate({
            inputRange: [0, 1],
            outputRange: [0.72, 1],
          }),
          transform: [
            {
              translateY: arrival.interpolate({
                inputRange: [0, 1],
                outputRange: [6, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** A small state transition: content is always visible, even before JS settles. */
export function StateArrival({
  children,
  changeKey,
  style,
}: {
  children: React.ReactNode;
  changeKey: string | number;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      offset.setValue(0);
      return;
    }
    offset.setValue(6);
    const animation = Animated.timing(offset, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [changeKey, reduced]);
  return (
    <Animated.View style={[style, { transform: [{ translateY: offset }] }]}>
      {children}
    </Animated.View>
  );
}

export function MeasuredProgress({
  value,
  label,
  color = "#087F4F",
  track = "#E7EBE7",
}: {
  value: number;
  label: string;
  color?: string;
  track?: string;
}) {
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const fill = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    const animation = Animated.timing(fill, {
      toValue: target,
      duration: reduced ? 0 : 420,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [target, reduced]);
  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={{
        height: 7,
        overflow: "hidden",
        backgroundColor: track,
        borderRadius: 4,
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          backgroundColor: color,
          borderRadius: 4,
          width: fill.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </Animated.View>
  );
}
