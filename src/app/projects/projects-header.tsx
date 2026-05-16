"use client";

import { useState } from "react";

import { UniverseInitializerModal } from "@/components/layout/UniverseInitializerModal";

export function ProjectsHeader() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9]"
      >
        New universe
      </button>
      <UniverseInitializerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
