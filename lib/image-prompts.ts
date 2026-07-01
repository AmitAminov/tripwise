/**
 * Prompt templates for Nano Banana image generation. Centralized so
 * tests can verify the prompt shape and so we can tune tone in one
 * place. The templates deliberately close every prompt with the
 * "no text, no logos, no watermarks" clause because Gemini image
 * models are prone to hallucinating fake signs otherwise.
 */

const HOUSE_STYLE =
  "Editorial travel photograph in the style of a premium travel magazine cover. Warm cinematic light, shallow depth of field, no text, no logos, no watermarks, no people in the foreground. Aspect 16:9.";

export interface DestinationHeroPromptParams {
  destinationName: string;
  country: string;
  seasonNote?: string;
}

export function destinationHeroPrompt(
  p: DestinationHeroPromptParams,
): string {
  const season = p.seasonNote ? ` ${p.seasonNote}` : "";
  return `${p.destinationName}, ${p.country}: iconic viewpoint at golden hour, warm ${p.country} light, atmospheric.${season} ${HOUSE_STYLE}`;
}

export interface TripPosterPromptParams {
  destinationName: string;
  durationDays: number;
  groupType?: string;
  interests?: string[];
}

export function tripPosterPrompt(p: TripPosterPromptParams): string {
  const interests =
    p.interests && p.interests.length > 0
      ? ` featuring ${p.interests.slice(0, 3).join(", ")}`
      : "";
  const group = p.groupType ? ` for a ${p.groupType}` : "";
  return `Premium illustrated travel poster${group} — ${p.durationDays}-day trip to ${p.destinationName}${interests}. Warm evening light, historic streets, layered visual composition with subtle itinerary-inspired elements. No readable text, no logos, no watermarks. Aspect 4:5.`;
}

export interface MoodBoardPromptParams {
  destinationName: string;
  moodDescriptor: string; // e.g. "food scene", "architecture", "nightlife"
}

export function moodBoardPrompt(p: MoodBoardPromptParams): string {
  return `${p.destinationName}: intimate close-up of ${p.moodDescriptor}. Warm editorial travel photograph, magazine spread aesthetic, natural light. ${HOUSE_STYLE}`;
}

export interface AttractionFallbackPromptParams {
  attractionName: string;
  destinationName: string;
  category?: string;
}

export function attractionFallbackPrompt(
  p: AttractionFallbackPromptParams,
): string {
  const cat = p.category ? ` (${p.category.replace(/_/g, " ")})` : "";
  return `${p.attractionName} in ${p.destinationName}${cat}. Atmospheric editorial travel photograph. ${HOUSE_STYLE}`;
}
