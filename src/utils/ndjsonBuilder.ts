import { v4 as uuidv4 } from 'uuid';

/**
 * NDJSON Builder for Sanity CMS Export
 * Converts generated content blocks into proper NDJSON format for direct Sanity import
 */

export interface SanityDocument {
  _id: string;
  _type: string;
  _createdAt: string;
  _updatedAt: string;
  _rev?: string;
  [key: string]: any;
}

export interface ContentBlock {
  _type: string;
  _key: string;
  [key: string]: any;
}

export interface NDJSONExportOptions {
  includeMetadata?: boolean;
  generateIds?: boolean;
  docType?: string;
  publishedAt?: string;
}

/**
 * Generates a Sanity-compatible document ID
 */
function generateSanityId(): string {
  return uuidv4().replace(/-/g, '');
}

/**
 * Generates a unique key for content blocks
 */
function generateBlockKey(prefix: string = 'block'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validates that content blocks have required Sanity fields
 */
function validateContentBlock(block: ContentBlock): boolean {
  if (!block._type) {
    console.warn('Content block missing required _type field:', block);
    return false;
  }
  if (!block._key) {
    console.warn('Content block missing required _key field:', block);
    return false;
  }
  return true;
}

/**
 * Ensures content blocks have proper Sanity structure
 */
function normalizeContentBlock(block: any, index: number): ContentBlock {
  // Ensure required fields exist
  if (!block._type) {
    block._type = 'textBlock'; // Default fallback
  }
  
  if (!block._key) {
    block._key = generateBlockKey(`block-${index}`);
  }

  return block as ContentBlock;
}

/**
 * Converts rich text to Sanity block format
 * This is critical for proper text rendering in Sanity
 */
function convertToSanityBlocks(text: string): any[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Split text into paragraphs
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  
  return paragraphs.map((paragraph, index) => ({
    _type: 'block',
    _key: generateBlockKey(`paragraph-${index}`),
    style: 'normal',
    markDefs: [],
    children: [
      {
        _type: 'span',
        _key: generateBlockKey(`span-${index}`),
        text: paragraph.trim(),
        marks: []
      }
    ]
  }));
}

/**
 * Creates a complete Sanity document from content blocks
 */
export function createSanityDocument(
  contentBlocks: ContentBlock[],
  metadata: {
    title: string;
    slug: string;
    topic: string;
    keywords: string[];
    contentGoal: string;
    language?: string;
  },
  options: NDJSONExportOptions = {}
): SanityDocument {
  const now = new Date().toISOString();
  const docId = options.generateIds !== false ? generateSanityId() : 'generated-page';
  
  // Normalize all content blocks
  const normalizedBlocks = contentBlocks.map((block, index) => {
    const normalized = normalizeContentBlock(block, index);
    
    // Convert plain text content to Sanity blocks if needed
    if (normalized.content && typeof normalized.content === 'string') {
      normalized.content = convertToSanityBlocks(normalized.content);
    }
    
    return normalized;
  });

  // Validate all blocks
  const validBlocks = normalizedBlocks.filter(validateContentBlock);
  
  if (validBlocks.length !== normalizedBlocks.length) {
    console.warn(`Filtered out ${normalizedBlocks.length - validBlocks.length} invalid blocks`);
  }

  const document: SanityDocument = {
    _id: docId,
    _type: options.docType || 'page',
    _createdAt: now,
    _updatedAt: now,
    
    // Page metadata
    title: metadata.title,
    slug: {
      _type: 'slug',
      current: metadata.slug
    },
    
    // SEO fields
    seoTitle: metadata.title,
    seoDescription: `${metadata.topic} - ${metadata.keywords.slice(0, 3).join(', ')}`,
    keywords: metadata.keywords,
    
    // Content
    contentBlocks: validBlocks,
    
    // Additional metadata
    language: metadata.language || 'da',
    contentGoal: metadata.contentGoal,
    generatedAt: now,
    
    ...(options.publishedAt && {
      publishedAt: options.publishedAt,
      _status: 'published'
    })
  };

  return document;
}

/**
 * Converts Sanity documents to NDJSON format
 * Each document becomes one line in the output
 */
export function convertToNDJSON(documents: SanityDocument[]): string {
  return documents
    .map(doc => JSON.stringify(doc))
    .join('\n');
}

/**
 * Main export function - creates NDJSON from generated content
 */
export function buildNDJSON(
  generatedContent: any,
  pageMetadata: {
    title: string;
    topic: string;
    keywords: string[];
    contentGoal: string;
  },
  options: NDJSONExportOptions = {}
): { ndjson: string; document: SanityDocument } {
  
  // Extract content blocks from generated content
  let contentBlocks: ContentBlock[] = [];
  
  if (Array.isArray(generatedContent)) {
    contentBlocks = generatedContent;
  } else if (generatedContent.contentBlocks && Array.isArray(generatedContent.contentBlocks)) {
    contentBlocks = generatedContent.contentBlocks;
  } else if (generatedContent.content) {
    // Fallback: wrap single content in a block
    contentBlocks = [{
      _type: 'textBlock',
      _key: generateBlockKey('content'),
      content: generatedContent.content
    }];
  } else {
    throw new Error('Unable to extract content blocks from generated content');
  }

  // Generate slug from title
  const slug = pageMetadata.title
    .toLowerCase()
    .replace(/[æ]/g, 'ae')
    .replace(/[ø]/g, 'oe') 
    .replace(/[å]/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  // Create complete document
  const document = createSanityDocument(
    contentBlocks,
    {
      ...pageMetadata,
      slug
    },
    options
  );

  // Convert to NDJSON
  const ndjson = convertToNDJSON([document]);

  return { ndjson, document };
}

/**
 * Downloads NDJSON file to user's computer
 */
export function downloadNDJSON(ndjson: string, filename: string = 'generated-content.ndjson'): void {
  const blob = new Blob([ndjson], { type: 'application/x-ndjson' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Copies NDJSON to user's clipboard
 */
export async function copyToClipboard(ndjson: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(ndjson);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
} 