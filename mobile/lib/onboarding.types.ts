export type OnboardingStepId = "welcome" | "theme" | "reader" | "account";

export interface OnboardingStepConfig {
  id: OnboardingStepId;
  title: string;
  stepIndex: number;
}
