import type { ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LucideProps } from "lucide-react-native";

import { colors } from "../theme";

interface IconButtonProps {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: ComponentType<LucideProps>;
  label?: string;
  onPress: () => void;
  tone?: "default" | "primary" | "danger";
}

export function IconButton({
  accessibilityLabel,
  disabled = false,
  icon: Icon,
  label,
  onPress,
  tone = "default",
}: IconButtonProps) {
  const foreground =
    tone === "primary"
      ? colors.ink
      : tone === "danger"
        ? colors.danger
        : colors.text;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        label ? styles.withLabel : styles.iconOnly,
        tone === "primary" && styles.primary,
        tone === "danger" && styles.danger,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        <Icon color={foreground} size={label ? 18 : 20} strokeWidth={2} />
        {label ? (
          <Text style={[styles.label, { color: foreground }]}>{label}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 6,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  danger: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerLine,
  },
  disabled: {
    opacity: 0.4,
  },
  iconOnly: {
    width: 44,
  },
  label: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.68,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  withLabel: {
    minWidth: 112,
    paddingHorizontal: 14,
  },
});
