// app/page.tsx
"use client";

import Navbar from "@/components/Navbar";
import WelcomeScreen from "@/components/WelcomeScreen";
import ActivePlant from "@/components/ActivePlant";
import WorkloadPanel from "@/components/WorkloadPanel";
import CreateWorkloadModal from "@/components/CreateWorkloadModal";
import EndCycleModal from "@/components/EndCycleModal";

import { calculateWater, getPlantInfo } from "@/lib/waterCalc";
import { useWorkload } from "@/hooks/useWorkload";

export default function HomePage() {
  const {
    isLoaded,
    isSignedIn,
    guestChecked,
    guest,
    workload,
    createOpen,
    setCreateOpen,
    endCycleOpen,
    setEndCycleOpen,
    updateWorkload,
    saveWorkload,
    handleEndChoice,
    handleContinueAsGuest,
  } = useWorkload();

  // Wait for Clerk + the local guest check before deciding what to render,
  // so we never flash the welcome screen at an already-authenticated user.
  if (!isLoaded || !guestChecked) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#fefcf7" }}
      >
        <p style={{ color: "#9b8878" }}>Loading...</p>
      </main>
    );
  }

  if (!isSignedIn && !guest) {
    return <WelcomeScreen onGuest={handleContinueAsGuest} />;
  }

  const water = workload
    ? calculateWater(workload.tasks, workload.cumulativeWater)
    : 0;

  const plant = getPlantInfo(water);

  return (
    <main
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg,#fefcf7 0%,#f4faf2 100%)",
      }}
    >
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">
        <div>
          <h1
            className="text-4xl font-bold"
            style={{
              color: "#2d1b0e",
              fontFamily: "'Lora', Georgia, serif",
            }}
          >
            Plantify 🌿
          </h1>

          <p className="mt-2 text-sm" style={{ color: "#6b5a4a" }}>
            Water your plant by finishing workloads and growing progress.
          </p>
        </div>

        <ActivePlant
          workload={workload}
          onEndCycle={() => setEndCycleOpen(true)}
          onCreateWorkload={() => setCreateOpen(true)}
        />

        {workload && (
          <WorkloadPanel workload={workload} onUpdate={updateWorkload} />
        )}
      </div>

      <CreateWorkloadModal
        open={createOpen}
        existingWorkload={workload}
        onClose={() => setCreateOpen(false)}
        onSave={saveWorkload}
      />

      <EndCycleModal
        open={endCycleOpen}
        workload={workload}
        onClose={() => setEndCycleOpen(false)}
        onChoose={handleEndChoice}
      />
    </main>
  );
}