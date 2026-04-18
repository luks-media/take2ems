"use client"

import { cn } from "@/lib/utils"

export function PageEnter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
        className
      )}
    >
      {children}
    </div>
  )
}
