import React, { useState, useRef } from 'react';
import Head from 'next/head';
import { 
  generateContent, 
  GenerationRequest, 
  AVAILABLE_MODELS,
  validateApiKey,
  getApiKey 
} from '@/utils/openrouter';
import { 
  buildNDJSON, 
  downloadNDJSON, 
  copyToClipboard 
} from '@/utils/ndjsonBuilder';
import { 
  buildAndDownloadPackage 
} from '@/utils/tarballBuilder';

/**
 * Main SEO Page Generator Interface
 * Provides all inputs needed to generate structured Sanity content
 */
export default function SEOPageGenerator() {
  // Form state
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['']);
  const [contentGoal, setContentGoal] = useState<'educate' | 'compare' | 'convert'>('educate');
  const [toneOfVoice, setToneOfVoice] = useState('friendly');
  const [contentLength, setContentLength] = useState<'short' | 'medium' | 'long'>('long');
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-3-sonnet');
  const [optionalBlocks, setOptionalBlocks] = useState<string[]>([]);
  
  // File uploads
  const [schema, setSchema] = useState<any>(null);
  const [contentBlocksSchema, setContentBlocksSchema] = useState<any>(null);
  const [schemaLoadingStatus, setSchemaLoadingStatus] = useState<'loading' | 'loaded' | 'error' | 'custom'>('loading');
  const [schemaSource, setSchemaSource] = useState<string>('');
  const [examplePages, setExamplePages] = useState<any[]>([]);
  const [relatedPages, setRelatedPages] = useState<Array<{ title: string; url: string }>>([{ title: '', url: '' }]);
  const schemaFileRef = useRef<HTMLInputElement>(null);
  const exampleFileRef = useRef<HTMLInputElement>(null);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  // Initialize API key from environment
  React.useEffect(() => {
    const envKey = getApiKey();
    if (envKey) {
      setApiKey(envKey);
    }
  }, []);

  // Auto-load ElPortal schema manifest on component mount
  React.useEffect(() => {
    const loadDefaultSchemas = async () => {
      setSchemaLoadingStatus('loading');
      try {
        // Load simplified schema manifest
        const manifestResponse = await fetch('/schemas/elportal-schema-manifest.json');
        
        if (manifestResponse.ok) {
          const manifest = await manifestResponse.json();
          
          setSchema(manifest);
          setContentBlocksSchema(manifest); // Use same manifest for both
          setSchemaLoadingStatus('loaded');
          setSchemaSource('ElPortal schema manifest (elportal-schema-manifest.json)');
          
          // Extract content block types from the manifest
          const contentBlockTypes = manifest.contentBlockTypes || [];
          
                    console.log('✅ ElPortal schema manifest auto-loaded successfully');
          console.log('📊 Schema manifest loaded with', contentBlockTypes.length, 'content block types');
          console.log('🧱 Available blocks:', contentBlockTypes.map((block: any) => block.type).join(', '));
          console.log('📋 Mandatory blocks: hero, pageSection (always included)');
          console.log('🔧 Optional blocks:', contentBlockTypes.filter((block: any) => block.type !== 'hero' && block.type !== 'pageSection').map((block: any) => block.type).join(', '));
          console.log('📝 Block details:');
          contentBlockTypes.forEach((block: any) => {
            console.log(`   • ${block.type}: ${block.requiredFields.length} required fields (${block.requiredFields.join(', ')})`);
          });
        } else {
          throw new Error(`Failed to load schema manifest: ${manifestResponse.status}`);
        }
      } catch (error) {
        console.error('⚠️ Could not auto-load ElPortal schema manifest:', error);
        setSchemaLoadingStatus('error');
        setSchemaSource('Schema manifest loading failed - manual upload required');
      }
    };

    loadDefaultSchemas();
  }, []);

  /**
   * Handles keyword input changes
   * Supports comma-separated keywords
   */
  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...keywords];
    newKeywords[index] = value;
    setKeywords(newKeywords);
  };

  const addKeyword = () => {
    setKeywords([...keywords, '']);
  };

  const removeKeyword = (index: number) => {
    if (keywords.length > 1) {
      setKeywords(keywords.filter((_, i) => i !== index));
    }
  };

  /**
   * Handles related pages input changes
   */
  const handleRelatedPageChange = (index: number, field: 'title' | 'url', value: string) => {
    const newRelatedPages = [...relatedPages];
    newRelatedPages[index][field] = value;
    setRelatedPages(newRelatedPages);
  };

  const addRelatedPage = () => {
    setRelatedPages([...relatedPages, { title: '', url: '' }]);
  };

  const removeRelatedPage = (index: number) => {
    if (relatedPages.length > 1) {
      setRelatedPages(relatedPages.filter((_, i) => i !== index));
    }
  };

  /**
   * Handles schema file upload - overrides default ElPortal schema
   * Supports JSON, PDF, and Markdown files
   */
  const handleSchemaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        setSchema(parsed);
        setSchemaLoadingStatus('custom');
        setSchemaSource(`Custom schema (${file.name})`);
        console.log('📁 Custom schema uploaded:', file.name);
      } else {
        // For PDF and MD files, store as text for now
        setSchema({ content: text, filename: file.name });
        setSchemaLoadingStatus('custom');
        setSchemaSource(`Custom schema (${file.name})`);
      }
    } catch (error) {
      console.error('Failed to parse schema file:', error);
      alert('Failed to parse schema file. Please ensure it\'s valid JSON.');
    }
  };

  /**
   * Resets to default ElPortal schema manifest
   */
  const resetToDefaultSchema = () => {
    if (schemaLoadingStatus === 'loaded') {
      // Schema manifest is already loaded, just update the status
      setSchemaLoadingStatus('loaded');
      setSchemaSource('ElPortal schema manifest (elportal-schema-manifest.json)');
      console.log('✅ Reset to schema manifest confirmed');
    } else {
      // Reload the page to trigger manifest auto-loading
      React.startTransition(() => {
        window.location.reload();
      });
    }
  };

  /**
   * Handles example page uploads
   */
  const handleExampleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const examples: any[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        if (file.name.endsWith('.json') || file.name.endsWith('.ndjson')) {
          const parsed = JSON.parse(text);
          examples.push(parsed);
        } else {
          examples.push({ content: text, filename: file.name });
        }
      } catch (error) {
        console.error(`Failed to parse ${file.name}:`, error);
      }
    }

    setExamplePages(examples);
  };

  /**
   * Toggles optional content blocks
   */
  const toggleOptionalBlock = (blockKey: string) => {
    setOptionalBlocks(prev => 
      prev.includes(blockKey)
        ? prev.filter(b => b !== blockKey)
        : [...prev, blockKey]
    );
  };

  /**
   * Main content generation function
   */
  const handleGenerate = async () => {
    if (!topic.trim()) {
      alert('Please enter a topic');
      return;
    }

    if (!schema || schemaLoadingStatus === 'loading') {
      alert('Schema is still loading or not available. Please wait or upload a schema file.');
      return;
    }

    if (schemaLoadingStatus === 'error') {
      alert('Schema loading failed. Please upload a custom schema file to proceed.');
      return;
    }

    const cleanKeywords = keywords.filter(k => k.trim()).map(k => k.trim());
    if (cleanKeywords.length === 0) {
      alert('Please enter at least one keyword');
      return;
    }

    const currentApiKey = apiKey || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || '';
    if (!validateApiKey(currentApiKey)) {
      alert('Please provide a valid OpenRouter API key');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      // Filter related pages to only include complete entries
      const validRelatedPages = relatedPages.filter(page => page.title.trim() && page.url.trim());
      
      const request: GenerationRequest = {
        topic: topic.trim(),
        keywords: cleanKeywords,
        contentGoal,
        toneOfVoice,
        schema,
        examplePages: examplePages.length > 0 ? examplePages : undefined,
        optionalBlocks,
        contentLength,
        relatedPages: validRelatedPages.length > 0 ? validRelatedPages : undefined
      };

      const response = await generateContent(request, {
        apiKey: currentApiKey,
        model: selectedModel,
        maxTokens: 4000,
        temperature: 0.7
      });

      if (response.success && response.data) {
        setGeneratedContent(response.data);
      } else {
        setGenerationError(response.error || 'Generation failed');
      }
    } catch (error: any) {
      setGenerationError(error.message || 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Downloads generated content as NDJSON
   */
  const handleDownloadNDJSON = () => {
    if (!generatedContent) return;

    try {
      const { ndjson } = buildNDJSON(
        generatedContent,
        {
          title: topic,
          topic,
          keywords: keywords.filter(k => k.trim()),
          contentGoal
        }
      );

      const filename = `${topic.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.ndjson`;
      downloadNDJSON(ndjson, filename);
    } catch (error: any) {
      alert(`Failed to create NDJSON: ${error.message}`);
    }
  };

  /**
   * Downloads generated content as tar.gz package
   */
  const handleDownloadPackage = async () => {
    if (!generatedContent) return;

    try {
      const { ndjson } = buildNDJSON(
        generatedContent,
        {
          title: topic,
          topic,
          keywords: keywords.filter(k => k.trim()),
          contentGoal
        }
      );

      await buildAndDownloadPackage(
        ndjson,
        {
          topic,
          title: topic,
          keywords: keywords.filter(k => k.trim()),
          contentGoal,
          language: 'da'
        },
        {
          includeAssets: true,
          includeReadme: true,
          packageName: `seo-${topic.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        }
      );
    } catch (error: any) {
      alert(`Failed to create package: ${error.message}`);
    }
  };

  /**
   * Copies generated NDJSON to clipboard
   */
  const handleCopyToClipboard = async () => {
    if (!generatedContent) return;

    try {
      const { ndjson } = buildNDJSON(
        generatedContent,
        {
          title: topic,
          topic,
          keywords: keywords.filter(k => k.trim()),
          contentGoal
        }
      );

      const success = await copyToClipboard(ndjson);
      if (success) {
        alert('NDJSON copied to clipboard!');
      } else {
        alert('Failed to copy to clipboard');
      }
    } catch (error: any) {
      alert(`Failed to copy: ${error.message}`);
    }
  };

  // Optional content blocks based on manifest (hero and pageSection are always included)
  const optionalBlockTypes = [
    { key: 'featureList', label: 'Feature List' },
    { key: 'featureItem', label: 'Feature Item' },
    { key: 'valueProposition', label: 'Value Proposition' },
    { key: 'providerList', label: 'Provider List' },
    { key: 'livePriceGraph', label: 'Live Price Graph' },
    { key: 'renewableEnergyForecast', label: 'Renewable Energy Forecast' },
    { key: 'priceExampleTable', label: 'Price Example Table' },
    { key: 'videoSection', label: 'Video Section' },
    { key: 'monthlyProductionChart', label: 'Monthly Production Chart' },
    { key: 'faqGroup', label: 'FAQ Group' },
    { key: 'faqItem', label: 'FAQ Item' },
    { key: 'callToActionSection', label: 'Call to Action Section' },
    { key: 'realPriceComparisonTable', label: 'Real Price Comparison Table' }
  ];

  return (
    <>
      <Head>
        <title>SEO Page Generator - ElPortal.dk</title>
        <meta name="description" content="Generate structured SEO content for Sanity CMS" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              SEO Page Generator
            </h1>
            <p className="text-lg text-gray-600">
              Generate structured, Sanity-compatible content for ElPortal.dk
            </p>
          </div>

          {/* Main Form */}
          <div className="card mb-8">
            <div className="space-y-6">
              {/* API Key Configuration */}
              <div className="form-section">
                <h3 className="text-lg font-medium text-gray-900 mb-4">API Configuration</h3>
                <div>
                  <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                    OpenRouter API Key
                  </label>
                  <input
                    type="password"
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="input-field"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">OpenRouter</a>
                  </p>
                </div>

                <div>
                  <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
                    AI Model
                  </label>
                  <select
                    id="model"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="input-field"
                  >
                    {Object.entries(AVAILABLE_MODELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Content Configuration */}
              <div className="form-section">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Content Configuration</h3>
                
                <div>
                  <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
                    Topic *
                  </label>
                  <input
                    type="text"
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Elpriser i DK2 om vinteren"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Keywords *
                  </label>
                  {keywords.map((keyword, index) => (
                    <div key={index} className="flex mb-2">
                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) => handleKeywordChange(index, e.target.value)}
                        placeholder="e.g., elpriser vinter"
                        className="input-field flex-1 mr-2"
                      />
                      {keywords.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeKeyword(index)}
                          className="btn-secondary px-3"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addKeyword}
                    className="btn-secondary text-sm"
                  >
                    Add Keyword
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="contentGoal" className="block text-sm font-medium text-gray-700 mb-2">
                      Content Goal
                    </label>
                    <select
                      id="contentGoal"
                      value={contentGoal}
                      onChange={(e) => setContentGoal(e.target.value as any)}
                      className="input-field"
                    >
                      <option value="educate">Educate</option>
                      <option value="compare">Compare</option>
                      <option value="convert">Convert</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="toneOfVoice" className="block text-sm font-medium text-gray-700 mb-2">
                      Tone of Voice
                    </label>
                    <select
                      id="toneOfVoice"
                      value={toneOfVoice}
                      onChange={(e) => setToneOfVoice(e.target.value)}
                      className="input-field"
                    >
                      <option value="friendly">Friendly</option>
                      <option value="technical">Technical</option>
                      <option value="journalistic">Journalistic</option>
                      <option value="brand">Brand Voice</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contentLength" className="block text-sm font-medium text-gray-700 mb-2">
                      Content Length
                    </label>
                    <select
                      id="contentLength"
                      value={contentLength}
                      onChange={(e) => setContentLength(e.target.value as any)}
                      className="input-field"
                    >
                      <option value="short">Short (600-1000 words)</option>
                      <option value="medium">Medium (1000-2000 words)</option>
                      <option value="long">Long (2000+ words)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Schema Status & Upload */}
              <div className="form-section">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Schema Configuration</h3>
                
                {/* Schema Status Display */}
                <div className="mb-4 p-4 rounded-lg border">
                  {schemaLoadingStatus === 'loading' && (
                    <div className="flex items-center text-blue-600">
                      <div className="loading-spinner inline mr-2"></div>
                      <span className="font-medium">Loading ElPortal schemas...</span>
                    </div>
                  )}
                  
                  {schemaLoadingStatus === 'loaded' && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-green-600">
                        <span className="text-lg mr-2">✅</span>
                        <div>
                          <span className="font-medium">Schema Active: </span>
                          <span className="text-sm">{schemaSource}</span>
                        </div>
                      </div>
                      {schema && (
                        <span className="text-xs text-gray-500">
                          {schema.contentBlockTypes?.length || 0} content block types available
                        </span>
                      )}
                    </div>
                  )}
                  
                  {schemaLoadingStatus === 'error' && (
                    <div className="text-red-600">
                      <span className="text-lg mr-2">❌</span>
                      <span className="font-medium">Schema Error: </span>
                      <span className="text-sm">{schemaSource}</span>
                    </div>
                  )}
                  
                  {schemaLoadingStatus === 'custom' && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-purple-600">
                        <span className="text-lg mr-2">📁</span>
                        <div>
                          <span className="font-medium">Custom Schema: </span>
                          <span className="text-sm">{schemaSource}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={resetToDefaultSchema}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Reset to ElPortal Default
                      </button>
                    </div>
                  )}
                </div>

                {/* Optional Custom Schema Upload */}
                <div>
                  <label htmlFor="schema" className="block text-sm font-medium text-gray-700 mb-2">
                    Override with Custom Schema (Optional)
                  </label>
                  <input
                    type="file"
                    id="schema"
                    ref={schemaFileRef}
                    onChange={handleSchemaUpload}
                    accept=".json,.pdf,.md"
                    className="file-upload"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Upload a custom schema to override the default ElPortal schema
                  </p>
                </div>

                {/* Example Pages */}
                <div>
                  <label htmlFor="examples" className="block text-sm font-medium text-gray-700 mb-2">
                    Example Pages (Optional)
                  </label>
                  <input
                    type="file"
                    id="examples"
                    ref={exampleFileRef}
                    onChange={handleExampleUpload}
                    accept=".json,.ndjson"
                    multiple
                    className="file-upload"
                  />
                  {examplePages.length > 0 && (
                    <p className="mt-2 text-sm text-green-600">
                      ✓ {examplePages.length} example page(s) loaded
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Upload existing page examples to guide content generation style
                  </p>
                </div>
              </div>

              {/* Related Pages for Internal Linking */}
              <div className="form-section">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Related Pages for Linking (Optional)</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add existing pages that should be internally linked from this content. Links will be inserted naturally within the main content.
                </p>
                
                {relatedPages.map((page, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={page.title}
                      onChange={(e) => handleRelatedPageChange(index, 'title', e.target.value)}
                      placeholder="Page title (e.g., Elpriser i DK1)"
                      className="input-field"
                    />
                    <div className="flex">
                      <input
                        type="text"
                        value={page.url}
                        onChange={(e) => handleRelatedPageChange(index, 'url', e.target.value)}
                        placeholder="URL (e.g., /elpriser-dk1)"
                        className="input-field flex-1 mr-2"
                      />
                      {relatedPages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRelatedPage(index)}
                          className="btn-secondary px-3"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addRelatedPage}
                  className="btn-secondary text-sm"
                >
                  Add Related Page
                </button>
              </div>

              {/* Optional Blocks */}
              <div className="form-section">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Optional Content Blocks</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {optionalBlockTypes.map((blockType) => (
                    <label key={blockType.key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={optionalBlocks.includes(blockType.key)}
                        onChange={() => toggleOptionalBlock(blockType.key)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{blockType.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <div className="flex flex-col items-center">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !topic.trim() || schemaLoadingStatus === 'loading' || schemaLoadingStatus === 'error'}
                  className="btn-primary text-lg px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <div className="loading-spinner inline mr-2"></div>
                      Generating...
                    </>
                  ) : schemaLoadingStatus === 'loading' ? (
                    'Loading Schema...'
                  ) : schemaLoadingStatus === 'error' ? (
                    'Schema Error - Upload Required'
                  ) : (
                    'Generate SEO Content'
                  )}
                </button>
                
                {/* Status message */}
                <p className="mt-2 text-xs text-gray-500 text-center">
                  {schemaLoadingStatus === 'loaded' && '✅ Ready with ElPortal default schema'}
                  {schemaLoadingStatus === 'custom' && '📁 Ready with custom schema'}
                  {schemaLoadingStatus === 'loading' && '⏳ Loading schemas...'}
                  {schemaLoadingStatus === 'error' && '❌ Schema required for generation'}
                </p>
              </div>
            </div>
          </div>

          {/* Generation Error */}
          {generationError && (
            <div className="card mb-8 border-red-200 bg-red-50">
              <div className="text-red-800">
                <h3 className="font-medium mb-2">Generation Error</h3>
                <p className="text-sm">{generationError}</p>
              </div>
            </div>
          )}

          {/* Generated Content */}
          {generatedContent && (
            <div className="card">
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Generated Content</h3>
                
                {/* Export Buttons */}
                <div className="flex flex-wrap gap-3 mb-6">
                  <button
                    onClick={handleDownloadNDJSON}
                    className="btn-primary"
                  >
                    Download NDJSON
                  </button>
                  <button
                    onClick={handleDownloadPackage}
                    className="btn-primary"
                  >
                    Download Package (.zip)
                  </button>
                  <button
                    onClick={handleCopyToClipboard}
                    className="btn-secondary"
                  >
                    Copy to Clipboard
                  </button>
                </div>

                {/* Content Preview */}
                <div className="code-preview max-h-96 overflow-y-auto">
                  <pre>{JSON.stringify(generatedContent, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 