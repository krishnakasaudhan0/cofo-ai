import extractAndSanitizeUrls  from "../src/urlSanitizer.js";

describe('extractAndSanitizeUrls Utility', () => {
    
    test('should extract a single URL and clean the surrounding prompt text', () => {
        const input = "Check out this article https://example.com/blog/post-1 and tell me what you think.";
        const result = extractAndSanitizeUrls(input);

        expect(result.extractedUrls).toEqual(['https://example.com/blog/post-1']);
        expect(result.sanitizedPrompt).toBe('Check out this article and tell me what you think.');
    });

    test('should extract multiple URLs located at different positions in the string', () => {
        const input = "Watch https://youtube.com/watch?v=xyz123 and read https://arxiv.org/abs/2401.99999 for the summary.";
        const result = extractAndSanitizeUrls(input);

        expect(result.extractedUrls).toHaveLength(2);
        expect(result.extractedUrls).toContain('https://youtube.com/watch?v=xyz123');
        expect(result.extractedUrls).toContain('https://arxiv.org/abs/2401.99999');
        expect(result.sanitizedPrompt).toBe('Watch and read for the summary.');
    });

    test('should handle inputs with no URLs cleanly without modifying the text', () => {
        const input = "Write a professional LinkedIn post about system design scalability.";
        const result = extractAndSanitizeUrls(input);

        expect(result.extractedUrls).toEqual([]);
        expect(result.sanitizedPrompt).toBe('Write a professional LinkedIn post about system design scalability.');
    });

    test('should handle empty strings, null, or undefined values gracefully', () => {
        expect(extractAndSanitizeUrls("")).toEqual({ extractedUrls: [], sanitizedPrompt: '' });
        expect(extractAndSanitizeUrls(null)).toEqual({ extractedUrls: [], sanitizedPrompt: '' });
        expect(extractAndSanitizeUrls(undefined)).toEqual({ extractedUrls: [], sanitizedPrompt: '' });
    });

    test('should normalize excessive internal whitespace left by URL removal', () => {
        const input = "Please parse    https://github.com/cofo-ai/repo    and build a ppt.";
        const result = extractAndSanitizeUrls(input);

        expect(result.extractedUrls).toEqual(['https://github.com/cofo-ai/repo']);
        expect(result.sanitizedPrompt).toBe('Please parse and build a ppt.');
    });

});