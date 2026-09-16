import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";

export default function Root() {
  const { loading, user, dbUser, activeRole } = useAuth();

  if (loading) return <FullScreenLoader message="Loading..." />;

  // Browse-first: logged-out users land on the public Find Chefs tab (matching
  // the web app), not the login screen. Login is only demanded at protected
  // actions.
  if (!user) return <Redirect href="/(tabs)/chefs" />;

  // Route to the chef dashboard only when the backend confirms is_chef, and
  // only while the user is acting as a chef — a dual-role account that last
  // chose customer mode should reopen on the customer tabs. Avoids acting on a
  // stale AsyncStorage role when dbUser hasn't loaded yet.
  if (dbUser?.is_chef === true && activeRole !== "customer") {
    return <Redirect href="/(chef)/dashboard" />;
  }

  return <Redirect href="/(tabs)/chefs" />;
}
