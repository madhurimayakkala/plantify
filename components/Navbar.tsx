"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, Sprout } from "lucide-react";
import { motion } from "framer-motion";

import {
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";

import { isGuestMode } from "@/lib/guestStorage";

export default function Navbar() {
  const pathname = usePathname();
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    setGuest(isGuestMode());
  }, [pathname]);

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/garden", label: "Garden" },
  ];

  return (
    <nav
      style={{
        background: "#fefcf7",
        borderBottom: "1px solid #e8e0d5",
      }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.4 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #7cb87a, #3d6b35)",
            }}
          >
            <Leaf size={18} color="#fefcf7" strokeWidth={2.5} />
          </motion.div>

          <span
            className="font-bold text-lg tracking-tight"
            style={{
              color: "#2d1b0e",
              fontFamily: "'Lora', Georgia, serif",
            }}
          >
            Plantify
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {links.map((link) => {
              const active = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: active ? "#3d6b35" : "#6b5a4a",
                    background: active ? "#eaf5e9" : "transparent",
                  }}
                >
                  {link.label}

                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: "#eaf5e9",
                        zIndex: -1,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 35,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Clerk Auth */}
          <div className="flex items-center gap-2">
            <Show when="signed-in">
              <UserButton />
            </Show>

            <Show when="signed-out">
              <div className="flex items-center gap-2">
                {guest && (
                  <span
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                      background: "#fff8e7",
                      color: "#9b7b2e",
                      border: "1px solid #f0dfa8",
                    }}
                  >
                    <Sprout size={13} />
                    Guest Mode
                  </span>
                )}

                <SignInButton mode="modal">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{
                      background: "#f3f0ea",
                      color: "#6b5a4a",
                    }}
                  >
                    Sign In
                  </button>
                </SignInButton>

                <SignUpButton mode="modal">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{
                      background: "#3d6b35",
                      color: "#ffffff",
                    }}
                  >
                    {guest ? "Save Progress" : "Sign Up"}
                  </button>
                </SignUpButton>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </nav>
  );
}