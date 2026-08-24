import { useLocation, Link } from "wouter";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search, FileText, Play, Settings, Rocket, Check, ArrowRight, Image, History, Loader2 } from "lucide-react";
import { useWorkflow } from "@/lib/workflow-context";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";

const menuItems = [
  {
    title: "Research",
    url: "/",
    icon: Search,
    step: "research" as const,
  },
  {
    title: "Script Writer",
    url: "/script",
    icon: FileText,
    step: "script" as const,
  },
  {
    title: "Thumbnail Creator",
    url: "/thumbnail",
    icon: Image,
    step: "thumbnail" as const,
  },
];

const stepOrder = ["research", "script", "thumbnail"] as const;
type ShellWorkflowStep = typeof stepOrder[number];
const stepLabels: Record<ShellWorkflowStep, string> = {
  research: "Research",
  script: "Script",
  thumbnail: "Thumbnail",
};

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const {
    state,
    recentWorkflows,
    historyLoading,
    historyError,
    startWorkflow,
    openWorkflow,
    goToStep,
  } = useWorkflow();
  const queryClient = useQueryClient();
  const [openingWorkflowId, setOpeningWorkflowId] = useState<string | null>(null);

  const handleStartWorkflow = () => {
    queryClient.removeQueries({ queryKey: ["/api/youtube/search"] });
    startWorkflow();
    setLocation("/");
  };

  const handleOpenWorkflow = async (id: string) => {
    if (id === state.id) return;
    setOpeningWorkflowId(id);
    try {
      const step = await openWorkflow(id);
      if (!step) return;
      queryClient.removeQueries({ queryKey: ["/api/youtube/search"] });
      setLocation(step === "script" ? "/script" : step === "thumbnail" ? "/thumbnail" : "/");
    } finally {
      setOpeningWorkflowId(null);
    }
  };

  const getStepStatus = (step: ShellWorkflowStep) => {
    if (!state.isWorkflowActive) return "inactive";
    const rawCurrentStep = String(state.currentStep);
    const normalizedCurrentStep: ShellWorkflowStep = rawCurrentStep === "package"
      ? "thumbnail"
      : rawCurrentStep === "ideas"
        ? "research"
        : stepOrder.includes(rawCurrentStep as ShellWorkflowStep)
          ? rawCurrentStep as ShellWorkflowStep
          : "research";
    const currentIndex = stepOrder.indexOf(normalizedCurrentStep);
    const stepIndex = stepOrder.indexOf(step);
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "upcoming";
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" onClick={() => goToStep("research")} className="flex items-center gap-3" aria-label="YouTube Pro home">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Play className="h-5 w-5 text-primary-foreground" fill="currentColor" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-sidebar-foreground" data-testid="text-app-name">
              YouTube Pro
            </span>
            <span className="text-xs text-muted-foreground">
              Research & Script
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 py-3">
          <div className="space-y-3">
            <Button
              onClick={handleStartWorkflow}
              className="w-full gap-2"
              data-testid="button-new-workflow"
            >
              <Rocket className="h-4 w-4" aria-hidden="true" />
              New Workflow
            </Button>
            <ol className="flex items-center gap-1" aria-label="Workflow progress">
              {stepOrder.map((step, index) => {
                const status = getStepStatus(step);
                return (
                  <li
                    key={step}
                    className="flex items-center gap-1"
                    aria-current={status === "current" ? "step" : undefined}
                  >
                    <span className="sr-only">{stepLabels[step]}: {status}</span>
                    <div
                      aria-hidden="true"
                      title={`${stepLabels[step]}: ${status}`}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        status === "completed"
                          ? "bg-success"
                          : status === "current"
                          ? "bg-primary animate-pulse"
                          : "bg-muted"
                      }`}
                    />
                    {index < stepOrder.length - 1 && (
                      <div
                        className={`h-0.5 w-4 transition-colors ${
                          status === "completed" ? "bg-success" : "bg-muted"
                        }`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                const stepStatus = item.step ? getStepStatus(item.step) : "inactive";

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-sidebar-accent" : ""}
                    >
                      <Link
                        href={item.url}
                        onClick={() => goToStep(item.step)}
                        aria-current={isActive ? "page" : undefined}
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <item.icon className={isActive ? "text-primary" : ""} aria-hidden="true" />
                          <span>{item.title}</span>
                        </div>
                        {state.isWorkflowActive && item.step && (
                          <div className="flex items-center">
                            {stepStatus === "completed" && (
                              <Check className="h-4 w-4 text-success" aria-hidden="true" />
                            )}
                            {stepStatus === "current" && (
                              <ArrowRight className="h-4 w-4 text-primary animate-pulse" aria-hidden="true" />
                            )}
                          </div>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pt-1">
          <SidebarGroupLabel className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Recent workflows
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {historyLoading ? (
              <p className="px-2 py-2 text-xs text-muted-foreground" role="status">Loading local history...</p>
            ) : recentWorkflows.length === 0 ? (
              <p className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">Your recent research, scripts, and thumbnails will appear here.</p>
            ) : (
              <SidebarMenu>
                {recentWorkflows.map((workflow) => {
                  const active = workflow.id === state.id;
                  return (
                    <SidebarMenuItem key={workflow.id}>
                      <SidebarMenuButton
                        type="button"
                        isActive={active}
                        className="h-auto min-h-12 items-start py-2"
                        onClick={() => void handleOpenWorkflow(workflow.id)}
                        disabled={openingWorkflowId !== null}
                        data-testid={`button-recent-workflow-${workflow.id}`}
                        aria-current={active ? "page" : undefined}
                        title={workflow.title}
                      >
                        {openingWorkflowId === workflow.id ? (
                          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                        ) : (
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-medium">{workflow.title}</span>
                          <span className="mt-0.5 block text-[11px] capitalize text-muted-foreground">
                            {stepLabels[workflow.currentStep]} · {formatDistanceToNowStrict(workflow.updatedAt, { addSuffix: true })}
                          </span>
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
            {historyError && <p className="px-2 pt-2 text-xs leading-relaxed text-destructive" role="status">{historyError}</p>}
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location === "/settings"}>
              <Link
                href="/settings"
                aria-current={location === "/settings" ? "page" : undefined}
                data-testid="link-settings"
              >
                <Settings className={location === "/settings" ? "text-primary" : ""} aria-hidden="true" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
