import { useLocation, Link } from "wouter";
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
import { Search, FileText, Play, Settings, Rocket, Check, ArrowRight, Image } from "lucide-react";
import { useWorkflow } from "@/lib/workflow-context";
import { useQueryClient } from "@tanstack/react-query";
import type { SearchResponse } from "@shared/schema";

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
  const { state, startWorkflow } = useWorkflow();
  const queryClient = useQueryClient();

  const handleStartWorkflow = () => {
    const hasCachedSearch = queryClient
      .getQueriesData<SearchResponse>({ queryKey: ["/api/youtube/search"] })
      .some(([, cached]) => Boolean(cached?.videos.length));
    const hasExistingWork = Boolean(
      state.isWorkflowActive || state.cachedResearch || state.idea || state.cachedScript || hasCachedSearch,
    );
    if (
      hasExistingWork &&
      !window.confirm("Start a new workflow? This will clear the current research, script, and thumbnail context from this session.")
    ) {
      return;
    }
    queryClient.removeQueries({ queryKey: ["/api/youtube/search"] });
    startWorkflow();
    setLocation("/");
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
        <Link href="/" className="flex items-center gap-3" aria-label="YouTube Pro home">
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
