# SEO Page Generator App — Project Description

## 🎯 Purpose

Build a web-based internal tool that generates **long-form, structured, Sanity-compatible** SEO content for ElPortal.dk. The app will allow you to:

* Upload schema files (e.g., Sanity block specs)
* Define SEO topics and keywords
* Adjust tone of voice and content intent
* Generate rich `contentBlocks` for Sanity
* Export valid `.ndjson` files for direct import
* Export **`.tar.gz`** bundles that include `.ndjson` + assets for full Sanity import
* Optionally preview, edit, and control output block-by-block
* Generate a README-style `project-description.md` file inside the repo that documents all plans and requirements clearly from the start

This tool is **not** just an article writer — it is a structured **page layout + content generator** for a programmatic SEO system.

---

## 🛠️ Tech Stack

* **Frontend**: Next.js with TypeScript
* **State management**: React state with Context API
* **Styling**: TailwindCSS
* **AI Provider**: OpenRouter API (to use Claude, GPT-4o, Mistral, etc.)
* **Deployment**: Vercel
* **Sanity Export Format**: `.ndjson` (Newline-delimited JSON) and `.tar.gz` (with asset bundling)

---

## 🌐 Required API Access

To connect to OpenRouter, you'll need:

* An account with [https://openrouter.ai](https://openrouter.ai)
* An API key from your OpenRouter dashboard

Store it as an environment variable:

```bash
NEXT_PUBLIC_OPENROUTER_API_KEY=your-api-key-here
```

---

## 📥 Input Fields (Frontend)

### 1. **Topic** (string)
> What is this page about? Ex: "Elpriser i DK2 om vinteren"

### 2. **Target Keywords** (array of strings)
> SEO keywords you want included. Ex: `elpriser vinter`, `dk2 el`, `forbrug om natten`

### 3. **Content Goal** (select)
* Educate
* Compare
* Convert

### 4. **Tone of Voice** (select or custom input)
* Friendly
* Technical
* Journalistic
* Brand voice (custom)

### 5. **Schema Upload (file)**
> Upload a `.json`, `.pdf`, or `.md` file of your current content block schema (ElPortal or ElPrisFinder)

**⚠️ This schema is mission-critical. The AI must understand it fully and align all output strictly to its structure.**

### 6. **Example Page Upload (optional)**
> Upload 1–3 existing `contentBlocks` from good pages to influence layout or tone.

### 7. **Toggle Blocks (multi-select)**
> Include optional blocks:
* ✅ Price Calculator
* ✅ Live Price Graph
* ✅ Forecast Chart
* ✅ FAQ Section
* ✅ Provider List

### 8. **Content Length Control**
* Short (600–1000 words)
* Medium (1000–2000)
* Long (2000+)
* *We default to long unless otherwise selected*

---

## 🤖 AI Prompting Plan

The backend prompt engine will:

1. Parse and understand uploaded schema (block types, fields, required elements)
2. Structure a `contentBlocks` layout for the given topic, using your strategy
3. Generate long-form, human-like content **per block**
4. Respect tone, keywords, content length, and Danish context
5. Output **valid NDJSON (1 line per document)** with:
   * `_type`, `_key` fields
   * Rich text arrays with proper nesting
   * Optional references to components (e.g., `priceCalculator`, `providerList`)
6. Optionally package content + dummy assets into a `.tar.gz` archive ready for Sanity import

---

## 🧾 Output Format

* Final output = `.ndjson` file
* Optional output = `.tar.gz` bundle (includes `.ndjson` and placeholder images)
* Each generated page = one JSON line
* Export buttons for both `.ndjson` and `.tar.gz`
* Optional: "Copy to clipboard" output

---

## 🪜 Roadmap (MVP First)

### Phase 1: MVP
* Basic form with all required inputs
* OpenRouter API integration
* Schema parsing and validation
* Content generation with proper block structure
* NDJSON export functionality

### Phase 2: Editor Features
* Preview generated content
* Block-by-block editing
* Real-time content adjustments
* Enhanced schema support

### Phase 3: Publishing & API integration
* tar.gz bundle creation
* Asset placeholder generation
* Batch processing capabilities
* Advanced schema management

---

## 🔒 Notes & Best Practices

* All block content should be valid JSON and match schema requirements
* Always include `_type` and `_key`
* Rich text fields should use Sanity block array format (`_type: block`, `children: span[]`)
* Never hallucinate unsupported blocks
* Add placeholders for missing data (e.g., `image.asset._ref`)
* AI must understand and **strictly follow** the structure and field definitions in your uploaded schemas
* Ensure generated content is not just long, but **well-structured, visually balanced, and useful**

---

## ✅ Success Criteria

* Generate structured, SEO-optimized content layouts for Sanity
* Avoid AI-fluff: produce real, high-quality content
* Maintain schema alignment across all output
* Enable reuse at scale for programmatic SEO
* Support `.tar.gz` output for content + assets
* Include project description inside the repo from the beginning

---

## 📂 Project Structure

```
seo-page-builder/
├── public/
│   └── placeholder-assets/        # Optional sample images for tar.gz bundles
├── schemas/
│   └── elportal-schema.json       # Your Sanity content block schema (ElPortal)
│   └── elprisfinder-schema.json   # Your alternate schema (ElPrisFinder)
├── examples/
│   └── example-page.ndjson        # Sample generated page for testing
├── src/
│   ├── components/                # Reusable UI components
│   ├── pages/                     # App routes
│   │   └── index.tsx              # Main UI
│   ├── utils/
│   │   └── openrouter.ts          # Handles API connection to Claude/GPT
│   │   └── ndjsonBuilder.ts       # Converts output to .ndjson format
│   │   └── tarballBuilder.ts      # Optional: creates .tar.gz with assets
│   └── styles/
│       └── globals.css
├── .env.local.example             # Placeholder for API key config
├── README.md                      # Installation and usage instructions
├── project-description.md         # This file - full project plan
├── dev_log.md                     # Development session log
├── package.json
├── tsconfig.json
├── next.config.js
└── tailwind.config.js
```

---

## 🚀 Getting Started

1. Set up environment variables
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Upload your schema files to `/schemas/`
5. Configure your OpenRouter API key
6. Start generating structured SEO content!

This tool is designed to scale programmatic SEO for ElPortal.dk while maintaining high content quality and proper Sanity CMS integration. 