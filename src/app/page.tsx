import Link from "next/link";
import { APP_NAME } from "@/config/constants";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm">
            L
          </div>
          <span className="font-semibold text-lg">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/track" className="text-sm text-gray-400 hover:text-white transition-colors">
            Track Shipment
          </Link>
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 rounded-lg font-medium"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-blue-400 text-sm mb-8">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          Enterprise Logistics Platform
        </div>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          Ship smarter.
          <br />
          <span className="text-blue-400">Deliver faster.</span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          End-to-end logistics management — real-time tracking, fleet dispatch, automated
          notifications, and analytics in one platform.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="bg-blue-600 hover:bg-blue-500 transition-colors px-8 py-3.5 rounded-xl font-semibold text-lg w-full sm:w-auto"
          >
            Start for free
          </Link>
          <Link
            href="/track"
            className="border border-gray-700 hover:border-gray-500 transition-colors px-8 py-3.5 rounded-xl font-semibold text-lg w-full sm:w-auto text-gray-300"
          >
            Track a shipment
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-800 px-6 py-12">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: "Shipments tracked", value: "2M+" },
            { label: "On-time delivery", value: "98.4%" },
            { label: "Active customers", value: "12K+" },
            { label: "Countries served", value: "45+" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16">Everything your logistics needs</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-xl mb-4">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Track CTA */}
      <section className="px-6 pb-24">
        <div className="max-w-2xl mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-2">Track your shipment</h3>
          <p className="text-gray-400 mb-6">Enter your tracking number to get real-time updates</p>
          <form action="/track" method="get" className="flex gap-3 max-w-md mx-auto">
            <input
              type="text"
              name="q"
              placeholder="LGT-XXXX-XXXX-XXXX"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 transition-colors px-6 py-3 rounded-xl font-medium text-sm"
            >
              Track
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} {APP_NAME}. Built for enterprise logistics.
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    icon: "📦",
    title: "Real-Time Tracking",
    description:
      "Live shipment status with WebSocket updates. Your customers always know where their package is.",
  },
  {
    icon: "🚚",
    title: "Fleet Management",
    description:
      "Assign drivers, manage vehicles, and dispatch with full visibility into your fleet operations.",
  },
  {
    icon: "🔔",
    title: "Smart Notifications",
    description:
      "Automated email and webhook notifications at every status change, powered by async queues.",
  },
  {
    icon: "📊",
    title: "Analytics Dashboard",
    description:
      "Track delivery rates, average times, failure reasons, and shipment volume trends.",
  },
  {
    icon: "🔐",
    title: "Role-Based Access",
    description:
      "Granular RBAC for Admin, Staff, and Customer roles. Every route and action is protected.",
  },
  {
    icon: "⚡",
    title: "API-First",
    description:
      "Integrate with your existing systems via a RESTful API. Webhook-ready for third-party tools.",
  },
];
