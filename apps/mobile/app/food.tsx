import { Redirect } from "expo-router";

/** Old deep link `/food` → Food tab. */
export default function FoodRedirect() {
  return <Redirect href="/(tabs)/food" />;
}
