import { ShipmentStatus } from "@/types";

const CONFIG: Record<ShipmentStatus, { label: string; classes: string }> = {
  [ShipmentStatus.CREATED]:          { label: "Created",          classes: "bg-gray-500/15 text-gray-300 border-gray-600/30" },
  [ShipmentStatus.PICKED_UP]:        { label: "Picked Up",        classes: "bg-violet-500/15 text-violet-300 border-violet-600/30" },
  [ShipmentStatus.IN_TRANSIT]:       { label: "In Transit",       classes: "bg-amber-500/15 text-amber-300 border-amber-600/30" },
  [ShipmentStatus.ARRIVED_AT_HUB]:   { label: "At Hub",           classes: "bg-cyan-500/15 text-cyan-300 border-cyan-600/30" },
  [ShipmentStatus.OUT_FOR_DELIVERY]: { label: "Out for Delivery", classes: "bg-blue-500/15 text-blue-300 border-blue-600/30" },
  [ShipmentStatus.DELIVERED]:        { label: "Delivered",        classes: "bg-green-500/15 text-green-300 border-green-600/30" },
  [ShipmentStatus.FAILED_DELIVERY]:  { label: "Failed",           classes: "bg-red-500/15 text-red-300 border-red-600/30" },
  [ShipmentStatus.RETURNED]:         { label: "Returned",         classes: "bg-orange-500/15 text-orange-300 border-orange-600/30" },
};

interface StatusBadgeProps {
  status: ShipmentStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const { label, classes } = CONFIG[status] ?? {
    label: status,
    classes: "bg-gray-500/15 text-gray-300 border-gray-600/30",
  };
  const sizeClasses = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeClasses} ${classes}`}>
      {label}
    </span>
  );
}
