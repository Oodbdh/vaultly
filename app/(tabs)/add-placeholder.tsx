import { Redirect } from 'expo-router';

/** Never rendered — the centre tab slot is occupied by the FAB. */
export default function AddPlaceholder() {
  return <Redirect href="/(tabs)/home" />;
}
