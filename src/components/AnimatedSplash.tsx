import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "@/constants/theme";

interface Props {
  onComplete: () => void;
}

export function AnimatedSplash({ onComplete }: Props) {
  const logoScale   = useRef(new Animated.Value(0.55)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(22)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity  = useRef(new Animated.Value(0)).current;
  const dot1        = useRef(new Animated.Value(0.25)).current;
  const dot2        = useRef(new Animated.Value(0.25)).current;
  const dot3        = useRef(new Animated.Value(0.25)).current;
  const screen      = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      // Logo springs in
      Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      // Brand name slides up
      Animated.sequence([
        Animated.delay(260),
        Animated.parallel([
          Animated.timing(textY, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      ]),
      // Tagline fades in
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(tagOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Pulse dots
      const pulseDot = (dot: Animated.Value, delay: number) => {
        Animated.sequence([
          Animated.delay(delay),
          Animated.loop(
            Animated.sequence([
              Animated.timing(dot, { toValue: 1,    duration: 380, useNativeDriver: true }),
              Animated.timing(dot, { toValue: 0.25, duration: 380, useNativeDriver: true }),
            ])
          ),
        ]).start();
      };
      pulseDot(dot1, 0);
      pulseDot(dot2, 130);
      pulseDot(dot3, 260);

      // Hold, then fade out
      setTimeout(() => {
        Animated.timing(screen, { toValue: 0, duration: 420, useNativeDriver: true }).start(
          () => onComplete()
        );
      }, 1500);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: screen }]}>
      <LinearGradient
        colors={["#2D8B7F", "#1A5C54"]}
        style={styles.gradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.6, y: 1 }}
      >
        {/* Decorative circles */}
        <View style={styles.circleTopRight} />
        <View style={styles.circleBottomLeft} />

        {/* Center: logo + name + tagline */}
        <View style={styles.center}>
          <Animated.View
            style={{ transform: [{ scale: logoScale }], opacity: logoOpacity }}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.24)", "rgba(255,255,255,0.08)"]}
              style={styles.logoBox}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="chef-hat" size={58} color="#fff" />
            </LinearGradient>
          </Animated.View>

          <Animated.View
            style={{ opacity: textOpacity, transform: [{ translateY: textY }], marginTop: 26 }}
          >
            <Text style={styles.brandName}>MealHost</Text>
          </Animated.View>

          <Animated.View style={{ opacity: tagOpacity, marginTop: 8 }}>
            <Text style={styles.tagline}>Home-cooked meals, delivered.</Text>
          </Animated.View>
        </View>

        {/* Pulsing dots */}
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { opacity: dot1 }]} />
          <Animated.View style={[styles.dot, { opacity: dot2 }]} />
          <Animated.View style={[styles.dot, { opacity: dot3 }]} />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 9999 },
  gradient: { flex: 1, alignItems: "center", justifyContent: "center" },

  circleTopRight: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  circleBottomLeft: {
    position: "absolute",
    bottom: -110,
    left: -90,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  center: { alignItems: "center" },

  logoBox: {
    width: 112,
    height: 112,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.30,
    shadowRadius: 18,
    elevation: 14,
  },

  brandName: {
    fontSize: 42,
    fontFamily: fonts.display,
    color: "#fff",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  tagline: {
    fontSize: 15,
    fontFamily: fonts.sans,
    color: "rgba(255,255,255,0.78)",
    letterSpacing: 0.25,
    textAlign: "center",
  },

  dotsRow: {
    position: "absolute",
    bottom: 62,
    flexDirection: "row",
    gap: 9,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.90)",
  },
});
