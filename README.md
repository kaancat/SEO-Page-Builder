# SEO Page Generator

A powerful internal tool for generating structured, SEO-optimized content for Sanity CMS. Built specifically for ElPortal.dk to scale programmatic SEO content creation.

## 🎯 Purpose

This tool generates **long-form, structured, Sanity-compatible** SEO content that can be directly imported into your CMS. It's designed for programmatic SEO at scale, not just simple article writing.

## ✨ Features

- **AI-Powered Content Generation**: Uses OpenRouter API to access multiple AI models (Claude, GPT-4o, etc.)
- **Schema-Aware**: Uploads and strictly follows your Sanity content block schemas
- **Danish SEO Optimized**: Built specifically for ElPortal.dk and Danish energy market content
- **Multiple Export Formats**: 
  - NDJSON files for direct Sanity import
  - ZIP packages with assets and documentation
  - Clipboard export for quick testing
- **Flexible Content Controls**: Topic, keywords, tone, length, and optional blocks
- **Example-Based Learning**: Upload existing pages to influence content style

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- OpenRouter API account and key ([Get one here](https://openrouter.ai/keys))

### Installation

1. **Clone and install**:
```bash
git clone <repository-url>
cd seo-page-generator
npm install
```

2. **Set up environment variables**:
```bash
# Copy the example and add your API key
cp env.example .env.local

# Edit .env.local and add your OpenRouter API key:
NEXT_PUBLIC_OPENROUTER_API_KEY=sk-or-v1-your-api-key
```

3. **Start development server**:
```bash
npm run dev
```

4. **Open in browser**:
```
http://localhost:3000
```

## 📋 Usage Guide

### 1. Configure API Settings
- Enter your OpenRouter API key
- Select your preferred AI model (Claude 3 Sonnet recommended)

### 2. Define Content Parameters
- **Topic**: What the page is about (e.g., "Elpriser i DK2 om vinteren")
- **Keywords**: Target SEO keywords (comma-separated)
- **Content Goal**: Educate, Compare, or Convert
- **Tone**: Friendly, Technical, Journalistic, or Brand Voice
- **Length**: Short (600-1000), Medium (1000-2000), or Long (2000+)

### 3. Upload Schema & Examples
- **Schema File**: Upload your Sanity content block schema (JSON, PDF, or MD)
- **Example Pages**: Optionally upload existing NDJSON files for style reference

### 4. Select Optional Blocks
Choose which interactive components to include:
- Price Calculator
- Live Price Graph
- Forecast Chart
- FAQ Section
- Provider List

### 5. Generate & Export
- Click "Generate SEO Content" 
- Review the generated content
- Export as NDJSON or ZIP package
- Import directly into Sanity

## 📁 Project Structure

```
seo-page-generator/
├── src/
│   ├── components/          # Reusable UI components
│   ├── pages/              # Next.js pages
│   │   └── index.tsx       # Main application interface
│   ├── utils/              # Core utilities
│   │   ├── openrouter.ts   # AI API integration
│   │   ├── ndjsonBuilder.ts # NDJSON export functionality
│   │   └── tarballBuilder.ts # ZIP package creation
│   └── styles/
│       └── globals.css     # Global styles and components
├── schemas/                # Example schema files
├── examples/               # Example generated content
├── public/                 # Static assets
├── project-description.md  # Detailed project specification
└── dev_log.md             # Development session log
```

## 🛠️ Technical Details

### AI Integration
- Uses OpenRouter API for access to multiple AI models
- Sophisticated prompt engineering for schema compliance
- Supports Claude 3, GPT-4o, Mistral, and other models
- Handles rate limiting and error recovery

### Content Generation
- Parses and validates uploaded schemas
- Generates proper Sanity content blocks with `_type` and `_key` fields
- Converts plain text to Sanity's rich text block format
- Includes Danish language optimization and SEO best practices

### Export Formats
- **NDJSON**: One line per document, ready for `sanity dataset import`
- **ZIP Package**: Includes NDJSON, placeholder assets, and documentation
- **Clipboard**: Quick copy for testing and development

### Schema System
The application uses ElPortal's simplified schema manifest to ensure generated pages are fully compatible with the existing Sanity CMS structure. The schema is automatically loaded on startup from:

- `elportal-schema-manifest.json` - Simplified content block definitions with exact required fields

The manifest defines 15 content block types based on the real ElPortal homepage:
- **Mandatory blocks**: `hero`, `pageSection` (always included)
- **Optional blocks**: `featureList`, `featureItem`, `valueProposition`, `providerList`, `livePriceGraph`, `renewableEnergyForecast`, `priceExampleTable`, `videoSection`, `monthlyProductionChart`, `faqGroup`, `faqItem`, `callToActionSection`, `realPriceComparisonTable`

Each block type includes:
- `type`: Exact block name for Sanity CMS
- `requiredFields`: Array of mandatory fields
- `description`: Clear explanation of block purpose

### Schema Compliance
- Strict adherence to manifest-defined block types and required fields
- Validates content blocks before export
- Never hallucinates unsupported block types
- Includes proper field validation and error handling
- Users can override the schema by uploading custom JSON files if needed

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler
```

### Environment Variables

```bash
# Required
NEXT_PUBLIC_OPENROUTER_API_KEY=sk-or-v1-your-api-key

# Optional
NEXT_PUBLIC_DEFAULT_MODEL=anthropic/claude-3-sonnet
NODE_ENV=development
DEBUG_MODE=true
```

## 📊 Content Quality Standards

This tool is designed to generate high-quality, useful content that:

- Follows ElPortal.dk brand voice and style
- Includes relevant Danish energy market context
- Maintains proper SEO structure and keyword usage
- Provides genuine value to readers (not AI fluff)
- Follows Sanity CMS best practices for content structure

## 🚨 Important Notes

### Schema Requirements
- Upload your actual Sanity schema files for best results
- The tool will strictly follow your schema structure
- Invalid schemas will cause generation failures

### API Usage
- OpenRouter API calls are metered and billed
- Longer content and more complex schemas use more tokens
- Monitor your usage in the OpenRouter dashboard

### Content Review
- Always review generated content before publishing
- The tool generates structured drafts, not final copy
- Customize and refine content as needed for your specific use case

## 🔗 Related Resources

- [OpenRouter API Documentation](https://openrouter.ai/docs)
- [Sanity CMS Documentation](https://www.sanity.io/docs)
- [ElPortal.dk Schema Reference](./schemas/elportal-schema.json)

## 📝 License

This is an internal tool for ElPortal.dk. Not for public distribution.

---

**Built with ❤️ for ElPortal.dk's SEO scaling needs** 