import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { CarDrilldownDialog } from "@/components/CarDrilldownDialog"
import { Leaderboard } from "@/components/Leaderboard"
import { MessagesPanel } from "@/components/MessagesPanel"
import { Podium } from "@/components/Podium"
import { StatisticsPanel } from "@/components/StatisticsPanel"
import { SessionHeader } from "@/components/SessionHeader"
import { TopQualifyingPanel } from "@/components/TopQualifyingPanel"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLiveConnection } from "@/hooks/useLiveConnection"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useSyncFiltersFromUrl } from "@/hooks/useSyncFiltersFromUrl"
import { cn } from "@/lib/utils"

function App() {
  useLiveConnection()
  useSyncFiltersFromUrl()
  const isMdUp = useMediaQuery("(min-width: 768px)")
  const isLgUp = useMediaQuery("(min-width: 1024px)")
  const [detailsOpen, setDetailsOpen] = useState(false)

  const mainColumn = (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-4",
        isMdUp && !isLgUp && "flex-1",
      )}
    >
      <Podium />
      <TopQualifyingPanel />
      <Leaderboard />
    </div>
  )

  const messagesAndStats = (
    <>
      <MessagesPanel />
      <StatisticsPanel />
    </>
  )

  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <CarDrilldownDialog />
      <SessionHeader />
      <main className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        {isMdUp ? (
          isLgUp ? (
            <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px] items-stretch gap-4">
              {mainColumn}
              <aside className="flex min-h-0 min-w-0 flex-col gap-4">
                {messagesAndStats}
              </aside>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {mainColumn}
              <Collapsible
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                className="group flex min-h-0 min-w-0 w-full flex-col gap-3"
              >
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Messages &amp; statistics
                  </span>
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    >
                      Details
                      <ChevronDown
                        className="size-4 transition-transform group-data-[state=open]:rotate-180"
                        aria-hidden
                      />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="flex min-h-0 flex-col gap-4">
                  {messagesAndStats}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )
        ) : (
          <Tabs
            defaultValue="leaderboard"
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <TabsList className="grid h-auto w-full shrink-0 grid-cols-3 p-1">
              <TabsTrigger value="leaderboard" className="flex-1">
                Leaderboard
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex-1">
                Messages
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex-1">
                Stats
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="leaderboard"
              className="mt-0 flex min-h-0 flex-1 flex-col gap-4 overflow-auto"
            >
              <Podium />
              <TopQualifyingPanel />
              <Leaderboard />
            </TabsContent>
            <TabsContent
              value="messages"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto"
            >
              <MessagesPanel />
            </TabsContent>
            <TabsContent
              value="stats"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto"
            >
              <StatisticsPanel />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}

export default App
