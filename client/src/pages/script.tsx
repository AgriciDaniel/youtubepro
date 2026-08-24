import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FileText, Sparkles, Loader2, Clock, Type, Copy, Check, RotateCcw,
  Download, RefreshCw, Image, X,
  ArrowRight, Play, Pause, SkipBack, Minus, Plus, Pencil, Save,
  SlidersHorizontal, ChevronDown, Undo2, Redo2, ArrowLeft,
  Maximize2, Minimize2, Captions, CaptionsOff
} from "lucide-react";
import { useLocation } from "wouter";
import jsPDF from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { EmptyState } from "@/components/empty-state";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWorkflow } from "@/lib/workflow-context";
import { StarryBackground } from "@/components/ui/starry-background";
import { VideoFormat, TargetAudience, CreatorPersona, scriptInputSchema, type ScriptInput, type ScriptResult } from "@shared/schema";

const formatOptions = [
  { value: VideoFormat.SHORT, label: "YouTube Short (< 60 sec)", icon: "60s" },
  { value: VideoFormat.LONG_FORM, label: "Long-form Video (8-15 min)", icon: "15m" },
  { value: VideoFormat.TUTORIAL, label: "Tutorial/How-to", icon: "EDU" },
  { value: VideoFormat.REVIEW, label: "Product Review", icon: "REV" },
  { value: VideoFormat.VLOG, label: "Vlog Style", icon: "VLG" },
];

const audienceOptions = [
  { value: TargetAudience.GENERAL, label: "General Audience" },
  { value: TargetAudience.TECH_SAVVY, label: "Tech-Savvy Viewers" },
  { value: TargetAudience.BEGINNERS, label: "Beginners" },
  { value: TargetAudience.PROFESSIONALS, label: "Industry Professionals" },
];

const personaOptions = [
  { value: CreatorPersona.NONE, label: "No specific style", description: "Default AI writing style" },
  { value: CreatorPersona.EINSTEIN, label: "The Curious Thinker", description: "Thought-provoking, uses analogies" },
  { value: CreatorPersona.NATE_HERK, label: "The Energizer", description: "Energetic, motivational, action-oriented" },
  { value: CreatorPersona.NEIL_PATEL, label: "The Data Expert", description: "Data-driven, SEO-focused, practical tips" },
  { value: CreatorPersona.GARY_VEE, label: "The Hustler", description: "High energy, hustle culture, motivational" },
  { value: CreatorPersona.BRITNEY_SPEARS, label: "The Entertainer", description: "Fun, pop culture, entertaining" },
  { value: CreatorPersona.BRUCE_LEE, label: "The Philosopher", description: "Philosophical, wise, mindful" },
  { value: CreatorPersona.MR_BEAST, label: "The Challenger", description: "Exciting, challenge-driven, high engagement" },
  { value: CreatorPersona.MORGAN_FREEMAN, label: "The Storyteller", description: "Calm, authoritative, storytelling voice" },
  { value: CreatorPersona.ALEX_HORMOZI, label: "The Business Pro", description: "Business-focused, value-driven, direct" },
  { value: CreatorPersona.TONY_ROBBINS, label: "The Motivator", description: "Empowering, motivational, high energy" },
  { value: CreatorPersona.OTHER, label: "Custom Persona", description: "Enter your own persona" },
];

interface ScriptParagraph {
  id: string;
  type: 'dialogue' | 'stage-direction' | 'b-roll' | 'heading' | 'bullet' | 'text';
  speaker?: string;
  tone?: string;
  content: string;
}

interface ScriptSection {
  name: string;
  timestamp?: string;
  paragraphs: ScriptParagraph[];
}

interface ScriptRegenerationResponse {
  content: string;
  evidenceClaimIds: string[];
}

interface ScriptActionError {
  title: string;
  message: string;
}

function providerAwareScriptError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  if (normalized.includes("quota") || normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Gemini usage is temporarily limited. Wait for the provider window to reset, then retry.";
  }
  if (normalized.includes("api key") || normalized.includes("unauthorized") || normalized.includes("authentication")) {
    return "Gemini could not authenticate. Check the configured key in Settings, then retry.";
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "Gemini took too long to respond. Your current script is unchanged. Retry when ready.";
  }
  if (normalized.includes("network") || normalized.includes("fetch") || normalized.includes("offline")) {
    return "The provider could not be reached. Check your connection, then retry.";
  }
  if (normalized.includes("schema") || normalized.includes("invalid") || normalized.includes("evidence")) {
    return "Gemini returned an unsafe or malformed revision. Your current script is unchanged. Retry to request a corrected response.";
  }
  return message || fallback;
}

function parseRegenerationResponse(
  value: unknown,
  allowedEvidenceClaimIds: readonly string[],
): ScriptRegenerationResponse {
  if (!value || typeof value !== "object") throw new Error("Invalid regeneration response");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.content !== "string" || !candidate.content.trim()) {
    throw new Error("Invalid regeneration response content");
  }
  if (!Array.isArray(candidate.evidenceClaimIds) || !candidate.evidenceClaimIds.every((id) => typeof id === "string")) {
    throw new Error("Invalid regeneration evidence schema");
  }
  const allowed = new Set(allowedEvidenceClaimIds);
  const unsupported = candidate.evidenceClaimIds.find((id) => !allowed.has(id as string));
  if (unsupported) throw new Error(`Regeneration cited unsupported evidence claim: ${unsupported}`);
  return { content: candidate.content, evidenceClaimIds: candidate.evidenceClaimIds as string[] };
}

function stripMarkdown(text: string): string {
  let result = text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^---+\s*$/gm, '')
    .replace(/^\*{3,}\s*$/gm, '')
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`{3}[\s\S]*?`{3}/g, '')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '');

  if (result.match(/^(HOOK|INTRO|INTRODUCTION|MAIN|CONTENT|BODY|CTA|CALL|OUTRO|CONCLUSION|SCRIPT|CLOSING|SOLUTION)/i)) {
    return '';
  }

  return result.trim();
}

function isSectionHeader(line: string): { isHeader: boolean; name: string; timestamp?: string } {
  const trimmed = line.trim();

  const sectionKeywords = [
    { patterns: [/HOOK/i, /\bOPENING\b/i], name: "HOOK" },
    { patterns: [/INTRO/i, /INTRODUCTION/i, /SOLUTION\s*PROMISE/i], name: "INTRODUCTION" },
    { patterns: [/MAIN\s*CONTENT/i, /\bBODY\b/i, /\bCONTENT\b/i, /\bSTEP/i], name: "MAIN CONTENT" },
    { patterns: [/CALL[\s-]*TO[\s-]*ACTION/i, /\bCTA\b/i, /OUTRO/i, /CONCLUSION/i, /CLOSING/i], name: "CALL-TO-ACTION" },
  ];

  const isHeading = /^#{1,6}\s/.test(trimmed) || /^\[?\d{1,2}:\d{2}/.test(trimmed);
  const hasKeyword = sectionKeywords.some(section =>
    section.patterns.some(p => p.test(trimmed))
  );

  if (hasKeyword) {
    const timestampMatch = trimmed.match(/\[?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?)\]?/);

    for (const section of sectionKeywords) {
      if (section.patterns.some(p => p.test(trimmed))) {
        return {
          isHeader: true,
          name: section.name,
          timestamp: timestampMatch ? timestampMatch[1] : undefined
        };
      }
    }
  }

  return { isHeader: false, name: "" };
}

function parseParagraph(line: string, index: number): ScriptParagraph | null {
  const trimmed = line.trim();

  if (!trimmed) return null;
  if (trimmed === '---' || /^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) return null;
  if (/^#{1,6}\s/.test(trimmed)) return null;

  const { isHeader } = isSectionHeader(trimmed);
  if (isHeader) return null;

  const dialogueMatch = trimmed.match(/^\*\*([A-Z\s]+)\s*\(([^)]+)\):\*\*\s*(.+)$/i) ||
                        trimmed.match(/^\*\*([A-Z\s]+):\*\*\s*\(([^)]+)\)\s*(.+)$/i);
  if (dialogueMatch) {
    return {
      id: `p-${index}`,
      type: 'dialogue',
      speaker: dialogueMatch[1].trim(),
      tone: dialogueMatch[2].trim(),
      content: stripMarkdown(dialogueMatch[3]),
    };
  }

  const simpleDialogueMatch = trimmed.match(/^\*\*([A-Z\s]+):\*\*\s*(.+)$/i);
  if (simpleDialogueMatch) {
    return {
      id: `p-${index}`,
      type: 'dialogue',
      speaker: simpleDialogueMatch[1].trim(),
      content: stripMarkdown(simpleDialogueMatch[2]),
    };
  }

  if (trimmed.match(/^\(.*\)$/) || trimmed.match(/^\[.*visual.*\]$/i) ||
      trimmed.toLowerCase().includes('text overlay') ||
      trimmed.toLowerCase().includes('on screen') ||
      trimmed.toLowerCase().includes('creator ')) {
    let content = stripMarkdown(trimmed);
    if (content.startsWith('(') && content.endsWith(')')) {
      content = content.slice(1, -1);
    }
    return {
      id: `p-${index}`,
      type: 'stage-direction',
      content,
    };
  }

  if (trimmed.match(/^\[.*\]$/) || trimmed.toLowerCase().includes('b-roll') ||
      trimmed.toLowerCase().includes('footage') || trimmed.toLowerCase().includes('cut to')) {
    let content = stripMarkdown(trimmed);
    if (content.startsWith('[') && content.endsWith(']')) {
      content = content.slice(1, -1);
    }
    return {
      id: `p-${index}`,
      type: 'b-roll',
      content,
    };
  }

  if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || /^\d+\.\s/.test(trimmed)) {
    return {
      id: `p-${index}`,
      type: 'bullet',
      content: stripMarkdown(trimmed.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '')),
    };
  }

  const cleanContent = stripMarkdown(trimmed);
  if (!cleanContent) return null;

  return {
    id: `p-${index}`,
    type: 'text',
    content: cleanContent,
  };
}

function parseScriptIntoSections(script: string): ScriptSection[] {
  const sections: ScriptSection[] = [];
  const lines = script.split('\n');
  let currentSection: ScriptSection | null = null;
  let paragraphIndex = 0;

  for (const line of lines) {
    const headerCheck = isSectionHeader(line);

    if (headerCheck.isHeader) {
      if (currentSection && currentSection.paragraphs.length > 0) {
        sections.push(currentSection);
      }

      currentSection = {
        name: headerCheck.name,
        timestamp: headerCheck.timestamp,
        paragraphs: [],
      };
    } else {
      const paragraph = parseParagraph(line, paragraphIndex++);
      if (paragraph) {
        if (!currentSection) {
          currentSection = { name: "SCRIPT", paragraphs: [] };
        }
        currentSection.paragraphs.push(paragraph);
      }
    }
  }

  if (currentSection && currentSection.paragraphs.length > 0) {
    sections.push(currentSection);
  }

  if (sections.length === 0 && script.trim()) {
    const paragraphs: ScriptParagraph[] = [];
    script.split('\n').forEach((line, i) => {
      const p = parseParagraph(line, i);
      if (p) paragraphs.push(p);
    });
    if (paragraphs.length > 0) {
      sections.push({ name: "FULL SCRIPT", paragraphs });
    }
  }

  return sections;
}

function ParagraphRenderer({ paragraph, onRegenerate, isRegenerating, onEdit }: {
  paragraph: ScriptParagraph;
  onRegenerate?: (content: string) => void;
  isRegenerating?: boolean;
  onEdit?: (paragraphId: string, newContent: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(paragraph.content);
  const { toast } = useToast();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(paragraph.content);
    toast({ title: "Copied to clipboard" });
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContent(paragraph.content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (onEdit && editContent !== paragraph.content) {
      onEdit(paragraph.id, editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(paragraph.content);
    setIsEditing(false);
  };

  const renderContent = () => {
    switch (paragraph.type) {
      case 'dialogue':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20">
                {paragraph.speaker}
              </Badge>
              {paragraph.tone && (
                <span className="text-xs text-muted-foreground italic">({paragraph.tone})</span>
              )}
            </div>
            <p className="text-foreground leading-relaxed pl-2 border-l-2 border-primary/30">
              {paragraph.content}
            </p>
          </div>
        );

      case 'stage-direction':
        return (
          <div className="flex items-start gap-2 bg-muted/40 px-4 py-2 rounded-lg">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide mt-0.5">Direction:</span>
            <p className="text-sm italic text-muted-foreground flex-1">{paragraph.content}</p>
          </div>
        );

      case 'b-roll':
        return (
          <div className="flex items-start gap-2 bg-primary/5 px-4 py-2 rounded-lg border-l-3 border-primary/40">
            <span className="text-primary/70 text-xs font-medium uppercase tracking-wide mt-0.5">B-Roll:</span>
            <p className="text-sm text-primary/80 flex-1">{paragraph.content}</p>
          </div>
        );

      case 'bullet':
        return (
          <div className="flex items-start gap-3 pl-2">
            <span className="text-primary mt-1.5 text-sm">•</span>
            <p className="text-foreground leading-relaxed flex-1">{paragraph.content}</p>
          </div>
        );

      default:
        return (
          <p className="text-foreground leading-relaxed">{paragraph.content}</p>
        );
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-2 p-3 rounded-lg border border-primary/30 bg-muted/30">
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="min-h-[100px] resize-none text-sm"
          autoFocus
          data-testid="textarea-edit-paragraph"
        />
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={handleCancelEdit} data-testid="button-cancel-edit">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSaveEdit} data-testid="button-save-edit">
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-2 rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
      {renderContent()}
      {!isRegenerating && (
        <div className="flex flex-wrap justify-end gap-1 border-t border-border/50 pt-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={handleCopy}
            aria-label="Copy paragraph"
            data-testid="button-copy-paragraph"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
          {onEdit && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={handleStartEdit}
              aria-label="Edit paragraph"
              data-testid="button-edit-paragraph"
            >
              <Type className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          {onRegenerate && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => onRegenerate(paragraph.content)}
              aria-label="Rewrite paragraph with grounded evidence"
              data-testid="button-rewrite-paragraph"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Rewrite
            </Button>
          )}
        </div>
      )}
      {isRegenerating && (
        <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          Rewriting paragraph...
        </div>
      )}
    </div>
  );
}

function SectionRenderer({ section, onRegenerateSection, onRegenerateParagraph, onEditParagraph, isRegenerating, regeneratingParagraphId }: {
  section: ScriptSection;
  onRegenerateSection: () => void;
  onRegenerateParagraph: (paragraphId: string, content: string) => void;
  onEditParagraph: (paragraphId: string, newContent: string) => void;
  isRegenerating: boolean;
  regeneratingParagraphId: string | null;
}) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="text-xs font-semibold">
              {section.name}
            </Badge>
            {section.timestamp && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {section.timestamp}
              </Badge>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRegenerateSection}
            disabled={isRegenerating}
            className="h-7 text-xs"
            data-testid={`button-regenerate-section-${section.name.toLowerCase().replace(/\s+/g, '-')}`}
            aria-label={`Regenerate ${section.name} with grounded evidence`}
          >
            {isRegenerating ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {section.paragraphs.map((paragraph) => (
          <ParagraphRenderer
            key={paragraph.id}
            paragraph={paragraph}
            onRegenerate={(content) => onRegenerateParagraph(paragraph.id, content)}
            onEdit={(paragraphId, newContent) => onEditParagraph(paragraphId, newContent)}
            isRegenerating={regeneratingParagraphId === paragraph.id}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface FlowingScriptElement {
  id: string;
  type: 'speech' | 'direction';
  timestamp?: string;
  tone?: string;
  content: string;
}

function cleanSpeechContent(text: string): string {
  let content = text;

  content = content.replace(/^\*\*(SPEAKER|HOST|VO|NARRATOR|VOICE|CREATOR):\*\*\s*/i, '');
  content = content.replace(/^(SPEAKER|HOST|VO|NARRATOR|VOICE|CREATOR):\s*/i, '');

  content = content.replace(/\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?)\]\s*/g, '');
  content = content.replace(/\((\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?)\)\s*/g, '');

  content = content.replace(/\([^)]*(?:camera|shot|close-up|wide|zoom|pan|transition|overlay|screen|visual)[^)]*\)/gi, '');

  return stripMarkdown(content).trim();
}

function extractTimestamp(text: string): string | null {
  const bracketMatch = text.match(/\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?)\]/);
  if (bracketMatch) return bracketMatch[1];

  const parenMatch = text.match(/^\((\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?)\)/);
  if (parenMatch) return parenMatch[1];

  return null;
}

function isDirectionContent(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('visual:') ||
    lower.includes('visual transition') ||
    lower.includes('camera ') ||
    lower.includes('cut to') ||
    lower.includes('zoom ') ||
    lower.includes('pan ') ||
    lower.includes('transition:') ||
    lower.includes('b-roll') ||
    lower.includes('footage') ||
    lower.includes('text overlay') ||
    lower.includes('on screen') ||
    lower.includes('graphic') ||
    lower.includes('animation') ||
    (text.startsWith('[') && (lower.includes('open') || lower.includes('shot') || lower.includes('close')))
  );
}

function isToneOrPersonaLine(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    text.startsWith('(') &&
    text.endsWith(')') &&
    (
      lower.includes('voice') ||
      lower.includes('tone') ||
      lower.includes('persona') ||
      lower.includes('storyteller') ||
      lower.includes('delivery') ||
      lower.includes('style')
    )
  );
}

function parseScriptToFlowingElements(script: string): FlowingScriptElement[] {
  const elements: FlowingScriptElement[] = [];
  let elementIndex = 0;

  const pushDirection = (content: string, timestamp?: string) => {
    const cleaned = stripMarkdown(content.replace(/^\[|\]$/g, "").trim());
    if (!cleaned) return;
    elements.push({ id: `el-${elementIndex++}`, type: "direction", timestamp, content: cleaned });
  };

  for (const line of script.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === '---' || /^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) continue;
    if (/^#{1,6}\s/.test(trimmed)) continue;

    const sectionKeywords = /^(HOOK|INTRO|INTRODUCTION|MAIN|CONTENT|BODY|CTA|CALL|OUTRO|CONCLUSION|SCRIPT|CLOSING|SOLUTION|OPENING)(?:\s*[:\-]|\s*$)/i;
    if (sectionKeywords.test(trimmed.replace(/[#*[\]]/g, ''))) continue;

    const timestamp = extractTimestamp(trimmed) || undefined;
    let working = trimmed
      .replace(/^\[\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?\]\s*/, '')
      .replace(/^\(\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?\)\s*/, '');
    let tone: string | undefined;

    const leadingParenthetical = working.match(/^\(([^)]+)\)\s*/);
    if (leadingParenthetical) {
      const remainder = working.slice(leadingParenthetical[0].length).trim();
      if (!remainder) {
        pushDirection(leadingParenthetical[1], timestamp);
        continue;
      }
      tone = leadingParenthetical[1].trim();
      working = remainder;
    }

    const directions: string[] = [];
    working = working.replace(/\[([^\]]+)\]/g, (_match, content: string) => {
      directions.push(content.trim());
      return ' ';
    });
    working = working.replace(/\(([^)]+)\)/g, (match, content: string) => {
      if (!isDirectionContent(content)) return match;
      directions.push(content.trim());
      return ' ';
    });

    const dialogueMatch = working.match(/^\*\*([A-Z\s]+):\*\*\s*(.+)$/i);
    if (dialogueMatch) working = dialogueMatch[2];
    const speech = cleanSpeechContent(working.replace(/\s{2,}/g, ' ').trim());

    if (speech) {
      elements.push({ id: `el-${elementIndex++}`, type: "speech", timestamp, tone, content: speech });
    } else if (working.trim() && isDirectionContent(working)) {
      directions.unshift(working.trim());
    }
    directions.forEach((direction) => pushDirection(direction, timestamp));
  }

  return elements;
}

function FlowingScriptRenderer({ script }: { script: string }) {
  const elements = useMemo(() => parseScriptToFlowingElements(script), [script]);
  const { toast } = useToast();

  const handleCopyElement = async (content: string) => {
    await navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  };

  if (elements.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-8">
        No script content to display
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="flowing-script-container">
      {elements.map((element) => (
        <div key={element.id} className="relative space-y-2">
          {element.type === 'speech' ? (
            <div className="space-y-2">
              {(element.timestamp || element.tone) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {element.timestamp && (
                    <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/30">
                      <Clock className="h-3 w-3 mr-1" />
                      {element.timestamp}
                    </Badge>
                  )}
                  {element.tone && (
                    <span className="text-xs text-muted-foreground italic">
                      ({element.tone})
                    </span>
                  )}
                </div>
              )}
              <p className="text-foreground leading-relaxed pl-0.5">
                {element.content}
              </p>
            </div>
          ) : (
            <div className="bg-muted/60 rounded-lg px-4 py-3 border-l-4 border-muted-foreground/30">
              <div className="flex items-start gap-3">
                <span className="text-muted-foreground text-sm font-semibold uppercase tracking-wide shrink-0">
                  DIRECTION:
                </span>
                <p className="text-sm italic text-muted-foreground flex-1">
                  {element.content}
                </p>
              </div>
            </div>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto flex h-8 px-2 text-xs"
            onClick={() => handleCopyElement(element.content)}
            aria-label="Copy script block"
            data-testid={`button-copy-element-${element.id}`}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
        </div>
      ))}
    </div>
  );
}

function Teleprompter({ script, onSave }: { script: string; onSave: (script: string) => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousFrameRef = useRef<number | null>(null);
  const scrollPositionRef = useRef(0);
  const elements = useMemo(() => parseScriptToFlowingElements(script), [script]);
  const spokenWordCount = useMemo(() => elements
    .filter((element) => element.type === "speech")
    .reduce((count, element) => count + (element.content.trim() ? element.content.trim().split(/\s+/).length : 0), 0), [elements]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState("150");
  const [fontSize, setFontSize] = useState(40);
  const [progress, setProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [showCues, setShowCues] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [draft, setDraft] = useState(script);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  useEffect(() => setDraft(script), [script]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === cardRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isPlaying || isEditing) return;

    const tick = (timestamp: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const previous = previousFrameRef.current ?? timestamp;
      const elapsed = Math.min(timestamp - previous, 100);
      previousFrameRef.current = timestamp;
      const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

      if (maximum === 0 || scrollPositionRef.current >= maximum - 1) {
        viewport.scrollTop = maximum;
        scrollPositionRef.current = maximum;
        setProgress(maximum === 0 ? 0 : 100);
        setIsPlaying(false);
        previousFrameRef.current = null;
        return;
      }

      const readingDuration = Math.max(1000, (Math.max(1, spokenWordCount) / Number(speed)) * 60_000);
      const pixelsPerMillisecond = maximum / readingDuration;
      scrollPositionRef.current = Math.min(maximum, scrollPositionRef.current + elapsed * pixelsPerMillisecond);
      viewport.scrollTop = scrollPositionRef.current;
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      previousFrameRef.current = null;
    };
  }, [isEditing, isPlaying, speed, spokenWordCount]);

  const updateProgress = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (!isPlaying) scrollPositionRef.current = viewport.scrollTop;
    const maximum = viewport.scrollHeight - viewport.clientHeight;
    setProgress(maximum > 0 ? Math.min(100, (viewport.scrollTop / maximum) * 100) : 0);
  };

  const restart = () => {
    setIsPlaying(false);
    const viewport = viewportRef.current;
    scrollPositionRef.current = 0;
    if (viewport) viewport.scrollTo({ top: 0, behavior: "auto" });
    setProgress(0);
  };

  const togglePlayback = () => {
    if (isEditing) return;
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    const viewport = viewportRef.current;
    if (viewport) {
      const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      if (viewport.scrollTop >= maximum - 1) {
        viewport.scrollTop = 0;
        scrollPositionRef.current = 0;
        setProgress(0);
      } else {
        scrollPositionRef.current = viewport.scrollTop;
      }
    }
    setIsPlaying(true);
  };

  const beginEditing = () => {
    setIsPlaying(false);
    if (document.fullscreenElement) void document.exitFullscreen();
    setDraft(script);
    setIsEditing(true);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await cardRef.current?.requestFullscreen();
  };

  const saveEdit = () => {
    const nextScript = draft.trim();
    if (!nextScript) return;
    if (nextScript === script) {
      setIsEditing(false);
      return;
    }
    setUndoStack((history) => [...history.slice(-19), script]);
    setRedoStack([]);
    onSave(nextScript);
    setIsEditing(false);
    restart();
  };

  const undoSavedEdit = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setUndoStack((history) => history.slice(0, -1));
    setRedoStack((history) => [script, ...history].slice(0, 20));
    setDraft(previous);
    onSave(previous);
    restart();
  };

  const redoSavedEdit = () => {
    const next = redoStack[0];
    if (!next) return;
    setRedoStack((history) => history.slice(1));
    setUndoStack((history) => [...history.slice(-19), script]);
    setDraft(next);
    onSave(next);
    restart();
  };

  return (
    <Card ref={cardRef} className="overflow-hidden border-white/10 bg-[#050505] text-white shadow-xl fullscreen:h-screen fullscreen:w-screen fullscreen:rounded-none fullscreen:border-0">
      <div className="h-1 bg-white/10" aria-hidden="true">
        <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0b0b0b] px-3 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="lg"
            className="min-w-28 rounded-full"
            onClick={togglePlayback}
            disabled={isEditing}
            data-testid="button-teleprompter-play"
          >
            {isPlaying ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button type="button" size="icon" variant="outline" onClick={restart} aria-label="Restart teleprompter" data-testid="button-teleprompter-restart">
            <SkipBack className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={speed} onValueChange={setSpeed} disabled={isEditing}>
            <SelectTrigger className="h-10 w-[116px]" aria-label="Reading speed" data-testid="select-teleprompter-speed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="100">100 wpm</SelectItem>
              <SelectItem value="125">125 wpm</SelectItem>
              <SelectItem value="150">150 wpm</SelectItem>
              <SelectItem value="175">175 wpm</SelectItem>
              <SelectItem value="200">200 wpm</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-md border border-border">
            <Button type="button" size="icon" variant="ghost" className="rounded-r-none" onClick={() => setFontSize((size) => Math.max(24, size - 2))} disabled={isEditing || fontSize <= 24} aria-label="Decrease text size">
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-12 text-center text-xs text-muted-foreground" aria-live="polite">{fontSize}px</span>
            <Button type="button" size="icon" variant="ghost" className="rounded-l-none" onClick={() => setFontSize((size) => Math.min(48, size + 2))} disabled={isEditing || fontSize >= 48} aria-label="Increase text size">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {!isEditing && <>
            <div className="flex items-center rounded-md border border-border">
              <Button type="button" size="icon" variant="ghost" className="rounded-r-none" onClick={undoSavedEdit} disabled={undoStack.length === 0} aria-label="Undo saved script edit" title="Undo saved edit"><Undo2 className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="ghost" className="rounded-l-none" onClick={redoSavedEdit} disabled={redoStack.length === 0} aria-label="Redo saved script edit" title="Redo saved edit"><Redo2 className="h-4 w-4" /></Button>
            </div>
            <Button type="button" size="icon" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => setShowCues((visible) => !visible)} aria-label={showCues ? "Hide production cues" : "Show production cues"} title={showCues ? "Hide cues" : "Show cues"}>
              {showCues ? <Captions className="h-4 w-4" /> : <CaptionsOff className="h-4 w-4" />}
            </Button>
            <Button type="button" size="icon" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? "Exit fullscreen teleprompter" : "Open fullscreen teleprompter"} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="outline" onClick={beginEditing} data-testid="button-edit-script"><Pencil className="mr-2 h-4 w-4" />Edit</Button>
          </>}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3 p-4 sm:p-6">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-[min(65vh,680px)] resize-y font-sans text-lg leading-8"
            aria-label="Edit full script"
            data-testid="textarea-edit-full-script"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => { setDraft(script); setIsEditing(false); }}><ArrowLeft className="mr-2 h-4 w-4" />Back without saving</Button>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground">Ctrl+Z undoes typing. Ctrl+Shift+Z redoes it.</span>
              <Button type="button" onClick={saveEdit} disabled={!draft.trim()} data-testid="button-save-full-script"><Save className="mr-2 h-4 w-4" />Save script</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative bg-black">
          <div className="pointer-events-none absolute inset-x-0 top-[42%] z-10 h-28 -translate-y-1/2 border-y border-primary/15 bg-primary/[0.025]" aria-hidden="true">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 border-y-[7px] border-l-[10px] border-y-transparent border-l-primary/70" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 border-y-[7px] border-r-[10px] border-y-transparent border-r-primary/70" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black to-transparent" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black to-transparent" aria-hidden="true" />
          <div
          ref={viewportRef}
          className="teleprompter-scrollbar h-[min(68vh,760px)] min-h-[440px] overflow-y-auto overscroll-contain bg-black px-8 sm:px-14 lg:px-20 fullscreen:h-[calc(100vh-69px)]"
          onScroll={updateProgress}
          onKeyDown={(event) => {
            if (event.code === "Space") {
              event.preventDefault();
              togglePlayback();
            }
          }}
          tabIndex={0}
          aria-label="Teleprompter script. Press Space to play or pause."
          data-testid="teleprompter-viewport"
        >
          <div className="mx-auto max-w-5xl space-y-12 pb-[58vh] pt-[32vh]">
            {elements.length > 0 ? elements.map((element) => element.type === "speech" ? (
              <div key={element.id} className="space-y-3 text-center">
                {showCues && (element.tone || element.timestamp) && <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary/70">{element.timestamp ? `${element.timestamp} ` : ""}{element.tone}</p>}
                <p className="font-semibold tracking-[0.01em] text-white" style={{ fontSize: `${fontSize}px`, lineHeight: 1.55 }}>{element.content}</p>
              </div>
            ) : showCues ? (
              <p key={element.id} className="mx-auto max-w-3xl rounded-lg border border-amber-300/15 bg-amber-200/[0.04] px-4 py-3 text-center text-base italic text-amber-100/65">{element.content}</p>
            ) : null) : (
              <p className="text-center text-white/55">No readable script content was found.</p>
            )}
          </div>
        </div>
        </div>
      )}
    </Card>
  );
}

function getSectionContentAsText(section: ScriptSection): string {
  return section.paragraphs.map(p => {
    if (p.type === 'dialogue') {
      return `${p.speaker}${p.tone ? ` (${p.tone})` : ''}: ${p.content}`;
    }
    if (p.type === 'stage-direction') {
      return `(${p.content})`;
    }
    if (p.type === 'b-roll') {
      return `[B-Roll: ${p.content}]`;
    }
    if (p.type === 'bullet') {
      return `• ${p.content}`;
    }
    return p.content;
  }).join('\n\n');
}

function mapFormatToEnum(format: string): VideoFormat {
  const formatLower = format.toLowerCase();
  if (formatLower.includes("short")) return VideoFormat.SHORT;
  if (formatLower.includes("tutorial") || formatLower.includes("how")) return VideoFormat.TUTORIAL;
  if (formatLower.includes("review")) return VideoFormat.REVIEW;
  if (formatLower.includes("vlog")) return VideoFormat.VLOG;
  return VideoFormat.LONG_FORM;
}

function mapAudienceToEnum(audience: string): TargetAudience {
  const audienceLower = audience.toLowerCase();
  if (audienceLower.includes("beginner") || audienceLower.includes("newcomer")) return TargetAudience.BEGINNERS;
  if (audienceLower.includes("professional") || audienceLower.includes("expert") || audienceLower.includes("advanced")) return TargetAudience.PROFESSIONALS;
  if (audienceLower.includes("tech")) return TargetAudience.TECH_SAVVY;
  return TargetAudience.GENERAL;
}

export default function ScriptPage() {
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [regeneratingTitles, setRegeneratingTitles] = useState(false);
  const [actionError, setActionError] = useState<ScriptActionError | null>(null);
  const retryActionRef = useRef<null | (() => void)>(null);
  const restoredWorkflowRef = useRef<string | null>(null);
  const { toast } = useToast();
  const { state: workflowState, setScriptData, clearScriptCache, goToStep } = useWorkflow();
  const [, setLocation] = useLocation();

  const reportActionError = (title: string, error: unknown, retry: () => void) => {
    const message = providerAwareScriptError(error, "The script action failed. Your existing work is unchanged.");
    retryActionRef.current = retry;
    setActionError({ title, message });
    toast({ title, description: message, variant: "destructive" });
  };

  const clearActionError = () => {
    retryActionRef.current = null;
    setActionError(null);
  };

  const form = useForm<ScriptInput>({
    resolver: zodResolver(scriptInputSchema),
    defaultValues: {
      topic: "",
      format: VideoFormat.LONG_FORM,
      audience: TargetAudience.GENERAL,
      persona: CreatorPersona.NONE,
      customPersona: "",
      additionalNotes: "",
    },
  });

  const selectedPersona = form.watch("persona");

  useEffect(() => {
    if (restoredWorkflowRef.current === workflowState.id) return;
    restoredWorkflowRef.current = workflowState.id;
    const cached = workflowState.cachedScript;
    if (!cached?.script) return;
    form.reset({
      topic: cached.topic,
      format: cached.format as VideoFormat,
      audience: cached.audience as TargetAudience,
      persona: (cached.persona || CreatorPersona.NONE) as CreatorPersona,
      customPersona: cached.customPersona || "",
      additionalNotes: cached.additionalNotes || "",
    });
    setResult(cached.result || {
      script: cached.script,
      titles: cached.title ? [cached.title] : undefined,
      hook: "",
      structure: [],
      payoff: "",
      primaryCta: "",
      studioValidation: "",
      metadata: {
        wordCount: cached.wordCount || cached.script.trim().split(/\s+/).length,
        estimatedDuration: cached.estimatedDuration || "",
        generatedAt: new Date(cached.timestamp).toISOString(),
      },
      evidenceContext: cached.evidenceContext,
    });
  }, [form, workflowState.id]);

  useEffect(() => {
    if (workflowState.isWorkflowActive && workflowState.idea?.selectedIdea && !workflowState.cachedScript) {
      const idea = workflowState.idea.selectedIdea;
      form.setValue("topic", idea.title);
      form.setValue("format", mapFormatToEnum(idea.format));
      form.setValue("audience", mapAudienceToEnum(workflowState.idea.audience));

      const notesSections: string[] = [];

      notesSections.push(`**SELECTED PACKAGE:**\n${idea.description}`);
      notesSections.push(`**HONEST PROMISE:** ${idea.honestPromise}`);
      notesSections.push(`**DISCOVERY SURFACE:** ${idea.discoverySurface}`);
      notesSections.push(`**PAYOFF:** ${idea.payoff}`);
      notesSections.push(`**THUMBNAIL CONCEPT:** ${idea.thumbnailConcept}`);
      notesSections.push(`**STUDIO VALIDATION:** ${idea.studioMetric}`);
      notesSections.push(`**EXPERIMENT RULE:** ${idea.experimentRule}`);
      notesSections.push(`**FOCUS TOPICS:** ${idea.keywords.join(", ")}`);

      form.setValue("additionalNotes", notesSections.join("\n\n"));

      toast({
        title: "Idea Loaded",
        description: `"${idea.title}" has been loaded with research insights. Ready to generate your script!`,
      });
    }
  }, [workflowState.isWorkflowActive, workflowState.idea, form, toast]);

  useEffect(() => {
    if (result?.script) {
      setSections(parseScriptIntoSections(result.script));
    }
  }, [result?.script]);

  const generateMutation = useMutation({
    mutationFn: async (data: ScriptInput) => {
      const response = await apiRequest("POST", "/api/script/generate", {
        ...data,
        evidenceContext: workflowState.idea?.evidenceContext,
      });
      return response as ScriptResult;
    },
    onSuccess: (data) => {
      clearActionError();
      setResult(data);

      // Cache script data for Thumbnail Creator
      const formValues = form.getValues();
      setScriptData({
        script: data.script,
        topic: formValues.topic,
        title: data.titles?.[0],
        format: formValues.format,
        audience: formValues.audience,
        persona: formValues.persona,
        customPersona: formValues.customPersona,
        additionalNotes: formValues.additionalNotes,
        keywords: workflowState.idea?.selectedIdea?.keywords,
        wordCount: data.metadata?.wordCount,
        estimatedDuration: data.metadata?.estimatedDuration,
        timestamp: Date.now(),
        evidenceContext: data.evidenceContext,
        result: data,
      });

      toast({
        title: "Script Generated",
        description: `Your ${form.getValues("format")} script is ready!`,
      });
    },
    onError: (error: Error, variables) => {
      reportActionError("Script generation failed", error, () => generateMutation.mutate(variables));
    },
  });

  const onSubmit = (data: ScriptInput) => {
    const cleanedData = {
      ...data,
      customPersona: data.persona === CreatorPersona.OTHER
        ? data.customPersona?.trim()
        : undefined,
    };
    generateMutation.mutate(cleanedData);
  };

  const handleCopy = async () => {
    if (result?.script) {
      await navigator.clipboard.writeText(result.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied to clipboard",
        description: "Script has been copied to your clipboard.",
      });
    }
  };

  const handleReset = () => {
    clearActionError();
    clearScriptCache();
    setResult(null);
    setSections([]);
    setDetailsOpen(false);
    form.reset();
  };

  const handleRegenerateTitles = async () => {
    if (!result) return;

    setRegeneratingTitles(true);
    clearActionError();
    try {
      const response = await apiRequest("POST", "/api/script/regenerate-titles", {
        topic: form.getValues("topic"),
        format: form.getValues("format"),
        audience: form.getValues("audience"),
        evidenceContext: workflowState.idea?.evidenceContext,
      }) as { titles: string[] };

      const updatedResult = { ...result, titles: response.titles };
      setResult(updatedResult);
      const formValues = form.getValues();
      setScriptData({
        script: result.script,
        topic: formValues.topic,
        title: response.titles[0],
        format: formValues.format,
        audience: formValues.audience,
        persona: formValues.persona,
        customPersona: formValues.customPersona,
        additionalNotes: formValues.additionalNotes,
        keywords: workflowState.idea?.selectedIdea?.keywords,
        wordCount: result.metadata.wordCount,
        estimatedDuration: result.metadata.estimatedDuration,
        timestamp: Date.now(),
        evidenceContext: workflowState.idea?.evidenceContext,
        result: updatedResult,
      });
      toast({
        title: "Titles Regenerated",
        description: "New title suggestions are ready!",
      });
    } catch (error: unknown) {
      reportActionError("Title regeneration failed", error, () => void handleRegenerateTitles());
    } finally {
      setRegeneratingTitles(false);
    }
  };

  const [regeneratingParagraph, setRegeneratingParagraph] = useState<string | null>(null);

  const persistScriptRevision = (updatedScript: string) => {
    const wordCount = updatedScript.trim() ? updatedScript.trim().split(/\s+/).length : 0;
    const updatedResult = result ? {
      ...result,
      script: updatedScript,
      metadata: { ...result.metadata, wordCount },
    } : null;
    setResult(updatedResult);
    const formValues = form.getValues();
    setScriptData({
      script: updatedScript,
      topic: formValues.topic,
      title: result?.titles?.[0],
      format: formValues.format,
      audience: formValues.audience,
      persona: formValues.persona,
      customPersona: formValues.customPersona,
      additionalNotes: formValues.additionalNotes,
      keywords: workflowState.idea?.selectedIdea?.keywords,
      wordCount,
      estimatedDuration: result?.metadata.estimatedDuration,
      timestamp: Date.now(),
      evidenceContext: workflowState.idea?.evidenceContext,
      result: updatedResult || undefined,
    });
  };

  const handleEditParagraph = (sectionName: string, paragraphId: string, newContent: string) => {
    const updatedSections = sections.map(s => {
      if (s.name !== sectionName) return s;
      return {
        ...s,
        paragraphs: s.paragraphs.map(p =>
          p.id === paragraphId ? { ...p, content: newContent } : p
        ),
      };
    });
    setSections(updatedSections);

    const updatedScript = updatedSections.map(s =>
      `### ${s.name}${s.timestamp ? ` [${s.timestamp}]` : ''}\n${getSectionContentAsText(s)}`
    ).join('\n\n');

    persistScriptRevision(updatedScript);

    toast({
      title: "Paragraph Updated",
      description: "Your edit has been saved.",
    });
  };

  const handleRegenerateSection = async (sectionName: string) => {
    const section = sections.find(s => s.name === sectionName);
    if (!section) return;

    const sectionContent = getSectionContentAsText(section);
    setRegeneratingSection(sectionName);
    clearActionError();
    try {
      const responseValue = await apiRequest("POST", "/api/script/regenerate-section", {
        sectionName,
        sectionContent,
        topic: form.getValues("topic"),
        format: form.getValues("format"),
        audience: form.getValues("audience"),
        additionalNotes: form.getValues("additionalNotes"),
        evidenceContext: workflowState.idea?.evidenceContext,
      });
      const response = parseRegenerationResponse(
        responseValue,
        workflowState.idea?.evidenceContext?.evidenceClaims.map((claim) => claim.id) || [],
      );

      const newParagraphs: ScriptParagraph[] = [];
      response.content.split('\n').forEach((line, i) => {
        const p = parseParagraph(line, i);
        if (p) newParagraphs.push(p);
      });

      const updatedSections = sections.map(s =>
        s.name === sectionName ? { ...s, paragraphs: newParagraphs } : s
      );
      setSections(updatedSections);

      const updatedScript = updatedSections.map(s =>
        `### ${s.name}${s.timestamp ? ` [${s.timestamp}]` : ''}\n${getSectionContentAsText(s)}`
      ).join('\n\n');

      persistScriptRevision(updatedScript);

      toast({
        title: "Section Regenerated",
        description: `${sectionName} section has been updated!`,
      });
    } catch (error: unknown) {
      reportActionError(`Could not regenerate ${sectionName}`, error, () => void handleRegenerateSection(sectionName));
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleRegenerateParagraph = async (sectionName: string, paragraphId: string, content: string) => {
    setRegeneratingParagraph(paragraphId);
    clearActionError();
    try {
      const responseValue = await apiRequest("POST", "/api/script/regenerate-paragraph", {
        sectionName,
        paragraphId,
        paragraphContent: content,
        topic: form.getValues("topic"),
        format: form.getValues("format"),
        audience: form.getValues("audience"),
        evidenceContext: workflowState.idea?.evidenceContext,
      });
      const response = parseRegenerationResponse(
        responseValue,
        workflowState.idea?.evidenceContext?.evidenceClaims.map((claim) => claim.id) || [],
      );

      const updatedSections = sections.map(s => {
        if (s.name !== sectionName) return s;
        return {
          ...s,
          paragraphs: s.paragraphs.map(p =>
            p.id === paragraphId ? { ...p, content: stripMarkdown(response.content) } : p
          ),
        };
      });
      setSections(updatedSections);
      const updatedScript = updatedSections.map(s =>
        `### ${s.name}${s.timestamp ? ` [${s.timestamp}]` : ''}\n${getSectionContentAsText(s)}`
      ).join('\n\n');
      persistScriptRevision(updatedScript);

      toast({
        title: "Paragraph Rewritten",
        description: "The paragraph has been updated!",
      });
    } catch (error: unknown) {
      reportActionError("Could not rewrite paragraph", error, () => void handleRegenerateParagraph(sectionName, paragraphId, content));
    } finally {
      setRegeneratingParagraph(null);
    }
  };


  const handleDownloadPDF = () => {
    if (!result) return;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
    };

    pdf.setFillColor(255, 0, 0);
    pdf.rect(0, 0, pageWidth, 25, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("YouTube Script", margin, 16);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    pdf.text(date, pageWidth - margin - pdf.getTextWidth(date), 16);

    y = 35;

    pdf.setTextColor(30, 30, 30);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    const topic = form.getValues("topic");
    const topicLines = pdf.splitTextToSize(topic, contentWidth);
    topicLines.forEach((line: string) => {
      pdf.text(line, margin, y);
      y += 6;
    });
    y += 5;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 100, 100);
    pdf.text(`${result.metadata.wordCount} words • ${result.metadata.estimatedDuration}`, margin, y);
    y += 10;

    if (result.titles && result.titles.length > 0) {
      checkPageBreak(30);
      pdf.setFillColor(240, 240, 240);
      pdf.roundedRect(margin, y, contentWidth, 8, 2, 2, "F");
      pdf.setTextColor(30, 30, 30);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("Suggested Titles", margin + 3, y + 5.5);
      y += 12;

      result.titles.forEach((title, i) => {
        checkPageBreak(8);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(60, 60, 60);
        const titleText = `${i + 1}. ${title}`;
        const titleLines = pdf.splitTextToSize(titleText, contentWidth);
        titleLines.forEach((line: string) => {
          pdf.text(line, margin, y);
          y += 5;
        });
        y += 2;
      });
      y += 5;
    }

    sections.forEach((section) => {
      checkPageBreak(20);

      pdf.setFillColor(255, 240, 240);
      pdf.roundedRect(margin, y, contentWidth, 8, 2, 2, "F");
      pdf.setTextColor(200, 50, 50);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(section.name + (section.timestamp ? ` [${section.timestamp}]` : ""), margin + 3, y + 5.5);
      y += 12;

      section.paragraphs.forEach((paragraph) => {
        checkPageBreak(15);

        switch (paragraph.type) {
          case 'dialogue':
            pdf.setFontSize(9);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(200, 50, 50);
            const speakerText = paragraph.speaker + (paragraph.tone ? ` (${paragraph.tone})` : '') + ':';
            pdf.text(speakerText, margin, y);
            y += 5;

            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(50, 50, 50);
            const dialogueLines = pdf.splitTextToSize(paragraph.content, contentWidth - 5);
            dialogueLines.forEach((line: string) => {
              pdf.text(line, margin + 3, y);
              y += 5;
            });
            break;

          case 'stage-direction':
            pdf.setFontSize(9);
            pdf.setFont("helvetica", "italic");
            pdf.setTextColor(100, 100, 100);
            const directionLines = pdf.splitTextToSize(`Direction: ${paragraph.content}`, contentWidth - 10);
            directionLines.forEach((line: string) => {
              pdf.text(line, margin + 5, y);
              y += 4.5;
            });
            break;

          case 'b-roll':
            pdf.setFontSize(9);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(180, 100, 50);
            const brollLines = pdf.splitTextToSize(`B-Roll: ${paragraph.content}`, contentWidth - 10);
            brollLines.forEach((line: string) => {
              pdf.text(line, margin + 5, y);
              y += 4.5;
            });
            break;

          case 'bullet':
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(50, 50, 50);
            const bulletLines = pdf.splitTextToSize(`• ${paragraph.content}`, contentWidth - 8);
            bulletLines.forEach((line: string) => {
              pdf.text(line, margin + 4, y);
              y += 5;
            });
            break;

          default:
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(50, 50, 50);
            const textLines = pdf.splitTextToSize(paragraph.content, contentWidth);
            textLines.forEach((line: string) => {
              pdf.text(line, margin, y);
              y += 5;
            });
        }
        y += 3;
      });
      y += 8;
    });

    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(8);
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
      pdf.text("Generated by YouTube Research & Script Pro", margin, pageHeight - 8);
    }

    const filename = `script-${topic.replace(/[^a-z0-9]/gi, "-").toLowerCase().substring(0, 30)}-${Date.now()}.pdf`;
    pdf.save(filename);

    toast({
      title: "PDF Downloaded",
      description: "Your script has been saved as a PDF.",
    });
  };

  return (
    <div className="relative flex min-h-full flex-col lg:flex-row">
      <StarryBackground />
      <aside className="relative z-10 border-b border-border bg-card/30 lg:w-[400px] lg:shrink-0 lg:border-b-0 lg:border-r xl:w-[450px]">
          <div className="border-b border-border p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-foreground">Script Writer</h1>
                  <p className="text-sm text-muted-foreground">AI-powered script generation</p>
                </div>
              </div>
              {workflowState.isWorkflowActive && <Badge variant="outline" className="gap-1">Step 2 of 3</Badge>}
            </div>
          </div>

          <div className="space-y-6 p-4 sm:p-6">
              {workflowState.isWorkflowActive && workflowState.idea?.selectedIdea && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 break-words">
                        <p className="text-sm font-medium text-foreground">Selected Idea</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {workflowState.idea.selectedIdea.title}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Promise: {workflowState.idea.selectedIdea.honestPromise}
                        </p>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          <span>Surface: {workflowState.idea.selectedIdea.discoverySurface}</span>
                          <span>Payoff: {workflowState.idea.selectedIdea.payoff}</span>
                          <span>Thumbnail: {workflowState.idea.selectedIdea.thumbnailConcept}</span>
                          <span>Studio check: {workflowState.idea.selectedIdea.studioMetric}</span>
                          <span>Experiment: {workflowState.idea.selectedIdea.experimentRule}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {workflowState.idea.selectedIdea.keywords.slice(0, 3).map((kw, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="topic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video Topic</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., How to build a React app from scratch"
                            {...field}
                            data-testid="input-topic"
                          />
                        </FormControl>
                        <FormDescription>
                          What is your video about?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="format"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video Format</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-format">
                              <SelectValue placeholder="Select a format" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {formatOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {option.icon}
                                  </Badge>
                                  <span>{option.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose the type of video you're creating
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="audience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Audience</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-audience">
                              <SelectValue placeholder="Select target audience" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {audienceOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Who are you making this video for?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="persona"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tone Traits</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-persona">
                              <SelectValue placeholder="Select a persona style" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {personaOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex flex-col">
                                  <span>{option.label}</span>
                                  <span className="text-xs text-muted-foreground">{option.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose abstract delivery traits. The script will not imitate a real person's voice.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedPersona === CreatorPersona.OTHER && (
                    <FormField
                      control={form.control}
                      name="customPersona"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Custom Tone Traits</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., calm, analytical, warm, concise"
                              {...field}
                              data-testid="input-custom-persona"
                            />
                          </FormControl>
                          <FormDescription>
                            Describe cadence, energy, vocabulary, and formality without naming a person.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="additionalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any specific points, style preferences, or requirements..."
                            className="min-h-[100px] resize-none"
                            {...field}
                            data-testid="input-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={generateMutation.isPending}
                      className="flex-1"
                      data-testid="button-generate-script"
                    >
                      {generateMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Script
                        </>
                      )}
                    </Button>
                    {result && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleReset}
                        aria-label="Reset script form"
                        data-testid="button-reset"
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
          </div>
      </aside>

      <div className="min-w-0 flex-1 bg-background relative z-10">
        <div className="p-4 sm:p-6">
          {actionError && (
            <Card className="mx-auto mb-6 max-w-4xl border-destructive/40 bg-destructive/5" role="alert" aria-live="assertive">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-destructive">{actionError.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{actionError.message}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const retry = retryActionRef.current;
                      clearActionError();
                      retry?.();
                    }}
                    data-testid="button-retry-script-action"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Retry
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={clearActionError}
                    aria-label="Dismiss script error"
                    data-testid="button-dismiss-script-error"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {generateMutation.isPending ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="relative">
                <div className="h-20 w-20 rounded-full border-4 border-muted animate-pulse" />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 text-primary animate-bounce" />
              </div>
              <p className="mt-6 text-lg font-medium text-foreground">Generating your script...</p>
              <p className="mt-2 text-sm text-muted-foreground">This may take a few seconds</p>
            </div>
          ) : result ? (
            <div className="mx-auto max-w-6xl space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-primary">Ready to read</p>
                  <h2 className="mt-1 text-2xl font-semibold text-foreground">Teleprompter</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Type className="h-4 w-4" />{result.metadata.wordCount} words</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{result.metadata.estimatedDuration}</span>
                    <span>Press Space to play or pause</span>
                  </div>
                </div>
              </div>

              <Teleprompter script={result.script} onSave={persistScriptRevision} />

              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <Card className="border-border/70">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="h-auto w-full justify-between rounded-xl px-4 py-4" data-testid="button-script-details">
                      <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Script details and export</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6 border-t border-border pt-5">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleDownloadPDF} data-testid="button-download-pdf"><Download className="mr-2 h-4 w-4" />Download PDF</Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-script">
                          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copied" : "Copy full script"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { goToStep("thumbnail"); setLocation("/thumbnail"); }}
                          data-testid="button-create-thumbnail"
                        >
                          <Image className="mr-2 h-4 w-4" />Create thumbnail<ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>

                      {result.titles && result.titles.length > 0 && (
                        <section aria-labelledby="script-title-options">
                          <div className="flex items-center justify-between gap-3">
                            <h3 id="script-title-options" className="text-sm font-semibold">Suggested titles</h3>
                            <Button type="button" variant="ghost" size="icon" onClick={handleRegenerateTitles} disabled={regeneratingTitles} aria-label="Regenerate suggested titles" data-testid="button-regenerate-titles">
                              {regeneratingTitles ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                          </div>
                          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
                            {result.titles.map((title, index) => (
                              <li key={`${title}-${index}`} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                                <span className="mr-2 text-xs font-semibold text-primary">{index + 1}</span>{title}
                              </li>
                            ))}
                          </ol>
                        </section>
                      )}

                      <section className="grid gap-4 text-sm lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]" aria-labelledby="script-plan-heading">
                        <div>
                          <h3 id="script-plan-heading" className="font-semibold">Plan</h3>
                          <p className="mt-2 text-muted-foreground"><span className="font-medium text-foreground">Hook:</span> {result.hook}</p>
                          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                            {result.structure.map((section, index) => (
                              <li key={`${section.section}-${index}`} className="rounded-lg border border-border p-3">
                                <p className="font-medium">{index + 1}. {section.section}</p>
                                <p className="mt-1 text-muted-foreground">{section.purpose}</p>
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div className="space-y-3">
                          <div className="rounded-lg border border-border p-3"><p className="font-medium">Payoff</p><p className="mt-1 text-muted-foreground">{result.payoff}</p></div>
                          <div className="rounded-lg border border-border p-3"><p className="font-medium">Primary CTA</p><p className="mt-1 text-muted-foreground">{result.primaryCta}</p></div>
                          <div className="rounded-lg border border-border p-3"><p className="font-medium">Studio check</p><p className="mt-1 text-muted-foreground">{result.studioValidation}</p></div>
                        </div>
                      </section>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="Create Your Script"
              description="Fill in the details on the left panel and let AI generate a professional script for your video."
            />
          )}
        </div>
      </div>

    </div>
  );
}
