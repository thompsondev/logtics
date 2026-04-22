"use client";

import { useState } from "react";
import { ShippingMethod } from "@/types";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

interface AddressFields {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

const EMPTY_ADDRESS: AddressFields = { street: "", city: "", state: "", country: "", postalCode: "" };

export function CreateShipmentModal({ onClose, onSuccess }: Props) {
  // Receiver
  const [receiverName, setReceiverName] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");

  // Addresses
  const [origin, setOrigin] = useState<AddressFields>(EMPTY_ADDRESS);
  const [destination, setDestination] = useState<AddressFields>(EMPTY_ADDRESS);

  // Package
  const [weightKg, setWeightKg] = useState("");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(ShippingMethod.STANDARD);
  const [currency, setCurrency] = useState("USD");
  const [isFragile, setIsFragile] = useState(false);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchOrigin(field: keyof AddressFields, value: string) {
    setOrigin((prev) => ({ ...prev, [field]: value }));
  }
  function patchDest(field: keyof AddressFields, value: string) {
    setDestination((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const body = {
        receiver: {
          name: receiverName.trim(),
          email: receiverEmail.trim(),
          phone: receiverPhone.trim(),
        },
        origin: {
          street: origin.street.trim(),
          city: origin.city.trim(),
          state: origin.state.trim() || undefined,
          country: origin.country.trim(),
          postalCode: origin.postalCode.trim(),
        },
        destination: {
          street: destination.street.trim(),
          city: destination.city.trim(),
          state: destination.state.trim() || undefined,
          country: destination.country.trim(),
          postalCode: destination.postalCode.trim(),
        },
        weightKg: Number(weightKg),
        shippingMethod,
        currency: currency.trim().toUpperCase(),
        isFragile,
        requiresSignature,
        ...(notes.trim() && { notes: notes.trim() }),
      };

      const res = await fetch("/api/shipments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to create shipment");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">Create Shipment</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Receiver */}
          <Section title="Receiver">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full Name" required>
                <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="John Doe" required
                  className={inputCls} />
              </Field>
              <Field label="Email" required>
                <input type="email" value={receiverEmail} onChange={(e) => setReceiverEmail(e.target.value)}
                  placeholder="john@example.com" required
                  className={inputCls} />
              </Field>
              <Field label="Phone" required>
                <input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)}
                  placeholder="+1 234 567 8900" required
                  className={inputCls} />
              </Field>
            </div>
          </Section>

          {/* Origin */}
          <Section title="Origin Address">
            <AddressForm values={origin} onChange={patchOrigin} />
          </Section>

          {/* Destination */}
          <Section title="Destination Address">
            <AddressForm values={destination} onChange={patchDest} />
          </Section>

          {/* Package */}
          <Section title="Package Details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Weight (kg)" required>
                <input type="number" min="0.01" step="0.01" value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)} placeholder="1.5" required
                  className={inputCls} />
              </Field>
              <Field label="Shipping Method" required>
                <select value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                  className={selectCls}>
                  {Object.values(ShippingMethod).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Currency">
                <input value={currency} onChange={(e) => setCurrency(e.target.value)}
                  placeholder="USD" maxLength={3}
                  className={inputCls} />
              </Field>
            </div>

            {/* Checkboxes */}
            <div className="flex items-center gap-6 mt-1">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                <input type="checkbox" checked={isFragile} onChange={(e) => setIsFragile(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500" />
                Fragile
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                <input type="checkbox" checked={requiresSignature} onChange={(e) => setRequiresSignature(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500" />
                Requires Signature
              </label>
            </div>

            {/* Notes */}
            <Field label="Notes">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions…" rows={2}
                className={`${inputCls} resize-none`} />
            </Field>
          </Section>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pb-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-white transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Creating…" : "Create Shipment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── helpers ── */

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors placeholder-gray-600";

const selectCls =
  "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function AddressForm({
  values,
  onChange,
}: {
  values: AddressFields;
  onChange: (field: keyof AddressFields, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Street" required>
        <input value={values.street} onChange={(e) => onChange("street", e.target.value)}
          placeholder="123 Main St" required className={inputCls} />
      </Field>
      <Field label="City" required>
        <input value={values.city} onChange={(e) => onChange("city", e.target.value)}
          placeholder="Lagos" required className={inputCls} />
      </Field>
      <Field label="State / Province">
        <input value={values.state} onChange={(e) => onChange("state", e.target.value)}
          placeholder="Lagos State" className={inputCls} />
      </Field>
      <Field label="Country" required>
        <input value={values.country} onChange={(e) => onChange("country", e.target.value)}
          placeholder="Nigeria" required className={inputCls} />
      </Field>
      <Field label="Postal Code" required>
        <input value={values.postalCode} onChange={(e) => onChange("postalCode", e.target.value)}
          placeholder="100001" required className={inputCls} />
      </Field>
    </div>
  );
}
