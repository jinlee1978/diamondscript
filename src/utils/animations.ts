/**
 * BUILD 106: Animation Utilities
 *
 * Centralized animation configs for consistent feel across the app.
 * Uses LayoutAnimation for smooth list/state transitions.
 */

import { LayoutAnimation, Platform, UIManager } from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Smooth spring animation for list changes */
export function animateListChange() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

/** Quick fade for toggling visibility */
export function animateFade() {
  LayoutAnimation.configureNext({
    duration: 200,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}

/** Expand/collapse animation (e.g., filter panels, notes) */
export function animateExpand() {
  LayoutAnimation.configureNext({
    duration: 250,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}

/** Spring animation for bouncy interactions */
export function animateSpring() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
}
