import { PageEnter } from "@/components/layout/PageEnter"

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PageEnter className="flex min-h-0 min-w-0 flex-1 flex-col">
      {children}
    </PageEnter>
  )
}
