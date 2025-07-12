/**
 * Content Cleaning Utilities
 * Cleans and formats email content for display
 * 
 * Created: 2025-01-09
 * Purpose: Remove tracking URLs, clean HTML, and format content for better readability
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Clean and format URLs by removing tracking parameters
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'msclkid',
      'trk', 'trkCampaign', 'trkInfo', 'lipi', 'licu',
      'ref', 'refId', 'trackingId', 'ei', 'ved',
      'usp', 'si', 'source', 'ct', 'mt', 'pt'
    ];
    
    trackingParams.forEach(param => urlObj.searchParams.delete(param));
    
    // Special handling for LinkedIn URLs
    if (urlObj.hostname.includes('linkedin.com')) {
      // Clean up LinkedIn tracking
      urlObj.searchParams.delete('trackingId');
      urlObj.searchParams.delete('lipi');
      urlObj.searchParams.delete('licu');
      
      // Simplify LinkedIn URLs
      if (urlObj.pathname.includes('/view/')) {
        // Keep only the essential path
        const pathParts = urlObj.pathname.split('/');
        const viewIndex = pathParts.indexOf('view');
        if (viewIndex !== -1 && pathParts[viewIndex + 1]) {
          urlObj.pathname = `/in/${pathParts[viewIndex + 1]}/`;
        }
      }
    }
    
    // Return cleaned URL
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Extract clean text from HTML content
 */
export function htmlToText(html: string): string {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const tempDiv = typeof document !== 'undefined' 
    ? document.createElement('div')
    : { innerHTML: '', textContent: '' };
    
  // Use DOMPurify to sanitize HTML first
  const cleanHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'a', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href']
  });
  
  tempDiv.innerHTML = cleanHtml;
  
  // Replace common HTML entities
  let text = tempDiv.textContent || tempDiv.innerHTML || '';
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  
  return text;
}

/**
 * Clean email content for display
 */
export function cleanEmailContent(content: string, isHtml: boolean = false): string {
  if (!content) return '';
  
  let cleanedContent = content;
  
  // If HTML, convert to text first
  if (isHtml) {
    cleanedContent = htmlToText(content);
  }
  
  // Remove email headers and metadata
  cleanedContent = cleanedContent
    .replace(/^(From|To|Subject|Date|Message-ID|Reply-To|CC|BCC):\s*.+$/gim, '')
    .replace(/^-{3,}.*?-{3,}$/gms, '') // Remove dividers
    .replace(/^>{1,}\s*/gm, '') // Remove quote markers
    .trim();
  
  // Clean up URLs in the content
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  cleanedContent = cleanedContent.replace(urlRegex, (match) => {
    const cleaned = cleanUrl(match);
    // If URL is too long, truncate for display
    if (cleaned.length > 50) {
      try {
        const url = new URL(cleaned);
        return `${url.hostname}${url.pathname.length > 20 ? url.pathname.substring(0, 20) + '...' : url.pathname}`;
      } catch {
        return cleaned.substring(0, 50) + '...';
      }
    }
    return cleaned;
  });
  
  // Remove base64 encoded content
  cleanedContent = cleanedContent.replace(/data:[^;]+;base64,[A-Za-z0-9+/]+=*/g, '[image]');
  
  // Clean up excessive whitespace
  cleanedContent = cleanedContent
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
    .replace(/[ \t]+/g, ' ') // Multiple spaces to single
    .trim();
  
  return cleanedContent;
}

/**
 * Format email content for preview (snippet)
 */
export function formatEmailSnippet(content: string, maxLength: number = 150): string {
  const cleaned = cleanEmailContent(content, true);
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  // Try to break at a sentence boundary
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  let snippet = '';
  
  for (const sentence of sentences) {
    if (snippet.length + sentence.length <= maxLength) {
      snippet += sentence;
    } else {
      break;
    }
  }
  
  // If no complete sentence fits, just truncate
  if (!snippet) {
    snippet = cleaned.substring(0, maxLength);
    const lastSpace = snippet.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) {
      snippet = snippet.substring(0, lastSpace);
    }
  }
  
  return snippet.trim() + '...';
}

/**
 * Extract and clean links from email content
 */
export function extractCleanLinks(content: string): Array<{ text: string; url: string }> {
  const links: Array<{ text: string; url: string }> = [];
  const seenUrls = new Set<string>();
  
  // Extract links from HTML
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const url = cleanUrl(match[1]);
    const text = htmlToText(match[2]);
    
    // Skip email and phone links
    if (!url.startsWith('mailto:') && !url.startsWith('tel:') && !seenUrls.has(url)) {
      links.push({ text, url });
      seenUrls.add(url);
    }
  }
  
  // Also extract plain URLs
  const plainUrlRegex = /(?<![">])(https?:\/\/[^\s<>"{}|\\^`\[\]]+)(?![<"])/gi;
  while ((match = plainUrlRegex.exec(content)) !== null) {
    const url = cleanUrl(match[1]);
    // Check if this URL was already extracted from an anchor tag
    if (!seenUrls.has(url)) {
      // Extract domain as text for plain URLs
      try {
        const urlObj = new URL(url);
        links.push({ text: urlObj.hostname, url });
        seenUrls.add(url);
      } catch {
        links.push({ text: 'Link', url });
        seenUrls.add(url);
      }
    }
  }
  
  return links;
}

/**
 * Remove email signatures
 */
export function removeEmailSignature(content: string): string {
  // Common signature indicators
  const signaturePatterns = [
    /^--\s*$/m, // Standard signature delimiter
    /^(Best|Kind|Warm|Thanks|Thank you|Regards|Sincerely|Cheers|Best regards),?\s*$/im,
    /^Sent from my (iPhone|iPad|Android|Samsung|mobile device)/im,
    /^Get Outlook for/im,
    /^\*{3,}/m, // Asterisk dividers
    /^_{3,}/m, // Underscore dividers
  ];
  
  let cleanedContent = content;
  let shortestContent = content;
  
  // Find the earliest signature pattern
  for (const pattern of signaturePatterns) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      const truncated = content.substring(0, match.index).trim();
      if (truncated.length < shortestContent.length && truncated.length > content.length * 0.3) {
        shortestContent = truncated;
      }
    }
  }
  
  return shortestContent;
}

/**
 * Clean and format the complete email for display
 */
export function cleanEmailForDisplay(email: {
  body_html?: string | null;
  body_text?: string | null;
  subject?: string | null;
}): {
  content: string;
  snippet: string;
  links: Array<{ text: string; url: string }>;
} {
  // Prefer HTML content as it usually has better formatting
  const rawContent = email.body_html || email.body_text || '';
  const isHtml = !!email.body_html;
  
  // Clean the content
  let content = cleanEmailContent(rawContent, isHtml);
  
  // Remove signature
  content = removeEmailSignature(content);
  
  // Extract links before final formatting
  const links = extractCleanLinks(rawContent);
  
  // Generate snippet
  const snippet = formatEmailSnippet(content);
  
  return {
    content,
    snippet,
    links
  };
}

/**
 * Format email headers for display
 */
export function formatEmailHeaders(email: {
  sender?: string;
  sender_email?: string;
  sender_name?: string;
  recipients?: string[];
  received_at?: string;
  subject?: string;
}): {
  from: string;
  to: string;
  date: string;
  subject: string;
} {
  // Format sender
  const from = email.sender_name 
    ? `${email.sender_name} <${email.sender_email || ''}>`
    : email.sender || email.sender_email || 'Unknown';
  
  // Format recipients
  const to = email.recipients?.join(', ') || 'Unknown';
  
  // Format date
  const date = email.received_at 
    ? new Date(email.received_at).toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    : 'Unknown';
  
  // Clean subject
  const subject = email.subject?.trim() || 'No Subject';
  
  return { from, to, date, subject };
}