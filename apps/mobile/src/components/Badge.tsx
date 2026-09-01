import {
  REQUEST_STATUS_LABELS,
  type RequestStatus,
} from "@proj/shared";
import { StyleSheet, View } from "react-native";
import {
  CheckCircle2,
  Clock,
  Loader,
  XCircle,
  type LucideIcon,
} from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { fonts, radius, toneColors, type Tone } from "../theme/tokens";
import { Text } from "./Text";

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: LucideIcon;
}

export function Badge({ label, tone = "neutral", icon: Icon }: BadgeProps) {
  const { c } = useTheme();
  const { fg, bg } = toneColors(c, tone);

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {Icon && <Icon size={13} color={fg} strokeWidth={2} />}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const STATUS_TONE: Record<RequestStatus, Tone> = {
  submitted: "info",
  in_progress: "warning",
  resolved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

const STATUS_ICON: Record<RequestStatus, LucideIcon> = {
  submitted: Clock,
  in_progress: Loader,
  resolved: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle,
};

/** Status is always colour + icon + word together, never colour alone. */
export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge
      label={REQUEST_STATUS_LABELS[status]}
      tone={STATUS_TONE[status]}
      icon={STATUS_ICON[status]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  label: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 16 },
});
