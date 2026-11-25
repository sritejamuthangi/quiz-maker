// A small test used by several test files.
export const sampleQuestions = () => [
  {
    id: 'q1',
    type: 'single',
    text: 'What is 2 + 2?',
    options: [
      { id: 'a', text: '3' },
      { id: 'b', text: '4' },
      { id: 'c', text: '5' },
    ],
    correct: 'b',
    explanation: '2 + 2 = 4',
    points: 1,
  },
  {
    id: 'q2',
    type: 'multiple',
    text: 'Which are prime?',
    options: [
      { id: 'a', text: '2' },
      { id: 'b', text: '4' },
      { id: 'c', text: '7' },
    ],
    correct: ['a', 'c'],
    explanation: 'Primes have exactly two divisors.',
    points: 2,
  },
  { id: 'q3', type: 'truefalse', text: 'The Earth orbits the Sun.', correct: true, explanation: '', points: 1 },
  {
    id: 'q4',
    type: 'blank',
    text: 'The capital of France is [Paris] and of Spain is [Madrid].',
    caseSensitive: false,
    explanation: 'Geography basics.',
    points: 1,
  },
];

export const sampleSettings = (overrides = {}) => ({
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
  ...overrides,
});

export const sampleTest = (settings = {}) => ({
  title: 'Sample test',
  description: '',
  questions: sampleQuestions(),
  settings: sampleSettings(settings),
});
