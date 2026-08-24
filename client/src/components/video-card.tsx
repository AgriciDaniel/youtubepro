import type { Video } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Calendar, ThumbsUp, MessageSquare } from "lucide-react";

interface VideoCardProps {
  video: Video;
  onClick?: (video: Video) => void;
}

function formatViews(views?: number): string {
  if (views === undefined) return "N/A";
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.ceil(Math.abs(diffTime) / (1000 * 60 * 60 * 24));

  if (diffTime < 0) {
    if (diffDays <= 1) return "Scheduled for tomorrow";
    return `Scheduled in ${diffDays} days`;
  }

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatDuration(duration?: string): string {
  if (!duration) return "";
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;

  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function VideoCard({ video, onClick }: VideoCardProps) {
  const isInteractive = Boolean(onClick);
  const openVideo = () => onClick?.(video);

  return (
    <Card
      className={`group overflow-hidden border-card-border bg-card transition-colors duration-300 ${
        isInteractive
          ? "cursor-pointer hover:border-primary/50 hover-elevate focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : ""
      }`}
      onClick={isInteractive ? openVideo : undefined}
      onKeyDown={isInteractive ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openVideo();
        }
      } : undefined}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? `Open details for ${video.title}` : undefined}
      data-testid={`card-video-${video.id}`}
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        <img
          src={video.thumbnailUrl}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {video.duration && (
          <Badge
            variant="secondary"
            className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono"
          >
            {formatDuration(video.duration)}
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-3">
        <h3
          className="font-semibold text-base leading-tight line-clamp-2 text-card-foreground group-hover:text-primary transition-colors"
          data-testid={`text-video-title-${video.id}`}
        >
          {video.title}
        </h3>

        <p
          className="text-sm text-muted-foreground line-clamp-1"
          data-testid={`text-video-channel-${video.id}`}
        >
          {video.channelTitle}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span data-testid={`text-video-views-${video.id}`}>
              {formatViews(video.viewCount)} views
            </span>
          </span>

          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{formatDate(video.publishedAt)}</span>
          </span>
        </div>

        {(video.likeCount !== undefined || video.commentCount !== undefined) && (
          <div className="flex items-center gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
            {video.likeCount !== undefined && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                {formatViews(video.likeCount)}
              </span>
            )}
            {video.commentCount !== undefined && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                {formatViews(video.commentCount)}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
