import React, { useCallback, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  ViewStyle,
} from "react-native";
import { colors, radius } from "@/constants/theme";

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 4;

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Fires continuously while the thumb is dragged. */
  onValueChange: (value: number) => void;
  /** Fires once the thumb is released — commit expensive work here. */
  onValueCommit?: (value: number) => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * A single-thumb slider built on `PanResponder`.
 *
 * React Native ships no slider, and the community package is a native module
 * that would force a rebuild for one filter control — so this draws its own.
 * The API mirrors the web app's Radix slider (`onValueChange` while dragging,
 * `onValueCommit` on release) so the two filter panels stay easy to compare.
 */
export const Slider = ({
  value,
  min,
  max,
  step,
  onValueChange,
  onValueCommit,
  accessibilityLabel,
  style,
}: SliderProps) => {
  const [trackWidth, setTrackWidth] = useState(0);

  // PanResponder is built once, so everything it reads lives in refs: the
  // measured width, the x the drag started from, and the newest value (which
  // is what gets committed on release).
  const widthRef = useRef(0);
  const startXRef = useRef(0);
  const latestRef = useRef(value);
  latestRef.current = value;

  const emit = useCallback(
    (x: number) => {
      const width = widthRef.current;
      if (width <= 0) return;
      const ratio = Math.min(1, Math.max(0, x / width));
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / step) * step;
      const next = Math.min(max, Math.max(min, stepped));
      latestRef.current = next;
      onValueChange(next);
    },
    [min, max, step, onValueChange]
  );

  // Kept in a ref so the handlers below always call the current closure.
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const commitRef = useRef(onValueCommit);
  commitRef.current = onValueCommit;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        // Tapping the track jumps the thumb there; the drag continues from it.
        startXRef.current = event.nativeEvent.locationX;
        emitRef.current(startXRef.current);
      },
      onPanResponderMove: (_event, gesture) => {
        // Offsetting from the grant point avoids needing the view's page x.
        emitRef.current(startXRef.current + gesture.dx);
      },
      onPanResponderRelease: () => commitRef.current?.(latestRef.current),
      onPanResponderTerminate: () => commitRef.current?.(latestRef.current),
    })
  ).current;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    widthRef.current = width;
    setTrackWidth(width);
  };

  const ratio =
    max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;

  return (
    <View
      style={[styles.container, style]}
      onLayout={handleLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      {...responder.panHandlers}
    >
      <View style={styles.track}>
        <View style={[styles.range, { width: Math.max(0, ratio * trackWidth) }]} />
      </View>
      <View style={[styles.thumb, { left: ratio * trackWidth - THUMB_SIZE / 2 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { height: THUMB_SIZE + 8, justifyContent: "center" },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  range: {
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
});
