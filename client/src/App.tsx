import { Redirect, Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ControllerGuide } from "@/components/controller-guide";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { WorkflowProvider, useWorkflow } from "@/lib/workflow-context";
import NotFound from "@/pages/not-found";
import ResearchDashboard from "@/pages/research";
import ScriptPage from "@/pages/script";
import SettingsPage from "@/pages/settings";
import ThumbnailPage from "@/pages/thumbnail";

function Router() {
  const { state } = useWorkflow();
  return (
    <Switch key={state.id || "workflow-loading"}>
      <Route path="/" component={ResearchDashboard} />
      <Route path="/ideas">
        <Redirect to="/#ideas" replace />
      </Route>
      <Route path="/script" component={ScriptPage} />
      <Route path="/thumbnail" component={ThumbnailPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const [location] = useLocation();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  } as React.CSSProperties;
  // Research uses its own Radix scroll area for the sticky search controls.
  // Other routes use the shell scroll owner so long generated content cannot
  // become trapped inside an unconstrained nested overflow container.
  const routeOwnsScrolling = location === "/" || location === "/ideas";

  return (
    <SidebarProvider style={style}>
      <div className="flex h-dvh w-full overflow-hidden">
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground shadow-md transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <AppSidebar />
        <SidebarInset id="main-content" tabIndex={-1} className="min-h-0 overflow-hidden" aria-label="Application workspace">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" aria-label="Toggle sidebar" />
            </div>
            <div className="flex items-center gap-1">
              <ControllerGuide />
              <ThemeToggle />
            </div>
          </header>
          <div
            className={`min-h-0 flex-1 ${routeOwnsScrolling ? "overflow-hidden" : "overflow-y-auto"}`}
            data-page-scroll-owner={routeOwnsScrolling ? "route" : "shell"}
          >
            <Router />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <WorkflowProvider>
            <AppLayout />
          </WorkflowProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
