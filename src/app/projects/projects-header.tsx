"use client";

import { useState } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { UniverseInitializerModal } from "@/components/layout/UniverseInitializerModal";

export function ProjectsHeader() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <LogoutButton className="px-3 py-2 text-sm" />
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9]"
        >
          New universe
        </button>
      </div>
      <UniverseInitializerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
