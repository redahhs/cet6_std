/**
 * Haptics Engine
 * Simulates physical feedback using Vibration API + Visual cues
 */
window.Haptics = {
  light: () => {
    if (navigator.vibrate) navigator.vibrate(5);
  },
  medium: () => {
    if (navigator.vibrate) navigator.vibrate(15);
  },
  heavy: () => {
    if (navigator.vibrate) navigator.vibrate([20, 50, 20]);
  },
  success: () => {
    if (navigator.vibrate) navigator.vibrate([10, 30, 10, 30, 10]);
  }
};