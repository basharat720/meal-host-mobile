import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";

export default function Root() {
  const { loading, user, dbUser } = useAuth();

  if (loading) return <FullScreenLoader message="Loading..." />;

  if (!user) return <Redirect href="/(auth)/customer-login" />;

  // Only route to the chef dashboard when the backend user explicitly confirms is_chef.
  // Avoids acting on a stale AsyncStorage role when dbUser hasn't loaded yet.
  if (dbUser?.is_chef === true) return <Redirect href="/(chef)/dashboard" />;

  return <Redirect href="/(tabs)/home" />;
}
