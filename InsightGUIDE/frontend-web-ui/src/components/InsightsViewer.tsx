"use client";

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; 
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Expand, Minimize, ServerCrash, Download, TestTube, Plus, Minus } from 'lucide-react';
import { cn, downloadAsFile, generateMarkdownFilename } from '@/lib/utils';

interface InsightsViewerProps {
  insights: string | null;
  isLoading: boolean;
  isUrlLoading: boolean;
  fileName: string | null;
  maximizedCard: 'insights' | 'pdf' | null;
  onToggleMaximize: () => void;
  onTestInsights?: (testContent: string) => void; 
}

export function InsightsViewer({
  insights,
  isLoading,
  isUrlLoading,
  fileName,
  maximizedCard,
  onToggleMaximize,
  onTestInsights,
}: InsightsViewerProps) {
  const isTestingEnabled = process.env.NEXT_PUBLIC_ENABLE_TESTING === 'true';
  
  const [textSize, setTextSize] = useState(14); 
  const minTextSize = 14; 
  const maxTextSize = 24; 
  
  const increaseTextSize = () => {
    setTextSize(prev => Math.min(prev + 2, maxTextSize));
  };
  
  const decreaseTextSize = () => {
    setTextSize(prev => Math.max(prev - 2, minTextSize));
  };

  const handleSaveInsights = () => {
    if (insights) {
      const filename = generateMarkdownFilename(fileName);
      downloadAsFile(insights, filename, 'text/markdown');
    }
  };

  const handleTestInsights = () => {
    if (onTestInsights) {
      const testMarkdown = `# Paper Analysis

## Critical figures/tables:

- **Table 1**: Summarizes dataset statistics (parsed files, references, matches).
- **Figure 1**: Workflow diagram illustrating data pipeline from DBLP ingestion to JSONL export.
- **Figure 2**: Example JSON record structure showing \`citing_paper\`, \`cited_papers\` fields, and identifier resolution.

## Key Findings

This paper presents a comprehensive analysis of citation networks with several important insights:

### Data Processing Pipeline

The authors developed a sophisticated pipeline that processes academic papers and extracts citation relationships. Key components include:

1. **Data Ingestion**: Raw paper data from multiple sources
2. **Citation Extraction**: Using \`extract_citations()\` function
3. **Identifier Resolution**: Mapping citations to \`paper_id\` values
4. **Output Generation**: Structured \`JSONL\` format

### Code Examples

The main processing function looks like this:

\`\`\`python
def process_papers(input_file, output_file):
    with open(input_file, 'r') as f:
        papers = json.load(f)
    
    results = []
    for paper in papers:
        citations = extract_citations(paper['content'])
        results.append({
            'citing_paper': paper['id'],
            'cited_papers': citations
        })
    
    write_jsonl(results, output_file)
\`\`\`

### Technical Details

- Processing speed: ~1000 papers/second
- Memory usage: \`O(n)\` where \`n\` is number of papers
- Output format: Each line contains a \`JSON\` object with \`citing_paper\` and \`cited_papers\` fields

> **Note**: The system handles edge cases like malformed citations and missing metadata gracefully.

### Performance Metrics

| Metric | Value |
|--------|--------|
| Papers processed | 2.3M |
| Citations extracted | 15.7M |
| Processing time | 45 minutes |

This demonstrates the efficiency of the \`citation_extractor\` module in handling large-scale academic datasets.

### Mathematical Formulations

The paper introduces several key mathematical concepts:

#### Attention Mechanism
The Transformer architecture uses multi-head attention where each head computes:

$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$

Where $Q$, $K$, and $V$ are the query, key, and value matrices respectively, and $d_k$ is the dimension of the key vectors.

#### Multi-Head Attention
The multi-head attention mechanism projects the input into $h$ different representation subspaces:

$$\\text{MultiHead}(Q, K, V) = \\text{Concat}(\\text{head}_1, \\ldots, \\text{head}_h)W^O$$

where each head is computed as: $\\text{head}_i = \\text{Attention}(QW_i^Q, KW_i^K, VW_i^V)$

#### Position Encoding
Since the model contains no recurrence, positional information is injected using:

$$PE_{(pos,2i)} = \\sin\\left(\\frac{pos}{10000^{2i/d_{model}}}\\right)$$
$$PE_{(pos,2i+1)} = \\cos\\left(\\frac{pos}{10000^{2i/d_{model}}}\\right)$$

#### Loss Function
The training objective uses label smoothing with parameter $\\epsilon_{ls} = 0.1$:

$$\\mathcal{L} = -\\sum_{i=1}^{|V|} y_i' \\log(p_i)$$

where $y_i' = (1-\\epsilon_{ls})y_i + \\frac{\\epsilon_{ls}}{|V|}$ for the true class and $y_i' = \\frac{\\epsilon_{ls}}{|V|}$ for other classes.

#### Training Convergence
The model's loss typically follows the pattern:

$$L(t) = L_0 \\cdot e^{-\\alpha t} + L_{\\infty}$$

where $L_0$ is the initial loss, $\\alpha$ is the decay rate, and $L_{\\infty}$ is the asymptotic loss.

#### Gradient Computation
The backpropagation through the attention mechanism involves:

$$\\frac{\\partial L}{\\partial Q} = \\frac{\\partial L}{\\partial \\text{Attention}} \\cdot \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right) \\cdot \\frac{V^T}{\\sqrt{d_k}}$$

### Implementation Details

- Multi-Head Attention: Projects queries/keys/values into multiple subspaces (8 heads, $d_k = d_v = 64$) to capture diverse dependencies.
- Scaled Dot-Product Attention: Computes attention weights via the formula above, counteracting gradient issues for large $d_k$.
- Regularization: Residual dropout (0.1–0.3) and label smoothing ($\\epsilon_{ls} = 0.1$).
- Learning Rate: Uses the formula $lr = d_{model}^{-0.5} \\cdot \\min(step^{-0.5}, step \\cdot warmup^{-1.5})$ for scheduling.`;
      
      onTestInsights(testMarkdown);
    }
  };

  return (
    <Card className={cn("shadow-md flex flex-col", maximizedCard === 'pdf' ? 'hidden' : '')}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg sm:text-xl">
          <div className="flex items-center">
            <FileText className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Extracted Insights
          </div>
          <div className="flex items-center space-x-2">
            {insights && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={decreaseTextSize}
                  disabled={textSize <= minTextSize}
                  aria-label="Decrease text size"
                  title="Decrease text size"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={increaseTextSize}
                  disabled={textSize >= maxTextSize}
                  aria-label="Increase text size"
                  title="Increase text size"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            )}
            {isTestingEnabled && onTestInsights && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleTestInsights}
                aria-label="Load test markdown content"
                title="Load test markdown content"
              >
                <TestTube className="h-4 w-4" />
              </Button>
            )}
            {insights && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleSaveInsights}
                aria-label="Save insights as Markdown file"
                title="Save insights as Markdown file"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleMaximize}
              aria-label={maximizedCard === 'insights' ? "Minimize insights" : "Maximize insights"}
            >
              {maximizedCard === 'insights' ? <Minimize className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
            </Button>
          </div>
        </CardTitle>
        {!insights && !isLoading && !isUrlLoading && (
          <CardDescription className="text-xs sm:text-sm">
            Insights from your PDF will appear here.
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 h-0 rounded-md border">
          {insights ? (
            <div 
              className="p-3 sm:p-4 leading-relaxed prose dark:prose-invert max-w-none"
              style={{ fontSize: `${textSize}px` }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  h1: ({ ...props }) => (
                    <h1 className="text-xl sm:text-2xl font-bold my-3 border-b pb-1" {...props} />
                  ),
                  h2: ({ ...props }) => (
                    <h2 className="text-lg sm:text-xl font-semibold my-2" {...props} />
                  ),
                  h3: ({ ...props }) => (
                    <h3 className="text-base sm:text-lg font-semibold my-1" {...props} />
                  ),
                  p: ({ ...props }) => (
                    <p className="mb-2" {...props} />
                  ),
                  ul: ({ ...props }) => (
                    <ul className="list-disc list-inside mb-2 pl-4" {...props} />
                  ),
                  ol: ({ ...props }) => (
                    <ol className="list-decimal list-inside mb-2 pl-4" {...props} />
                  ),
                  li: ({ ...props }) => (
                    <li className="mb-1" {...props} />
                  ),
                  code: ({ 
                    className, 
                    children, 
                    ...props 
                  }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInlineCode = !match && !className?.includes('language-');
                    
                    return isInlineCode ? (
                      <code className="bg-muted px-1 py-0.5 rounded-sm text-xs" {...props}>
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-muted p-2 rounded-md overflow-x-auto my-2 text-xs">
                        <code className={match ? `language-${match[1]}` : ''} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                  blockquote: ({ ...props }) => (
                    <blockquote 
                      className="border-l-4 border-muted-foreground/50 pl-3 italic my-2 text-muted-foreground" 
                      {...props} 
                    />
                  ),
                  table: ({ ...props }) => (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full border-collapse border border-border" {...props} />
                    </div>
                  ),
                  thead: ({ ...props }) => (
                    <thead className="bg-muted/50" {...props} />
                  ),
                  tbody: ({ ...props }) => (
                    <tbody {...props} />
                  ),
                  tr: ({ ...props }) => (
                    <tr className="border-b border-border hover:bg-muted/30" {...props} />
                  ),
                  th: ({ ...props }) => (
                    <th className="border border-border px-3 py-2 text-left font-semibold text-xs sm:text-sm" {...props} />
                  ),
                  td: ({ ...props }) => (
                    <td className="border border-border px-3 py-2 text-xs sm:text-sm" {...props} />
                  ),
                }}
              >
                {insights}
              </ReactMarkdown>
            </div>
          ) : (
            !isLoading && !isUrlLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <ServerCrash className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  No insights to display.<br />
                  Upload a PDF or load from URL, then click "Analyze".
                </p>
              </div>
            )
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
