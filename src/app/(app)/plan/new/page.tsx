import { RoutineBuilder } from "@/components/workouts/routine-builder";

export const metadata = { title: "Nueva rutina" };

export default function NewRoutinePage() {
  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Crear rutina</h1>
      <RoutineBuilder />
    </div>
  );
}
