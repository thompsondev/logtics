"use client";

import { useState } from "react";
import { Header } from "@/components/dashboard/header";
import { ShipmentTable } from "@/components/admin/shipment-table";
import { CreateShipmentModal } from "@/components/admin/create-shipment-modal";

export default function AdminShipmentsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleCreated() {
    setShowCreate(false);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-2">
      <Header
        title="Shipments"
        subtitle="Manage and track all shipments"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <span className="text-base leading-none">+</span>
            New Shipment
          </button>
        }
      />

      {/* Pass refreshKey as a key prop so table re-mounts (and re-fetches) after creation */}
      <ShipmentTable key={refreshKey} />

      {showCreate && (
        <CreateShipmentModal
          onClose={() => setShowCreate(false)}
          onSuccess={handleCreated}
        />
      )}
    </div>
  );
}
