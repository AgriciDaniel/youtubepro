import { UploadDateFilter, DurationFilter, SortBy } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface SearchFiltersProps {
  uploadDate: UploadDateFilter;
  duration: DurationFilter;
  sortBy: SortBy;
  onUploadDateChange: (value: UploadDateFilter) => void;
  onDurationChange: (value: DurationFilter) => void;
  onSortByChange: (value: SortBy) => void;
}

const uploadDateOptions = [
  { value: UploadDateFilter.ANY, label: "Any time" },
  { value: UploadDateFilter.HOUR, label: "Last hour" },
  { value: UploadDateFilter.TODAY, label: "Today" },
  { value: UploadDateFilter.WEEK, label: "This week" },
  { value: UploadDateFilter.MONTH, label: "This month" },
  { value: UploadDateFilter.YEAR, label: "This year" },
];

const durationOptions = [
  { value: DurationFilter.ANY, label: "Any duration" },
  { value: DurationFilter.SHORT, label: "Short (< 4 min)" },
  { value: DurationFilter.MEDIUM, label: "Medium (4-20 min)" },
  { value: DurationFilter.LONG, label: "Long (> 20 min)" },
];

const sortByOptions = [
  { value: SortBy.RELEVANCE, label: "Relevance" },
  { value: SortBy.DATE, label: "Upload date" },
  { value: SortBy.VIEW_COUNT, label: "View count" },
  { value: SortBy.RATING, label: "Rating" },
];

export function SearchFilters({
  uploadDate,
  duration,
  sortBy,
  onUploadDateChange,
  onDurationChange,
  onSortByChange,
}: SearchFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="filter-upload-date" className="text-xs text-muted-foreground">Upload date</Label>
        <Select value={uploadDate} onValueChange={onUploadDateChange}>
          <SelectTrigger id="filter-upload-date" className="w-[140px]" data-testid="select-upload-date">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {uploadDateOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-duration" className="text-xs text-muted-foreground">Duration</Label>
        <Select value={duration} onValueChange={onDurationChange}>
          <SelectTrigger id="filter-duration" className="w-[150px]" data-testid="select-duration">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {durationOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-sort-by" className="text-xs text-muted-foreground">Sort by</Label>
        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger id="filter-sort-by" className="w-[130px]" data-testid="select-sort-by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortByOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
