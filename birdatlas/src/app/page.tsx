'use client';

import React, { useState } from "react";
import dynamic from "next/dynamic";
import BirdPanel from "@/components/BirdPanel";

const UsMap = dynamic(() => import("@/components/UsMap"), { ssr: false });

export default function Home() {
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        <section className="flex-1">
          <div className="font-semibold mb-2">Bird Atlas (Native Birds by US State)</div>
          <UsMap selectedStateCode={selectedStateCode} onStateSelected={setSelectedStateCode} />
        </section>

        <section className="lg:pt-0">
          <BirdPanel selectedStateCode={selectedStateCode} />
        </section>
      </div>
    </main>
  );
}
