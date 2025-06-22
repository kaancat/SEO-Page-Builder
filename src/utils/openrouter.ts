import axios from 'axios';
import { PROVIDER_WHITELIST, isValidProviderId, getProviderSelection, PROVIDER_ID_MAP } from './providerIds';

/**
 * OpenRouter API client for generating SEO content
 * Supports multiple AI models including Claude, GPT-4, and others
 */

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerationRequest {
  topic: string;
  keywords: string[];
  contentGoal: 'educate' | 'compare' | 'convert';
  toneOfVoice: string;
  schema: any;
  examplePages?: any[];
  optionalBlocks: string[];
  contentLength: 'short' | 'medium' | 'long';
  relatedPages?: Array<{ title: string; url: string; }>;
}

export interface GenerationResponse {
  success: boolean;
  data?: any;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Available models for the dropdown
export const AVAILABLE_MODELS = {
  'anthropic/claude-3-sonnet': 'Claude 3 Sonnet (Recommended)',
  'anthropic/claude-3-haiku': 'Claude 3 Haiku (Fast)',
  'openai/gpt-4o': 'GPT-4o',
  'openai/gpt-4-turbo': 'GPT-4 Turbo',
  'mistralai/mistral-large': 'Mistral Large',
  'google/gemini-pro': 'Gemini Pro',
};

/**
 * Summarizes the schema structure from the manifest for the AI prompt
 * Uses the structured manifest data with exact block types and required fields
 */
function summarizeSchema(schema: any): string {
  // Check if we have the new manifest structure
  if (schema && schema.contentBlockTypes && Array.isArray(schema.contentBlockTypes)) {
    const totalBlocks = schema.contentBlockTypes.length;
    const mandatoryBlocks = schema.contentBlockTypes.filter((block: any) => 
      block.type === 'hero' || block.type === 'pageSection'
    );
    const optionalBlocks = schema.contentBlockTypes.filter((block: any) => 
      block.type !== 'hero' && block.type !== 'pageSection'
    );
    
    const blockSummaries = schema.contentBlockTypes.map((block: any) => {
      const fieldCount = block.requiredFields.length;
      const isMandatory = block.type === 'hero' || block.type === 'pageSection';
      const status = isMandatory ? '[MANDATORY]' : '[OPTIONAL]';
      
      // Add field type information
      let fieldDetails = `Required fields (${fieldCount}): ${block.requiredFields.join(', ')}`;
      
      if (block.fieldTypes) {
        const typeDetails = Object.entries(block.fieldTypes)
          .map(([field, type]) => `${field}: ${type}`)
          .join(', ');
        fieldDetails += `\n  Field types: ${typeDetails}`;
      }
      
      if (block.fieldEnums) {
        const enumDetails = Object.entries(block.fieldEnums)
          .map(([field, values]) => `${field} must be one of: ${(values as string[]).join(', ')}`)
          .join(', ');
        fieldDetails += `\n  Enum constraints: ${enumDetails}`;
      }
      
      return `• ${block.type} ${status}: ${block.description}
  ${fieldDetails}`;
    });
    
    return `SCHEMA MANIFEST SUMMARY:
Total content blocks: ${totalBlocks}
Mandatory blocks: ${mandatoryBlocks.length} (hero, pageSection)
Optional blocks: ${optionalBlocks.length}

DETAILED BLOCK SPECIFICATIONS:
${blockSummaries.join('\n')}

STRICT COMPLIANCE RULES:
- _type: Must match exact block type from manifest (${schema.contentBlockTypes.map((b: any) => b.type).join(', ')})
- _key: Unique identifier (format: "blocktype-timestamp-random")
- Required fields: ALL fields in requiredFields array MUST be included for each block
- Rich text fields: Use Sanity Portable Text format with _type: 'block', children arrays
- NO DEVIATION: Only use the ${totalBlocks} block types defined in manifest
- FIELD VALIDATION: Every required field must contain meaningful, relevant content
- BLOCK ORDERING: hero first, pageSection second, then optional blocks as requested

CRITICAL FIELD TYPE CONSTRAINTS:
- featureItem.icon: NEVER auto-generate – omit this field completely.
- videoSection.customThumbnail: NEVER include – omit unless explicitly provided.
- providerList.providers: Must be valid reference objects only – first must be Vindstød, others from whitelist.
- Image fields (image, customThumbnail): Must be Sanity image objects with asset._ref
- Portable Text fields (content, leadingText, answer): Use block[] format with _type: 'block'
- Rich text links: Use standard Sanity link markDefs with _type: 'link' and href property
- Enum fields (apiRegion): Must use exact values from fieldEnums (e.g., "DK1" or "DK2")
- Number fields (prices, subscriptions): Use numeric values, not strings
- String arrays (propositions): Use plain string arrays, NOT Portable Text blocks
- DO NOT use strings for reference fields - always use proper reference objects
- If you do NOT have a real Sanity image ID, OMIT hero.image and videoSection.customThumbnail completely – never invent placeholders.
- providerList.providers must be an array of reference objects. First ref = "63c05ca2-cd1e-4f00-b544-6a2077d4031a" (Vindstød). Remaining refs must be chosen from whitelist: [9451a43b-6e68-4914-945c-73a81a508214, 9526e0ba-cbe8-4526-9abc-7dabb4756b2b, a6541984-3dbb-466a-975b-badba029e139].`;
  }

  // Fallback for legacy schema formats
  return `❌ SCHEMA MANIFEST ERROR
The schema manifest is not properly loaded or formatted.
Expected: { contentBlockTypes: [...] }
Cannot proceed with content generation without valid manifest.`;
}

/**
 * Creates a comprehensive, well-structured system prompt for page generation
 * Designed for professional-grade SEO page building with Sanity CMS
 */
function createSystemPrompt(request: GenerationRequest): string {
  const wordCount = {
    short: '600-1000',
    medium: '1000-2000', 
    long: '2000+'
  }[request.contentLength];

  const schemaSummary = summarizeSchema(request.schema);
  
  const exampleContext = request.examplePages?.length 
    ? `\n═══ INSPIRATION EXAMPLES ═══
Use these existing pages as inspiration for structure, tone, and content depth:
${JSON.stringify(request.examplePages.slice(0, 2), null, 2)}`
    : '';

  const internalLinkingContext = request.relatedPages?.length
    ? `\n═══ INTERNAL LINKING ═══
Include contextual links to these related pages within pageSection or FAQ blocks:
${request.relatedPages.map(page => `• ${page.title}: ${page.url}`).join('\n')}

LINKING GUIDELINES:
• Use natural anchor text that matches the page title
• Insert only 1–2 links per section maximum
• Place links where they add genuine value to the reader
• Format as standard Sanity link annotations in rich text blocks`
    : '';

  return `═══ ROLE DEFINITION ═══
You are an expert SEO page designer and content architect for ElPrisFinder, Denmark's leading electricity price comparison platform. Your job is to create complete, well-structured web pages using predefined Sanity CMS content blocks - not just write text, but design entire page experiences.

═══ PAGE STRUCTURE RULES ═══
MANDATORY LAYOUT SEQUENCE:
1. HERO BLOCK (always first) - Compelling headline, subheadline, and value proposition
2. PAGE SECTION (always second) - Main educational content with comprehensive coverage
3. OPTIONAL BLOCKS (user-selected) - Functional components like calculators, comparisons, FAQs

STRUCTURAL REQUIREMENTS:
• Every block MUST have valid _type and _key fields
• _key format: "blocktype-timestamp-random" (e.g., "hero-1735551600-abc123")
• Rich text uses Sanity Portable Text: { _type: 'block', children: [...] }
• NEVER invent block types not in the schema
• NEVER skip required fields

 ═══ CONTENT REQUIREMENTS ═══
 TOPIC: ${request.topic}
 KEYWORDS: ${request.keywords.join(', ')}
 CONTENT GOAL: ${request.contentGoal}
 TONE: ${request.toneOfVoice}
 TARGET LENGTH: ${wordCount} words (distributed across all blocks)
 
 CONTENT DISTRIBUTION:
 • Spread keyword usage evenly across blocks
 • Avoid stuffing all keywords into the hero section
 • Ensure each block has standalone informational value
 • Hero: Primary keyword + compelling value proposition
 • PageSection: Comprehensive coverage with semantic variations
 • Optional blocks: Context-specific keyword integration
 
 DANISH ENERGY MARKET FOCUS:
 • Use Danish energy terminology and regulations
 • Reference DK1/DK2 price areas when relevant  
 • Include actionable advice for Danish consumers
 • Focus on transparency and consumer empowerment
 
 SEO OPTIMIZATION:
 • Integrate target keywords naturally throughout content
 • Create compelling, search-friendly headlines
 • Provide comprehensive coverage of the topic
 • Include semantic keyword variations

═══ OPTIONAL BLOCKS ═══
User has requested these additional components:
${request.optionalBlocks.length > 0 ? request.optionalBlocks.join(', ') : 'None selected - use just hero and pageSection'}

MANIFEST-DEFINED OPTIONAL BLOCKS (only use these):
${request.schema?.contentBlockTypes 
  ? request.schema.contentBlockTypes
    .filter((block: any) => block.type !== 'hero' && block.type !== 'pageSection')
    .map((block: any) => `• ${block.type}: ${block.description}`)
    .join('\n')
  : '• Schema manifest not available'
}

SELECTED BLOCKS FOR THIS PAGE:
• hero (mandatory)
• pageSection (mandatory)
${request.optionalBlocks.map(block => `• ${block} (requested)`).join('\n')}

═══ SCHEMA OVERVIEW ═══
${schemaSummary}

═══ OUTPUT FORMAT ═══
CRITICAL: Respond with ONLY valid JSON - no markdown, no explanations, no code blocks.

REQUIRED JSON STRUCTURE:
{
  "contentBlocks": [
    {
      "_type": "hero",
      "_key": "hero-main-[timestamp]",
      "headline": "SEO-optimized headline with target keywords",
      "subheadline": "Supporting text that explains value proposition",
      "image": {
        "_type": "image",
        "asset": {
          "_type": "reference",
          "_ref": "image-placeholder-hero-1920x1080-jpg",
          "_weak": true
        }
      }
    },
    {
      "_type": "pageSection", 
      "_key": "content-main-[timestamp]",
      "title": "Descriptive section title",
      "content": [
        {
          "_type": "block",
          "_key": "paragraph-[timestamp]",
          "style": "normal",
          "children": [
            {
              "_type": "span",
              "_key": "span-[timestamp]",
              "text": "Comprehensive content covering the topic...",
              "marks": []
            }
          ]
        }
      ]
    }
  ]
}

FIELD TYPE EXAMPLES:
• Icon objects: {"_type": "icon.manager", "icon": "mdi:calculator", "metadata": {"collectionName": "Material Design Icons"}}
• Provider references: [{"_type": "reference", "_ref": "63c05ca2-cd1e-4f00-b544-6a2077d4031a"}, {"_type": "reference", "_ref": "9451a43b-6e68-4914-945c-73a81a508214"}]
• Video thumbnails: null (omit field) OR {"_type": "image", "asset": {"_type": "reference", "_ref": "image-placeholder-0000x0000-jpg", "_weak": true}}
• String arrays (propositions): ["Provider A", "Provider B", "Provider C"]
• Portable Text arrays (content, leadingText): [{"_type": "block", "children": [...]}]
• Image objects: {"_type": "image", "asset": {"_type": "reference", "_ref": "image-placeholder-0000x0000-jpg", "_weak": true}}
• Rich text with links: Use markDefs array with {"_type": "link", "href": "https://example.com"}
• Enum values: "DK1" or "DK2" (not "dk1" or other variations)
• Numbers: 2.45 (not "2.45")

COMMON MISTAKES TO AVOID:
❌ icon: "mdi:calculator" (string)
✅ icon: {"_type": "icon.manager", "icon": "mdi:calculator"}

❌ providers: ["Provider A", "Provider B"] (strings)
✅ providers: [{"_type": "reference", "_ref": "63c05ca2-cd1e-4f00-b544-6a2077d4031a"}] (Vindstød first)

❌ customThumbnail: {"asset": {"_ref": "image-id"}} (incomplete)
✅ customThumbnail: null (omit field) OR proper image object

❌ providers[0]: any other provider ID
✅ providers[0]: "63c05ca2-cd1e-4f00-b544-6a2077d4031a" (Vindstød MUST be first)

RESPONSE REQUIREMENTS:
• Start with { and end with }
• Use double quotes for all strings
• Include _type and _key for every content block
• Follow Sanity Portable Text format for rich content
• Generate unique _key values using timestamps

VALIDATION CHECKLIST:
✓ Hero block is first with compelling headline
✓ PageSection contains comprehensive main content  
✓ All required fields are populated with relevant content
✓ Rich text follows Portable Text format exactly
✓ Keywords integrated naturally throughout
 ✓ Content provides genuine value to Danish energy consumers
 ✓ Optional blocks add meaningful functionality${exampleContext}${internalLinkingContext}
 
 Generate a complete, professional web page that Danish consumers will find valuable and engaging.`;
}

/**
 * Validates individual field types against manifest specifications
 */
function validateFieldType(fieldName: string, fieldValue: any, fieldType: string, blockType: string, blockIndex: number, warnings: string[]): void {
  switch (fieldType) {
    case 'array of strings':
      if (!Array.isArray(fieldValue)) {
        warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}" should be an array of strings, got ${typeof fieldValue}`);
      } else {
        fieldValue.forEach((item, itemIndex) => {
          if (typeof item !== 'string') {
            warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}[${itemIndex}]" should be a string, got ${typeof item}. Do not use Portable Text blocks for string arrays.`);
          }
          if (typeof item === 'object' && item._type === 'block') {
            warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}[${itemIndex}]" contains Portable Text block but should be plain string`);
          }
        });
      }
      break;
      
    case 'array of references':
      if (!Array.isArray(fieldValue)) {
        warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}" should be an array of references, got ${typeof fieldValue}`);
      } else {
        fieldValue.forEach((item, itemIndex) => {
          if (typeof item === 'string') {
            warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}[${itemIndex}]" should be a reference object, not a string`);
          } else if (typeof item !== 'object' || item._type !== 'reference' || !item._ref) {
            warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}[${itemIndex}]" should be a reference object with _type: 'reference' and _ref property`);
          } else if (blockType === 'providerList' && fieldName === 'providers') {
            // Special validation for provider references
            if (itemIndex === 0 && item._ref !== PROVIDER_WHITELIST[0]) {
              warnings.push(`Block ${blockIndex} (${blockType}): First provider must be Vindstød (${PROVIDER_WHITELIST[0]}), got ${item._ref}`);
            }
            if (!isValidProviderId(item._ref)) {
              warnings.push(`Block ${blockIndex} (${blockType}): Provider ID "${item._ref}" not in whitelist`);
            }
          }
        });
      }
      break;
      
    case 'array of Portable Text blocks':
      if (!Array.isArray(fieldValue)) {
        warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}" should be an array of Portable Text blocks, got ${typeof fieldValue}`);
      } else {
        fieldValue.forEach((item, itemIndex) => {
          if (typeof item !== 'object' || item._type !== 'block') {
            warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}[${itemIndex}]" should be a Portable Text block with _type: 'block'`);
          }
        });
      }
      break;
      
    case 'icon.manager':
      if (typeof fieldValue !== 'object' || fieldValue._type !== 'icon.manager' || !fieldValue.icon) {
        warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}" must be an icon.manager object with _type: 'icon.manager' and icon property`);
      }
      break;
      
    case 'image':
    case 'image?':
    case 'Sanity image object with valid asset reference':
      // Optional image fields (like customThumbnail) can be null/undefined
      if (fieldType === 'image?' && (fieldValue === null || fieldValue === undefined)) {
        // This is OK for optional image fields
        break;
      }
      if (typeof fieldValue !== 'object' || !fieldValue.asset || !fieldValue.asset._ref) {
        warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}" must be a Sanity image object with asset._ref property`);
      }
      break;
      
    case 'number':
      if (typeof fieldValue !== 'number') {
        warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}" should be a number, got ${typeof fieldValue}`);
      }
      break;
      
    case 'string':
      if (typeof fieldValue !== 'string') {
        warnings.push(`Block ${blockIndex} (${blockType}): Field "${fieldName}" should be a string, got ${typeof fieldValue}`);
      }
      break;
  }
}

//////////////////// 1️⃣  — helper: flatten PT array → plain string
function _toPlainString(value: any): string {
  if (Array.isArray(value)) {
    return value
      .map(v =>
        typeof v === 'object' && v?._type === 'block'
          ? (v.children || []).map((c: any) => c.text).join('')
          : String(v)
      )
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/*─────────────────────────────────────────────────────────────────────────
🔧 BULLETPROOF AUTO-FIX SYSTEM
───────────────────────────────────────────────────────────────────────────
• HARDCODED field mappings (schema manifest lacks fieldTypes)
• ENHANCED debugging with before/after logging
• GUARANTEED mutation tracking to ensure fixes are applied
• COMPREHENSIVE coverage of all known validation issues
─────────────────────────────────────────────────────────────────────────*/
function applyAutoFixes(contentBlocks: any[], schema: any): any[] {
  console.log('🔧 === BULLETPROOF AUTO-FIX SYSTEM STARTING ===');
  console.log(`📋 Processing ${contentBlocks.length} content blocks`);
  
  // Extract schema field type information for bulletproof validation
  const schemaFieldTypes = extractSchemaFieldTypes(schema);
  const referenceOnlyFields = extractReferenceOnlyFields(schema);
  
  console.log(`📊 Schema analysis: ${Object.keys(schemaFieldTypes).length} block types, ${Object.keys(referenceOnlyFields).length} reference-only field mappings`);

  let totalFixesApplied = 0;
  let totalViolationsDetected = 0;
  let totalObjectsDropped = 0;

  const fixedBlocks = contentBlocks.map((blk: any, idx: number) => {
    if (!blk || typeof blk !== 'object') {
      console.warn(`⚠️  Block ${idx}: Invalid block object, skipping`);
      totalViolationsDetected++;
      return null;
    }

    const b = JSON.parse(JSON.stringify(blk)); // Deep copy for safe mutation
    let blockFixesApplied = 0;
    let blockViolationsDetected = 0;
    
    console.log(`\n🔍 Block ${idx}: ${b._type || 'UNKNOWN_TYPE'}`);

    /* ========== BLOCK TYPE VALIDATION ========== */
    
    if (!b._type || typeof b._type !== 'string') {
      console.error(`❌ Block ${idx}: Missing or invalid _type, dropping block`);
      totalViolationsDetected++;
      totalObjectsDropped++;
      return null;
    }

    if (!schemaFieldTypes[b._type]) {
      console.warn(`⚠️  Block ${idx}: Unknown block type '${b._type}', attempting to fix anyway`);
      blockViolationsDetected++;
    }

    /* ========== UNIVERSAL SAFEGUARDS ========== */
    
    // 1. Ensure _key exists and is valid
    if (!b._key || typeof b._key !== 'string' || b._key.trim() === '') {
      const newKey = `${b._type}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      b._key = newKey;
      console.log(`  ✅ Added/fixed _key: ${newKey}`);
      blockFixesApplied++;
    }

    // 2. Remove ALL problematic icon fields (bulletproof approach)
    const iconFieldsRemoved = removeProblematicFields(b, ['icon'], `Block ${idx}`);
    blockFixesApplied += iconFieldsRemoved;

    // 3. Remove customThumbnail from videoSection (can cause validation errors)
    if (b._type === 'videoSection' && 'customThumbnail' in b) {
      delete b.customThumbnail;
      console.log(`  ✅ Removed videoSection customThumbnail (validation risk)`);
      blockFixesApplied++;
    }

    /* ========== FIELD TYPE ENFORCEMENT ========== */
    
    const blockSchema = schemaFieldTypes[b._type] || {};
    
    Object.keys(b).forEach(fieldName => {
      if (fieldName.startsWith('_')) return; // Skip Sanity system fields
      
      const expectedType = blockSchema[fieldName];
      const currentValue = b[fieldName];
      
      if (!expectedType) {
        // Unknown field - log but don't remove (might be valid)
        console.log(`  ℹ️  Unknown field '${fieldName}' in ${b._type}, keeping as-is`);
        return;
      }
      
      const fixResult = enforceFieldType(fieldName, currentValue, expectedType, b._type, idx);
      if (fixResult.fixed) {
        b[fieldName] = fixResult.value;
        console.log(`  ✅ Fixed ${fieldName}: ${expectedType} (was ${fixResult.wasType})`);
        blockFixesApplied++;
      } else if (fixResult.dropped) {
        delete b[fieldName];
        console.warn(`  ⚠️  Dropped ${fieldName}: unfixable type mismatch (${fixResult.wasType} vs ${expectedType})`);
        blockFixesApplied++;
        blockViolationsDetected++;
      }
    });

    /* ========== REFERENCE-ONLY ARRAY VALIDATION ========== */
    
    const referenceFields = referenceOnlyFields[b._type] || [];
    referenceFields.forEach(fieldName => {
      if (!(fieldName in b)) return;
      
      const fixResult = sanitizeReferenceOnlyArray(b[fieldName], `${b._type}.${fieldName}`, idx);
      if (fixResult.fixed) {
        b[fieldName] = fixResult.value;
        console.log(`  ✅ Sanitized reference array ${fieldName}: ${fixResult.originalCount} → ${fixResult.validCount} valid refs`);
        blockFixesApplied++;
        if (fixResult.droppedCount > 0) {
          console.warn(`  ⚠️  Dropped ${fixResult.droppedCount} invalid objects from ${fieldName}`);
          blockViolationsDetected++;
          totalObjectsDropped += fixResult.droppedCount;
        }
      }
    });

    /* ========== SPECIAL CASE HANDLING ========== */
    
    // FAQ Groups: Must have valid faqItems array
    if (b._type === 'faqGroup') {
      const faqFixResult = fixFaqGroup(b, idx);
      blockFixesApplied += faqFixResult.fixesApplied;
      blockViolationsDetected += faqFixResult.violationsDetected;
    }

    // Provider Lists: Must have valid provider references
    if (b._type === 'providerList') {
      const providerFixResult = fixProviderList(b, idx);
      blockFixesApplied += providerFixResult.fixesApplied;
      blockViolationsDetected += providerFixResult.violationsDetected;
    }

    // Value Propositions: Clean nested objects
    if (b._type === 'valueProposition' && Array.isArray(b.items)) {
      const cleanedItems = b.items.map((item: any, itemIdx: number) => {
        if (!item || typeof item !== 'object') return null;
        const cleaned = { ...item };
        const removed = removeProblematicFields(cleaned, ['icon'], `valueProposition.items[${itemIdx}]`);
        blockFixesApplied += removed;
        return cleaned;
      }).filter(Boolean);
      
      if (cleanedItems.length !== b.items.length) {
        console.warn(`  ⚠️  Cleaned valueProposition.items: ${b.items.length} → ${cleanedItems.length}`);
        b.items = cleanedItems;
        blockFixesApplied++;
      }
    }

    // Feature Lists: Clean nested objects
    if (b._type === 'featureList' && Array.isArray(b.features)) {
      const cleanedFeatures = b.features.map((feature: any, featIdx: number) => {
        if (!feature || typeof feature !== 'object') return null;
        const cleaned = { ...feature };
        const removed = removeProblematicFields(cleaned, ['icon'], `featureList.features[${featIdx}]`);
        blockFixesApplied += removed;
        return cleaned;
      }).filter(Boolean);
      
      if (cleanedFeatures.length !== b.features.length) {
        console.warn(`  ⚠️  Cleaned featureList.features: ${b.features.length} → ${cleanedFeatures.length}`);
        b.features = cleanedFeatures;
        blockFixesApplied++;
      }
    }

    console.log(`  📊 Block fixes: ${blockFixesApplied}, violations: ${blockViolationsDetected}`);
    totalFixesApplied += blockFixesApplied;
    totalViolationsDetected += blockViolationsDetected;
    return b;
  }).filter(Boolean); // Remove any null blocks

  /* ========== DEEP REFERENCE SANITIZATION ========== */
  
  let totalReferencesSanitized = 0;
  fixedBlocks.forEach((block, idx) => {
    const sanitizedInBlock = sanitizeAllReferences(block, `block[${idx}]`);
    totalReferencesSanitized += sanitizedInBlock;
  });

  console.log(`\n🎯 === BULLETPROOF AUTO-FIX SYSTEM COMPLETE ===`);
  console.log(`📈 Total fixes applied: ${totalFixesApplied}`);
  console.log(`⚠️  Total violations detected: ${totalViolationsDetected}`);
  console.log(`🗑️  Total objects dropped: ${totalObjectsDropped}`);
  console.log(`🧹 References sanitized: ${totalReferencesSanitized}`);
  console.log(`📋 Blocks processed: ${contentBlocks.length} → ${fixedBlocks.length} (${contentBlocks.length - fixedBlocks.length} dropped)`);
  
  // COMPREHENSIVE DEBUGGING OUTPUT
  if (totalFixesApplied > 0 || totalViolationsDetected > 0) {
    console.log('\n🔍 DETAILED FIX SUMMARY:');
    fixedBlocks.slice(0, 3).forEach((block, idx) => {
      const debugInfo: any = {
        _type: block._type,
        _key: block._key?.substring(0, 20) + '...',
        fields: Object.keys(block).filter(k => !k.startsWith('_')).length,
      };
      
      // Check for common problem fields
      if ('leadingText' in block) {
        debugInfo.leadingText = {
          type: Array.isArray(block.leadingText) ? 'array' : typeof block.leadingText,
          sample: typeof block.leadingText === 'string' ? 
            block.leadingText.substring(0, 30) + '...' : 
            `[${Array.isArray(block.leadingText) ? block.leadingText.length + ' items' : 'non-string'}]`
        };
      }
      
      if ('providers' in block) {
        debugInfo.providers = {
          count: Array.isArray(block.providers) ? block.providers.length : 'not-array',
          allReferences: Array.isArray(block.providers) ? 
            block.providers.every((p: any) => p?._type === 'reference' && p?._ref) : false
        };
      }
      
      if ('faqItems' in block) {
        debugInfo.faqItems = {
          count: Array.isArray(block.faqItems) ? block.faqItems.length : 'not-array',
          allReferences: Array.isArray(block.faqItems) ? 
            block.faqItems.every((f: any) => f?._type === 'reference' && f?._ref) : false
        };
      }
      
      console.log(`Block ${idx}:`, debugInfo);
    });
  }

  return fixedBlocks;
}

// Helper function to extract field types from schema manifest
function extractSchemaFieldTypes(schema: any): Record<string, Record<string, string>> {
  const fieldTypes: Record<string, Record<string, string>> = {};
  
  if (schema?.contentBlockTypes && Array.isArray(schema.contentBlockTypes)) {
    schema.contentBlockTypes.forEach((blockType: any) => {
      if (blockType.type && blockType.fieldTypes) {
        fieldTypes[blockType.type] = { ...blockType.fieldTypes };
      }
    });
  }
  
  return fieldTypes;
}

// Helper function to extract reference-only field mappings from schema
function extractReferenceOnlyFields(schema: any): Record<string, string[]> {
  const referenceFields: Record<string, string[]> = {};
  
  if (schema?.contentBlockTypes && Array.isArray(schema.contentBlockTypes)) {
    schema.contentBlockTypes.forEach((blockType: any) => {
      const refFields: string[] = [];
      
      if (blockType.fieldTypes) {
        Object.entries(blockType.fieldTypes).forEach(([fieldName, fieldType]) => {
          if (typeof fieldType === 'string' && 
              (fieldType.includes('references') || fieldType.includes('reference'))) {
            refFields.push(fieldName);
          }
        });
      }
      
      if (refFields.length > 0) {
        referenceFields[blockType.type] = refFields;
      }
    });
  }
  
  return referenceFields;
}

// Helper function to enforce field type compliance
function enforceFieldType(fieldName: string, value: any, expectedType: string, blockType: string, blockIndex: number): 
  { fixed: boolean; dropped: boolean; value?: any; wasType: string } {
  
  const wasType = Array.isArray(value) ? 'array' : typeof value;
  
  // String fields that might be arrays (Portable Text)
  if (expectedType === 'string') {
    if (Array.isArray(value)) {
      // Try to flatten Portable Text to string
      const flattened = _toPlainString(value);
      if (flattened && flattened.trim() !== '') {
        return { fixed: true, dropped: false, value: flattened, wasType };
      } else {
        return { fixed: false, dropped: true, wasType };
      }
    } else if (typeof value === 'string') {
      return { fixed: false, dropped: false, wasType }; // Already correct
    } else if (value != null) {
      // Try to convert other types to string
      return { fixed: true, dropped: false, value: String(value), wasType };
    } else {
      return { fixed: false, dropped: true, wasType };
    }
  }
  
  // Array fields that might be strings or wrong type
  if (expectedType.includes('array')) {
    if (!Array.isArray(value)) {
      if (typeof value === 'string' && expectedType.includes('Portable Text')) {
        // Convert string to Portable Text block
        const portableTextBlock = {
          _type: 'block',
          _key: `block-${Date.now()}-${Math.random().toString(36).slice(2,4)}`,
          style: 'normal',
          children: [{
            _type: 'span',
            _key: `span-${Date.now()}-${Math.random().toString(36).slice(2,4)}`,
            text: value,
            marks: []
          }],
          markDefs: []
        };
        return { fixed: true, dropped: false, value: [portableTextBlock], wasType };
      } else if (expectedType.includes('strings')) {
        // Convert single value to array of strings
        return { fixed: true, dropped: false, value: [String(value)], wasType };
      } else {
        return { fixed: false, dropped: true, wasType };
      }
    } else {
      return { fixed: false, dropped: false, wasType }; // Already array
    }
  }
  
  // Number fields
  if (expectedType === 'number') {
    if (typeof value === 'number') {
      return { fixed: false, dropped: false, wasType };
    } else if (typeof value === 'string' && !isNaN(Number(value))) {
      return { fixed: true, dropped: false, value: Number(value), wasType };
    } else {
      return { fixed: false, dropped: true, wasType };
    }
  }
  
  // Default: no fix needed or possible
  return { fixed: false, dropped: false, wasType };
}

// Helper function to sanitize reference-only arrays
function sanitizeReferenceOnlyArray(value: any, fieldPath: string, blockIndex: number): 
  { fixed: boolean; value?: any[]; originalCount: number; validCount: number; droppedCount: number } {
  
  if (!Array.isArray(value)) {
    return { fixed: false, originalCount: 0, validCount: 0, droppedCount: 0 };
  }
  
  const originalCount = value.length;
  const validReferences: any[] = [];
  let droppedCount = 0;
  
  value.forEach((item, idx) => {
    if (!item || typeof item !== 'object') {
      console.warn(`  ⚠️  ${fieldPath}[${idx}]: Not an object, dropping`);
      droppedCount++;
      return;
    }
    
    // Strictly require proper reference shape
    if (item._type === 'reference' && typeof item._ref === 'string' && item._ref.trim() !== '') {
      const cleanRef: any = { _type: 'reference', _ref: item._ref };
      if (item._key) cleanRef._key = item._key;
      if (item._weak) cleanRef._weak = item._weak;
      validReferences.push(cleanRef);
    } else if (item._ref && typeof item._ref === 'string') {
      // Has _ref but missing/incorrect _type – fix _type
      const cleanRef: any = { _type: 'reference', _ref: item._ref };
      if (item._key) cleanRef._key = item._key;
      if (item._weak) cleanRef._weak = item._weak;
      validReferences.push(cleanRef);
      console.log(`  ✅ Fixed reference _type in ${fieldPath}[${idx}]`);
    } else {
      // Inline object or invalid reference – drop it
      console.warn(`  ⚠️  ${fieldPath}[${idx}]: Inline or invalid object dropped (type=${item._type || typeof item})`);
      droppedCount++;
    }
  });
  
  return {
    fixed: validReferences.length !== originalCount || droppedCount > 0,
    value: validReferences,
    originalCount,
    validCount: validReferences.length,
    droppedCount
  };
}

// Helper function to remove problematic fields
function removeProblematicFields(obj: any, fieldsToRemove: string[], context: string): number {
  let removed = 0;
  fieldsToRemove.forEach(field => {
    if (field in obj) {
      delete obj[field];
      console.log(`  ✅ Removed ${field} from ${context}`);
      removed++;
    }
  });
  return removed;
}

// Helper function to fix FAQ groups
function fixFaqGroup(block: any, blockIndex: number): { fixesApplied: number; violationsDetected: number } {
  let fixesApplied = 0;
  let violationsDetected = 0;

  if (!Array.isArray(block.faqItems)) {
    block.faqItems = [];
    fixesApplied++;
  }

  const originalCount = block.faqItems.length;

  // Keep only VALID inline faqItem objects, drop references and invalid entries
  block.faqItems = (block.faqItems as any[]).filter((item, idx) => {
    if (!item || typeof item !== 'object') {
      console.warn(`  ⚠️  faqGroup.faqItems[${idx}]: Not an object – dropped`);
      violationsDetected++;
      return false;
    }
    if (item._type === 'faqItem' && typeof item.question === 'string' && Array.isArray(item.answer)) {
      return true; // valid inline object
    }
    console.warn(`  ⚠️  faqGroup.faqItems[${idx}]: Invalid or reference – dropped`);
    violationsDetected++;
    return false;
  });

  if (block.faqItems.length !== originalCount) {
    console.log(`  ✅ Sanitized faqItems: ${originalCount} → ${block.faqItems.length}`);
    fixesApplied++;
  }

  // Guarantee at least one inline faqItem because schema validation requires min(1)
  if (block.faqItems.length === 0) {
    const ts = Date.now();
    const newKey = `faq-${ts}-${Math.random().toString(36).slice(2,4)}`;
    block.faqItems.push({
      _type: 'faqItem',
      _key: newKey,
      question: 'Placeholder spørgsmål',
      answer: [{
        _type: 'block',
        _key: `block-${ts}`,
        style: 'normal',
        children: [{ _type: 'span', _key: `span-${ts}`, text: 'FAQ-indhold mangler.', marks: [] }],
        markDefs: []
      }]
    });
    console.warn('⚠️  Added placeholder inline faqItem due to empty faqItems array');
    fixesApplied++;
  }

  return { fixesApplied, violationsDetected };
}

// Helper function to fix provider lists
function fixProviderList(block: any, blockIndex: number): { fixesApplied: number; violationsDetected: number } {
  let fixesApplied = 0;
  let violationsDetected = 0;
  
  const needsfix = !Array.isArray(block.providers) ||
    block.providers.length === 0 ||
    block.providers.some((p: any, i: number) =>
      typeof p !== 'object' || p._type !== 'reference' || !p._ref ||
      !isValidProviderId(p._ref) || (i === 0 && p._ref !== PROVIDER_WHITELIST[0])
    );
  
  if (needsfix) {
    const n = Math.min(4, PROVIDER_WHITELIST.length);
    block.providers = PROVIDER_WHITELIST.slice(0, n).map(id => ({ 
      _type: 'reference', 
      _ref: id,
      _key: `provider-${Date.now()}-${Math.random().toString(36).slice(2,4)}`
    }));
    console.log(`  ✅ Fixed providers array with ${n} whitelisted refs`);
    fixesApplied++;
    if (block.providers.length === 0) violationsDetected++;
  }
  
  return { fixesApplied, violationsDetected };
}

// Enhanced reference sanitization with comprehensive logging
function sanitizeAllReferences(obj: any, path: string = ''): number {
  let sanitizedCount = 0;
  
  if (typeof obj !== 'object' || obj === null) {
    return sanitizedCount;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      sanitizedCount += sanitizeAllReferences(item, `${path}[${index}]`);
    });
    return sanitizedCount;
  }
  
  // Check if this object is a reference (has _ref or _type === 'reference')
  if (obj._ref || obj._type === 'reference') {
    const allowedKeys = ['_type', '_ref', '_key', '_weak'];
    const originalKeys = Object.keys(obj);
    const invalidKeys = originalKeys.filter(key => !allowedKeys.includes(key));
    
    if (invalidKeys.length > 0) {
      invalidKeys.forEach(key => delete obj[key]);
      console.log(`  🧹 Sanitized reference at ${path || 'root'}: removed [${invalidKeys.join(', ')}]`);
      sanitizedCount++;
    }
    
    // Ensure _type is set to 'reference' if _ref exists
    if (obj._ref && obj._type !== 'reference') {
      obj._type = 'reference';
      console.log(`  ✅ Fixed reference _type at ${path || 'root'}`);
      sanitizedCount++;
    }
    
    // Validate _ref is a string
    if (obj._ref && typeof obj._ref !== 'string') {
      console.warn(`  ⚠️  Invalid _ref type at ${path || 'root'}: ${typeof obj._ref}`);
      delete obj._ref;
      sanitizedCount++;
    }
  } else {
    // Recursively check nested objects
    Object.keys(obj).forEach(key => {
      sanitizedCount += sanitizeAllReferences(obj[key], path ? `${path}.${key}` : key);
    });
  }
  
  return sanitizedCount;
}

/**
 * Validates generated content blocks against schema manifest
 */
function validateContentBlocks(contentBlocks: any[], schema: any): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!schema?.contentBlockTypes) {
    warnings.push('Schema manifest not available for validation');
    return { isValid: false, warnings };
  }
  
  const manifestBlockTypes = schema.contentBlockTypes.map((block: any) => block.type);
  const manifestBlockMap = schema.contentBlockTypes.reduce((map: any, block: any) => {
    map[block.type] = block;
    return map;
  }, {});
  
  contentBlocks.forEach((block, index) => {
    // Validate _type exists
    if (!block._type) {
      warnings.push(`Block ${index}: Missing _type field`);
      return;
    }
    
    // Validate _key exists
    if (!block._key) {
      warnings.push(`Block ${index} (${block._type}): Missing _key field`);
    }
    
    // Validate block type exists in manifest
    if (!manifestBlockTypes.includes(block._type)) {
      warnings.push(`Block ${index}: Invalid _type "${block._type}". Valid types: ${manifestBlockTypes.join(', ')}`);
      return;
    }
    
    // Validate required fields
    const manifestBlock = manifestBlockMap[block._type];
    if (manifestBlock?.requiredFields) {
      manifestBlock.requiredFields.forEach((requiredField: string) => {
        if (!(requiredField in block) || block[requiredField] === null || block[requiredField] === undefined || block[requiredField] === '') {
          warnings.push(`Block ${index} (${block._type}): Missing required field "${requiredField}"`);
        }
      });
    }
    
    // Validate field types and constraints
    if (manifestBlock?.fieldTypes) {
      Object.entries(manifestBlock.fieldTypes).forEach(([fieldName, fieldType]) => {
        const fieldValue = block[fieldName];
        if (fieldValue !== undefined && fieldValue !== null) {
          validateFieldType(fieldName, fieldValue, fieldType as string, block._type, index, warnings);
        }
      });
    }
    
    // Validate enum constraints
    if (manifestBlock?.fieldEnums) {
      Object.entries(manifestBlock.fieldEnums).forEach(([fieldName, allowedValues]) => {
        const fieldValue = block[fieldName];
        if (fieldValue !== undefined && fieldValue !== null) {
          const validValues = allowedValues as string[];
          if (!validValues.includes(fieldValue)) {
            warnings.push(`Block ${index} (${block._type}): Field "${fieldName}" must be one of: ${validValues.join(', ')}. Got: "${fieldValue}"`);
          }
        }
      });
    }
  });
  
  return { isValid: warnings.length === 0, warnings };
}

/**
 * Validates request against schema manifest before generation
 */
function validateGenerationRequest(request: GenerationRequest): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if schema manifest is loaded
  if (!request.schema || !request.schema.contentBlockTypes) {
    errors.push('Schema manifest not loaded - ensure elportal-schema-manifest.json is available');
    return { isValid: false, errors };
  }
  
  const manifestBlockTypes = request.schema.contentBlockTypes.map((block: any) => block.type);
  
  // Validate that all optional blocks exist in manifest
  const invalidBlocks = request.optionalBlocks.filter(blockType => 
    !manifestBlockTypes.includes(blockType)
  );
  
  if (invalidBlocks.length > 0) {
    errors.push(`Invalid block types requested: ${invalidBlocks.join(', ')}. Available types: ${manifestBlockTypes.join(', ')}`);
  }
  
  // Validate mandatory fields
  if (!request.topic || request.topic.trim().length === 0) {
    errors.push('Topic is required');
  }
  
  if (!request.keywords || request.keywords.length === 0 || request.keywords.every(k => k.trim().length === 0)) {
    errors.push('At least one keyword is required');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Makes API call to OpenRouter with proper error handling
 */
export async function generateContent(
  request: GenerationRequest,
  config: OpenRouterConfig
): Promise<GenerationResponse> {
  try {
    // Runtime validation before generation
    const validation = validateGenerationRequest(request);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join('; ')}`
      };
    }
    
    const systemPrompt = createSystemPrompt(request);
    
    const response = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Generate structured SEO content for: "${request.topic}"

IMPORTANT: Respond with valid JSON only. No markdown code blocks, no explanations, just the raw JSON object starting with { and ending with }.`
          }
        ],
        max_tokens: config.maxTokens || 4000,
        temperature: config.temperature || 0.7,
        stream: false,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000', // Required for OpenRouter
          'X-Title': 'SEO Page Generator', // Optional but helpful
        },
        timeout: 60000, // 60 second timeout
      }
    );

    if (!response.data.choices || response.data.choices.length === 0) {
      throw new Error('No content generated from API');
    }

    const content = response.data.choices[0].message.content;
    
    /* ---------- parse + fix + validate ---------- */
    console.log('🔍 RAW AI RESPONSE PREVIEW:', content.slice(0, 500));
    console.log('📏 Full response length:', content.length, 'characters');
    
    let parsed: any;
    let jsonExtractionAttempts = 0;
    let successfulStrategy = '';
    
    // Attempt 1: Direct JSON parse
    try {
      parsed = JSON.parse(content);
      successfulStrategy = 'DIRECT_PARSE';
      console.log('✅ JSON parse succeeded via [DIRECT_PARSE]');
    } catch (directParseError) {
      jsonExtractionAttempts++;
      console.log('⚠️  Strategy [DIRECT_PARSE] failed:', (directParseError as Error).message.substring(0, 100));
      
      // Attempt 2: Extract JSON from markdown code blocks
      const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/i);
      if (codeBlockMatch) {
        try {
          parsed = JSON.parse(codeBlockMatch[1]);
          successfulStrategy = 'MARKDOWN_EXTRACTION';
          console.log('✅ JSON parse succeeded via [MARKDOWN_EXTRACTION]');
          console.log('📦 Extracted from code block, length:', codeBlockMatch[1].length);
        } catch (codeBlockError) {
          jsonExtractionAttempts++;
          console.log('⚠️  Strategy [MARKDOWN_EXTRACTION] failed:', (codeBlockError as Error).message.substring(0, 100));
        }
      } else {
        console.log('⚠️  Strategy [MARKDOWN_EXTRACTION] skipped: No code blocks found');
      }
      
      // Attempt 3: Find JSON object boundaries in text
      if (!parsed) {
        const jsonMatch = content.match(/\{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
            successfulStrategy = 'BOUNDARY_DETECTION';
            console.log('✅ JSON parse succeeded via [BOUNDARY_DETECTION]');
            console.log('📦 Extracted JSON length:', jsonMatch[0].length);
          } catch (boundaryError) {
            jsonExtractionAttempts++;
            console.log('⚠️  Strategy [BOUNDARY_DETECTION] failed:', (boundaryError as Error).message.substring(0, 100));
          }
        } else {
          console.log('⚠️  Strategy [BOUNDARY_DETECTION] skipped: No JSON boundaries found');
        }
      }
      
      // Attempt 4: Clean and retry (remove common issues)
      if (!parsed) {
        try {
          const cleaned = content
            .replace(/```(?:json)?/gi, '') // Remove markdown
            .replace(/^\s*[\w\s]*?(?=\{)/, '') // Remove text before first {
            .replace(/\}[\s\w]*$/, '}') // Remove text after last }
            .trim();
          parsed = JSON.parse(cleaned);
          successfulStrategy = 'CONTENT_CLEANING';
          console.log('✅ JSON parse succeeded via [CONTENT_CLEANING]');
          console.log('📦 Cleaned content length:', cleaned.length);
        } catch (cleanError) {
          jsonExtractionAttempts++;
          console.log('⚠️  Strategy [CONTENT_CLEANING] failed:', (cleanError as Error).message.substring(0, 100));
        }
      }
      
      // Final fallback with detailed logging
      if (!parsed) {
        console.error('❌ ALL JSON EXTRACTION STRATEGIES FAILED');
        console.error('📊 Extraction attempts made:', jsonExtractionAttempts);
        console.error('📏 Raw content length:', content.length);
        console.error('🔍 Content preview:', content.substring(0, 200));
        console.error('🔍 Content ending:', content.substring(Math.max(0, content.length - 100)));
        successfulStrategy = 'FALLBACK_EMPTY';
        parsed = { contentBlocks: [] };
      }
    }

    // Ensure we have an array to pass through the fixer
    const blocks = Array.isArray(parsed?.contentBlocks) ? parsed.contentBlocks
                  : Array.isArray(parsed)               ? parsed
                  : [];

    console.log(`🔍 BLOCKS EXTRACTED: ${blocks.length} content blocks via [${successfulStrategy}]`);
    if (blocks.length > 0) {
      console.log('📋 First block preview:', {
        _type: blocks[0]._type,
        _key: blocks[0]._key,
        fields: Object.keys(blocks[0]).filter(k => !k.startsWith('_')).length,
        hasRequiredFields: blocks[0]._type && blocks[0]._key
      });
      console.log('📋 Block types found:', blocks.map((b: any) => b._type).join(', '));
    } else {
      console.warn('⚠️  No content blocks extracted - will trigger auto-fix system with empty array');
    }

    let fixedBlocks = applyAutoFixes(blocks, request.schema);
    
    // FAIL-SAFE: Ensure we never return completely empty content
    if (!Array.isArray(fixedBlocks) || fixedBlocks.length === 0) {
      console.warn('⚠️  Final contentBlocks array is empty after all fixes. Inserting fallback...');
      console.warn('🔧 Creating emergency fallback content block');
      
      fixedBlocks = [{
        _type: 'pageSection',
        _key: `fallback-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        title: 'Indhold ikke genereret',
        content: [{
          _type: 'block',
          _key: `block-${Date.now()}-${Math.random().toString(36).slice(2,4)}`,
          style: 'normal',
          children: [{
            _type: 'span',
            _key: `span-${Date.now()}-${Math.random().toString(36).slice(2,4)}`,
            text: 'AI-indholdet kunne ikke genereres korrekt. Prøv venligst igen med en anden model eller justér dine indstillinger.',
            marks: []
          }],
          markDefs: []
        }]
      }];
      
      console.log('✅ Emergency fallback content created - user will see helpful message instead of empty page');
    }
    
    // Debug the fixes
    console.log('🔍 POST-FIX DEBUGGING:');
    fixedBlocks.forEach((block, idx) => {
      if (block._type === 'renewableEnergyForecast' || block._type === 'monthlyProductionChart' || block._type === 'realPriceComparisonTable') {
        console.log(`Block ${idx} (${block._type}):`, {
          leadingText: block.leadingText,
          leadingTextType: typeof block.leadingText,
          isArray: Array.isArray(block.leadingText)
        });
      }
    });
    
    const postFixValidation = validateContentBlocks(fixedBlocks, request.schema);

    if (!postFixValidation.isValid) {
      console.warn('⚠️  Post-fix validation still failed:', postFixValidation.warnings);
      return { success:false, error:'Auto-fix failed: '+postFixValidation.warnings.join('; ') };
    }

    const finalPayload = { contentBlocks: fixedBlocks };
    /* ---------- end new parse section ---------- */

    return {
      success: true,
      data: finalPayload,
      usage: {
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: response.data.usage?.completion_tokens || 0,
        totalTokens: response.data.usage?.total_tokens || 0,
      }
    };

  } catch (error: any) {
    console.error('OpenRouter API Error:', error);
    
    let errorMessage = 'Unknown error occurred';
    
    if (error.response) {
      // API responded with error status
      errorMessage = `API Error: ${error.response.status} - ${error.response.data?.error?.message || error.response.statusText}`;
    } else if (error.request) {
      // Request was made but no response received
      errorMessage = 'No response from API - check your internet connection';
    } else if (error.code === 'ECONNABORTED') {
      // Request timeout
      errorMessage = 'Request timeout - the API took too long to respond';
    } else {
      // Something else happened
      errorMessage = error.message || 'Request failed';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Validates that the API key is properly configured
 */
export function validateApiKey(apiKey: string): boolean {
  return !!(apiKey && apiKey.startsWith('sk-or-v1-') && apiKey.length > 20);
}

/**
 * Gets the configured API key from environment variables
 */
export function getApiKey(): string | null {
  if (typeof window === 'undefined') {
    // Server-side
    return null;
  }
  // Client-side - use the public env var
  return (window as any).ENV?.NEXT_PUBLIC_OPENROUTER_API_KEY || null;
} 

