import type { Goal, WorkoutBlock, WorkoutType } from "@/types/database";

export interface BaseRoutine {
  title: string;
  workout_type: WorkoutType;
  goal: Goal;
  duration_min: number;
  difficulty: string;
  plan: WorkoutBlock[];
}

const ex = (
  name: string,
  sets: number,
  reps: string,
  rest_sec = 60,
) => ({ name, sets, reps, rest_sec });

/** Semana base recomendada (rutinas listas, sin IA) para el plan General. */
export const BASE_WEEK: BaseRoutine[] = [
  {
    title: "Día 1 · Pecho y tríceps",
    workout_type: "gym",
    goal: "gain_muscle",
    duration_min: 50,
    difficulty: "intermedio",
    plan: [
      {
        block: "Principal",
        exercises: [
          ex("Press de banca con barra", 4, "8-10", 90),
          ex("Press inclinado con mancuernas", 3, "10-12"),
          ex("Aperturas con mancuerna", 3, "12"),
          ex("Fondos en paralelas", 3, "10"),
          ex("Extensión de tríceps en polea", 3, "12-15"),
          ex("Press francés", 3, "10-12"),
        ],
      },
    ],
  },
  {
    title: "Día 2 · Espalda y bíceps",
    workout_type: "gym",
    goal: "gain_muscle",
    duration_min: 50,
    difficulty: "intermedio",
    plan: [
      {
        block: "Principal",
        exercises: [
          ex("Dominadas", 4, "máximas", 90),
          ex("Remo con barra", 4, "8-10", 90),
          ex("Jalón al pecho", 3, "10-12"),
          ex("Remo con mancuerna", 3, "10"),
          ex("Curl de bíceps con barra", 3, "10-12"),
          ex("Curl martillo", 3, "12"),
        ],
      },
    ],
  },
  {
    title: "Día 3 · Pierna completa",
    workout_type: "gym",
    goal: "gain_muscle",
    duration_min: 55,
    difficulty: "intermedio",
    plan: [
      {
        block: "Principal",
        exercises: [
          ex("Sentadilla con barra", 4, "8-10", 120),
          ex("Prensa de pierna", 4, "10-12", 90),
          ex("Peso muerto rumano", 3, "10"),
          ex("Zancadas con mancuernas", 3, "12 por pierna"),
          ex("Extensión de cuádriceps", 3, "12-15"),
          ex("Elevación de gemelos", 4, "15-20", 45),
        ],
      },
    ],
  },
  {
    title: "Día 4 · Hombro y abdomen",
    workout_type: "gym",
    goal: "gain_muscle",
    duration_min: 45,
    difficulty: "intermedio",
    plan: [
      {
        block: "Principal",
        exercises: [
          ex("Press militar", 4, "8-10", 90),
          ex("Elevaciones laterales", 4, "12-15", 45),
          ex("Pájaros (deltoide posterior)", 3, "12-15"),
          ex("Encogimientos para trapecio", 3, "12"),
          ex("Plancha", 3, "45 seg", 30),
          ex("Crunch abdominal", 3, "20", 30),
        ],
      },
    ],
  },
  {
    title: "Día 5 · Full body en casa",
    workout_type: "home",
    goal: "maintain",
    duration_min: 35,
    difficulty: "principiante",
    plan: [
      {
        block: "Principal",
        exercises: [
          ex("Sentadilla con peso corporal", 4, "15", 45),
          ex("Flexiones de pecho", 4, "12", 45),
          ex("Zancadas", 3, "12 por pierna", 45),
          ex("Puente de glúteo", 3, "15", 30),
          ex("Plancha", 3, "40 seg", 30),
          ex("Burpees", 3, "10", 60),
        ],
      },
    ],
  },
  {
    title: "Día 6 · Cardio y core",
    workout_type: "cardio",
    goal: "lose_fat",
    duration_min: 30,
    difficulty: "principiante",
    plan: [
      {
        block: "Principal",
        exercises: [
          ex("Trote / caminata rápida", 1, "20 min", 0),
          ex("Mountain climbers", 4, "30 seg", 30),
          ex("Bicicleta abdominal", 3, "20", 30),
          ex("Russian twist", 3, "20", 30),
          ex("Elevación de piernas", 3, "15", 30),
        ],
      },
    ],
  },
];
