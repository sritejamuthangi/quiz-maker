// Starting points for new tests. A template only sets default settings; everything can be changed.

export const DEFAULT_SETTINGS = Object.freeze({
  timeLimitMinutes: null,
  requireName: true,
  extraFieldLabel: '',
  shuffleQuestions: false,
  shuffleOptions: false,
  questionsPerAttempt: null,
  resultsVisibility: 'full',
  passPercent: null,
  allowRetakes: false,
  closesAt: null,
});

export const TEMPLATES = Object.freeze([
  {
    id: 'practice',
    label: 'Practice quiz',
    description: 'No timer. People see the correct answers and explanations, and can retake it.',
    settings: { ...DEFAULT_SETTINGS, allowRetakes: true },
  },
  {
    id: 'exam',
    label: 'Timed exam',
    description:
      '30-minute timer, shuffled questions and options, one attempt per device. People see their score and which answers were right, but not the correct answers.',
    settings: {
      ...DEFAULT_SETTINGS,
      timeLimitMinutes: 30,
      shuffleQuestions: true,
      shuffleOptions: true,
      resultsVisibility: 'marks',
      passPercent: 40,
      extraFieldLabel: 'Roll number',
    },
  },
  {
    id: 'blank',
    label: 'Blank',
    description: 'Start from scratch with the default settings.',
    settings: { ...DEFAULT_SETTINGS },
  },
]);

export function templateSettings(templateId) {
  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[2];
  return { ...template.settings };
}
