import type { Exercise } from './types'

// EyeExerciseManager + MovementExerciseManager data and routine builders.

export const EYE_EXERCISES: Exercise[] = [
  {
    id: 'distance',
    name: 'Look into the distance',
    durationSec: 20,
    steps: ['Look away from your screen.', 'Find an object about 20 feet (6 m) away.', 'Soften your gaze and keep focusing on it.'],
    animation: 'eye-distance',
  },
  {
    id: 'blink',
    name: 'Slowly blink 10 times',
    durationSec: 15,
    steps: ['Close your eyes slowly.', 'Squeeze gently for a moment, then open.', 'Repeat 10 times at a relaxed pace.'],
    animation: 'eye-blink',
  },
  {
    id: 'close',
    name: 'Close your eyes',
    durationSec: 10,
    steps: ['Close your eyes gently.', 'Relax your forehead and jaw.', 'Breathe slowly until the timer ends.'],
    animation: 'eye-close',
  },
  {
    id: 'left-right',
    name: 'Look left and right',
    durationSec: 15,
    steps: ['Keep your head still.', 'Move your eyes slowly to the far left, then the far right.', 'Repeat smoothly without straining.'],
    animation: 'eye-left-right',
  },
  {
    id: 'up-down',
    name: 'Look up and down',
    durationSec: 15,
    steps: ['Keep your head still.', 'Look slowly up toward the ceiling, then down to the floor.', 'Repeat smoothly.'],
    animation: 'eye-up-down',
  },
  {
    id: 'near-far',
    name: 'Near and far focus',
    durationSec: 20,
    steps: ['Hold a finger about 10 inches from your face and focus on it.', 'Shift your focus to something far away.', 'Alternate every few seconds.'],
    animation: 'eye-near-far',
  },
]

export const MOVEMENT_EXERCISES: Exercise[] = [
  { id: 'neck', name: 'Neck Rotation', durationSec: 15, steps: ['Sit or stand tall.', 'Slowly roll your head in a gentle circle.', 'Switch direction halfway.'], gentle: 'Tilt your head side to side instead of full circles.', animation: 'neck' },
  { id: 'shoulders', name: 'Shoulder Rolls', durationSec: 20, steps: ['Let your arms hang loose.', 'Roll your shoulders forward 5 times.', 'Then roll them backward 5 times.'], gentle: 'Shrug your shoulders up and let them drop.', animation: 'shoulders' },
  { id: 'standing-stretch', name: 'Standing Stretch', durationSec: 20, steps: ['Stand up with feet hip-width apart.', 'Raise both arms overhead.', 'Reach up and hold the stretch.'], gentle: 'Stay seated and reach your arms up.', animation: 'reach' },
  { id: 'wrist', name: 'Wrist Stretch', durationSec: 20, steps: ['Extend one arm, palm up.', 'Gently pull your fingers back with the other hand.', 'Switch hands halfway.'], gentle: 'Make slow wrist circles.', animation: 'wrist' },
  { id: 'back', name: 'Back Stretch', durationSec: 20, steps: ['Stand with hands on your lower back.', 'Gently lean back and open your chest.', 'Return slowly and repeat.'], gentle: 'Seated: twist gently to each side.', animation: 'back' },
  { id: 'walk', name: 'Walking Break', durationSec: 120, steps: ['Stand up and leave your desk.', 'Walk around your room or office.', 'Keep a relaxed, easy pace.'], gentle: 'March gently in place.', animation: 'walk' },
  { id: 'stand', name: 'Standing Break', durationSec: 60, steps: ['Stand up from your chair.', 'Shake out your arms and legs.', 'Let your posture relax.'], gentle: 'Shift your weight and sit tall.', animation: 'stand' },
  { id: 'calf', name: 'Calf Raises', durationSec: 20, steps: ['Stand behind your chair for support.', 'Rise slowly onto your toes.', 'Lower back down and repeat.'], gentle: 'Seated: lift your heels while keeping toes down.', animation: 'calf' },
  { id: 'breathing', name: 'Deep Breathing', durationSec: 30, steps: ['Breathe in slowly through your nose for 4 seconds.', 'Hold for a moment.', 'Exhale slowly for 6 seconds.'], animation: 'breathe' },
  { id: 'full-body', name: 'Full Body Stretch', durationSec: 45, steps: ['Reach your arms up and out.', 'Stretch one leg back, then the other.', 'Finish with a gentle forward fold.'], gentle: 'Seated: stretch arms up and extend legs.', animation: 'full-body' },
]

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(
  [...EYE_EXERCISES, ...MOVEMENT_EXERCISES].map((e) => [e.id, e]),
)

export const DEFAULT_EYE_SELECTION = ['distance']
export const DEFAULT_MOVEMENT_SELECTION = ['neck', 'shoulders', 'standing-stretch', 'wrist', 'back', 'calf', 'breathing', 'full-body']

/**
 * Pick movement exercises to roughly fill the target duration. `rotation`
 * shifts the starting exercise each break so routines vary.
 */
export function buildMovementRoutine(selected: string[], targetSec: number, rotation: number): Exercise[] {
  const pool = selected.map((id) => EXERCISE_BY_ID[id]).filter((e): e is Exercise => !!e && MOVEMENT_EXERCISES.includes(e))
  if (pool.length === 0) return [EXERCISE_BY_ID['stand']]
  const routine: Exercise[] = []
  let total = 0
  for (let i = 0; i < pool.length && total < targetSec; i++) {
    const ex = pool[(rotation + i) % pool.length]
    routine.push(ex)
    total += ex.durationSec
  }
  return routine
}

export function buildEyeRoutine(selected: string[], distanceSec: number): Exercise[] {
  const list = selected.map((id) => EXERCISE_BY_ID[id]).filter((e): e is Exercise => !!e && EYE_EXERCISES.includes(e))
  const routine = list.length ? list : [EXERCISE_BY_ID['distance']]
  return routine.map((e) => (e.id === 'distance' ? { ...e, durationSec: distanceSec } : e))
}
