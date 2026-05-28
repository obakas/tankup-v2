import { useEffect } from "react";
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { type TankupTheme } from "@/components/ui/theme";

type Props = {
  height: number;
  theme: TankupTheme;
  width?: number | `${number}%`;
  borderRadius?: number;
  style?: object;
};

export function Skeleton({ height, theme, width, borderRadius = 10, style }: Props) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { height, borderRadius, backgroundColor: theme.muted, width },
        animatedStyle,
        style,
      ]}
    />
  );
}
