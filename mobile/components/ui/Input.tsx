import { View, Text, TextInput } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "phone-pad" | "default";
};

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: Props) {
  const { theme } = useAppTheme();

  return (
    <View>
      <Text style={{ color: theme.foreground }} className="font-medium mb-2">
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType ?? "default"}
        placeholderTextColor={theme.mutedForeground}
        style={{
          backgroundColor: theme.input,
          borderColor: theme.border,
          color: theme.foreground,
        }}
        className="border rounded-xl px-4 py-4 text-base"
      />
    </View>
  );
}


// import { View, Text, TextInput } from "react-native";

// type Props = {
//   label: string;
//   value: string;
//   onChangeText: (t: string) => void;
//   placeholder?: string;
//   keyboardType?: "phone-pad" | "default";
// };

// export function Input({
//   label,
//   value,
//   onChangeText,
//   placeholder,
//   keyboardType,
// }: Props) {
//   return (
//     <View>
//       <Text className="text-foreground font-medium mb-4 text-white">{label}</Text>

//       <TextInput
//         value={value}
//         onChangeText={onChangeText}
//         placeholder={placeholder}
//         keyboardType={keyboardType ?? "default"}
//         placeholderTextColor="#7c8aa6"
//         className="bg-card border border-border rounded-xl px-4 py-5 text-foreground text-lg"
//         style={{ color: "#000000" }}
//       />
//     </View>
//   );
// }