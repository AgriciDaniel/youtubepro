import { FileText, Gamepad2, Image, Rocket, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const guideItems = [
  {
    label: "Research",
    icon: Search,
    description: "Search YouTube, compare public video data, generate grounded AI insights, and choose an idea.",
  },
  {
    label: "Script Writer",
    icon: FileText,
    description: "Turn an idea into a script, then read it in the built-in teleprompter with play, speed, and text-size controls.",
  },
  {
    label: "Thumbnail Creator",
    icon: Image,
    description: "Create a thumbnail from one visual brief, an optional preset, and permitted reference images.",
  },
  {
    label: "Settings",
    icon: Settings,
    description: "Connect local API keys and choose the Gemini text and image models.",
  },
  {
    label: "New Workflow",
    icon: Rocket,
    description: "Clear the current session after confirmation and begin again from Research.",
  },
] as const;

export function ControllerGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open controller guide"
          title="Controller guide"
          data-testid="button-controller-guide"
        >
          <Gamepad2 className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" aria-hidden="true" />
            YouTube Pro controller note
          </DialogTitle>
          <DialogDescription>
            Use the sidebar labels below to navigate the workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2" aria-label="YouTube Pro navigation guide">
          {guideItems.map((item) => (
            <section key={item.label} className="flex gap-3 rounded-lg border border-border bg-card p-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{item.label}</h2>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            </section>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Recommended order: Research, Script Writer, then Thumbnail Creator.
        </p>
      </DialogContent>
    </Dialog>
  );
}
