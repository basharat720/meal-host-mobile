import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";

export default function Root() {
  const { loading, user, dbUser } = useAuth();

  if (loading) return <FullScreenLoader message="Loading..." />;

  // Browse-first: logged-out users land on the public home feed (matching the
  // web app), not the login screen. Login is only demanded at protected actions.
  if (!user) return <Redirect href="/(tabs)/home" />;

  // Only route to the chef dashboard when the backend user explicitly confirms is_chef.
  // Avoids acting on a stale AsyncStorage role when dbUser hasn't loaded yet.
  if (dbUser?.is_chef === true) return <Redirect href="/(chef)/dashboard" />;

  return <Redirect href="/(tabs)/home" />;
}
