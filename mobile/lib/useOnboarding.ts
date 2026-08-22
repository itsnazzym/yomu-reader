import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { updateDownloadSettings } from "./downloadSettingsStore";

const ONBOARDING_KEY = "@nhentai_onboarding_done_v1";
const LAST_ONBOARDING_STEP = 4;

let isCompletedGlobal = true; // Par défaut à true pour éviter un flash visuel avant la lecture du stockage
let isInitialized = false;
let currentStepGlobal = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export async function initOnboarding(): Promise<void> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    isCompletedGlobal = value === "true";
  } catch {
    isCompletedGlobal = true;
  } finally {
    isInitialized = true;
    notify();
  }
}

export async function completeOnboarding(): Promise<void> {
  isCompletedGlobal = true;
  currentStepGlobal = 0;
  notify();
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    await updateDownloadSettings({ folderPrompted: true });
  } catch {}
}

export async function resetOnboarding(): Promise<void> {
  isCompletedGlobal = false;
  currentStepGlobal = 0;
  notify();
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch {}
}

export function setOnboardingStep(step: number): void {
  currentStepGlobal = Math.max(0, Math.min(LAST_ONBOARDING_STEP, step));
  notify();
}

export function useOnboarding() {
  const [completed, setCompleted] = useState<boolean>(isCompletedGlobal);
  const [initialized, setInitialized] = useState<boolean>(isInitialized);
  const [step, setStep] = useState<number>(currentStepGlobal);

  useEffect(() => {
    const update = () => {
      setCompleted(isCompletedGlobal);
      setInitialized(isInitialized);
      setStep(currentStepGlobal);
    };
    listeners.add(update);
    if (!isInitialized) {
      initOnboarding();
    }
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    isReady: initialized,
    isOpen: initialized && !completed,
    currentStep: step,
    totalSteps: LAST_ONBOARDING_STEP + 1,
    nextStep: () => {
      if (step < LAST_ONBOARDING_STEP) setOnboardingStep(step + 1);
      else completeOnboarding();
    },
    prevStep: () => {
      if (step > 0) setOnboardingStep(step - 1);
    },
    setStep: setOnboardingStep,
    complete: completeOnboarding,
    reset: resetOnboarding,
  };
}
