import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle, CheckCircle2, ChevronDown, Download, Image as ImageIcon, ImagePlus,
  Info, Loader2, RefreshCw, Settings, SlidersHorizontal, Sparkles, Trash2, Wand2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useWorkflow } from "@/lib/workflow-context";

const MAX_INPUT_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_GENERATION_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REFERENCE_IMAGES = 3;

const thumbnailStyles = [
  ["bold", "Bold and dramatic"], ["minimal", "Clean and minimal"], ["gaming", "Gaming"],
  ["vlog", "Vlog and lifestyle"], ["tutorial", "Educational"], ["cinematic", "Cinematic"],
  ["tech", "Tech and modern"], ["lifestyle", "Lifestyle and wellness"],
] as const;
const compositionOptions = [
  ["centered", "Centered"], ["rule-of-thirds", "Rule of thirds"], ["close-up", "Close-up"],
  ["wide-shot", "Wide shot"], ["split-screen", "Split screen"], ["diagonal", "Diagonal"],
] as const;
const cameraAngleOptions = [
  ["eye-level", "Eye level"], ["low-angle", "Low angle"], ["high-angle", "High angle"],
  ["dutch-angle", "Dutch angle"], ["overhead", "Overhead"], ["three-quarter", "Three-quarter"],
] as const;
const lightingOptions = [
  ["natural", "Natural"], ["dramatic", "Dramatic"], ["golden-hour", "Golden hour"],
  ["studio", "Studio"], ["neon", "Neon and RGB"], ["backlit", "Backlit"], ["soft", "Soft and diffused"],
] as const;
const colorSchemeOptions = [
  ["vibrant", "Vibrant"], ["muted", "Muted and elegant"], ["warm", "Warm tones"],
  ["cool", "Cool tones"], ["monochrome", "Monochrome"], ["complementary", "Complementary"],
  ["brand-colors", "Brand colors"],
] as const;
const textPositionOptions = [
  ["left", "Left"], ["right", "Right"], ["center", "Center"], ["top", "Top"],
  ["bottom", "Bottom"], ["none", "No text space"],
] as const;
const imageRoleOptions = [
  ["subject", "Subject or person"], ["style", "Style direction"],
  ["background", "Background"], ["composition", "Composition"],
] as const;

type ThumbnailStyle = (typeof thumbnailStyles)[number][0];
type ThumbnailComposition = (typeof compositionOptions)[number][0];
type ThumbnailCameraAngle = (typeof cameraAngleOptions)[number][0];
type ThumbnailLighting = (typeof lightingOptions)[number][0];
type ThumbnailColorScheme = (typeof colorSchemeOptions)[number][0];
type ThumbnailTextPosition = (typeof textPositionOptions)[number][0];
type ReferenceRole = (typeof imageRoleOptions)[number][0];
type ReferenceImage = { image: string; role: ReferenceRole; name: string };
type RequestFailure = { error: string; code: string; category: string; retryable: boolean; suggestion: string };
type ImageModelStatus = { id: string; label: string; description: string };
type SelectOption = readonly [string, string];
type OutcomePreset = {
  id: string; label: string; mainText: string; description: string; style: ThumbnailStyle;
  composition: ThumbnailComposition; cameraAngle: ThumbnailCameraAngle; lighting: ThumbnailLighting;
  colorScheme: ThumbnailColorScheme; textPosition: ThumbnailTextPosition;
};

const outcomePresets: OutcomePreset[] = [
  { id: "tutorial", label: "Tutorial or demo", mainText: "How it works", description: "Show the action and the visible outcome in one simple instructional scene.", style: "tutorial", composition: "rule-of-thirds", cameraAngle: "three-quarter", lighting: "studio", colorScheme: "complementary", textPosition: "right" },
  { id: "comparison", label: "Comparison or versus", mainText: "Side by side", description: "Give both options equal visual weight and make the comparison basis obvious.", style: "minimal", composition: "split-screen", cameraAngle: "eye-level", lighting: "studio", colorScheme: "complementary", textPosition: "top" },
  { id: "result", label: "Result reveal", mainText: "The result", description: "Lead with the real outcome while avoiding an unsupported before-and-after claim.", style: "bold", composition: "close-up", cameraAngle: "eye-level", lighting: "dramatic", colorScheme: "vibrant", textPosition: "left" },
  { id: "case-study", label: "Case study", mainText: "What changed", description: "Feature the real subject and one concrete, supportable change from the case study.", style: "minimal", composition: "rule-of-thirds", cameraAngle: "eye-level", lighting: "natural", colorScheme: "muted", textPosition: "right" },
  { id: "news", label: "News or update", mainText: "What changed", description: "Show the update itself with clear hierarchy and no false urgency.", style: "tech", composition: "wide-shot", cameraAngle: "eye-level", lighting: "studio", colorScheme: "cool", textPosition: "left" },
  { id: "list", label: "List or ranking", mainText: "Top picks", description: "Feature the leading item and enough secondary cues to communicate a ranked selection.", style: "bold", composition: "diagonal", cameraAngle: "high-angle", lighting: "dramatic", colorScheme: "complementary", textPosition: "left" },
  { id: "review", label: "Product or tool review", mainText: "Worth it?", description: "Show the exact product clearly and frame the evaluation question without implying a verdict.", style: "tech", composition: "centered", cameraAngle: "three-quarter", lighting: "studio", colorScheme: "cool", textPosition: "right" },
];

function localFailure(error: string, suggestion: string): RequestFailure {
  return { error, code: "THUMBNAIL_CLIENT_VALIDATION", category: "invalid_response", retryable: false, suggestion };
}

async function readFailure(response: Response): Promise<RequestFailure> {
  let body: Partial<RequestFailure> = {};
  try { body = await response.json(); } catch { body = {}; }
  return {
    error: body.error || `Request failed with status ${response.status}`,
    code: body.code || `HTTP_${response.status}`,
    category: body.category || (response.status === 429 ? "quota" : "unknown"),
    retryable: body.retryable ?? response.status >= 429,
    suggestion: body.suggestion || "Retry once. If this continues, review Settings and server logs.",
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected file could not be decoded as an image."));
    image.src = dataUrl;
  });
}

async function prepareReferenceImage(file: File): Promise<string> {
  if (file.type !== "image/png" && file.type !== "image/jpeg") throw new Error("Choose a PNG or JPEG image.");
  if (file.size > MAX_INPUT_IMAGE_BYTES) throw new Error("Choose an image smaller than 10 MB.");
  const original = await readFileAsDataUrl(file);
  const image = await loadImage(original);
  if (image.naturalWidth < 128 || image.naturalHeight < 128 || image.naturalWidth > 4096 || image.naturalHeight > 4096) {
    throw new Error("Image dimensions must be between 128 and 4096 pixels.");
  }
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the image.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const prepared = canvas.toDataURL("image/jpeg", 0.86);
  const approximateBytes = Math.ceil((prepared.length - prepared.indexOf(",") - 1) * 0.75);
  if (approximateBytes > MAX_GENERATION_IMAGE_BYTES) throw new Error("The prepared image is still larger than 5 MB. Choose a simpler or smaller image.");
  return prepared;
}

function FailurePanel({ failure, busy, onRetry, onSettings }: { failure: RequestFailure; busy: boolean; onRetry: () => void; onSettings: () => void }) {
  const needsSettings = failure.category === "missing_key" || failure.category === "invalid_key";
  return (
    <Alert variant="destructive" data-testid="thumbnail-error">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{failure.error}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{failure.suggestion}</p>
        <div className="flex flex-wrap gap-2">
          {failure.retryable && <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>}
          {needsSettings && <Button type="button" size="sm" variant="outline" onClick={onSettings}><Settings className="mr-2 h-4 w-4" />Open Settings</Button>}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function LabeledSelect({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: ReadonlyArray<SelectOption>; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([optionValue, optionLabel]) => <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

export default function ThumbnailPage() {
  const { state: workflowState, setThumbnailData: cacheThumbnailData } = useWorkflow();
  const [, setLocation] = useLocation();
  const lastGenerationMode = useRef<"create" | "variation">("create");
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const selectedIdea = workflowState.idea?.selectedIdea;
  const [topic, setTopic] = useState("");
  const [thumbnailStyle, setThumbnailStyle] = useState<ThumbnailStyle>("bold");
  const [mainText, setMainText] = useState("");
  const [subText, setSubText] = useState("");
  const [description, setDescription] = useState("");
  const [composition, setComposition] = useState<ThumbnailComposition>("centered");
  const [cameraAngle, setCameraAngle] = useState<ThumbnailCameraAngle>("eye-level");
  const [lighting, setLighting] = useState<ThumbnailLighting>("natural");
  const [colorScheme, setColorScheme] = useState<ThumbnailColorScheme>("vibrant");
  const [textPosition, setTextPosition] = useState<ThumbnailTextPosition>("left");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [variationOpen, setVariationOpen] = useState(false);
  const [presetId, setPresetId] = useState("custom");
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [autoBlend, setAutoBlend] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [thumbnailData, setThumbnailData] = useState<string | null>(null);
  const [resultModel, setResultModel] = useState<string | null>(null);
  const [configuredModel, setConfiguredModel] = useState<ImageModelStatus | null>(null);
  const [modelStatusUnavailable, setModelStatusUnavailable] = useState(false);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationError, setGenerationError] = useState<RequestFailure | null>(null);
  const [variationDirection, setVariationDirection] = useState("");
  const [downloadedName, setDownloadedName] = useState<string | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    const cached = workflowState.cachedThumbnail;
    if (cached) {
      setTopic(cached.topic);
      setThumbnailStyle(cached.thumbnailStyle as ThumbnailStyle);
      setMainText(cached.mainText);
      setSubText(cached.subText);
      setDescription(cached.description);
      setComposition(cached.composition as ThumbnailComposition);
      setCameraAngle(cached.cameraAngle as ThumbnailCameraAngle);
      setLighting(cached.lighting as ThumbnailLighting);
      setColorScheme(cached.colorScheme as ThumbnailColorScheme);
      setTextPosition(cached.textPosition as ThumbnailTextPosition);
      setPresetId(cached.presetId);
      setAutoBlend(cached.autoBlend);
      setThumbnailData(cached.thumbnailData);
      setResultModel(cached.resultModel);
    } else if (selectedIdea) {
      setTopic(selectedIdea.title);
      setDescription(selectedIdea.thumbnailConcept);
    } else if (workflowState.cachedScript) {
      setTopic(workflowState.cachedScript.topic || workflowState.cachedScript.title || "");
    }
    setCacheReady(true);
  }, [workflowState.id]);

  useEffect(() => {
    if (!cacheReady || !workflowState.id) return;
    const timeout = window.setTimeout(() => {
      cacheThumbnailData({
        topic,
        thumbnailStyle,
        mainText,
        subText,
        description,
        composition,
        cameraAngle,
        lighting,
        colorScheme,
        textPosition,
        presetId,
        autoBlend,
        thumbnailData,
        resultModel,
        timestamp: Date.now(),
      });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [
    autoBlend, cacheReady, cacheThumbnailData, cameraAngle, colorScheme, composition,
    description, lighting, mainText, presetId, resultModel, subText, textPosition,
    thumbnailData, thumbnailStyle, topic, workflowState.id,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/settings/status", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Settings status unavailable"); return response.json(); })
      .then((status) => {
        const option = status.models?.imageOptions?.find((item: ImageModelStatus) => item.id === status.models?.image);
        if (option) setConfiguredModel(option); else setModelStatusUnavailable(true);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setModelStatusUnavailable(true);
      });
    return () => controller.abort();
  }, []);

  const applyPreset = (preset: OutcomePreset) => {
    setPresetId(preset.id);
    setThumbnailStyle(preset.style); setMainText(preset.mainText); setDescription(preset.description);
    setComposition(preset.composition); setCameraAngle(preset.cameraAngle); setLighting(preset.lighting);
    setColorScheme(preset.colorScheme); setTextPosition(preset.textPosition); setGenerationError(null);
  };

  const addReferenceFiles = async (files: File[]) => {
    const available = MAX_REFERENCE_IMAGES - references.length;
    if (available <= 0) {
      setGenerationError(localFailure("Reference limit reached", "Remove an image before adding another. You can use up to three references."));
      return;
    }
    const selectedFiles = files.slice(0, available);
    if (selectedFiles.length === 0) return;
    setReferencesLoading(true);
    try {
      const prepared = await Promise.all(selectedFiles.map(async (file) => ({ image: await prepareReferenceImage(file), role: "subject" as const, name: file.name })));
      setReferences((current) => [...current, ...prepared].slice(0, MAX_REFERENCE_IMAGES));
      setRightsConfirmed(false); setGenerationError(null);
    } catch (error) {
      setGenerationError(localFailure("Reference image not accepted", error instanceof Error ? error.message : "Choose another PNG or JPEG image."));
    } finally { setReferencesLoading(false); }
  };

  const handleReferenceUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    void addReferenceFiles(files);
  };

  const handleReferenceDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void addReferenceFiles(Array.from(event.dataTransfer.files));
  };

  const generateThumbnail = async (mode: "create" | "variation" = "create") => {
    if (!topic.trim()) { setGenerationError(localFailure("Topic required", "Add a specific video topic before generating.")); return; }
    if (references.length > 0 && !rightsConfirmed) { setGenerationError(localFailure("Reference permission required", "Confirm that you have permission to use every uploaded reference.")); return; }
    if (mode === "variation" && !variationDirection.trim()) { setGenerationError(localFailure("Variation direction required", "Describe what should change in the next variation.")); return; }
    const requestReferences = mode === "variation" && thumbnailData
      ? [{ image: thumbnailData, role: "style" as const }, ...references.slice(0, 2).map(({ image, role }) => ({ image, role }))]
      : references.map(({ image, role }) => ({ image, role }));
    lastGenerationMode.current = mode;
    setGenerationLoading(true); setGenerationError(null); setDownloadedName(null);
    try {
      const response = await fetch("/api/thumbnail/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(), style: thumbnailStyle, mainText: mainText.trim(), subText: subText.trim(),
          thumbnailDescription: description.trim(), composition, cameraAngle, lighting, colorScheme, textPosition,
          autoBlend, referenceImages: requestReferences, referenceRightsConfirmed: requestReferences.length > 0,
          honestPromise: selectedIdea?.honestPromise, thumbnailConcept: selectedIdea?.thumbnailConcept,
          mode, variationDirection: mode === "variation" ? variationDirection.trim() : undefined,
        }),
      });
      if (!response.ok) throw await readFailure(response);
      const body = await response.json();
      if (typeof body.imageData !== "string" || !body.imageData.startsWith("data:image/")) throw localFailure("Image response was incomplete", "Retry once. If this continues, choose another supported image model in Settings.");
      setThumbnailData(body.imageData); setResultModel(typeof body.model === "string" ? body.model : null);
      if (mode === "variation") setVariationDirection("");
    } catch (error) {
      setGenerationError(error && typeof error === "object" && "code" in error ? error as RequestFailure : localFailure("Thumbnail could not be generated", "Check the server connection and retry."));
    } finally { setGenerationLoading(false); }
  };

  const downloadThumbnail = () => {
    if (!thumbnailData) return;
    const extension = thumbnailData.startsWith("data:image/jpeg") ? "jpg" : "png";
    const safeTopic = topic.trim().slice(0, 40).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "youtube";
    const filename = `${safeTopic}-thumbnail.${extension}`;
    const link = document.createElement("a"); link.href = thumbnailData; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove(); setDownloadedName(filename);
  };

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-5 p-3 sm:p-5 lg:p-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ImageIcon className="h-5 w-5" aria-hidden="true" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Thumbnail Creator</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Describe the thumbnail once. The creator applies the selected research promise and YouTube readability rules.</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" />16:9 output, no visible app watermark requested. Invisible SynthID provenance remains.</p>
            </div>
          </div>
          {configuredModel ? (
            <div className="max-w-sm rounded-lg border bg-card/70 px-3 py-2 text-xs"><p className="font-medium">{configuredModel.label}</p><p className="mt-0.5 text-muted-foreground">{configuredModel.id}</p></div>
          ) : modelStatusUnavailable ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setLocation("/settings")}><Settings className="mr-2 h-4 w-4" />Check image model</Button>
          ) : <Skeleton className="h-12 w-48" aria-label="Loading configured image model" />}
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
          <Card className="min-w-0 border-border/70 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Create a thumbnail</CardTitle>
              <p className="text-sm text-muted-foreground">Start with a clear promise and one visual idea. References and detailed controls are optional.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedIdea && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="font-medium text-foreground">Research idea loaded</p>
                  <p className="mt-1 text-muted-foreground">{selectedIdea.thumbnailConcept}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Promise: {selectedIdea.honestPromise}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="thumbnail-topic">Video topic or title</Label>
                <Input id="thumbnail-topic" value={topic} maxLength={200} onChange={(event) => setTopic(event.target.value)} placeholder="What is the video about?" data-testid="input-topic" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="thumbnail-preset">Starting point</Label>
                  <Select value={presetId} onValueChange={(value) => {
                    setPresetId(value);
                    const preset = outcomePresets.find((item) => item.id === value);
                    if (preset) applyPreset(preset);
                  }}>
                    <SelectTrigger id="thumbnail-preset"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Use my brief</SelectItem>
                      {outcomePresets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="thumbnail-main-text">Words on the thumbnail</Label>
                  <Input id="thumbnail-main-text" value={mainText} maxLength={50} onChange={(event) => setMainText(event.target.value)} placeholder="Optional, 2 to 5 words" data-testid="input-thumbnail-text" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail-description">Describe the thumbnail you want</Label>
                <div className="rounded-xl border border-border bg-muted/20 p-2 focus-within:ring-2 focus-within:ring-ring">
                  <Textarea
                    id="thumbnail-description"
                    value={description}
                    maxLength={1000}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Example: A close-up of a creator looking surprised at a clean analytics dashboard, strong contrast, subject on the right, room for short text on the left."
                    className="min-h-32 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0"
                    data-testid="input-thumbnail-description"
                  />
                  <div className="flex items-center justify-between px-1 pb-1 text-xs text-muted-foreground"><span>Subject, action, setting, and truthful outcome</span><span>{description.length}/1000</span></div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Reference images</p><p className="text-xs text-muted-foreground">Optional, up to three permitted PNG or JPEG images.</p></div><span className="text-xs text-muted-foreground">{references.length}/{MAX_REFERENCE_IMAGES}</span></div>
                <input ref={referenceInputRef} id="thumbnail-references" type="file" accept="image/png,image/jpeg" multiple className="sr-only" onChange={handleReferenceUpload} disabled={references.length >= MAX_REFERENCE_IMAGES || referencesLoading} data-testid="input-add-reference" />
                <div
                  className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/15 px-4 text-center"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleReferenceDrop}
                >
                  {referencesLoading ? <Loader2 className="mb-2 h-5 w-5 animate-spin text-primary" /> : <ImagePlus className="mb-2 h-5 w-5 text-muted-foreground" />}
                  <p className="text-sm font-medium">Drag images here</p>
                  <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => referenceInputRef.current?.click()} disabled={references.length >= MAX_REFERENCE_IMAGES || referencesLoading}>{referencesLoading ? "Preparing images" : "or choose files"}</Button>
                </div>

                {references.length > 0 && <div className="grid gap-3 sm:grid-cols-3">{references.map((reference, index) => (
                  <div key={`${reference.name}-${index}`} className="rounded-lg border border-border p-2">
                    <img src={reference.image} alt={`Reference ${index + 1}: ${reference.name}`} className="aspect-video w-full rounded-md bg-muted object-cover" />
                    <div className="mt-2 flex items-center gap-1">
                      <Select value={reference.role} onValueChange={(role: ReferenceRole) => setReferences((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, role } : item))}>
                        <SelectTrigger className="h-9 min-w-0 flex-1" aria-label={`Role for reference ${index + 1}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{imageRoleOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => { setReferences((current) => current.filter((_, itemIndex) => itemIndex !== index)); setRightsConfirmed(false); }} aria-label={`Remove reference ${index + 1}: ${reference.name}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}</div>}

                {references.length > 0 && <div className="flex items-start gap-3 rounded-lg border border-border p-3"><Checkbox id="thumbnail-rights" checked={rightsConfirmed} onCheckedChange={(checked) => setRightsConfirmed(checked === true)} /><Label htmlFor="thumbnail-rights" className="text-sm font-normal leading-5">I have permission to use every uploaded reference image.</Label></div>}
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="w-full justify-between border-t border-border pt-4" aria-expanded={advancedOpen} data-testid="button-toggle-advanced"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Advanced controls</span><ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} /></Button></CollapsibleTrigger>
                <CollapsibleContent className="pt-4"><div className="grid gap-4 sm:grid-cols-2">
                  <LabeledSelect id="thumbnail-style" label="Visual style" value={thumbnailStyle} options={thumbnailStyles} onChange={(value) => setThumbnailStyle(value as ThumbnailStyle)} />
                  <div className="space-y-2"><Label htmlFor="thumbnail-subtext">Secondary text</Label><Input id="thumbnail-subtext" value={subText} maxLength={80} onChange={(event) => setSubText(event.target.value)} placeholder="Optional supporting line" data-testid="input-thumbnail-subtext" /></div>
                  <LabeledSelect id="thumbnail-composition" label="Composition" value={composition} options={compositionOptions} onChange={(value) => setComposition(value as ThumbnailComposition)} />
                  <LabeledSelect id="thumbnail-camera-angle" label="Camera angle" value={cameraAngle} options={cameraAngleOptions} onChange={(value) => setCameraAngle(value as ThumbnailCameraAngle)} />
                  <LabeledSelect id="thumbnail-lighting" label="Lighting" value={lighting} options={lightingOptions} onChange={(value) => setLighting(value as ThumbnailLighting)} />
                  <LabeledSelect id="thumbnail-color" label="Color scheme" value={colorScheme} options={colorSchemeOptions} onChange={(value) => setColorScheme(value as ThumbnailColorScheme)} />
                  <LabeledSelect id="thumbnail-text-position" label="Text position" value={textPosition} options={textPositionOptions} onChange={(value) => { const position = value as ThumbnailTextPosition; setTextPosition(position); if (position === "none") { setMainText(""); setSubText(""); } }} />
                  {references.length > 0 && <div className="flex items-start gap-3 pt-2"><Switch id="thumbnail-auto-blend" checked={autoBlend} onCheckedChange={setAutoBlend} /><div><Label htmlFor="thumbnail-auto-blend">Blend references into one scene</Label><p className="mt-1 text-xs text-muted-foreground">Off treats them as direction only.</p></div></div>}
                </div></CollapsibleContent>
              </Collapsible>

              {generationError && <FailurePanel failure={generationError} busy={generationLoading} onRetry={() => void generateThumbnail(lastGenerationMode.current)} onSettings={() => setLocation("/settings")} />}
              <Button type="button" size="lg" className="min-h-12 w-full" onClick={() => void generateThumbnail("create")} disabled={generationLoading} data-testid="button-generate-thumbnail">{generationLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}{generationLoading ? "Creating thumbnail" : "Create thumbnail"}</Button>
            </CardContent>
          </Card>

          <aside className="min-w-0 lg:sticky lg:top-5"><Card className="border-border/70 shadow-sm"><CardHeader><CardTitle className="text-lg">Preview</CardTitle></CardHeader><CardContent className="space-y-4">
            {generationLoading ? <div className="space-y-3" role="status" aria-live="polite"><Skeleton className="aspect-video w-full" /><p className="text-sm text-muted-foreground">Generating one 16:9 image with the configured model. This can take a moment.</p></div> : thumbnailData ? <>
              <div className="overflow-hidden rounded-lg border bg-muted"><img src={thumbnailData} alt="Generated YouTube thumbnail" className="aspect-video w-full object-cover" data-testid="img-generated-thumbnail" /></div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row"><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={downloadThumbnail} data-testid="button-download-thumbnail"><Download className="mr-2 h-4 w-4" />Download</Button><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => void generateThumbnail("create")} disabled={generationLoading}><RefreshCw className="mr-2 h-4 w-4" />New version</Button></div>
              {downloadedName && <p className="flex items-center gap-2 text-sm text-success" role="status"><CheckCircle2 className="h-4 w-4" />Downloaded as {downloadedName}</p>}
              <Collapsible open={variationOpen} onOpenChange={setVariationOpen}><CollapsibleTrigger asChild><Button type="button" variant="ghost" className="w-full justify-between"><span className="flex items-center gap-2"><Wand2 className="h-4 w-4" />Create a variation</span><ChevronDown className={`h-4 w-4 transition-transform ${variationOpen ? "rotate-180" : ""}`} /></Button></CollapsibleTrigger><CollapsibleContent className="space-y-2 pt-3"><Textarea id="thumbnail-variation" value={variationDirection} maxLength={500} onChange={(event) => setVariationDirection(event.target.value)} placeholder="What should change in the next version?" className="min-h-20" /><Button type="button" className="min-h-11 w-full" onClick={() => void generateThumbnail("variation")} disabled={generationLoading || !variationDirection.trim()} data-testid="button-generate-variation"><Wand2 className="mr-2 h-4 w-4" />Generate variation</Button></CollapsibleContent></Collapsible>
              <p className="text-center text-xs text-muted-foreground">Generated with {resultModel || configuredModel?.label || "the configured image model"}</p>
            </> : <div className="flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center"><ImageIcon className="mb-3 h-7 w-7 text-muted-foreground" /><p className="font-medium">Your thumbnail will appear here</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">Add a topic and a short visual brief, then create.</p></div>}
          </CardContent></Card></aside>
        </div>
      </div>
    </div>
  );
}
