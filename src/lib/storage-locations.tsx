import { Refrigerator, Snowflake, Store, Archive, Apple, Package, type LucideIcon } from "lucide-react";

/**
 * Storage locations for inventory items. Single source of truth for the value,
 * its human label, and its icon — shared by InventoryManager, the item form,
 * and the receipt scanner so the three never drift apart.
 */
export interface StorageLocation {
  value: string;
  label: string;
  icon: LucideIcon;
}

export const STORAGE_LOCATIONS: StorageLocation[] = [
  { value: "fridge", label: "Fridge", icon: Refrigerator },
  { value: "freezer", label: "Freezer", icon: Snowflake },
  { value: "pantry", label: "Pantry", icon: Store },
  { value: "cabinet", label: "Cabinet", icon: Archive },
  { value: "counter", label: "Counter", icon: Apple },
  { value: "other", label: "Other", icon: Package },
];

export const storageLocation = (value: string): StorageLocation | undefined =>
  STORAGE_LOCATIONS.find((l) => l.value === value);

/** Location icon (16px, neutral-mid) centered against its label text. */
export const StorageLocationLabel = ({ value }: { value: string }) => {
  const loc = storageLocation(value);
  const Icon = loc?.icon;
  return (
    <span className="inline-flex items-center gap-1.5">
      {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--neutral-mid)" }} />}
      {loc?.label || value}
    </span>
  );
};
