import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/contexts/AuthContext";
import { useOrderChat } from "@/hooks/useOrderChat";
import type { OrderMessage } from "@/services/chatService";
import { colors, radius, spacing, typography } from "@/constants/theme";

const MAX_LENGTH = 1000;

const dayLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** A message, or the date separator that precedes the first of that day. */
type Row = { kind: "day"; key: string; label: string } | { kind: "message"; key: string; message: OrderMessage };

/**
 * One order's chat, as a full screen.
 *
 * Reached from a confirmed order in Orders or the chef dashboard, and from a
 * new-message notification. See `feature-docs/06-order-chat.md`.
 */
export default function OrderChatScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const orderId = Number(params.id) || null;
  const counterpartName = params.name || "your order";

  const { dbUser } = useAuth();
  const {
    messages,
    thread,
    loading,
    error,
    sending,
    connection,
    theirLastReadMessageId,
    theyAreTyping,
    notifyTyping,
    hasMore,
    loadOlder,
    send,
  } = useOrderChat(orderId, true);

  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<Row>>(null);

  // Newest message stays in view as the thread grows.
  useEffect(() => {
    if (messages.length === 0 && !theyAreTyping) return;
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [messages.length, theyAreTyping]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay: string | null = null;
    messages.forEach((message) => {
      const day = dayLabel(message.created_at);
      if (day !== lastDay) {
        out.push({ kind: "day", key: `day-${day}`, label: day });
        lastDay = day;
      }
      out.push({ kind: "message", key: `m-${message.id}`, message });
    });
    return out;
  }, [messages]);

  const myLastMessageId = useMemo(() => {
    const mine = messages.filter((m) => m.sender_id === dbUser?.id);
    return mine.length ? mine[mine.length - 1].id : null;
  }, [messages, dbUser?.id]);

  const seen =
    myLastMessageId != null &&
    theirLastReadMessageId != null &&
    theirLastReadMessageId >= myLastMessageId;

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    try {
      await send(body);
      setDraft("");
    } catch {
      // The hook surfaces the error and the draft is kept, so nothing is lost.
    }
  };

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === "day") {
      return (
        <View style={styles.dayRow}>
          <Text style={styles.dayLabel}>{item.label}</Text>
        </View>
      );
    }

    const mine = item.message.sender_id === dbUser?.id;
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
            {item.message.body}
          </Text>
          <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
            {timeLabel(item.message.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {counterpartName}
          </Text>
          <Text style={styles.headerSubtitle}>
            Order #{orderId}
            {(connection === "reconnecting" || connection === "polling") && " · Reconnecting…"}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.key}
            renderItem={renderRow}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              hasMore ? (
                <Pressable style={styles.loadOlder} onPress={() => void loadOlder()}>
                  <Text style={styles.loadOlderText}>Load earlier messages</Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={32}
                  color={colors.mutedForeground}
                />
                <Text style={styles.emptyText}>
                  No messages yet. Ask about your order and {counterpartName} will see it
                  straight away.
                </Text>
              </View>
            }
            ListFooterComponent={
              <>
                {theyAreTyping && (
                  <Text style={styles.typing}>{counterpartName} is typing…</Text>
                )}
                {seen && <Text style={styles.seen}>Seen</Text>}
              </>
            }
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {thread?.can_send ? (
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                notifyTyping();
              }}
              placeholder="Write a message…"
              placeholderTextColor={colors.mutedForeground}
              maxLength={MAX_LENGTH}
              multiline
            />
            <Pressable
              style={[styles.send, (sending || !draft.trim()) && styles.sendDisabled]}
              onPress={() => void submit()}
              disabled={sending || !draft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Ionicons name="send" size={18} color={colors.primaryForeground} />
              )}
            </Pressable>
          </View>
        ) : (
          <Text style={styles.closed}>
            {thread?.locked_reason === "not_confirmed"
              ? "This chat opens once the chef confirms the order."
              : "This chat is closed. You can still read the conversation."}
          </Text>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerText: { flex: 1 },
  headerTitle: { ...typography.md, fontWeight: "600", color: colors.foreground },
  headerSubtitle: { ...typography.xs, color: colors.mutedForeground },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.sm,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  listContent: { padding: spacing.md, flexGrow: 1 },
  dayRow: { alignItems: "center", marginVertical: spacing.sm },
  dayLabel: {
    ...typography.xs,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  bubbleRow: { flexDirection: "row", marginBottom: spacing.xs },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowTheirs: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleTheirs: {
    backgroundColor: colors.muted,
    borderBottomLeftRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bubbleText: { ...typography.base, color: colors.foreground },
  bubbleTextMine: { color: colors.primaryForeground },
  bubbleTime: { ...typography.xs, color: colors.mutedForeground, marginTop: 2 },
  bubbleTimeMine: { color: "rgba(255,255,255,0.7)" },
  seen: { ...typography.xs, color: colors.mutedForeground, textAlign: "right" },
  typing: {
    ...typography.sm,
    color: colors.mutedForeground,
    fontStyle: "italic",
    paddingVertical: spacing.xs,
  },
  loadOlder: { alignItems: "center", paddingVertical: spacing.sm },
  loadOlderText: { ...typography.sm, color: colors.primary, fontWeight: "600" },
  error: {
    ...typography.sm,
    color: colors.destructive,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.base,
    color: colors.foreground,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.5 },
  closed: {
    ...typography.sm,
    color: colors.mutedForeground,
    textAlign: "center",
    padding: spacing.md,
  },
});
