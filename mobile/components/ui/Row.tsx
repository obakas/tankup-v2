import { View, Text } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  label: string;
  value: string;
  bold?: boolean;
};

export function Row({ label, value, bold }: Props) {
  const { theme } = useAppTheme();

  return (
    <View className="flex-row justify-between py-2 gap-4">
      <Text style={{ color: theme.mutedForeground }} className="flex-1">
        {label}
      </Text>
      <Text
        style={{ color: theme.foreground }}
        className={`${bold ? "font-bold" : "font-medium"} text-right flex-1`}
      >
        {value}
      </Text>
    </View>
  );
}


// import { View, Text } from "react-native";

// type Props = {
//   label: string;
//   value: string;
//   bold?: boolean;
// };

// export function Row({ label, value, bold }: Props) {
//   return (
//     <View className="flex-row justify-between py-2">
//       <Text className="text-muted-foreground">{label}</Text>
//       <Text className={`text-foreground ${bold ? "font-bold" : "font-medium"}`}>
//         {value}
//       </Text>
//     </View>
//   );
// }