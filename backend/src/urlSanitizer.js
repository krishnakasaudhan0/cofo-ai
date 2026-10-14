/**
 * Extracts URLs from a raw prompt string and sanitizes the remaining text.
 * @param {string} rawPrompt - The raw text input entered by the user.
 * @returns {Object} An object containing the array of extracted URLs and the cleaned prompt.
 */
export default function extractAndSanitizeUrls(rawPrompt) {
    if (!rawPrompt || typeof rawPrompt !== 'string') {
        return { extractedUrls: [], sanitizedPrompt: '' };
    }

    // Robust regex to match http:// or https:// URLs up to whitespace or common trailing punctuation
    const urlRegex = /https?:\/\/[^\s<]+[^<.,:;"')\]\s]/g;

    // 1. Extract all matching URLs into an array (default to empty array if none found)
    const extractedUrls = rawPrompt.match(urlRegex) || [];

    // 2. Sanitize the prompt: replace URLs with empty string, collapse extra spaces, and trim
    let sanitizedPrompt = rawPrompt
        .replace(urlRegex, '')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        extractedUrls,
        sanitizedPrompt
    };
}

