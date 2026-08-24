import { Lock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ComingSoonFeature {
  icon: LucideIcon;
  label: string;
}

interface ComingSoonProps {
  title: string;
  description: string;
  features: ComingSoonFeature[];
}

export function ComingSoon({ title, description, features }: ComingSoonProps) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-xl px-8 py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="relative mb-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
              <Lock className="h-10 w-10 text-muted-foreground" />
            </div>
            <Badge
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground"
              data-testid="badge-coming-soon"
            >
              Soon
            </Badge>
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-coming-soon-title">
            {title}
          </h1>
          <p className="text-muted-foreground">Coming Soon</p>
          <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-4 text-left sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.label} className="flex items-center gap-2">
                <feature.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{feature.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </Card>
    </div>
  );
}
