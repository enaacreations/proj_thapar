import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { gradient } from "../theme/tokens";

/**
 * The app mark — a residence block whose repeated windows are what read as
 * "hostel" rather than "house". Same geometry as the launcher icon
 * (store/assets/mark.py), so the splash, the welcome screen and the home
 * screen icon are all one shape.
 */
const ROOF =
  "M270 216 H754 A18 18 0 0 1 772 234 V254 A18 18 0 0 1 754 272 H270 " +
  "A18 18 0 0 1 252 254 V234 A18 18 0 0 1 270 216 Z";

/** Body, doorway and the six windows — the cut-outs rely on fill-rule evenodd. */
const BLOCK =
  "M318 254 H706 A26 26 0 0 1 732 280 V774 A26 26 0 0 1 706 800 H318 " +
  "A26 26 0 0 1 292 774 V280 A26 26 0 0 1 318 254 Z " +
  "M468 664 A44 44 0 0 1 556 664 V800 H468 Z " +
  "M366 332 H418 A18 18 0 0 1 436 350 V402 A18 18 0 0 1 418 420 H366 A18 18 0 0 1 348 402 V350 A18 18 0 0 1 366 332 Z " +
  "M486 332 H538 A18 18 0 0 1 556 350 V402 A18 18 0 0 1 538 420 H486 A18 18 0 0 1 468 402 V350 A18 18 0 0 1 486 332 Z " +
  "M606 332 H658 A18 18 0 0 1 676 350 V402 A18 18 0 0 1 658 420 H606 A18 18 0 0 1 588 402 V350 A18 18 0 0 1 606 332 Z " +
  "M366 456 H418 A18 18 0 0 1 436 474 V526 A18 18 0 0 1 418 544 H366 A18 18 0 0 1 348 526 V474 A18 18 0 0 1 366 456 Z " +
  "M486 456 H538 A18 18 0 0 1 556 474 V526 A18 18 0 0 1 538 544 H486 A18 18 0 0 1 468 526 V474 A18 18 0 0 1 486 456 Z " +
  "M606 456 H658 A18 18 0 0 1 676 474 V526 A18 18 0 0 1 658 544 H606 A18 18 0 0 1 588 526 V474 A18 18 0 0 1 606 456 Z";

/** Just the glyph, in whatever colour the caller wants. */
export function BrandGlyph({
  size,
  color = "#FFFFFF",
}: {
  size: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Path d={ROOF} fill={color} />
      <Path d={BLOCK} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

/** The glyph on the gradient plate — the launcher icon, in-app. */
export function BrandMark({ size = 88 }: { size?: number }) {
  return (
    <LinearGradient
      colors={[...gradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.plate,
        { width: size, height: size, borderRadius: size * 0.25 },
      ]}
    >
      <BrandGlyph size={size} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  plate: { alignItems: "center", justifyContent: "center" },
});
