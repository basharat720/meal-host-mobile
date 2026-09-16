import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { getAuthToken } from "@/lib/api";
import {
  ChatUnread,
  OrderMessage,
  OrderThread,
  chatService,
  chatSocketUrl,
} from "@/services/chatService";

/** Messages are sent over REST and received over this socket. */
type ConnectionState = "connecting" | "live" | "reconnecting" | "polling";

const PAGE_SIZE = 50;
const HEARTBEAT_MS = 25_000;
/** At most one typing frame this often, well inside the socket's own floor. */
const TYPING_THROTTLE_MS = 3_000;
/**
 * How long a typing indicator survives without another frame.
 *
 * There is deliberately no "stopped typing" frame: that is the one frame whose
 * loss would leave the indicator stuck on forever. Expiring it on a timer fails
 * the harmless way instead — it clears a moment early.
 */
const TYPING_EXPIRY_MS = 4_000;
const POLL_MS = 5_000;
/** After this many failed attempts, stop waiting on the socket and poll. */
const FAILURES_BEFORE_POLLING = 3;
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

interface UseOrderChatResult {
  messages: OrderMessage[];
  thread: OrderThread | null;
  loading: boolean;
  error: string | null;
  sending: boolean;
  connection: ConnectionState;
  /** How far the other participant has read — what drives the "Seen" marker. */
  theirLastReadMessageId: number | null;
  /** True while the other participant is typing. Never set while polling. */
  theyAreTyping: boolean;
  /** Call on keystroke; throttled, and a no-op unless the socket is live. */
  notifyTyping: () => void;
  hasMore: boolean;
  loadOlder: () => Promise<void>;
  send: (body: string) => Promise<void>;
}

/**
 * Live view of one order's chat.
 *
 * Only runs while `enabled` — the panel being open. The socket is the delivery
 * channel and the REST endpoints are the source of truth, so a dropped
 * connection costs nothing: the thread is refetched on reconnect, and after a
 * few failures the hook falls back to polling rather than going silent.
 */
export const useOrderChat = (
  orderId: number | null,
  enabled: boolean,
): UseOrderChatResult => {
  const [thread, setThread] = useState<OrderThread | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [theirLastRead, setTheirLastRead] = useState<number | null>(null);
  const [theyAreTyping, setTheyAreTyping] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const timersRef = useRef<number[]>([]);
  const failuresRef = useRef(0);
  const closedByUsRef = useRef(false);
  const lastIdRef = useRef<number>(0);
  const lastReadSentRef = useRef<number>(0);
  const lastTypingSentRef = useRef<number>(0);
  const typingExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.forEach((t) => clearInterval(t));
    timersRef.current = [];
  };

  /** Add messages we have not already got, keeping the thread in id order. */
  const mergeMessages = useCallback((incoming: OrderMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      merged.sort((a, b) => a.id - b.id);
      lastIdRef.current = merged.length ? merged[merged.length - 1].id : 0;
      return merged;
    });
  }, []);

  /** Tell the server how far we have read, at most once per message id. */
  const markRead = useCallback(
    async (messageId: number) => {
      if (!orderId || messageId <= lastReadSentRef.current) return;
      lastReadSentRef.current = messageId;
      try {
        await chatService.markRead(orderId, messageId);
      } catch {
        // A missed receipt only leaves a badge up; it is retried on the next message.
        lastReadSentRef.current = 0;
      }
    },
    [orderId],
  );

  // --- Initial load --------------------------------------------------------
  useEffect(() => {
    if (!enabled || !orderId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    chatService
      .getThread(orderId, { limit: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        setThread(data);
        setMessages(data.messages);
        setTheirLastRead(data.their_last_read_message_id);
        lastIdRef.current = data.messages.length
          ? data.messages[data.messages.length - 1].id
          : 0;
        lastReadSentRef.current = data.my_last_read_message_id ?? 0;
        if (lastIdRef.current) void markRead(lastIdRef.current);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this chat");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, orderId, markRead]);

  // --- Live connection -----------------------------------------------------
  useEffect(() => {
    if (!enabled || !orderId) return;

    closedByUsRef.current = false;
    failuresRef.current = 0;

    /** Fetch anything that arrived while we were not listening. */
    const catchUp = async () => {
      try {
        const data = await chatService.getThread(orderId, { afterId: lastIdRef.current });
        mergeMessages(data.messages);
        setTheirLastRead(data.their_last_read_message_id);
        if (lastIdRef.current) void markRead(lastIdRef.current);
      } catch {
        // Next poll or reconnect picks it up.
      }
    };

    const startPolling = () => {
      setConnection("polling");
      const timer = setInterval(catchUp, POLL_MS) as unknown as number;
      timersRef.current.push(timer);
    };

    const scheduleReconnect = () => {
      const attempt = failuresRef.current;
      failuresRef.current += 1;
      if (failuresRef.current > FAILURES_BEFORE_POLLING) {
        startPolling();
        return;
      }
      setConnection("reconnecting");
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      const timer = setTimeout(() => void connect(), delay) as unknown as number;
      timersRef.current.push(timer);
    };

    const connect = async () => {
      const token = await getAuthToken();
      if (!token || closedByUsRef.current) return;

      let socket: WebSocket;
      try {
        socket = new WebSocket(chatSocketUrl(orderId));
      } catch {
        scheduleReconnect();
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        // The browser cannot set an Authorization header on a WebSocket, so the
        // token goes in the first frame rather than the query string.
        socket.send(JSON.stringify({ type: "auth", token }));
      };

      socket.onmessage = (event) => {
        let frame: { type?: string; message?: OrderMessage; user_id?: number; last_message_id?: number };
        try {
          frame = JSON.parse(event.data as string);
        } catch {
          return;
        }

        if (frame.type === "ready") {
          failuresRef.current = 0;
          setConnection("live");
          // Anything sent while we were away.
          void catchUp();
          const beat = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping" }));
            }
          }, HEARTBEAT_MS) as unknown as number;
          timersRef.current.push(beat);
          return;
        }

        if (frame.type === "message" && frame.message) {
          mergeMessages([frame.message]);
          void markRead(frame.message.id);
          // Their message has landed, so whatever they were typing is sent.
          setTheyAreTyping(false);
          return;
        }

        if (frame.type === "read" && frame.last_message_id != null) {
          setTheirLastRead(frame.last_message_id);
          return;
        }

        if (frame.type === "typing") {
          setTheyAreTyping(true);
          if (typingExpiryRef.current) clearTimeout(typingExpiryRef.current);
          typingExpiryRef.current = setTimeout(
            () => setTheyAreTyping(false),
            TYPING_EXPIRY_MS,
          );
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
        if (closedByUsRef.current) return;
        scheduleReconnect();
      };

      socket.onerror = () => socket.close();
    };

    void connect();

    return () => {
      closedByUsRef.current = true;
      clearTimers();
      if (typingExpiryRef.current) clearTimeout(typingExpiryRef.current);
      setTheyAreTyping(false);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled, orderId, mergeMessages, markRead]);

  // A suspended app drops the socket silently; catch up when it comes back to
  // the foreground, so nothing sent meanwhile is missing from the screen.
  useEffect(() => {
    if (!enabled || !orderId) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void chatService
        .getThread(orderId, { afterId: lastIdRef.current })
        .then((data) => {
          mergeMessages(data.messages);
          setTheirLastRead(data.their_last_read_message_id);
        })
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, [enabled, orderId, mergeMessages]);


  /**
   * Tell the other side we are typing.
   *
   * Only ever goes over the socket: it is ephemeral, and a signal that arrived
   * five seconds late through the polling fallback would say someone is typing
   * when they have already stopped.
   */
  const notifyTyping = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;

    try {
      socket.send(JSON.stringify({ type: "typing" }));
    } catch {
      // A socket that failed here is about to close and reconnect anyway.
    }
  }, []);

  const loadOlder = useCallback(async () => {
    if (!orderId || messages.length === 0) return;
    const oldest = messages[0].id;
    const page = await chatService.getThread(orderId, { limit: PAGE_SIZE, beforeId: oldest });
    setMessages((prev) => [...page.messages, ...prev]);
    setThread((prev) => (prev ? { ...prev, has_more: page.has_more } : prev));
  }, [orderId, messages]);

  const send = useCallback(
    async (body: string) => {
      if (!orderId) return;
      const trimmed = body.trim();
      if (!trimmed) return;

      setSending(true);
      setError(null);
      try {
        // The POST's response is what puts the message on screen. The socket
        // also echoes it back to this user's other connections, where
        // mergeMessages drops it as a duplicate.
        const message = await chatService.sendMessage(orderId, trimmed);
        mergeMessages([message]);
        lastReadSentRef.current = Math.max(lastReadSentRef.current, message.id);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Message could not be sent");
        throw e;
      } finally {
        setSending(false);
      }
    },
    [orderId, mergeMessages],
  );

  return {
    messages,
    thread,
    loading,
    error,
    sending,
    connection,
    theirLastReadMessageId: theirLastRead,
    theyAreTyping,
    notifyTyping,
    hasMore: thread?.has_more ?? false,
    loadOlder,
    send,
  };
};

/** Unread counts across every thread, for the badges on an orders list. */
export const useChatUnread = (enabled: boolean, refreshMs = 30_000) => {
  const [unread, setUnread] = useState<ChatUnread>({ total: 0, by_order: {} });

  const refresh = useCallback(async () => {
    try {
      setUnread(await chatService.getUnread());
    } catch {
      // Badges are cosmetic; a failed refresh keeps the last known counts.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = setInterval(refresh, refreshMs);
    return () => clearInterval(timer);
  }, [enabled, refresh, refreshMs]);

  return { unread, refresh };
};
