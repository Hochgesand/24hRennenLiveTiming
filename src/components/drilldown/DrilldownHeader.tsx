import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type DrilldownHeaderProps = {
  name: string
  startingNo: string
  session: string | null
  eventId: string | null
}

export function DrilldownHeader({ name, startingNo, session, eventId }: DrilldownHeaderProps) {
  return (
    <DialogHeader>
      <DialogTitle>
        {name} #{startingNo}
      </DialogTitle>
      <DialogDescription>
        Lap times from session {session ?? "—"}
        {eventId ? ` · event ${eventId}` : ""}
      </DialogDescription>
    </DialogHeader>
  )
}
