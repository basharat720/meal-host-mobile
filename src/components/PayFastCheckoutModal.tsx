import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { getCheckoutError } from "@/lib/errorMessages";
import {
  PAYFAST_SUCCESS_CODE,
  PayFastFormData,
  PayFastReturn,
  buildPayFastAutoSubmitHtml,
  parsePayFastReturn,
  payfastService,
} from "@/services/payfastService";

type Phase =
  | { kind: "starting" }
  | { kind: "paying"; html: string; formData: PayFastFormData }
  | { kind: "verifying" }
  | { kind: "failed"; message: string }
  // PayFast said yes but FoodPal couldn't confirm it from here. The webhook
  // still settles the order server-side, so this is "check My Orders", not
  // "try again" — retrying could charge twice.
  | { kind: "unconfirmed" };

interface Props {
  /** The order to pay for; the modal is open while this is set. */
  orderId: number | null;
  customerMobile: string;
  /** PayFast took the money and FoodPal confirmed it. */
  onPaid: (orderId: number) => void;
  /** Back to checkout, cart intact. */
  onClose: () => void;
  /** Leave checkout for My Orders. */
  onOpenOrders: () => void;
}

/**
 * PayFast's hosted checkout inside the app: asks FoodPal for the signed form,
 * posts it to PayFast in a WebView, and catches PayFast returning to FoodPal's
 * success or failure address. Mirrors the website's bridge, success and
 * failure pages. See feature-docs/14-paying-with-payfast.md.
 */
export function PayFastCheckoutModal({
  orderId,
  customerMobile,
  onPaid,
  onClose,
  onOpenOrders,
}: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  // PayFast's return can be reported by more than one WebView callback.
  const handledRef = useRef(false);

  useEffect(() => {
    if (orderId == null) return;
    let cancelled = false;
    handledRef.current = false;
    setPhase({ kind: "starting" });

    payfastService
      .initiatePayment(orderId, customerMobile)
      .then(({ form_data, post_url }) => {
        if (cancelled) return;
        setPhase({
          kind: "paying",
          formData: form_data,
          html: buildPayFastAutoSubmitHtml(form_data, post_url),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("PayFast initiate failed:", err);
        setPhase({ kind: "failed", message: getCheckoutError(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, customerMobile]);

  const handleReturn = useCallback(
    async (ret: PayFastReturn & { kind: "success" | "failure" }) => {
      if (handledRef.current || orderId == null) return;
      handledRef.current = true;

      if (ret.kind === "failure" || ret.errCode !== PAYFAST_SUCCESS_CODE) {
        setPhase({
          kind: "failed",
          message: ret.errMsg || "PayFast didn't complete the payment.",
        });
        return;
      }

      setPhase({ kind: "verifying" });
      try {
        const result = await payfastService.verifyPayment(ret);
        if (result.success) {
          onPaid(result.order_id);
        } else {
          setPhase({
            kind: "failed",
            message: result.message || "The payment couldn't be verified.",
          });
        }
      } catch (err) {
        console.error("PayFast verify failed:", err);
        setPhase({ kind: "unconfirmed" });
      }
    },
    [orderId, onPaid]
  );

  const formData = phase.kind === "paying" ? phase.formData : null;

  const onShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest) => {
      if (!formData) return true;
      const ret = parsePayFastReturn(request.url, formData);
      if (!ret) return true;
      handleReturn(ret);
      // FoodPal's website page would only verify again; the app does it here.
      return false;
    },
    [formData, handleReturn]
  );

  // Belt and braces: some Android versions don't consult the callback above
  // for server-side redirects, but still report the navigation here.
  const onNavigationStateChange = useCallback(
    (nav: WebViewNavigation) => {
      if (!formData) return;
      const ret = parsePayFastReturn(nav.url, formData);
      if (ret) handleReturn(ret);
    },
    [formData, handleReturn]
  );

  const confirmLeave = () => {
    if (phase.kind !== "paying") {
      onClose();
      return;
    }
    Alert.alert(
      "Leave payment?",
      "Your order won't be placed until you pay. Your cart will still be here.",
      [
        { text: "Stay", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: onClose },
      ]
    );
  };

  return (
    <Modal
      visible={orderId != null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={phase.kind === "verifying" ? () => {} : confirmLeave}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="lock-closed" size={16} color={colors.primary} />
            <Text style={styles.headerTitle}>Secure payment</Text>
          </View>
          {phase.kind !== "verifying" ? (
            <Pressable onPress={confirmLeave} hitSlop={10} accessibilityLabel="Close payment">
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          ) : null}
        </View>

        {phase.kind === "paying" ? (
          <WebView
            source={{ html: phase.html }}
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onNavigationStateChange={onNavigationStateChange}
            startInLoadingState
            renderLoading={() => <Centered text="Connecting to PayFast…" />}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            style={styles.webview}
          />
        ) : phase.kind === "starting" ? (
          <Centered text="Connecting to PayFast…" />
        ) : phase.kind === "verifying" ? (
          <Centered text="Confirming your payment…" />
        ) : phase.kind === "failed" ? (
          <Outcome
            icon="close-circle"
            iconColor={colors.destructive}
            title="Payment didn't go through"
            body={`${phase.message}\n\nNothing was charged. Your cart is still there.`}
            primary={{ label: "Try again", onPress: onClose }}
          />
        ) : (
          <Outcome
            icon="time-outline"
            iconColor={colors.primary}
            title="We couldn't confirm your payment yet"
            body="PayFast is telling us about it directly, so your order will update on its own. Check My Orders in a moment, and please don't pay again."
            primary={{ label: "Go to My Orders", onPress: onOpenOrders }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Centered({ text }: { text: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.centeredText}>{text}</Text>
    </View>
  );
}

function Outcome({
  icon,
  iconColor,
  title,
  body,
  primary,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  title: string;
  body: string;
  primary: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.centered}>
      <Ionicons name={icon} size={64} color={iconColor} />
      <Text style={styles.outcomeTitle}>{title}</Text>
      <Text style={styles.outcomeBody}>{body}</Text>
      <Button variant="primary" size="lg" style={styles.outcomeButton} onPress={primary.onPress}>
        {primary.label}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.foreground,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  centeredText: {
    ...typography.base,
    color: colors.mutedForeground,
  },
  outcomeTitle: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
  },
  outcomeBody: {
    ...typography.base,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  outcomeButton: {
    alignSelf: "stretch",
    marginTop: spacing.sm,
    borderRadius: radius.md,
  },
});
