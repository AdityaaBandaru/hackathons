import type { Metadata } from "next";
import "./studio.css";

export const metadata: Metadata = {
  title: "3D Design Studio | WC26 Mobility Optimizer",
  description: "Explore and compare temporary and permanent mobility concepts across 11 World Cup host regions.",
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
